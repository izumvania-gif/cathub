# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

CatHub is a mobile-first PWA for a household (several people, one cat) to track cat-care chores:
feeding, litter, grooming, parasite treatments, vaccinations, vet visits. Reminders go through a
Telegram bot. The owner and users are in Russia. The UI language is Russian.

**Current state: planning.** There's no code or build tooling yet. The source of truth for scope,
data model, and phases is `docs/PLAN.md`. `docs/REFERENCES.md` holds competitors, OSS, and vet-care
frequency sources. `docs/HOSTING_RU.md` holds the Russia-specific hosting analysis. Update this file's
Commands section once the monorepo scaffold (Phase 0 in the plan) lands.

## Workflow

- Commit and push directly to `main`. The repo owner asked for this, so don't open PRs unless asked.
- Docs and UI copy are written in Russian. Code, identifiers, and commit messages are in English.

## Planned architecture (see docs/PLAN.md §4, §7)

pnpm-workspaces monorepo:
- `packages/core`: the recurrence/scheduling engine. It's pure TypeScript with no I/O and is
  unit-tested with Vitest. **This is the single source of truth for due dates and task status.** The
  web app and the bot both import it. Don't reimplement schedule math anywhere else, including
  PocketBase hooks.
- `apps/web`: React + Vite + TypeScript PWA (Tailwind v4, shadcn/ui, Motion, TanStack Query,
  vite-plugin-pwa, date-fns with `ru` locale).
- `apps/bot`: Node + TypeScript + grammY. Runs a once-a-minute scheduler that calls
  `reminderPlan` from core, sends Telegram reminders with inline "done/snooze/skip" buttons,
  subscribes to `completions` via PocketBase realtime, and edits already-sent messages so
  household members see who did it (prevents double feeding).
- `pocketbase/`: PocketBase backend (auth, SQLite, realtime, files). Schema lives in
  `pb_migrations` and access control in API rules. Every record is scoped to the user's `household`.

Key design decisions:
- **`nextDue` is never stored.** It's derived from `tasks.schedule` + `completions` + now + the
  household timezone. `Schedule` is a tagged union: `daily_slots` | `interval` (anchor `completion`
  = floating, `calendar` = fixed grid, optional `graceDays`) | `once`.
- Store timestamps in UTC and compute in the household's IANA timezone (default `Europe/Moscow`).
- The data model keeps `cat_id` even though the UI supports a single cat.
- Notifications go through a `Notifier` abstraction so a second channel can be added if Telegram
  becomes unreliable in Russia.

## Constraints

- Everything must work for users in Russia without VPN. Self-host fonts and assets, and add no
  runtime dependency on Google Fonts or foreign CDNs. Hosting must be payable with Russian cards
  (see `docs/HOSTING_RU.md`).
- Medical intervals (vaccines, parasite treatments) are defaults only. They must stay user-editable
  and show a "check with your vet / product label" hint.
