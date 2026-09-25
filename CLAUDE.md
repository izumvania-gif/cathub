# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

CatHub is a mobile-first PWA for a household (several people, one cat) to track cat-care chores:
feeding, litter, grooming, parasite treatments, vaccinations, vet visits. Reminders go through a
Telegram bot. The owner and users are in Russia. The UI language is Russian.

**Current state: Phases 1–2 mostly done.** Working: the schedule engine in `packages/core`, the
PocketBase schema and household/Telegram routes, the web app (login, onboarding, Today, journal,
task list and editor, household settings, `/diag`), and the bot (linking via `/start <token>`,
reminders with done/snooze/skip buttons, `/today`). The source of truth for scope, data model, and phases is
`docs/PLAN.md`. `docs/REFERENCES.md` holds competitors, OSS, and vet-care frequency sources.
`docs/HOSTING_RU.md` holds the Russia-specific hosting analysis. `docs/DEPLOY_AMVERA.md` is the
chosen deployment (Amvera, Moscow region). `docs/DEPLOY_YC.md` is a rejected Yandex Cloud option,
kept as the fallback relay design.

## Commands

pnpm workspaces, Node 22 (`.nvmrc`). Copy `.env.example` to `.env` for local runs.

```bash
pnpm install
pnpm dev:pb        # local PocketBase on :8090 (downloads the version in pocketbase/VERSION into .pocketbase/)
pnpm dev           # Vite dev server (proxies /api and /_ to :8090) + bot via tsx watch
pnpm lint          # ESLint (flat config at the root)
pnpm format:check  # Prettier; `pnpm format` to fix
pnpm typecheck     # tsc --noEmit in every package
pnpm test          # Vitest in every package
pnpm build         # web → apps/web/dist, bot → apps/bot/dist/index.js (esbuild bundle)
pnpm --filter @cathub/core exec vitest run src/schedule.test.ts   # single test file
pnpm --filter @cathub/core exec vitest run -t "parseTimeOfDay"     # single test by name
pnpm --filter @cathub/web icons  # regenerate PWA PNG icons from apps/web/public/icon.svg
docker build -t cathub .         # production image (same as Amvera builds)
```

CI (`.github/workflows/ci.yml`) runs lint, format check, typecheck, test, build and a Docker build.
Amvera builds and deploys `main` itself.

PocketBase schema changes go in `pocketbase/pb_migrations/*.js` (JS migrations, applied
automatically on `serve`). Bump `pocketbase/VERSION` deliberately: PocketBase is pre-1.0.

## Workflow

- Commit and push directly to `main`. The repo owner asked for this, so don't open PRs unless asked.
- Docs and UI copy are written in Russian. Code, identifiers, and commit messages are in English.

## Architecture (see docs/PLAN.md §4, §7)

pnpm-workspaces monorepo:

- `packages/core`: the recurrence/scheduling engine. It's pure TypeScript with no I/O and is
  unit-tested with Vitest. **This is the single source of truth for due dates and task status.** The
  web app and the bot both import it. Don't reimplement schedule math anywhere else, including
  PocketBase hooks.
- `apps/web`: React + Vite + TypeScript PWA (Tailwind v4, shadcn/ui, Motion, TanStack Query,
  vite-plugin-pwa, date-fns with `ru` locale).
- `apps/bot`: Node + TypeScript + grammY. `ReminderService.tick()` (every 30 s) loads all
  households as superuser, asks core's `reminderPlan` which reminder is due, and sends each
  (task, occurrence, stage, chat) once. `reminder_log` has a unique index on that tuple and stores
  the message text. The same tick edits open reminders whose occurrence was handled (in the app or
  another chat) to "✅ Петя, 20:03" — polling, not realtime, since Node has no EventSource.
  Callback data is `<d|s|z>:<taskId>:<occurrence seconds>`. Linking: the web app calls
  `POST /api/cathub/telegram/link` (needs `TELEGRAM_BOT_USERNAME`), and the bot consumes the
  token from `telegram_links`.
- `pocketbase/`: PocketBase backend (auth, SQLite, realtime, files). Schema lives in
  `pb_migrations` and access control in API rules. Every record is scoped to the user's `household`.
  Users can't set `household`/`role` through the API; membership changes go through the custom
  routes in `pb_hooks/household.pb.js` (`POST /api/cathub/household`, `/join`, `/invite`). Hooks run
  each handler in its own JS VM, so shared helpers live in `pb_hooks/lib/*.js` and are `require()`d
  inside handlers.

Web app notes (`apps/web/src`): routing is `wouter` (`App.tsx`), data is TanStack Query
(`lib/queries.ts`) invalidated by PocketBase realtime subscriptions (`useRealtimeSync`), and
`lib/board.ts` runs every task through `evaluate()` from core. `pb.authStore.record` returns a new
object on every access, so `lib/auth.ts` keeps a cached snapshot for `useSyncExternalStore`.
PocketBase dates use a space (`2026-09-25 08:12:00.000Z`); convert with `toIso`/`toPbDate` from
`lib/pb.ts`. Access rules read `@request.auth.household` from the database, so the client only
needs `refreshAuth()` to update its own view of the user.

Deployment (docs/DEPLOY_AMVERA.md): **one Amvera project, one container.** The root `Dockerfile`
builds web + bot, and `deploy/entrypoint.sh` runs `pocketbase serve --http=0.0.0.0:8090
--dir=/data/pb_data` (PWA served from `pb_public`) plus the bot, which reaches PocketBase at `PB_URL`
(default `http://127.0.0.1:8090`). `amvera.yml` must sit at the repo root (Amvera can't read it from
elsewhere). Only `/data` persists. Env vars exist at runtime only, not at build time, so the PWA must
call the API on its own origin and never bake an API URL into the build.

Key design decisions:

- **`nextDue` is never stored.** It's derived from `tasks.schedule` + `completions` + now + the
  household timezone. `Schedule` is a tagged union: `daily_slots` | `interval` (anchor `completion`
  = floating, `calendar` = fixed grid, optional `graceDays`) | `once`.
- Store timestamps in UTC and compute in the household's IANA timezone (default `Europe/Moscow`).
- The data model keeps `cat_id` even though the UI supports a single cat.
- Notifications go through a `Notifier` abstraction so a second channel can be added if Telegram
  becomes unreliable in Russia.

## Constraints

- Servers in Russia often can't reach `api.telegram.org` directly. On Amvera's Moscow region a
  transparent built-in proxy handles it, but it degrades at times. So the bot must:
  - use long polling (webhooks don't reach Moscow) and run as a single instance (a second one gets 409);
  - leave `TELEGRAM_API_ROOT` empty by default and keep it configurable (grammY `client.apiRoot`)
    for a fallback relay;
  - force IPv4 (`https.Agent({ family: 4, keepAlive: true })` via `client.baseFetchConfig`, with
    `compress: true`), and not override DNS, which could bypass the provider's interception;
  - retry `bot.start()`/`getMe` with backoff, never crash on network errors, and mark reminders sent
    in `reminder_log` only after Telegram confirms.

  Telegram is never the only login method. See `docs/PLAN.md` §8.

- Everything must work for users in Russia without VPN. Self-host fonts and assets, and add no
  runtime dependency on Google Fonts or foreign CDNs. Hosting must be payable with Russian cards
  (see `docs/HOSTING_RU.md`).
- Medical intervals (vaccines, parasite treatments) are defaults only. They must stay user-editable
  and show a "check with your vet / product label" hint.
