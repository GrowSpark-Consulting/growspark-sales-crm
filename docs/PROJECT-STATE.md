# Project State — Session Handover

Read this first in any new session, together with `CLAUDE.md` and
`docs/decisions.md`. This file is append-only in its Session Log (§15); every
other section should be kept accurate as reality changes, not just added to.

## 1. Project snapshot

**Sales & CRM** for Grow Spark Consulting: an internal tool for Admin and Staff
users covering the lead-to-deal flow (leads → companies/contacts → deals →
pipeline → activities → dashboard). Per the user, this CRM is **one of three
independent apps being built by different people** — stated directly, not
independently verifiable from this repo. The user's plan is **7 days**: Days
1–5 build, Day 6 testing, Day 7 stabilise and demo (also stated directly; see
§13 for what's known about Day 1's remaining packages and §14 for what isn't
known about Days 2–5).

**Current status (end of 2026-11-19 session)**: Day 1, packages 1.1
(scaffold), 1.1b (hardening), and 1.2 (Prisma schema/migration/seed/tests) are
complete and committed locally. No product features, no auth, no API
endpoints beyond `/health` exist yet. Nothing has been pushed to the remote
this session (see §7 for the exact git state, which has one unresolved detail
worth your attention).

## 2. Hard constraints

- **(a) Grow Spark website repository**: must not be touched, read, or looked
  for. Website integration is **on hold** until this CRM is finished. When
  resumed, it must be purely additive: it must never affect the existing
  website's workflow, Supabase, SMTP, HubSpot, validation, spam protection, or
  visitor behaviour. **This rule was given to me directly in chat at the start
  of package 1.1 but is not currently written into `CLAUDE.md` or
  `docs/decisions.md`** — I'm recording it here so it isn't lost, but whoever
  reads this should consider adding it to `CLAUDE.md` properly.
- **(b) Never push.** Commit locally only, always. No session has run
  `git push`.
- **(c) Never cut**: the essential sales journey, authentication, backend
  authorisation, data integrity, or core relationships — even under time
  pressure in later days.
- **(d) Dummy data only** — no real customer, lead, or company data, ever.

## 3. Working agreement

- One work package per prompt. Inspect existing code before writing similar
  code. Stop at review gates (e.g. package 1.2 had a schema-approval gate
  between Phase A and Phase B).
- Reports use the standard 8-section format (what was built; commands run and
  actual output; tests added; deviations; dependencies added; known gaps;
  questions; next step) — except pure-docs tasks like this one, which use
  whatever short format the user asks for.
- Ask before: adding a dependency, running a destructive command, deleting a
  Docker volume, or running `git reset --hard` (or similar).
- **Process hygiene**: record the PID of anything started (dev servers,
  background scripts); stop it by exact PID with `taskkill /PID <pid> /T /F`
  (not a broad pattern match — `pkill -f` style matching has failed silently
  before, see §10); before finishing, prove ports 3000 and 4000 are clear via
  `netstat -ano | findstr :3000` (and `:4000`).
- **Prisma consent gate**: Prisma 7's CLI itself detects when it's invoked by
  an AI agent and refuses destructive commands (`migrate reset`, likely others
  in the same family) without the human's explicit, in-the-moment consent —
  this is Prisma's own built-in safety check, not something this project
  configured. The human decides, every time; a prior message earlier in a
  conversation does not count as consent for a later invocation. The only
  databases this should ever be used on are `crm_test` and `crm_dev` (never
  anything else). See §10 and `docs/decisions.md` D15 for what happened the
  one time this was invoked (one-time manual consent, verification only — not
  wired into any automated script).

## 4. Environment

- Windows 10, PowerShell used for most commands this session (the user's own
  prompts reference `cmd`/PowerShell interchangeably; verify which the user
  has open before assuming syntax).
- Node **v22.20.0**, pnpm **11.10.0**, Docker **29.8.2** (Docker Desktop) —
  confirmed via `node -v` / `pnpm -v` / `docker --version` this session.
- Ports: web **3000**, API **4000**, Postgres **127.0.0.1:5433** (bound to
  localhost only, not `0.0.0.0`). Databases: **crm_dev**, **crm_test**, in one
  Postgres 17 container (`growspark-sales-crm-postgres`).

### Starting everything from scratch

Commands taken verbatim from the real root `package.json` (verified this
session):

```powershell
pnpm install                                    # also runs "prepare": builds
                                                 # packages/shared + prisma generate
copy apps\api\.env.example apps\api\.env        # fill in real values; see note below
copy apps\web\.env.example apps\web\.env
pnpm db:up                                       # starts Postgres only
pnpm db:migrate                                  # applies migrations to DATABASE_URL (crm_dev)
pnpm db:seed                                     # idempotent — safe to re-run
pnpm dev                                         # web:3000, api:4000, shared tsc --watch
```

`apps/api/.env.example` also needs `SEED_ADMIN_PASSWORD` /
`SEED_STAFF_PASSWORD` filled in (dev-only values are fine) before `db:seed`
will run — the seed has no password default in code.

### Troubleshooting

- **Port already in use**: see the "Port already in use (Windows)" section in
  the root `README.md` — `netstat -ano | findstr :3000`, inspect the PID
  before touching it, `taskkill /PID <pid> /T /F`.
- **Docker not running**: `docker info` fails fast with a clear connection
  error; start Docker Desktop and retry `pnpm db:up`.
- **PowerShell execution policy**: not hit this session (no `.ps1` scripts are
  used — all scripts are `pnpm`/`tsx`/node), but if it ever blocks something,
  that's a machine-level policy, not a repo config issue.
- **git pager**: commands in this session were run non-interactively; if a
  pager ever hangs a command, add `--no-pager` or pipe through `cat`.

## 5. Repository map

```
apps/web/              Next.js 16 App Router app (port 3000)
  app/                  layout.tsx, page.tsx (client component, TanStack Query
                        health check via /api/* proxy), providers.tsx, globals.css
  components/ui/        shadcn Button (only component added)
  next.config.ts         proxies /api/:path* to API_INTERNAL_URL; transpiles
                        @growspark/shared

apps/api/               Express 5 app (port 4000)
  src/
    app.ts              Express app factory (testable without listening)
    index.ts            entry point — calls app.ts, listens
    env.ts              Zod-validated env config, fails fast
    logger.ts            pino logger
    db/pool.ts           raw pg Pool, used only by the /health/db check
    db/prisma.ts         PrismaClient singleton, built with @prisma/adapter-pg
    middleware/          request-id.ts, error-handler.ts
    routes/health.ts     GET /health, /health/db, mirrored at /api/v1/*
    types/express.d.ts   Request.id / Request.log augmentation
  prisma/
    schema.prisma         full P0 data model (18 models, 8 enums)
    prisma.config.ts      (actually at apps/api/prisma.config.ts, not under prisma/)
    seed.ts / seed-lib.ts CLI entry + reusable runSeed(), idempotent
    SCHEMA-SUMMARY.md     factual per-model column/index/FK/CHECK reference —
                        read this instead of schema.prisma when you just need
                        to know what a table looks like
    migrations/           one migration, 20261118202744_init, NOT a Phase-A
                        artifact — see §7
  scripts/
    db-reset.ts           safety-checked wrapper for `prisma migrate reset`
                        (refuses unless host is localhost/127.0.0.1 and db
                        name ends _dev/_test)
    db-verify-fresh.ts    manual, human-run check that crm_test migrates
                        cleanly from zero — NOT part of `pnpm test`
  tests/
    health.test.ts, health-db.test.ts   pre-existing health-check tests
    schema/               11 files proving the DATABASE itself rejects bad
                        data (not application-level validation) — helpers.ts
                        has the shared setup/cleanup/assertion helpers

packages/shared/        Zod schemas + enums, consumed as a compiled package
  src/roles.ts           ROLES enum
  src/health.ts          health response Zod schema
  src/loss-reasons.ts    LOSS_REASONS constant + Zod enum (package 1.2)

docker-compose.yml       postgres:17-alpine only; project name
                        growspark-sales-crm, named volume, 127.0.0.1:5433 only
docker/init-db.sh        creates crm_test (crm_dev comes from POSTGRES_DB)

docs/
  decisions.md           D1, D2, D4, D6–D15 (see §9 — note the gaps)
  PROJECT-STATE.md        this file
```

## 6. Stack and exact pinned versions

Read directly from the three `package.json` files this session (all workspace
packages pin exact versions, no `^`/`~` ranges, per `CLAUDE.md`).

| Area | Package | Version | Note |
|---|---|---|---|
| Root/all | `typescript` | **6.0.3** | Pinned below npm "latest" (**7.0.2**, the new Go-native rewrite) — `typescript-eslint@8.73.0`'s peer dependency caps support at `<6.1.0`. Revisit once typescript-eslint supports TS 7. |
| Root/all | `eslint` | 10.15.0 | |
| apps/api | `prisma`, `@prisma/client`, `@prisma/adapter-pg` | **7.10.1** | Pinned below npm "latest" for the `prisma` CLI package specifically (**8.0.0-rc.34** — a pre-release; `@prisma/client`'s own "latest" tag is correctly 7.10.1, so this is a real tag mismatch between the two packages, not a mistake on our part). |
| apps/api | `express` | 5.3.0 | |
| apps/api | `@node-rs/argon2` | 2.2.2 | Password hashing, default algorithm Argon2id |
| apps/api | `pg` | 8.23.1 | |
| apps/api | `vitest` / `supertest` | 5.1.1 / 7.3.2 | |
| apps/web | `next` | 16.4.6 | `next lint` was removed in 16.0.0; ESLint runs directly |
| apps/web | `react` / `react-dom` | 19.3.1 | |
| apps/web | `tailwindcss` | 4.3.5 | |
| apps/web | `shadcn` (CLI, dev) | 4.23.0 | |
| apps/web | `cn`, `radix-ui`, `class-variance-authority` | 0.5.2, 1.8.1, 0.7.1 | What the installed shadcn CLI actually generates now — verified live, not assumed; see `decisions.md` D11 |
| packages/shared | `zod` | 4.6.7 | |

## 7. What has been built, package by package

All commits are **local only**. `git branch -vv` shows local `main` **9
commits ahead of the `origin/main` tracking ref**; that ref already matches
the exact tip of package 1.1b (`5f3ef1d`). **Unverified**: how `origin/main`'s
local tracking ref came to include those 8 commits — no session ever ran
`git push`, so either the user pushed them independently outside these
sessions, or something else updated the local ref (e.g. an IDE auto-fetch).
Worth asking the user directly rather than assuming either way.

- **Package 1.1 — scaffold** (`00269d5` … `e3b5c78`, 6 commits): pnpm
  workspace root tooling; Postgres 17 docker-compose; `packages/shared`
  (ROLES, health schema); `apps/api` (Express 5, health endpoints); `apps/web`
  (Next.js 16, Tailwind v4, shadcn Button); decisions log + CLAUDE.md +
  README.
- **Package 1.1b — verification & hardening** (`b6a60e8`, `5f3ef1d`, 2
  commits): fixed a stale-`.tsbuildinfo` bug that could let `packages/shared`
  silently fail to rebuild; verified the `cn`/`radix-ui` dependencies are
  genuinely what shadcn's CLI generates; added Windows process-hygiene
  guidance to the README.
- **Package 1.2 — Prisma schema, migration, seed** (`6d89974` … `107300d`,
  9 commits): full P0 schema (18 models), one migration (schema-approved with
  amendments before being applied), idempotent seed, 17 new tests proving the
  database rejects bad data. Full detail in `docs/decisions.md` D13–D15 and
  §8 below.

## 8. Database

- **Migrations applied via** `prisma migrate deploy` (root: `pnpm db:migrate`,
  reads `DATABASE_URL`). The one migration so far is
  `20261118202744_init` — note this is **not** what Phase A originally
  generated: an earlier unapplied folder (`20261118201529_init`) was deleted
  and regenerated after schema-approval amendments, so the timestamp in the
  folder name does not reflect package 1.2's actual start time.
- **Table list, columns, indexes, FKs, CHECKs**: see
  `apps/api/prisma/SCHEMA-SUMMARY.md` (479 lines) — don't re-derive this from
  `schema.prisma` by hand, it's already written out per-model.
- **Conventions** (all verified in the actual schema/migration SQL this
  session, not assumed):
  - Every `id` is `uuid`, generated by **Prisma Client** (`uuid(7)`), **not**
    the database — confirmed by the migration SQL having no `DEFAULT` on any
    `id` column. Same for `updated_at` (`@updatedAt`) — also client-supplied,
    no DB trigger or default. Any raw SQL insert/update must supply both
    itself.
  - `organization_id` is a NOT NULL column + FK on every table except
    `organizations` itself. The database does **not** enforce that related
    rows share an organisation (no composite FKs) — that's a service-layer
    responsibility, not yet built (`decisions.md` D13).
  - `onDelete: Restrict` on every foreign key — nothing is ever hard-deleted;
    business records get an `archived_at` instead.
  - 16 CHECK constraints and several partial indexes exist only as
    hand-written SQL inside the migration file (Prisma's schema language
    can't express either) — all documented in the migration file's own header
    comment and in `SCHEMA-SUMMARY.md`.
- **What the seed creates** (`apps/api/prisma/seed.ts` /
  `apps/api/prisma/seed-lib.ts`, idempotent — safe to run any number of
  times, refuses when `NODE_ENV=production`):
  - Organization "Grow Spark Consulting" (Asia/Kolkata, INR) — found-or-
    created by name.
  - Two users: `admin@growspark.test` (Admin) and `staff@growspark.test`
    (Staff) — passwords come **only** from the `SEED_ADMIN_PASSWORD` /
    `SEED_STAFF_PASSWORD` env vars, no default anywhere in code.
  - 7 lead sources, 1 default pipeline ("Sales Pipeline") with 6 stages.
- **Current state of both databases** (checked via `psql` this session):
  both `crm_dev` and `crm_test` have the one migration applied and the full
  seed data present (1 org / 2 users / 7 sources / 1 pipeline / 6 stages; 0
  leads/companies/deals — nothing beyond the seed has ever been created).
  `crm_test` additionally carries whatever the last test run left (the schema
  tests clean up their own rows; the seed data is deliberately left in place
  to prove idempotency).

## 9. Decisions index

`docs/decisions.md` has **its own numbering starting at D1**; the user's
separate planning roadmap (not in this repo) uses different decision IDs —
don't confuse the two when discussing "D-numbers" with the user.
**Note the gaps**: D3 and D5 do not exist in this file — they were never
assigned here (the original brief started numbering at D1, D2, D4, D6,
skipping D3/D5, presumably reserved in the user's own roadmap).

- D1 — pnpm monorepo layout (apps/web, apps/api, packages/shared)
- D2 — Auth deferred to a later package; nothing built for it yet
- D4 — Single currency: INR
- D6 — Organisation timezone: Asia/Kolkata
- D7 — TypeScript pinned to 6.0.3, not npm "latest" (7.0.2)
- D8 — ESLint 10 flat config; `next lint` doesn't exist in Next 16
- D9 — `packages/shared` ships compiled output, not raw TS source (amended by D12)
- D10 — pnpm 11 `allowBuilds` (replaces `onlyBuiltDependencies`); what got approved and why
- D11 — `cn`/`radix-ui` dependency verification (shadcn CLI really does generate these)
- D12 — Hardened `packages/shared`'s build against a stale-cache failure mode
- D13 — Same-organisation integrity is service-level, not a composite FK
- D14 — Schema-approval amendments (indexes/uniques/CHECKs) applied before Phase B
- D15 — Package 1.2 policy summary: lead CHECK, loss reasons, snake_case, enum policy, normalised columns, UUID choice, seed rules, Prisma error codes (P2039/P2002/P2003), why `migrate reset` stays manual

## 10. Gotchas and lessons learned

- **pnpm 11's `allowBuilds`** replaced `onlyBuiltDependencies` entirely — a
  bare `onlyBuiltDependencies: []` does nothing in pnpm 11. Approve one
  package at a time with a reason (`esbuild`, `prisma`, `@prisma/engines` so
  far) — never a blanket allow-all.
- **Stale `.tsbuildinfo` can make a build silently no-op.** `composite: true`
  implies an incremental cache; if `dist` is deleted but the cache survives,
  `tsc` believes `dist` is current and emits nothing. Fixed by setting
  `incremental: false` on `packages/shared`'s build.
- **`packages/shared` must be built before every** `typecheck`/`lint`/
  `test`/`build`/`dev` run, not just once — pnpm's script-name topological
  ordering doesn't help scripts that don't build shared themselves. Root
  scripts now do this unconditionally, plus a `prepare` hook as backup.
- **Leftover dev processes are easy to create, hard to kill correctly.**
  `pkill -f` pattern matching has failed silently. `taskkill /PID <pid> /T
  /F` by exact, verified PID is reliable on Windows. A tool's own "stopped"
  message isn't proof the OS process died — verify with `tasklist`/`netstat`.
- **Next.js 16 removed `next lint`** (call `eslint .` directly); **Prisma 7
  removed auto-seeding** on `migrate dev`/`reset` (seeding is explicit-only).
- **shadcn's CLI changed significantly** — `shadcn init` now wants an
  interactive prompt or a web-UI preset code; `lib/utils.ts` + `clsx` +
  `tailwind-merge` is legacy. Verify what the *installed* version actually
  generates (`shadcn add <x> --view` is a safe dry-run) rather than trusting
  memory.
- **The `cn` npm package has a strange history** (abandoned 2013 joke
  package, taken over by shadcn-ui in 2026) — looks suspicious, is
  legitimate; verified via downloads/publish history/CLI behaviour first.
- **Prisma 7 + driver adapters uses different error codes than classic
  Prisma docs**: CHECK violations are `P2039`, not `P2004`. Unique (`P2002`)
  and FK/Restrict (`P2003`) are unchanged. Verified empirically — D15.
- **`process.loadEnvFile` does not override an already-set env var** —
  confirmed empirically; this is how migrations get applied to `crm_test`
  instead of `crm_dev` despite `.env` defaulting to `crm_dev`.
- **Files outside `tsconfig.json`'s `include: ["src"]` aren't type-checked**
  by `tsc --noEmit`, though they run fine via `tsx`/`vitest`: affects
  `apps/api/scripts/*.ts`, `prisma/seed*.ts`, everything under `tests/`.
  ESLint still covers them. Known, not fixed.
- **Prisma 7's CLI refuses certain commands when it detects an AI agent**
  invoking it, demanding fresh human consent every time — §3, D15.

## 11. Testing

- `pnpm test` (root) runs `packages/shared` (no tests yet), `apps/web` (no
  tests yet), and `apps/api` (`vitest run`) — 12 test files, 20 tests, all
  passing as of the last run this session.
- `apps/api/tests/schema/helpers.ts` provides `createTestOrganization`,
  `createTestUser`/`LeadSource`/`Company`/`Contact`/`Pipeline`/`Deal`,
  `cleanupOrganization` (deletes a test org's rows in FK-safe,
  children-first order, since everything is `onDelete: Restrict`), and
  `expectRejection(promise, code, constraintNameFragment)` for asserting a
  specific Prisma error code *and* that the right constraint fired.
- `apps/api/vitest.config.ts` sets `fileParallelism: false` — the schema
  tests share one database (`crm_test`, via `TEST_DATABASE_URL`) and must not
  run concurrently.
- **`db:verify-fresh` is manual and intentionally never part of `pnpm test`**
  — it drops and recreates `crm_test` from zero, and Prisma's own CLI refuses
  to run that without fresh human consent each time anyway. Run it yourself
  before a release: `pnpm db:verify-fresh`.
- **Known gaps**: no tests in `apps/web` or `packages/shared` yet (nothing to
  test yet — no components/logic beyond scaffolding). No API endpoint tests
  beyond `/health` (no real endpoints exist yet). Test files aren't
  type-checked by `tsc` (see §10).

## 12. Conventions every future module must follow

- Service functions take a context `{ userId, orgId, role }` — never read
  these off a raw request object inside a service.
- Every database query is scoped by `organizationId` taken from that context;
  a record belonging to a different organisation must look like a 404, not a
  403 (don't leak existence).
- Every route declares a required permission explicitly.
- Multi-table writes happen inside one transaction, with the audit row
  written inside that same transaction (not after, not best-effort).
- `packages/shared`'s Zod schemas are the single source of validation — don't
  re-declare the same shape in `apps/api` or `apps/web`.
- Error responses follow the shape already established in
  `apps/api/src/middleware/error-handler.ts`:
  `{ error: { code, message, details?, requestId } }`.
- API routes live under `/api/v1/*` (already true for `/health`; follow the
  same prefix for every real endpoint).

## 13. What's next

From the user's planning roadmap (stated directly, not yet detailed in this
repo — may be refined):

- **1.3 — API core**: sessions, auth, permission map, rate limiting.
- **1.4 — Users module**: the "last Admin" rule (can't demote/deactivate the
  only remaining Admin), audit writer, tests.
- **1.5 — Web shell**: login page, auth guard, Users page.

## 14. Open questions and unverified items

- How `origin/main`'s local tracking ref came to include the first 8 commits
  without any session running `git push` (§7) — ask the user directly.
- The exact plan for Days 2–5 — the user told me the 7-day shape (build/test/
  stabilise) but not what each of Days 2–5 covers; don't invent content for
  them.
- Whether the user wants the website-repo constraint (§2a) formally added to
  `CLAUDE.md` — it's currently only in this file and in chat history.
- `README.md` is stale in two places (still says "package 1.1: scaffolding
  only" and "No database migrations yet") — not fixed this session since the
  task was docs-only for `PROJECT-STATE.md`/`CLAUDE.md` specifically; flagging
  so it doesn't get forgotten.

## 15. Session log

**Append-only.** At the end of every session, add a new dated entry below —
do not edit or delete earlier entries. If reality changed (new packages
built, decisions revised, gotchas found), update the sections above too; this
log just records that a session happened and what it covered.

- **2026-11-19** — Packages 1.1, 1.1b, and 1.2 (Phases A & B) completed and
  committed locally (17 commits total, none pushed). Final test count: 20
  tests passing in `apps/api` (12 files). Nothing left uncommitted — working
  tree was clean before this handover file was written. Created this file and
  added start/end-of-session rules to `CLAUDE.md`.
