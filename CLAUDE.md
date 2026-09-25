# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

CatHub is a mobile-first PWA for a household (several people, one cat) to track cat-care chores:
feeding, litter, grooming, parasite treatments, vaccinations, vet visits. Reminders go through a
Telegram bot. The owner and users are in Russia. The UI language is Russian.

**Current state: Phases 1–5 done** (only manual testing on real phones remains). Working: the schedule engine in `packages/core`, the
PocketBase schema and household/Telegram routes, the web app (login, onboarding, Today, journal,
task list and editor, household settings, `/diag`), and the bot (linking via `/start <token>`,
reminders with done/snooze/skip buttons, `/today`, morning digest, family group chat), and health
(weight chart, health records with protected files, calendar subscription feed), supplies with a
usage forecast, 30-day stats, rotating chores, offline mode, a Telegram Mini App and nightly backups. The source of truth for scope, data model, and phases is
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
pnpm e2e           # end-to-end: real PocketBase + built web app + bot against a Telegram mock (run `pnpm build` first)
pnpm --filter @cathub/e2e exec playwright test --project=bot -g "digest"   # one project / test by name
pnpm --filter @cathub/web icons  # regenerate PWA PNG icons from apps/web/public/icon.svg
docker build -t cathub .         # production image (same as Amvera builds)
```

CI (`.github/workflows/ci.yml`) runs lint, format check, typecheck, unit tests, build, the e2e
suite and a Docker build. Amvera builds and deploys `main` itself.

E2E (`tests/e2e`, Playwright): `support/global-setup.ts` starts PocketBase on :18090 with a temp
data dir (binary from `$PB_BIN` or downloaded via `scripts/pocketbase.sh`), the Telegram Bot API
mock (`support/mock-telegram.mjs`, :18091; tests read calls via `/__calls` and push updates via
`/__inject`), and the built bot with 1 s intervals and `GROUP_QUIET_HOURS=00:00-00:00`. Tests share
one server, so every test creates its own users/household and uses unique chat ids. Bot tests set
the user's quiet hours explicitly so they don't depend on the time of day.

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
  Callback data is `<d|s|z>:<taskId>:<occurrence seconds>`. Routing: a task with an assignee goes
  to that user's private chat; otherwise to the household group chat if linked
  (`households.telegram_group_chat_id`, via `t.me/<bot>?startgroup=<token>`), else to every linked
  member. The morning digest (`users.digest_time`, core's `digestDue`) goes to private chats only. Linking: the web app calls
  `POST /api/cathub/telegram/link` (bot username from `TELEGRAM_BOT_USERNAME` or else the latest
  `diagnostics.bot_username` heartbeat), and the bot consumes the
  token from `telegram_links`.
- Calendar feed: `GET /api/cathub/calendar/{token}.ics` (pb_hooks/calendar.pb.js) checks the secret
  `households.calendar_token`, then proxies to the bot's internal HTTP server
  (`apps/bot/src/calendar.ts`, 127.0.0.1:`ICS_PORT`=8091, PocketBase side `BOT_INTERNAL_URL`),
  which builds the .ics with core's `calendarEvents`/`buildIcs`. Hooks never compute due dates.
- Mini App login: the bot sets a `web_app` menu button (needs an https `APP_URL`). The web app reads
  `#tgWebAppData` on load (`lib/telegram.ts`, no telegram.org SDK) and calls
  `POST /api/cathub/telegram/webapp-auth`, which asks the bot's internal `/webapp-verify` to check
  the HMAC (the bot holds `BOT_TOKEN`) and returns a PocketBase auth for the user with that
  `telegram_chat_id`.
- Fish 🐟 (docs/PLAN.md §6.7): core's `rewardFor` prices a completion from the task's status at
  that moment (weight × 5, ×1.5 on time, 0 for a repeat or a skip). The bot's tick
  (`ReminderService.rewardPending`) stores it in `completions.fish` + `rewarded`; clients can't set
  those fields. Perfect-day bonuses go to `fish_bonuses`. The balance is the `fish_balance` view;
  `pb_hooks/room.pb.js` sells items (prices in `pb_hooks/lib/room.js` must match core's
  `ROOM_CATALOG`, a bot test checks it). The web app adds not-yet-priced marks locally (`lib/fish.ts`).
- Other hooks: `rotation.pb.js` (after a completion the assignee moves to the next person in
  `tasks.rotation`; undone on delete), `backups.pb.js` (backup cron/S3 from `BACKUP_*` env on start),
  `users.pb.js` (default digest time).
- `pocketbase/`: PocketBase backend (auth, SQLite, realtime, files). Schema lives in
  `pb_migrations` and access control in API rules. Every record is scoped to the user's `household`.
  Users can't set `household`/`role` through the API; membership changes go through the custom
  routes in `pb_hooks/household.pb.js` (`POST /api/cathub/household`, `/join`, `/invite`). Hooks run
  each handler in its own JS VM, so shared helpers live in `pb_hooks/lib/*.js` and are `require()`d
  inside handlers. `pb_hooks/static.pb.js` gzips and sets cache headers for the static PWA only:
  never gzip `/api/`, it buffers the realtime SSE stream. `specs/a11y.spec.ts` runs axe on every
  screen in both themes and must stay at zero violations.

Pixel cat (`apps/web/src/cat`): `sprite.ts` rasterizes parametric poses (ellipses, capsule legs,
Bézier tail) with auto-outline; coat patterns are computed per pixel from `look.ts` (stored in
`cats.appearance`). `behavior.ts` is a pure mood → behaviour state machine; `CatScene` draws the
room on a canvas (~12 fps, paused off screen, still pose under reduced motion). `room.ts` holds the
room items and the spots where the cat does things. On Today the mood comes from
`lib/catMood.ts` (fed → hungry → grumpy about litter → restless → sleepy at night → happy →
calm). `/cat-lab` shows everything. `cat.test.ts` checks every frame stays inside the sprite frame.

Web app notes (`apps/web/src`): routing is `wouter` (`App.tsx`), data is TanStack Query
(`lib/queries.ts`) invalidated by PocketBase realtime subscriptions (`useRealtimeSync`), and
`lib/board.ts` runs every task through `evaluate()` from core. `pb.authStore.record` returns a new
object on every access, so `lib/auth.ts` keeps a cached snapshot for `useSyncExternalStore`.
PocketBase dates use a space (`2026-09-25 08:12:00.000Z`); convert with `toIso`/`toPbDate` from
`lib/pb.ts`. Access rules read `@request.auth.household` from the database, so the client only
needs `refreshAuth()` to update its own view of the user. Offline: the query cache is persisted to
localStorage (`cathub.cache`) and completions made without network go to `lib/outbox.ts`
(`cathub.outbox`), are merged into `useBoard` immediately, and flushed by `OfflineBanner`. When
computing "now" for the engine, never use a value older than the newest data (fetched or queued):
the engine ignores completions in the future, which makes fresh marks invisible.

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
