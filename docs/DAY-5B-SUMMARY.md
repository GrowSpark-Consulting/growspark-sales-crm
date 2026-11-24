# Day 5b Summary — Sales & CRM

Written at the end of Day 5 part (b) (2026-11-24) for a plain read of what
was built, two real incidents found while building it, and the two
requested audits (RBAC sweep, P0 freeze list). For the *next* session's
starting point, read `docs/NEXT-SESSION-START.md` instead — this is a look
back, not a plan forward.

## What was built

**CSV export** — Leads, Companies, Contacts, Deals each get a `GET
.../export` endpoint and a "Download CSV" button, respecting whatever
filters are currently applied, gated on a (previously unused, since Day 1)
`reports:export` permission that both roles have. Two defences on every
cell: RFC4180 quoting (commas/quotes/newlines) and formula-injection
neutralisation (a cell starting with `=`, `+`, `-`, `@`, a tab, or a
carriage return gets a leading single quote). Capped at 10,000 rows, per
the roadmap. Full detail in `docs/decisions.md` D76.

**Docker — the whole stack in one command.** `docker compose --profile
full up --build -d` now builds both apps from their own Dockerfiles and
runs the complete stack. This took far more work than originally scoped,
because actually running it (not just writing it) surfaced five real
problems — two ordinary bugs, and three incidents serious enough to stop
and report immediately rather than bury in a summary:

1. An `express-rate-limit` v8 IPv6-safety warning that had been silently
   printing since Day 5a, never seen before because the logger is silent
   in `NODE_ENV=test`. Fixed.
2. An unbounded database-connection timeout: a fresh container's very
   first database query once took **over ten minutes** before Postgres's
   connection pool's own uncapped default timeout let it through. Fixed
   with a bounded 10-second `connectionTimeoutMillis` — this protects
   staging too, not just Docker.
3. **A real incident**: an early verification step ran `pnpm db:seed`
   inside a container whose database pointed at the same `crm_dev` the
   user's native dev setup uses, overwriting the real Admin/Staff login
   passwords. Reported immediately; the user restored their own password
   by re-running their own seed. Fixed properly afterward: the Docker
   profile now uses its own database, `crm_docker`, which can structurally
   never resolve to `crm_dev`, auto-seeded with fixed, documented demo
   credentials so a reviewer never needs to touch `crm_dev` at all.
4. **A real incident**: a `.dockerignore` mistake (bare `.env`/`.env.*`
   patterns, which — unlike `.gitignore` — only match at the build
   context's root, not at every depth) let real local database credentials
   *and* real staging/Supabase credentials get copied into a built image.
   Found by inspecting a running container's filesystem. Fixed, the
   leaked images and the entire Docker build cache were deleted from this
   machine, and a permanent guard script
   (`scripts/check-dockerignore.mjs`, `pnpm docker:check-env-leak`) now
   asks Docker's own real build to prove no `.env`-style file would ever
   be copied in again — proven to actually catch the original bug, not
   just shown to pass now.
5. A port collision with native `pnpm dev` (both happily bound to
   3000/4000 at once; Windows silently routed browser traffic to the
   *native* server instead of erroring) that made the crm_docker fix look
   broken when it wasn't — plus a genuine second bug found while
   re-verifying on new ports (Next.js bakes its rewrite-proxy destination
   into the production build at `next build` time, so a correct runtime
   `API_INTERNAL_URL` set later had no effect). Fixed by moving the Docker
   profile to its own ports (3100 web / 4100 api, configurable) and
   setting the proxy destination at image-*build* time instead.

Full, honest detail on every one of these — including the exact commands
run and the exact output that proved each one — is in `docs/decisions.md`
D77–D80. Nothing above is paraphrased more favourably there than it
happened.

**README rewritten** for a reviewer who has never seen this project:
what it is, both ways to run it (native dev vs. the Docker one-command
stack, with the demo login prominently documented), project structure, the
permission table, key decisions, and troubleshooting — including the
port-collision story, since it's the kind of thing a future reader needs
to know *before* hitting it themselves.

## RBAC sweep

Every backend route was re-read from source (not just the route-registry
test, which only proves every route declares *some* permission, not that
the permission is the *right* one) and cross-checked against the PRD's and
roadmap's role tables. Every frontend screen was checked for a matching
client-side gate (a convenience redirect only — the API's own permission
check is the real control either way).

| Resource | Routes | Required permission | Admin | Staff |
| --- | --- | --- | --- | --- |
| Leads | list/create/get/update/status/status-history/conversion-matches/convert/export | `leads:read`/`leads:write` | Yes | Yes |
| Leads | archive/restore | `records:archive` | Yes | Yes |
| Companies | list/create/get/update/export | `companies:read`/`companies:write` | Yes | Yes |
| Companies | archive/restore | `records:archive` | Yes | Yes |
| Contacts | list/create/get/update/export | `contacts:read`/`contacts:write` | Yes | Yes |
| Contacts | archive/restore | `records:archive` | Yes | Yes |
| Deals | list/create/get/update/stage/close/reopen/contacts/stage-history/export | `deals:read`/`deals:write` | Yes | Yes |
| Deals | archive/restore | `records:archive` | Yes | Yes |
| Activities | list/create/get/update | `activities:read`/`activities:write` | Yes | Yes |
| Pipeline | stages/summary | `deals:read` | Yes | Yes |
| Lead sources | list | `leads:read` | Yes | Yes |
| Workspace | `/today` | `activities:read` | Yes | Yes |
| Workspace | `/dashboard` | `dashboard:read` | Yes | Yes |
| Enquiries | list/get | `leads:read` | Yes | Yes |
| Enquiries | mark-spam | `leads:write` | Yes | Yes |
| Enquiries | archive/restore | `records:archive` | Yes | Yes |
| Users | everything | `users:manage` | Yes | **No** |
| Audit | `/audit-events` | `audit:read` | Yes | **No** |
| API keys | everything | `settings:manage` | Yes | **No** |
| Auth | login | public | — | — |
| Auth | logout/me/change-password | any session | Yes | Yes |
| Users | `/users/options` | any session | Yes | Yes |
| Intake | website-enquiries | API key, not a session | — | — |
| Health | `/health`, `/health/db` (×2 paths) | public | — | — |

This matches the PRD's role table and the roadmap's permission table
exactly — no discrepancy found, and **no change was made to the
permission table** (none was needed).

Frontend cross-check: **Users** and **Settings → API Keys** both redirect
non-Admins to the 403 page client-side and are hidden from Staff's sidebar,
matching their Admin-only backend permissions. Every other screen (Home,
Today, My Tasks, Leads, Companies, Contacts, Deals, Enquiries) has no role
gate at all, matching its non-Admin-only backend permission.

**The one surprising finding, reported as asked rather than quietly
fixed**: `GET /audit-events` was fully built, tested, and Admin-only — but
had no frontend page at all. Not a hidden/broken link; a repo-wide search
for any audit-related frontend code (component, hook, or route) found
nothing. The original Day-1 roadmap text explicitly promised "an audit log
and its Admin page... Admins read it on one filtered page" — a real gap
against that promise, even though the PRD's own *minimum* acceptance
criteria only require actions to be "recorded in audit logs" (which they
were) and don't explicitly require a page to read them back. **The user
chose to close this gap immediately rather than accept it** — see
`docs/decisions.md` D81 for the full build: `/settings/audit-log`
(Admin-only, same pattern as Users/API Keys), filters for actor/action/
entity type/date range, and — because `metadata` is a free-form JSON blob
written by many different call sites — a server-side **allowlist** (not a
denylist) that only lets known-safe field names through the API response
at all, proven with a test that inserts a row with deliberately dangerous
key names (`rawKey`, `password`, `token`, ...) and confirms none of them
ever reach the JSON response.

## P0 freeze list — what's missing against the PRD and the 5-day roadmap

**Confirmed done, matching P0 scope exactly** (Areas A–J of the roadmap's
Part C): foundation/auth, companies/contacts, leads, lead conversion,
deals/pipeline, activities/Today, dashboard, website intake, CSV export,
Docker, organisation scoping, and the RBAC/conversion/deals/intake test
suite the roadmap asks for.

**P0 gap found, then closed the same session**: the audit log Admin page
(see above and `docs/decisions.md` D81) — the Day-1 roadmap text explicitly
named it as Day 1 scope ("Admins read it on one filtered page"), distinct
from the PRD's weaker minimum bar. No open P0 gap remains.

**Explicitly P1 or later per the roadmap/PRD, not gaps** (listed here only
so a reviewer doesn't mistake "not built" for "forgotten"): products and
quotations; global search; in-app notifications; Admin screens for
stages/lead sources/loss reasons; Enquiries Inbox upgrades (read/unread,
processing status, richer filters); a predefined-reports page with charts
beyond the dashboard's own; CSV/Excel *import*; a calendar view; bulk
operations; self-service password reset by email; session list/revoke;
generated OpenAPI docs. Everything in P2 (multiple pipelines, workflow
automation, lead scoring, custom fields, the transactional outbox, SSO,
the three AI capabilities, duplicate-merge tooling) — none of it started,
correctly, per the roadmap.

**Known, already-recorded limitations carried forward, not new findings**:
no browser-automation tool exists in this environment, so the Day 1–5a
manual test scripts are still unrun by a human; no component tests for the
Companies/Contacts/Leads/Deals list-and-detail screens (a deliberate Day 2
scope choice, reserved for Day 6); the Users page's search isn't in the
URL like every newer list page's is.

**Recommendation on freezing P0**: everything matches the roadmap's P0
scope exactly, with no open gap — safe to call Day 5 (and P0 as a whole)
frozen.

## How to verify everything in this entry

```powershell
pnpm typecheck && pnpm lint && pnpm test
# apps/api 483/483, apps/web 101/101 — 584 total (D82 adds 5 more to apps/api)

pnpm docker:check-env-leak
# OK: no real .env-style file is present in the Docker build context.

docker compose --profile full up --build -d
# web: http://localhost:3100, api: http://localhost:4100
# demo login: admin@growspark.test / dev-only-admin-password
```

`docs/MANUAL-TEST-DAY5B.md` has the full human click-through script,
unchecked, same as every other manual test script in this repo.
