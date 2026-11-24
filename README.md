# Grow Spark Sales & CRM

An internal Sales & CRM tool for Grow Spark Consulting, covering the
sales journey end to end: a lead comes in (manually entered, or from the
website's contact forms), gets qualified, converts into a company and a
contact, becomes a deal, moves through a pipeline, and is tracked to Won
or Lost — with tasks, calls, meetings, notes, a daily "Today" workspace,
and a dashboard along the way.

Two roles: **Admin** (everything, plus user management, the audit log, and
API keys) and **Staff** (the full sales workflow — leads, companies,
contacts, deals, activities, the dashboard, CSV export — everything except
user administration and settings).

This is a single-organisation deployment today, built with future
multi-tenancy and integration in mind (every record is organisation-scoped
from the start).

## What's built so far

| Area | Status |
| --- | --- |
| Auth, sessions, roles, user management, audit log (backend) | Done |
| Companies, Contacts | Done |
| Leads — manual entry, duplicate detection, status workflow | Done |
| Lead conversion (lead → company/contact/deal, one transaction) | Done |
| Deals, pipeline (Kanban + list), Won/Lost | Done |
| Activities (tasks/calls/meetings/notes), timelines, Today workspace | Done |
| Dashboard (KPIs, charts, All/Mine, date range) | Done |
| Website intake API, API keys, Enquiries inbox | Done |
| CSV export (Leads, Companies, Contacts, Deals) | Done |
| Docker: one-command full stack for a reviewer | Done |
| Audit log (Admin-only page: filter, paginate, actor/action/entity/date) | Done |
| Quotations (line items, GST, Draft → Sent → Accepted/Rejected/Expired, duplicate, PDF download) | Done |

Not built yet (see `docs/decisions.md` and the project state docs for the
full P0/P1/P2 breakdown): in-app notifications and a predefined reports page
(both in progress, Day 5c), a product/service catalogue and a CGST/SGST/IGST
split for quotations (future items, D87), global search, self-service
password reset, and everything explicitly scoped to P1/P2 in the roadmap.

## Stack

- **apps/web** — Next.js 16 (App Router), React 19, TypeScript, Tailwind
  CSS v4, shadcn/ui, TanStack Query, React Hook Form + Zod, `@dnd-kit/core`
  (pipeline drag-and-drop), Recharts (dashboard).
- **apps/api** — Express 5, TypeScript (ESM), Zod, pino, helmet,
  `express-rate-limit`, `@node-rs/argon2` (password hashing).
- **packages/shared** — Zod schemas, enums, and the permission map, shared
  by both apps.
- **Database** — PostgreSQL 17, Prisma 7 with the `@prisma/adapter-pg`
  driver adapter. Sessions are our own server-side opaque tokens (hashed in
  the database), not JWTs — see `docs/decisions.md` D2 for why.
- Pinned, exact dependency versions throughout (no `^`/`~` ranges) — see
  `docs/decisions.md` for the reasoning behind any non-obvious choice.

## Two ways to run this

### A — Native dev (what you'd use to actually work on the code)

Only PostgreSQL runs in Docker; both apps run directly on your machine with
hot reload.

```powershell
# 1. Install dependencies (also builds packages/shared and runs `prisma generate`)
pnpm install

# 2. Copy env files and fill in values (dev-only credentials are fine locally).
#    apps/api/.env additionally needs SEED_ADMIN_PASSWORD and SEED_STAFF_PASSWORD
#    filled in by hand — there is no default in code.
copy apps\api\.env.example apps\api\.env
copy apps\web\.env.example apps\web\.env

# 3. Start Postgres (creates crm_dev, crm_test, and crm_docker in one container)
pnpm db:up

# 4. Apply migrations and seed demo data (both idempotent — safe to re-run)
pnpm db:migrate
pnpm db:seed

# 5. Run both apps
pnpm dev
```

- Web: http://localhost:3000 — Admin: `admin@growspark.test`, Staff:
  `staff@growspark.test`, both with whatever password you put in
  `apps/api/.env`.
- API: http://localhost:4000/health, http://localhost:4000/health/db

### B — Docker, the whole stack, one command (what a reviewer would use)

Builds both apps from their own Dockerfiles and runs the complete stack —
Postgres, API, web — with **one command**, against its **own, separate
database** (`crm_docker`) that can never read, write, or reseed your native
setup's data. A fixed, documented demo login is seeded automatically, every
time the API container starts, so there is nothing else to configure.

```powershell
docker compose --profile full up --build -d
```

- Web: **http://localhost:3100**
- API: **http://localhost:4100**
- Demo login — **Admin**: `admin@growspark.test` / `dev-only-admin-password`.
  **Staff**: `staff@growspark.test` / `dev-only-staff-password`. (Same
  placeholder values as `apps/api/.env.example` — not secret, not real,
  fine to publish.)

**Different ports on purpose** (3100/4100, not 3000/4000): this profile is
designed to run *at the same time* as native dev mode (A, above) without
either one silently stealing the other's traffic. Earlier in this
project's own history that collision happened for real — Windows let both
a container's `127.0.0.1:3000` mapping and a native process's `0.0.0.0:3000`
bind at once, and quietly routed browser requests to the *native* server
instead of erroring, which looked exactly like a data-isolation bug until
it was traced back to two servers sharing a port. See `docs/decisions.md`
D80 for the full story.

Stop it with `docker compose --profile full down` (this does **not** touch
the native-dev Postgres volume or any of its databases — only the `api`/
`web` containers and their own images are affected; `crm_dev`/`crm_test`
are a separate concern entirely from `crm_docker`).

Optional extras, once the stack is up:

```powershell
# Richer fictional demo data (companies, contacts, leads, deals, activities)
docker compose --profile full exec api pnpm db:seed:sample -- --confirm

# Confirm no real .env file could ever leak into a rebuilt image
pnpm docker:check-env-leak
```

**What "full" means here, honestly**: this is a demo/reviewer convenience,
not a production deployment artefact. Both images are single-stage and keep
the whole workspace (including devDependencies) on disk — simple and
reliable to build, not optimised for image size. See `docs/decisions.md`
D77 for the tradeoff.

## Other scripts

| Script | What it does |
| --- | --- |
| `pnpm db:up` / `pnpm db:down` / `pnpm db:logs` | Manage the Postgres container (native dev only) |
| `pnpm db:migrate` | Apply migrations to `crm_dev` |
| `pnpm db:seed` | Idempotent seed: organisation, Admin + Staff, lead sources, pipeline |
| `pnpm db:seed:sample` | Richer fictional demo data (companies/contacts/leads/deals/activities) |
| `pnpm db:reset` | Safety-checked wrapper for `prisma migrate reset` (refuses non-local/non-`_dev`/`_test` targets) |
| `pnpm db:verify-fresh` | Confirms `crm_test` migrates cleanly from zero |
| `pnpm build` / `pnpm typecheck` / `pnpm lint` / `pnpm test` | The usual, across the whole workspace |
| `pnpm docker:check-env-leak` | Confirms no real `.env`-style file would be copied into a Docker image |
| `docker compose --profile full up --build -d` | The whole stack, one command, port 3100/4100 (see above) |
| `docker compose --profile full exec api pnpm db:seed:sample -- --confirm` | Optional richer demo data for the Docker stack |
| `docker compose --profile full down` | Stop the Docker stack (never touches native dev's database) |

## Project structure

```
apps/
  api/            Express 5 API (port 4000 native / 4100 in Docker)
    prisma/       schema.prisma, migrations/, seed.ts — see SCHEMA-SUMMARY.md
    src/
      modules/    one folder per feature: auth, users, leads, companies,
                  contacts, deals, pipeline, activities, workspace (Today/
                  dashboard), api-keys, intake, enquiries, audit, lead-sources
      lib/        scoped(), permissions, duplicate detection, rate limits,
                  CSV writer, session handling, database config guards
      middleware/ session, CSRF/Origin check, validation, error handling
    tests/        Vitest + Supertest against a real test database (crm_test)
  web/            Next.js App Router app (port 3000 native / 3100 in Docker)
    app/          routes, grouped under (protected) behind one auth layout
    components/   one folder per feature, plus a shared ui/ (shadcn-based)
    hooks/        one TanStack Query hook module per resource
packages/
  shared/         Zod schemas, enums, the permission map — the one source
                  of validation both apps import
docs/             decisions.md (why things are the way they are), the
                  per-day summaries, manual test scripts, PROJECT-STATE.md
                  (the detailed handover reference), STAGING.md
docker-compose.yml, apps/*/Dockerfile, .dockerignore, docker/init-db.sh
```

## Permissions

Role-based, enforced at the API — the frontend hides what a role can't do,
but every route independently checks the same permission server-side, so
there is no path where hiding a button is the actual security control.

| Capability | Admin | Staff |
| --- | --- | --- |
| Leads, Companies, Contacts, Deals, Activities — read & write | Yes | Yes |
| Convert leads, move/close deals | Yes | Yes |
| Archive / restore business records | Yes | Yes |
| Dashboard, Today, CSV export | Yes | Yes |
| Website Enquiries inbox | Yes | Yes |
| Quotations — read, write, change status, duplicate, download PDF | Yes | Yes |
| Manage users, roles, deactivate | Yes | No |
| Read the audit log | Yes | No |
| Manage settings and API keys | Yes | No |

## Key decisions worth knowing before you dig in

Full reasoning for every decision is in `docs/decisions.md` (append-only,
numbered D1 onward). A few that shape how the code reads:

- **Sessions, not JWTs** — a random opaque token, hashed in the database,
  so deactivating a user or changing a password revokes access instantly.
- **Organisation-scoped from day one** — every table carries
  `organizationId`; a small `scoped(ctx)` helper builds the `where` clause
  so this is hard to forget, even though this deployment only has one
  organisation today.
- **One error shape everywhere** — `{ error: { code, message, details?,
  requestId } }` — mapped centrally from Zod/Prisma errors.
- **Archive, never delete** — every business record has an `archivedAt`;
  nothing is permanently deletable in this version.
- **CSV export defends against formula injection** — a cell starting with
  `=`, `+`, `-`, `@`, a tab, or a carriage return is neutralised before
  it's written, on top of standard RFC4180 quoting (`apps/api/src/lib/csv.ts`).
  Every export also leads with a UTF-8 BOM and never starts with the bare
  letters "ID" as its first column (`rowsToCsv` throws if it ever would) —
  both there specifically because Excel on Windows misreads such a file as
  an old SYLK spreadsheet and refuses to open it; see `docs/decisions.md` D82.
- **The audit log's `metadata` field is allowlisted, not trusted as-is** —
  `apps/api/src/lib/audit-metadata.ts` only lets a known-safe set of field
  names through the API response (names, ids, enum values, changed-field
  lists), so a future call site can never accidentally leak something
  sensitive into an Admin-visible screen just by adding a new field.
- **The Docker "full" profile is intentionally isolated from native dev** —
  its own database (`crm_docker`), its own host ports (3100/4100). This
  wasn't the original design — see `docs/decisions.md` D78–D80 for what
  went wrong the first time and why it's built this way now.

## Testing

```powershell
pnpm typecheck && pnpm lint && pnpm test
```

Current count: **apps/api 483 tests, apps/web 101 tests — 584 total**, all
against a real Postgres test database (`crm_test`), not mocked — including
RBAC/permission matrix tests, the lead-conversion transaction (with a real
concurrency/rollback test), dashboard-metric reconciliation against
independent SQL, and the website-intake idempotency/honeypot/rate-limit
behaviour.

One Playwright end-to-end test and every manual click-through script are
Day 6 work per the roadmap — see `docs/MANUAL-TEST-DAY*.md` for what's
written but not yet run by a human in a real browser (this development
environment has no browser-automation tool).

## Staging

A separate, already-deployed staging environment exists (Render + Vercel +
Supabase) — unrelated to the Docker profile above, which is local-only.
See `docs/STAGING.md` for the full walkthrough before touching anything
staging-related.

## Troubleshooting

**Port already in use (native dev, Windows)** — `pnpm dev` needs 3000/4000
free, `pnpm db:up` needs 5433:

```powershell
netstat -ano | findstr :3000
Get-CimInstance Win32_Process -Filter "ProcessId = <PID>" | Select-Object CommandLine
taskkill /PID <PID> /T /F
```

**Running native dev and the Docker profile at the same time** — this is
fine and expected (that's why the Docker profile uses 3100/4100, not
3000/4000) — just don't expect them to share data; they're deliberately
two separate databases.

**A Docker build fails on a slow/flaky package download** — this has been
seen to be a transient npm registry issue, not a real problem with the
repo; retrying the same `docker compose --profile full up --build -d`
command has always resolved it.

## Notes

- The seed (`apps/api/prisma/seed.ts`) refuses to run when
  `NODE_ENV=production`, and is safe to re-run any number of times
  (upserts by unique email/name).
- The full P0 database schema is in one migration,
  `apps/api/prisma/migrations/20261118202744_init`, plus one later addition
  for website-submission spam/archive support. See
  `apps/api/prisma/SCHEMA-SUMMARY.md` for a factual per-model reference
  instead of reading `schema.prisma` by hand.
- `pnpm dev` runs `packages/shared` in `tsc --watch` mode, so editing its
  source rebuilds automatically.
