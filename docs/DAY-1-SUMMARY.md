# Day 1 Summary — Sales & CRM

Written at the end of Day 1 (2026-11-19) for anyone who wants a plain read of
what exists and how it was checked, without digging through `decisions.md`'s
full technical log. For the *next* session's starting point, read
`docs/NEXT-SESSION-START.md` instead — this file is a look back, not a plan
forward.

## What was built, package by package

- **1.1 — scaffold**: the pnpm workspace itself (`apps/web`, `apps/api`,
  `packages/shared`), Postgres 17 in Docker, Express health endpoints, a
  bare Next.js app with one shadcn Button, the decisions log and `CLAUDE.md`.
- **1.1b — hardening**: fixed a stale-build-cache bug in `packages/shared`
  before it could bite anyone; confirmed the UI dependencies shadcn's CLI
  pulls in are genuinely what it generates, not guesses.
- **1.2 — database schema**: the full first-pass data model (18 tables, 8
  enums) — organisations, users, leads, companies, contacts, deals, a sales
  pipeline with stages, activities, audit events — one reviewed-and-amended
  migration, an idempotent seed script, and tests proving the *database
  itself* rejects bad data (not just the application layer).
- **1.2c — housekeeping**: widened what gets type-checked, refreshed a
  stale README, wrote the website-repo rule into `CLAUDE.md` so it's not
  only in chat history, and built two test helpers ahead of needing them.
- **1.3 / 1.3b — authentication and permissions**: real server-side
  sessions (not JWTs), password hashing with a timing-attack defence, the
  full Admin/Staff permission map, a route registry that a test audits
  against the live server so no route can quietly skip its permission
  check, login rate limiting, and the login/logout/me/change-password
  endpoints. 1.3b fixed two real problems found before sign-off: the rate
  limiter's weakness against shared IPs, and a Windows-specific bug that
  made the dev server's startup script hang.
- **1.4 — user management**: full CRUD for users, the rule that the
  organisation can never be left with zero active Admins (safe even under
  concurrent requests), and an audit trail that records who changed what
  and when, with before/after values but never a password.
- **1.5 — the actual web app**: a login page, a sidebar + top bar shell, a
  Users page with search/filter/pagination and dialogs for every action
  (create, edit, deactivate, reactivate, reset password), a 403 page, a 404
  page. This is where the browser UI for everything 1.3/1.4 built first
  appeared.
- **1.6 — the real design**: the whole app restyled to the Grow Spark
  Workspace design system — proper colours, fonts, spacing, a dark sidebar
  with a product chip, light/dark/system theming, and shared formatters for
  Indian-currency and date/time display.
- **1.7 — three polish fixes**: a nicer search box (icon instead of a
  button, a clear button), real handling for a session that expires while
  someone is using the app (not just on refresh), and a fix for a Next.js
  dev-only console notice.

## How it was verified

**Automated** — every package ran `pnpm typecheck && pnpm lint && pnpm test
&& pnpm build` from a clean state before being committed. Test count grew
through the day: 20 → 90 → 92 → 124 (`apps/api`, where it stayed through
1.5) → 136 → **140** (124 `apps/api` + 16 `apps/web`) by the end of 1.7.
`apps/api`'s 124 tests include real database-level checks (not mocked),
real concurrency tests for the last-Admin rule, and a route-registry audit
that proves every live route actually declares its permission. `apps/web`'s
16 are pure-logic unit tests (currency/date formatting, the session-expiry
401 listener) — no browser-driving tests exist yet (see
`docs/NEXT-SESSION-START.md`'s open items).

**Manual** — the user reports having completed a manual browser
click-through on 2026-11-19. This session has no independent record of
which specific checks passed or what, if anything, was found during that
pass — `docs/MANUAL-TEST-DAY1.md` is the checklist that click-through was
presumably run against, but its boxes aren't marked in the repo. If
anything surfaced during it that isn't already in
`docs/NEXT-SESSION-START.md`'s open items, that's worth adding explicitly
rather than assuming it's covered.

Separately, every session that built UI also did what verification it
could **without** a browser (no browser-automation tool is available in
this environment): `curl` against the real dev server to prove pages
render, status codes are right, and specific fixes (like a hydration-
warning suppression) actually reach the served HTML. That's real evidence
the server-rendered side works — it is not a substitute for watching a
real browser render and react to clicks, which is what the manual
checklist is for.

## Bugs found and fixed during Day 1

- **D21 (1.3b)**: the login rate limiter was keyed by IP, but Next's proxy
  never forwarded the real client IP — a shared IP (office NAT, etc.) could
  starve other users' login attempts. Replaced with a global flood ceiling
  instead of fixing the per-IP key (real per-IP limiting needs a
  deployment-level decision about trusted proxies, still open).
- **The `pnpm dev` startup race (1.3b)**: `pnpm -r --parallel dev` silently
  broke `apps/api`'s file-watcher on this machine, with zero error output.
  Root-caused to pnpm's own parallel scheduler, not a timing issue;
  replaced with a small orchestrator script.
- **D25 (1.4, found on review)**: editing a user's name *and* role in one
  request only recorded the role's before/after values in the audit log,
  not the name's. Fixed before 1.5 started, with a test added.
- **Missing `lucide-react` dependency (1.5)**: the shadcn CLI generated
  four components that import icons from this package without actually
  installing it — only caught because `tsc` immediately complained.
- **A blank `Suspense` fallback was a real blank page (1.5)**: `/login`'s
  form was wrapped in `<Suspense fallback={null}>`; under this app's
  caching mode, that `null` meant the entire login form was missing from
  the page until the browser finished loading React — found via `curl`,
  not assumed, then fixed with a real loading-skeleton fallback.
- **The reported hydration-mismatch error (1.6)**: `next-themes` writes
  theme attributes onto `<html>` after the page loads, which didn't match
  what the server had rendered. Fixed with React's own
  `suppressHydrationWarning` escape hatch for exactly this situation.
- **A hard-coded `text-white` and a hard-coded `bg-black/50` (1.6)**: found
  during a deliberate sweep for any colour not coming from the design
  system's tokens — one in the danger-button style, one in every dialog's
  background overlay. Both replaced with the correct tokens.

## How to run the app and log in

You need: Node 22+, pnpm, and Docker Desktop running.

1. **Install and prepare**, from the repo root:
   ```
   pnpm install
   ```
   This also builds the shared package and generates the database client.

2. **Set up your environment files** — copy the two example files and fill
   them in (dev-only placeholder values are already in the examples; see
   `docs/PROJECT-STATE.md` §4 for exactly which variable names exist — this
   file deliberately doesn't repeat real values):
   ```
   copy apps\api\.env.example apps\api\.env
   copy apps\web\.env.example apps\web\.env
   ```
   You must fill in `SEED_ADMIN_PASSWORD` and `SEED_STAFF_PASSWORD` in
   `apps/api/.env` yourself — there is no built-in default, by design.

3. **Start the database**:
   ```
   pnpm db:up
   ```

4. **Apply the schema and load the demo data**:
   ```
   pnpm db:migrate
   pnpm db:seed
   ```
   The seed is safe to run more than once — it won't duplicate anything.

5. **Start everything**:
   ```
   pnpm dev
   ```
   This starts the web app on `http://localhost:3000` and the API on
   `http://localhost:4000`, plus a watcher for the shared package.

6. **Log in**: open `http://localhost:3000`, which redirects you to
   `/login`. Sign in as either seeded account:
   - `admin@growspark.test` — sees everything, including the Users page.
   - `staff@growspark.test` — sees the Home page only; Users is hidden and
     blocked even by direct URL.

   Both accounts' passwords are whatever you set `SEED_ADMIN_PASSWORD` /
   `SEED_STAFF_PASSWORD` to in step 2 — check that file if you forget.

7. **When you're done**, stop `pnpm dev` (Ctrl+C), and optionally
   `pnpm db:down` to stop the database container too.
