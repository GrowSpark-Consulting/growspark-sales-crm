# Project State — Session Handover

A new session should start at `docs/NEXT-SESSION-START.md`, which reads this
file next, together with `CLAUDE.md` and `docs/decisions.md`. This file is
append-only in its Session Log (§15); every other section should be kept
accurate as reality changes, not just added to.

## 1. Project snapshot

**Sales & CRM** for Grow Spark Consulting: an internal tool for Admin and Staff
users covering the lead-to-deal flow (leads → companies/contacts → deals →
pipeline → activities → dashboard). Per the user, this CRM is **one of three
independent apps being built by different people** — stated directly, not
independently verifiable from this repo. The user's plan is **7 days**: Days
1–5 build, Day 6 testing, Day 7 stabilise and demo (also stated directly; see
§13 for what's known about Day 1's remaining packages and §14 for what isn't
known about Days 2–5).

**Current status (end of 2026-11-19 session)**: **Day 1 is functionally
complete.** Packages 1.1 through 1.7 are all built, tested, and committed
locally (not yet pushed). The full sales-journey-adjacent foundation exists:
server-side session auth, the full permission map, user management with the
last-Admin rule and audit log, and a working browser UI (login, role-aware
navigation, a Users page with create/edit/deactivate/reactivate/reset-
password, a 403 page, a 404 page) all exist and are wired together, now
restyled end to end with the Grow Spark Workspace design system (tokens,
fonts, Light/Dark/System theming, a rebuilt sidebar/top-bar shell), with a
reusable search box pattern and a real session-expiry-while-open flow
(global 401 handling, window-focus + route-change revalidation of `/auth/
me`) on top — login through the real browser-facing proxy on :3000 was
verified with curl (no browser available in this environment), and a full
manual click-through script (`docs/MANUAL-TEST-DAY1.md`, now including
design-system and session-expiry sections) is ready for the user to run in
a real browser, which this session could not do itself.

**Update, same calendar date, a later session**: **Day 2's backend
(packages 2.0 through 2.3) is also now complete** — see §7 for full detail
per package. In short: the Cache Components page-wrapper pattern and a
password show/hide toggle (2.0); normalisers, the duplicate finder, and
two small lookup endpoints (2.1); full Companies and Contacts CRUD with
archive/restore (2.2); full Leads CRUD with archive/restore, a separate
status-change endpoint implementing D29's status workflow, and a
duplicate-check endpoint (2.3). 215 `apps/api` tests (up from 124 at the
end of Day 1) and 16 `apps/web` tests, all passing. Nothing has been
pushed. Packages 2.4–2.6 (the corresponding frontend UI for leads/
companies/contacts) have not been started and are not detailed in this
repo yet.

**Update, 2026-11-20, a new session**: Day 2's remaining frontend work
(packages 2.4 through 2.6) was completed in an earlier session, and the
user then ran a full manual browser pass (`docs/MANUAL-TEST-DAY2.md`),
confirming all five acceptance items and surfacing five real refinements
(D40–D44). **Package 2.7 closes out D40–D44 (items 1 through 4; item 5 is
this documentation pass)** — see §7 and `docs/decisions.md` D45 for full
detail: new-record forms (Lead, Company, Contact) now always open blank,
with the actual root cause (Next's Cache Components preserving state via
React's `Activity` instead of unmounting) confirmed from Next's own
bundled docs, not assumed; phone fields across all three resources are
now a country-code select plus a number, composed into a strict,
validated E.164 string server-side (`packages/shared/src/phone.ts`),
with a lenient parser reserved and unused for a future website-intake
path; required fields are trimmed to the PRD's actual minimum and
labelled with `*` (Company's non-core fields moved under a new collapsed
"More details" section; Lead's Source now preselects "Manual"); Contacts
require an email or a phone, the same rule Leads already had; and the
Lead History tab now names who made each change, with its own "provide
an email or phone" hint fixed to only show while actually unmet. 244
`apps/api` tests (up from 219) and 53 `apps/web` tests (up from 30), all
passing. Four commits, one per item; nothing pushed. Day 3 (lead
conversion, deals, pipeline) is next.

**Update, 2026-11-20, a new session — Day 3 backend underway: packages 3.1
and 3.2 are built and committed (`3f08a38`, `f2c59e0`).** This file was not
updated for either at the time — this update is a docs-only catch-up pass,
done before package 3.3, requested explicitly because the gap was noticed.
**3.1 — the lead conversion transaction**, the hardest item on the roadmap,
built first per the brief: `POST /leads/:id/convert` turns a `QUALIFIED`
lead into a linked-or-created Company and Contact, optionally a Deal in the
pipeline's first open stage, all inside one `$transaction` with a
`SELECT ... FOR UPDATE` row lock so concurrent conversions serialise rather
than race; `GET /leads/:id/conversion-matches` suggests existing
companies/contacts to link instead of creating new ones. **3.2 — the Deals
API and pipeline**: full Deal CRUD, `POST /deals/:id/stage` (probability
copied from the target stage every time, per the roadmap's D7), `POST
/deals/:id/close` (Won/Lost, Lost requires a reason from the shared
`LOSS_REASONS` list), `POST /deals/:id/reopen` (returns to the pipeline's
first open stage), archive/restore (deliberately allowed even on a closed
deal), `PUT /deals/:id/contacts`, and `GET /pipeline/{stages,summary}` (the
summary computed entirely in Postgres SQL, not recomputed in JS). Full
detail, including the five judgment calls approved alongside these two
packages, is in `docs/decisions.md` D46/D47 — see §7 below for the
package-by-package summary and §9 for the decisions index. 275 `apps/api`
tests (up from 244) and 53 `apps/web` tests (unchanged), 328 total, all
passing. Nothing pushed.

**Update, same session — package 3.3 (Deals list, forms, detail, close
dialogs) is built.** `/deals` (list, with search/stage/status/owner/company
filters and an archived toggle, all server-side); `/deals/new` and
`/deals/[id]/edit` (one shared `DealForm` — Stage is create-only, since
`PATCH` has no `stageId` key at all, D47); `/deals/[id]` (key-facts strip —
Company, Stage, Value, Probability, Weighted value, Expected close, Owner —
plus Overview/Contacts/Stage history tabs and the full action set: Edit,
Move stage, Close as Won, Close as Lost with a required reason, Reopen, and
Archive/Restore, all correctly gated by the deal's open/closed status per
D47). Three backend additions found necessary while building this (a
`contactId` filter on `GET /deals`; `GET /deals/:id/stage-history`; and a
`contacts` summary array added to `dealResponseSchema` itself, after
stopping to ask when the brief's "list this deal's contacts" requirement
turned out to have no corresponding read endpoint) — full detail in
`docs/decisions.md` D48. 279 `apps/api` tests (up from 275) and 63
`apps/web` tests (up from 53), 342 total, all passing. Nothing pushed.

**Update, same session — package 3.4 (the Kanban pipeline board,
`@dnd-kit/core`) is built.** A Board/List toggle on `/deals` (kept in the
URL); Board shows one column per `OPEN` pipeline stage (Won/Lost never get
a column — their totals surface in a small "Open pipeline" summary bar
instead, from `GET /pipeline/summary`'s own `open` aggregate, D47); every
card carries a "Move to…" dropdown — the always-present fallback — plus
real pointer/keyboard drag via the new, exact-pinned `@dnd-kit/core@6.3.1`
(confirmed no peer-dependency warning against `react@19.3.1` before
installing; `@dnd-kit/sortable`/`/utilities` deliberately not added). One
shared optimistic move-mutation backs both the dropdown and the drag
handler. Full detail, including an honest note on what could and couldn't
be verified without a browser in this environment, is in
`docs/decisions.md` D49. 279 `apps/api` tests (unchanged) and 65
`apps/web` tests (up from 63), 344 total, all passing. Nothing pushed.

**Update, same session — package 3.5 (Convert dialog and related tabs) is
built — Day 3 is now complete.** Two backend additions, both pre-approved
by the brief: a `companyName` override on `convertLeadSchema` (lets a
lead with no company name still convert, via the dialog's editable
"create new company" field) and a `conversion` summary on
`leadResponseSchema`, populated only by `GET /leads/:id`, for the
Converted panel's links and date. `LeadDetailPageClient`'s Convert action
is a real trigger only when `QUALIFIED` and not archived, disabled
elsewhere, hidden once `CONVERTED` or archived. The new
`ConvertLeadDialog` (three Link/Create toggles — Company, Contact, Deal)
had a genuine race condition in its first draft — an async matches lookup
could silently overwrite text the user had already typed — found and
fixed by this package's own tests, not caught by inspection. `DealsTab`
(Company and Contact detail pages) and `DealForm`'s new
`defaultCompanyId` close the loop back to Deals. Full detail, including a
recorded environment incident (a wedged Docker Desktop, unrelated to any
code change, resolved by the user rebooting their machine) in
`docs/decisions.md` D50. 282 `apps/api` tests (up from 279) and 74
`apps/web` tests (up from 65), 356 total, all passing. Nothing pushed.
**Day 3 (lead conversion, deals, pipeline) is done.**

**Note: this section's narrative was not kept current for Day 4 or package
4C (hosted staging)** — read §7/§9/§15 for those instead of assuming
continuity here. Picking back up at the next thing this section *was* kept
current for:

**Update, 2026-11-24 — Day 5a (website intake, API keys, the Enquiries
inbox) is done.** Resumed from a mid-build checkpoint (migration applied,
two unused shared-package files, `docs/decisions.md` D71's full design — see
the note at the start of §13's old Day 5a bullet, now updated). Built this
session, in full: `lib/api-key.ts` (key generation/hashing/timing-safe
verification); `middleware/api-key-auth.ts` (`attachApiKeyContext`) and the
`csrf.ts` Origin-check exemption conditioned on a verified key, never on
path alone; `'apiKey'` added to `route-registry.ts`'s `RouteAuth`; two new
intake-specific rate limiters (60/min per key, 120/min per IP); an
`Idempotency-Key` log-redact entry; `modules/api-keys/` (Admin-only create/
list/revoke/rotate, the raw key shown exactly once); `modules/intake/`
(the lenient field mapper, the idempotency-before-validation service, the
one route in this app with no declarative body `validate`); `modules/
enquiries/` (list/detail/mark-spam/archive/restore, same visibility as
Leads); all three wired into `app.ts`. A pre-existing Windows bug in
`pnpm db:verify-fresh`/`db:reset` (the same `.cmd`-shim `ENOENT` D63 had
already fixed for `staging-migrate.ts`, but left unfixed here) was found and
fixed first, at the user's own request. Frontend: an Admin-only
`/settings/api-keys` screen (create/rotate both need a "shown once" raw-key
reveal, not just a toast) and an `/enquiries` screen (list + detail, visible
to both roles) using the existing `DataTable`/`RecordLayout` components.
Full detail, every judgment call, and the full test-by-test breakdown are in
`docs/decisions.md` D72 (backend) and D73 (frontend). **409 `apps/api` tests
(up from 359) + 91 `apps/web` tests (unchanged — no new component tests for
either screen, matching this repo's established Day 2 precedent) = 500
total, all passing.** `pnpm typecheck`/`pnpm lint` clean throughout.

**Update, same session — a user-requested audit closed two real test gaps
(D74).** Asked for a plain, per-refinement accounting of D71's eight
binding items (tested vs. documented-only), which found the key-hash/
compare mechanism and the audit/log-redaction behaviour were implemented
correctly but never independently unit-tested — only proven end to end.
Closed with `tests/lib/api-key.test.ts` (new), `tests/intake/audit.test.ts`
(new), `tests/logger.test.ts` (new, after exporting `LOG_REDACT_PATHS` from
`logger.ts`), and a per-IP rate-limit test enabled by refactoring
`lib/rate-limit.ts`'s per-IP limiter into a ceiling-parameterised factory
(`createIntakeIpRateLimiter`, same pattern as the existing
`createGlobalLoginFloodLimiter`) — honestly scoped in that test's own
comment: it proves the limiter mechanism works, not what `req.ip` actually
is on Render. **427 `apps/api` tests (up from 409) + 91 `apps/web` = 518
total, all passing.** Full detail in `docs/decisions.md` D74;
`docs/DAY-5A-SUMMARY.md` now has an explicit tested-vs-reasoning-only table,
one row per refinement. `pnpm typecheck`/`pnpm lint` clean throughout.
Nothing pushed; nothing run against staging. Manual verification is still
limited to a clean-server-start/200-response/401-through-proxy smoke
check — no browser
exists in this environment, so neither new screen has actually been clicked
through; see `docs/MANUAL-TEST-DAY5A.md`.

**Update, same session — D75: a bug found in manual testing (Rotate on the
API Keys screen never showed the new raw key) was fixed, with a test that
was shown to fail against the reverted code first.** 428 `apps/api` + 92
`apps/web` = 520 total, all passing. Full detail in `docs/decisions.md` D75.

**Update, 2026-11-24, a new session — Day 5 part (b) is done: CSV export,
a Docker "full" profile, a rewritten README, an RBAC sweep, and a P0
freeze list.** Read `docs/DAY-5B-SUMMARY.md` for the plain-language
account — it is substantial, because actually *running* the Docker work
(not just writing it) surfaced five real problems worth knowing about
before touching this area again, two of them serious enough to have been
reported to the user immediately rather than folded quietly into a later
summary: a brief incident where a verification step overwrote the real
local Admin/Staff passwords in `crm_dev` (the user restored their own
password; fixed properly by giving the Docker profile its own database,
`crm_docker`, which can structurally never resolve to `crm_dev`), and a
`.dockerignore` mistake that let real `.env`/`.env.staging.local` files
(local and staging credentials) get copied into a built image (fixed; the
leaked images and the entire Docker build cache were deleted from this
machine; a permanent guard script, `pnpm docker:check-env-leak`, now
proves this can't happen again by asking Docker's own real build, not by
re-implementing `.dockerignore` matching). Full detail, every incident,
every fix, and the exact verification commands and output, is in
`docs/decisions.md` D76–D80 — read that before changing anything
Docker-related in this repo. The Docker profile now runs on **ports
3100 (web) / 4100 (api)**, deliberately different from native dev's
3000/4000 (a real port collision was the root cause of a lot of this
session's confusion — see D80). RBAC sweep: every route and screen
checked against the PRD/roadmap role tables; no discrepancy, no
permission-table change made; one real gap found and reported, not
silently fixed — there was no frontend page for the audit log
(`GET /audit-events` was built, tested, and Admin-only, but unreachable
from the UI). **The user asked for it to be built immediately, same
session (D81)**: `/settings/audit-log`, Admin-only, filters for actor/
action/entity type/date range, and a server-side metadata **allowlist**
(`sanitizeAuditMetadata`, `apps/api/src/lib/audit-metadata.ts`) so the
free-form `metadata` JSON column can never leak something sensitive into
this screen even if a future `writeAudit()` call site adds an unsafe
field — proven with a test that inserts a row with deliberately dangerous
key names (`rawKey`, `password`, `token`, ...) and confirms none reach the
JSON response. **No open P0 gap remains.** **apps/api 478/478 (up from
428), apps/web 101/101 (up from 92) — 579 total, all passing.**

**Update, same session — two bugs found in manual testing, both fixed
(D82)**: every CSV export's first column was the bare text "ID", which
Excel on Windows misdetects as an old SYLK file and refuses to open —
fixed (renamed to "Lead ID"/"Company ID"/"Contact ID"/"Deal ID", a
structural guard added to `rowsToCsv` against this ever recurring, plus a
UTF-8 BOM on every export). `pnpm docker:check-env-leak` also failed on
Windows cmd/PowerShell (needed `sh`, which Windows doesn't have) —
rewritten as plain Node (`scripts/check-dockerignore.mjs`), proven to still
catch the original `.dockerignore` bug the same way. **apps/api 483/483
(up from 478), apps/web 101/101 (unchanged) — 584 total, all passing.**
`pnpm typecheck`/`pnpm lint` clean throughout. Nothing committed or
pushed this session (explicit instruction for Day 5b); nothing run
against staging; `crm_dev` was never written to after the password
incident was caught and fixed (the user re-seeded their own password
themselves).

**Update, 2026-11-25 — Day 5c, feature 1 of 3 (Quotations) is done.** Day 5c
adds Quotations, then Notifications, then Reports, stopping for review after
each. Quotations: migration `20261124181711_add_quotations` (three tables,
one enum, eleven nullable organisation header columns); exact-decimal money
rule with half-up rounding (D85); yearly `Q-YYYY-NNNN` numbering via an
atomic counter upsert; server-enforced Draft → Sent → Accepted/Rejected
flow with best-effort, audited auto-expiry on read (D86); edit (Draft only,
version bump), duplicate, archive/restore; an on-demand pdfkit PDF with
bundled Noto Sans for the rupee sign, never stored (D84); list/detail/
create/edit screens, Quotations tabs on Deal and Company, and an optional
"mark the deal Won?" offer after Accept. New permissions `quotations:read`/
`quotations:write` (both roles, approved). New dependency `pdfkit@0.20.2`
(+ dev `@types/pdfkit@0.17.7`). **apps/api 539/539 (up from 483), apps/web
109/109 (up from 101) — 648 total.** Applied to `crm_test` by the user
(`pnpm db:verify-fresh`); not yet to `crm_dev` or staging. Full account:
`docs/DAY-5C-SUMMARY.md`; decisions D83–D87. Nothing committed or pushed.
Later the same day: D88 (a Draft past its valid-until date cannot be sent,
tested) and the start of Notifications (D89 — migration
`20261124191130_add_notifications` and shared schemas only; the rest is
not written). **Current counts: apps/api 540/540, apps/web 109/109 (649).**
Resume from `docs/DAY-5C-HANDOVER-PROMPT.md`.

**Update, 2026-11-25 (later) — Day 5c, feature 2 of 3 (Notifications) is
done (D90).** The user applied both Day 5c migrations to `crm_test`
(`pnpm db:verify-fresh`) and `crm_dev` (`pnpm db:migrate`); still not on
staging. In-app only: a bell with an unread count in the app-shell header
(polls every 60 s, paused while the tab is hidden), a `/notifications` page,
mark one read / mark all read. Events: lead or deal assigned to someone else
(create, owner change, deal created by conversion), new website enquiry to
every active user, quotation accepted/rejected to its owner, and task due
today / overdue generated when the user loads the app (org time zone,
de-duplicated, capped at 50 per load). All written after the main
transaction commits, best-effort. No new permission, dependency or
migration change. PRD 5.8/5.11 items **not** built: deal-change and
invitation notifications, notification preferences (reported, D90;
approved as deviations, D91). **apps/api 572/572, apps/web 121/121 (693).**

**Update, 2026-11-25 (later still) — Day 5c, feature 3 of 3 (Reports) is
done (D92); Day 5c is complete.** New permission `reports:read` (both roles;
the one approved permission-table change). `/reports` with Home's date range
and All/Mine controls (extracted into a shared component) and five reports:
pipeline by stage (open snapshot), lead sources and conversion, sales by
owner (won/lost/value/win rate), quotations by effective status, overdue
tasks by assignee; a CSV per report (`reports:export`). Totals reuse Home's
own query functions and a shared range resolver; a reconciliation test
proves Reports = `GET /dashboard`. No migration or dependency. PRD 5.10 gaps
reported (leads by status/date and revenue trend live on Home only; no
per-person activity report; CSV only). **apps/api 593/593, apps/web 126/126
(719).** Not clicked through in a browser; staging not yet migrated.

## 2. Hard constraints

- **(a) Grow Spark website repository**: must not be touched, read, or looked
  for. Website integration is **on hold** until this CRM is finished. When
  resumed, it must be purely additive: it must never affect the existing
  website's workflow, Supabase, SMTP, HubSpot, validation, spam protection, or
  visitor behaviour. **Now written into `CLAUDE.md`** (added in package
  1.2c) — no longer only in chat history and this file.
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
- **Docker "full" profile (Day 5b, `docker compose --profile full up`)**:
  web **3100**, API **4100** — deliberately different host ports from
  native dev, and its own database, **crm_docker**, in the *same* Postgres
  container as crm_dev/crm_test (created once, by hand, on this developer's
  existing volume; `docker/init-db.sh` creates it automatically on any
  future brand-new volume). `crm_docker` is seeded automatically, every
  container start, with fixed demo credentials
  (`admin@growspark.test`/`dev-only-admin-password`,
  `staff@growspark.test`/`dev-only-staff-password`) — never run
  `pnpm db:seed` (or any other write) against `crm_dev` on this tool's own
  initiative; see `docs/decisions.md` D78 for why that rule exists.

### Environment variables (names only — never commit or paste real values)

`apps/api/.env` (copy from `apps/api/.env.example`, which already holds
placeholder dev-only values, not secrets):

- `NODE_ENV`, `PORT` — standard.
- `DATABASE_URL`, `TEST_DATABASE_URL` — Postgres connection strings for
  `crm_dev` and `crm_test` respectively.
- `ALLOWED_ORIGINS` — comma-separated origin allow-list for the CSRF
  Content-Type/Origin check (D20); the web app's own origin.
- `TRUST_PROXY` — `"false"` locally; a hop-count integer once a real
  reverse proxy sits in front (see D21/D23, still deferred).
- `SESSION_TTL_DAYS` — sliding session expiry window.
- `SEED_ADMIN_PASSWORD`, `SEED_STAFF_PASSWORD` — dev-only; the seed has no
  built-in default and refuses to run without both set.

`apps/web/.env` (copy from `apps/web/.env.example`):

- `API_INTERNAL_URL` — server-side only, used by `next.config.ts` to build
  the `/api/*` rewrite proxy.

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
pnpm dev                                         # web:3000, api:4000, shared watch
```

`apps/api/.env.example` also needs `SEED_ADMIN_PASSWORD` /
`SEED_STAFF_PASSWORD` filled in (dev-only values are fine) before `db:seed`
will run — the seed has no password default in code.

**`pnpm dev` no longer runs `pnpm -r --parallel dev` internally** (package
1.3b, D24) — it runs `node scripts/dev.mjs`, which spawns `packages/shared`,
`apps/api`, and `apps/web`'s own `dev` scripts as three independent `pnpm
--filter <pkg> run dev` processes. `pnpm -r --parallel dev` itself was found
to hang `apps/api`'s `tsx watch` with zero output, unrelated to any specific
package or timing — do not revert to it. Verified 5 clean cold-state runs in
both package 1.3b and again in this session (re-verification after the
review gate): ports 3000/4000 free before each, both answering within
10–32s each time, ports free after each `taskkill /PID <top-level pnpm dev
PID> /T /F`.

**Docker Desktop is not always already running** at session start on this
machine — `docker info` can fail with a plain connection error. Launch it
via `Start-Process "shell:AppsFolder\Docker.DockerForWindows.Settings"` (the
`.exe` is not at the path you'd expect; found via `Get-StartApps`), then poll
`docker info` until it succeeds (took ~5s once, in this session).

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
apps/web/              Next.js 16 App Router app (port 3000) — package 1.5,
                        restyled with the Grow Spark design system in 1.6
  app/
    layout.tsx            root layout — next/font (Inter + JetBrains Mono,
                        400/500/600 only), suppressHydrationWarning on
                        <html> (next-themes sets data-theme/style on it
                        after mount — D27)
    globals.css           imports design-tokens.css once; @theme inline
                        maps every shadcn semantic colour to a GS token;
                        global :focus-visible outline rule; reduced-motion
                        reset (D27)
    design-tokens.css     verbatim copy of docs/design-system/tokens.css —
                        edit the source and re-copy, never this file
                        directly (D27)
    providers.tsx         QueryClientProvider + next-themes ThemeProvider
                        (attribute="data-theme", defaultTheme="system",
                        enableSystem — the toggle lives in AppShell's user
                        menu, D27) + SessionExpiryHandler (D28), mounted
                        inside both providers
    not-found.tsx         404 page (Next's own file convention)
    login/page.tsx         public; wraps LoginForm in <Suspense> (needed for
                        useSearchParams) with a real skeleton fallback, not
                        null (D26); control-lg (44px) inputs/button (D27)
    (protected)/           route group, no URL segment; EVERY authenticated
                        page lives here behind one layout
      layout.tsx            AuthGuard (client-side nav convenience only,
                        never the real security control — D26) + AppShell;
                        `export const instant = false` (D28 — Cache
                        Components' instant-navigation dev validation;
                        can't be set on users/page.tsx itself, a Client
                        Component, so it's set once here instead)
      page.tsx              Home — (4.5, D57) the real dashboard now, via
                        DashboardPageClient behind a <Suspense> boundary
                        (useSearchParams, D26's rule); no own <h1> (the top
                        bar carries the page title — D27)
      forbidden/page.tsx     403 page; same, no own <h1>
      users/page.tsx         the Users page (see below); search box is now
                        SearchInput, not Input+Button (D28)
      companies/page.tsx     (2.4, D37) thin wrapper + <Suspense> around
                        CompaniesPageClient (useSearchParams for URL state)
      companies/new/page.tsx, companies/[id]/page.tsx,
      companies/[id]/edit/page.tsx   (2.5, D38) thin wrappers; the [id]
                        routes await the Promise `params` inside a small
                        async inner component wrapped in <Suspense>
                        (Next 16 + Cache Components requirement)
      contacts/page.tsx, contacts/[id]/page.tsx   (2.5, D38) same pattern
      leads/page.tsx, leads/new/page.tsx, leads/[id]/page.tsx,
      leads/[id]/edit/page.tsx   (2.6, D39) same thin-wrapper pattern
      deals/page.tsx, deals/new/page.tsx, deals/[id]/page.tsx,
      deals/[id]/edit/page.tsx   (3.3, D48) same thin-wrapper pattern
      tasks/page.tsx, today/page.tsx   (4.4, D56) same thin-wrapper pattern
  components/
    auth-guard.tsx          useMe()-driven redirect: unauth'd -> /login?
                        next=..., shows a Skeleton while loading; also
                        invalidates the `me` query on every pathname change
                        after first mount, so a deactivated user is caught
                        on their next navigation (D28)
    session-expiry-handler.tsx  mounted once in providers.tsx; registers
                        api-client's onUnauthorized listener — on any 401,
                        clears the whole query cache and redirects to
                        /login?next=<path>, guarded against redirect loops
                        and against firing on /login's own failed-login 401
                        (D28)
    app-shell.tsx           rebuilt per the design system (D27): 240px dark
                        sidebar with the Sales product chip, 56px top bar
                        showing the current page's title (a flat pathname
                        lookup, PAGE_TITLES — fine for 3 routes, revisit
                        later), user menu with Light/Dark/System
                        (DropdownMenuRadioGroup) + logout; (4.4, D56) gained
                        Today and My Tasks nav items between Home and Leads,
                        and both routes' titles in PAGE_TITLES
    login-form.tsx          React Hook Form + loginSchema (shared), inline
                        field errors, generic failure banner
    ui/                    shadcn: button, input, label, form, table,
                        dialog, dropdown-menu, badge, sonner, skeleton,
                        select, alert (1.5), tabs (1.6, added from the
                        already-installed radix-ui package, no new
                        dependency) — button/input/label/badge/alert/table/
                        tabs restyled per their design-system READMEs in
                        1.6 (D27); dialog's overlay fixed from `bg-black/50`
                        to `bg-ink/40` (the one other hard-coded colour
                        found); search-input.tsx (1.7, D28) — magnifier +
                        clear-x search box wrapping Input, reusable by
                        Leads/Companies/Contacts later; password-input.tsx
                        (2.0, D31) — Input wrapped with a show/hide toggle
                        (Lucide Eye/EyeOff), used by login/Create user/
                        Reset password; data-table.tsx, record-layout.tsx,
                        confirm-action-dialog.tsx (moved here from
                        components/users/, always generic) (all 2.4, D37);
                        textarea.tsx (2.5, D38 — same Field treatment as
                        Input, no shadcn-generated one existed);
                        phone-input.tsx (2.7 item 2, D41/D45) — country-code
                        Select + number Input composed into/out of one
                        canonical E.164 string, used by Company/Contact/Lead
                        wherever phone appears; collapsible.tsx (2.7 item 3,
                        D40/D45) — not yet in docs/design-system/, built
                        from its tokens/motion rules, used so far only by
                        Company's "More details" section; stat-card.tsx
                        (4.5, D57) — a KPI tile per the design system's
                        StatCard README, no delta line (nothing to compare
                        against yet)
    pickers/                owner-select.tsx, company-select.tsx (2.4, D37)
                        — OwnerSelect wraps Select over GET /users/options
                        (form use only); CompanySelect is a hand-built
                        async combobox (no Combobox primitive installed);
                        contact-select.tsx (3.3, D48) — the same hand-built
                        combobox pattern, optionally scoped by companyId,
                        used by the deal Contacts tab
    companies/              companies-page-client.tsx (2.4, D37) — the
                        Companies list: DataTable + SearchInput +
                        useListUrlState, owner/archived filters, sortable
                        Name/Created columns only (the two fields
                        COMPANY_SORT_FIELDS allows); company-form.tsx (2.5,
                        D38 — shared create/edit form, always validated
                        against createCompanySchema, duplicate-name hint on
                        blur; 2.7 item 1 D42 — a useLayoutEffect cleanup
                        resets the create form to blank on every Activity
                        hide; 2.7 item 3 D40 — core fields vs. a collapsed
                        "More details" Collapsible, phone field is now
                        PhoneInput); create-company-page-client.tsx,
                        edit-company-page-client.tsx,
                        company-detail-page-client.tsx (RecordLayout,
                        Overview + Contacts tabs; phone shown via
                        formatPhoneForDisplay, 2.7 item 2; 3.5 D50 gained a
                        Deals tab via the shared DealsTab, with "Add deal"
                        prefilled via /deals/new?companyId=...),
                        company-contacts-tab.tsx
                        (bounded, unpaginated list scoped to one company)
    contacts/               contact-form-dialog.tsx (2.5, D38 — create/edit
                        Dialog, reusable from /contacts or a Company's
                        Contacts tab via `lockedCompany`; no
                        alternatePhone/preferredCommunicationMethod or
                        lifecycleStatus fields — see D38/D36; 2.7 item 1
                        D42 — same create-mode reset-on-hide pattern, plus
                        force-closes the dialog itself on hide; 2.7 item 3
                        D43 — requires an email or a phone, with the same
                        only-while-unmet hint as Lead's; phone field is now
                        PhoneInput, 2.7 item 2),
                        contacts-page-client.tsx, contact-detail-page-client.tsx
                        (3.5 D50 gained a read-only Deals tab, shared
                        DealsTab, no "Add deal" link per the brief; 4.3 D55
                        gained the shared Timeline tab)
    leads/                  (2.6, D39) leads-page-client.tsx (list: all 5
                        named filters + search/sort/paging, sortable
                        name/status/priority/created only); lead-form.tsx
                        (shared fields via leadCreatableFields, but
                        genuinely separate create/edit schemas —
                        requirement is create-only; duplicate warning via
                        the real GET /leads/duplicates; 2.7 item 1 D42 — same
                        reset-on-hide pattern as Company; 2.7 item 3 D40 —
                        Source preselects "Manual" by name on create;
                        phone field is now PhoneInput, 2.7 item 2; 2.7 item
                        4 D44 — the email-or-phone hint is now conditional,
                        not permanently visible); create-lead-page-
                        client.tsx, edit-lead-page-client.tsx,
                        lead-detail-page-client.tsx (status buttons minus
                        current status, hidden entirely once CONVERTED;
                        read-only original-enquiry panel; History tab, now
                        showing "by <name>" per row, 2.7 item 4 D44; 3.5
                        D50 — Convert is a real trigger only when
                        QUALIFIED and not archived, disabled elsewhere,
                        hidden once CONVERTED/archived; a "Converted"
                        panel with company/contact/deal links replaces
                        "Change status" once converted); convert-lead-
                        dialog.tsx (3.5, D50) — three Link/Create
                        ModeToggle sections (Company/Contact/Deal)
                        prefilled from GET /leads/:id/conversion-matches;
                        the whole form stays unrendered while that lookup
                        is in flight, specifically to avoid a found-by-
                        its-own-test race where the async result could
                        overwrite text the user had already typed
    deals/                  (3.3, D48) deals-page-client.tsx (list:
                        search/stage/status/owner/company filters +
                        archived toggle, sortable name/value/probability/
                        expectedCloseDate only — DEAL_SORT_FIELDS; 3.4
                        D49 — gained a Board/List toggle kept in the URL
                        as ?view=board, hiding the list+filter bar entirely
                        when Board is active); deal-
                        form.tsx (one shared create/edit form; Stage is
                        create-only — updateDealSchema has no stageId key
                        at all, D47 — defaults to the pipeline's first open
                        stage and copies its probability; value/probability
                        need the same z.coerce.number() override as
                        Company/Lead, D38/D39; 3.5 D50 gained
                        defaultCompanyId, create-mode-only, prefilled from
                        CreateDealPageClient's ?companyId= query param);
                        create-deal-page-client.tsx (3.5 D50 — now reads
                        useSearchParams(), needed a real Suspense boundary
                        added to deals/new/page.tsx, D26's rule),
                        edit-deal-page-client.tsx (refuses to render the
                        form at all for a closed deal, a backstop alongside
                        the detail page's own hidden Edit link);
                        deal-detail-page-client.tsx (RecordLayout; key
                        facts include a client-computed Weighted value;
                        Overview/Contacts/Stage history tabs; Move stage via
                        a DropdownMenu, not a persistent Select, since it's
                        a one-shot action; Close as Won via
                        ConfirmActionDialog, Close as Lost via the new
                        CloseLostDialog; Reopen only once closed; Archive/
                        Restore always available, per D47); deal-contacts-
                        tab.tsx (reads the deal's own `contacts` summary
                        directly — no second request; add/remove/make-
                        primary all funnel through one replaceContacts()
                        helper calling the one real PUT endpoint); close-
                        lost-dialog.tsx (submit disabled until a
                        LOSS_REASONS reason is chosen); pipeline-board.tsx
                        (3.4, D49) — one column per OPEN stage; each
                        column runs its own fixed-shape useDealsList query
                        (no filters/sort choice, so its cache key stays
                        predictable for the optimistic move below); every
                        card has an always-present "Move to…" dropdown
                        plus real drag via @dnd-kit/core (PointerSensor
                        with an 8px activation distance so the card's own
                        link/dropdown stay clickable, KeyboardSensor with
                        its built-in default coordinate getter,
                        closestCenter collision detection); one shared
                        useMoveDealMutation (optimistic cache patch across
                        the two affected columns, snapshot + rollback on
                        error, broad deals+pipeline invalidation on
                        settle) backs both the dropdown and the drag
                        handler; deals-tab.tsx (3.5, D50) — shared by
                        Company's and Contact's detail pages, a bounded
                        pageSize:50 list via GET /deals's companyId/
                        contactId filters (contactId was 3.3's own
                        forward-looking addition for exactly this); only
                        Company's usage passes addHref
    activities/             activity-composer.tsx and record-timeline.tsx
                        (4.3, D55) — shared Task/Call/Meeting/Note composer
                        and paginated merged timeline, reused by all four
                        record detail pages; completed entries include the
                        actor and timestamp from existing audit events;
                        add-follow-up-dialog.tsx (4.4, D56) — a controlled
                        Dialog wrapping the same ActivityComposer, closing
                        itself via its onCreated callback, used by the Today
                        workspace's per-row "Add follow-up" action
    tasks/                  tasks-page-client.tsx (4.4, D56) — /tasks: a
                        Tabs-driven Open/Overdue/Done switch, Type/Priority/
                        due-range filters, reusing DataTable and the shared
                        priority badge helpers; inline Complete/Cancel
    workspace/               today-page-client.tsx (4.4, D56) — /today: one
                        card per GET /today section, a Mine/All scope toggle
                        kept in the URL, Complete on the two task sections,
                        Add follow-up (via AddFollowUpDialog) on every row
                        that names a record
    dashboard/               dashboard-page-client.tsx (4.5, D57) — the Home
                        dashboard: date-range (month default/30 days/custom)
                        and All/Mine scope, both in the URL; nine StatCard
                        KPIs and a recent-activity list straight from GET
                        /dashboard; dashboard-bar-chart.tsx — one shared
                        single-series Recharts bar chart (decorative,
                        aria-hidden) plus a sr-only data table, used four
                        times (leads by source/status, pipeline by stage,
                        monthly won revenue)
    users/                 create-user-dialog.tsx, edit-user-dialog.tsx,
                        reset-password-dialog.tsx,
                        users-page-client.tsx (2.0, D31 — the Client
                        Component users/page.tsx's logic was moved into,
                        unchanged, so page.tsx itself can be a thin Server
                        Component wrapper)
  hooks/
    use-me.ts              useMe() — GET /auth/me via TanStack Query,
                        retry:false (so a 401 settles fast, not after
                        retries); refetchOnWindowFocus:true, the one
                        exception to the QueryClient's app-wide default of
                        false (D28)
    use-users.ts            useUsersList(params) — server-side page/pageSize/
                        q/role/isActive, placeholderData keeps the old page
                        visible while a new one loads
    use-list-url-state.ts   (2.4, D37) page/pageSize off useSearchParams +
                        setParams(updates) merging into the query string
                        via router.replace, resets page to 1 on any other change
    use-user-options.ts     (2.4, D37) useUserOptions() — GET /users/options,
                        staleTime 60s (shared across OwnerSelect instances)
    use-companies.ts        (2.4, D37) useCompaniesList(params),
                        useCompany(id) — used by both the Companies list
                        page and CompanySelect's async search
    use-debounced-value.ts  (2.4, D37) generic debounce hook, used by
                        CompanySelect
    use-contacts.ts         (2.5, D38) useContactsList(params), useContact(id)
    use-leads.ts            (2.6, D39) useLeadsList(params), useLead(id),
                        useLeadStatusHistory(id); useLeadConversionMatches
                        (3.5, D50) — GET /leads/:id/conversion-matches,
                        gated by a caller-supplied `enabled` so it only
                        fetches while the Convert dialog is open
    use-lead-sources.ts     (2.6, D39) GET /lead-sources, for the Source select
    use-deals.ts            (3.3, D48) useDealsList(params), useDeal(id),
                        useDealStageHistory(id)
    use-pipeline.ts         (3.3, D48) usePipelineStages(), usePipelineSummary()
    use-activities.ts       (4.3, D55) paginated useRecordTimeline() query;
                        (4.4, D56) useActivitiesList() for /tasks' server-side
                        filters and useToday(scope) for GET /today
    use-dashboard.ts        (4.5, D57) useDashboard({from, to, scope}) — GET
                        /dashboard
  lib/
    api-client.ts           ApiError + apiGet/apiPost/apiPatch, same-origin
                        credentials; onUnauthorized(listener) — apiFetch
                        calls the registered listener on every 401,
                        regardless of caller (D28); apiPut (3.3, D48 — the
                        first PUT route this frontend has needed, for
                        PUT /deals/:id/contacts)
    handle-form-error.ts    the one place that decides: 422 -> field errors,
                        409/401/403 -> inline banner, 500/network -> toast
                        with request id (D26)
    format.ts               formatINR/formatINRCompact/formatDate/formatTime
                        — Indian grouping + L/Cr compaction, "19 Nov 2026",
                        "2:30 PM" (D27); formatPhoneForDisplay (2.7 item 2,
                        D41/D45) — a stored E.164 phone grouped for reading
                        ("+91 98400 12345"), never shown raw
    form-utils.ts           (2.5, D38) stripEmptyOptionalFields — strips
                        ""-valued keys from a form payload before POST/
                        PATCH, so "left blank" means null/omitted, not a
                        literal empty string
    lead-presentation.ts    (2.6, D39) leadStatusLabel/leadStatusBadgeVariant,
                        priorityLabel/priorityBadgeVariant — reuses the
                        Badge README's status-tone mapping (D27);
                        leadStatusChartColor (4.5, D57) — the same tone
                        mapping as a chart-fill colour, for the dashboard's
                        leads-by-status chart
    deal-presentation.ts    (3.3, D48) dealStatusLabel/dealStatusBadgeVariant
                        — same tone-mapping pattern as lead-presentation.ts
    activity-presentation.ts (4.4, D56) activityTypeLabel,
                        activityStatusLabel/activityStatusBadgeVariant — same
                        tone-mapping pattern, used by /tasks and /today;
                        activityRecordHref (4.5, D57) — promoted here from a
                        private copy in tasks-page-client.tsx so the
                        dashboard's recent-activity list could reuse it too
    datetime-local.ts       (2.6, D39) toDatetimeLocalValue/
                        fromDatetimeLocalValue — bridges the native
                        <input type="datetime-local"> (bare local string,
                        no timezone) and the API's ISO instants, for
                        "Next follow-up"
  tests/lib/
    format.test.ts          12 unit tests for lib/format.ts (D27)
    api-client.test.ts      4 unit tests for onUnauthorized (mocked fetch,
                        no DOM needed) (D28)
  tests/components/        (2.4, D37) data-table.test.tsx (7),
                        search-input.test.tsx (4), owner-select.test.tsx
                        (3, mocked fetch + QueryClientProvider); package
                        3.3's deal-form.test.tsx (D42 reset-target, create-
                        mode-defaults-prefill-probability, no Stage field
                        in edit mode), close-lost-dialog.test.tsx (submit
                        disabled until a reason is chosen), deal-detail-
                        page-client.test.tsx (closed deal hides Edit/Move
                        stage/Close actions and shows Reopen instead);
                        package 3.4's pipeline-board.test.tsx (D49 — a
                        successful move via the card dropdown calls POST
                        /deals/:id/stage and the card ends up in the
                        target column; a failed move rolls back — both
                        against a small stateful fake backend; opening the
                        dropdown uses keyboard activation, not a plain
                        click, since jsdom doesn't simulate the pointerdown
                        Radix's trigger opens on in a real browser);
                        package 3.5's convert-lead-dialog.test.tsx (D50 —
                        the race-condition fix itself: no company match
                        defaults to Create new and blocks submit until a
                        name is typed; deal fields vanish once "Create a
                        deal" is toggled off; a double-click on submit
                        sends exactly one request) and lead-detail-page-
                        client.test.tsx (D50 — Convert is enabled only
                        when QUALIFIED, shown-but-disabled for every other
                        open status, hidden once CONVERTED or archived,
                        and the Converted panel's three links resolve to
                        the right hrefs)
  tests/setup.ts            (2.4, D37) afterEach(cleanup) for
                        @testing-library/react — not automatic without
                        vitest's globals:true, which this repo doesn't use
  vitest.config.mts       `.mts` (not `.ts` — avoids a Vite native-loader
                        ESM/CJS warning); one alias (`@` -> package root)
                        mirroring tsconfig.json (D27); environment:"jsdom"
                        + setupFiles:["./tests/setup.ts"] (2.3b/2.4, D36/D37)
  next.config.ts         proxies /api/:path* to API_INTERNAL_URL; transpiles
                        @growspark/shared

apps/api/               Express 5 app (port 4000)
  src/
    app.ts              createApp({ extraRoutes? }) — Express app factory
                        (testable without listening); mounts helmet,
                        requestId, requestLog, enforceOriginAndContentType,
                        express.json(), then every module's routes, then
                        errorHandler last
    index.ts            entry point — calls app.ts, listens
    env.ts              Zod-validated env config: DATABASE_URL,
                        ALLOWED_ORIGINS, TRUST_PROXY, SESSION_TTL_DAYS, PORT,
                        NODE_ENV
    logger.ts            pino logger; silent when NODE_ENV=test (D22)
    db/pool.ts           raw pg Pool, used only by the /health/db check
    db/prisma.ts         PrismaClient singleton, built with @prisma/adapter-pg
    lib/                 context.ts (RequestContext, toSharedRole/
                        toPrismaRole), scoped.ts, password.ts (argon2id +
                        dummy-hash timing defence, D17), cookies.ts (cookie@2
                        stringifySetCookie/parseCookie, D16), session.ts
                        (create/find/touch/delete, sliding 7-day expiry),
                        audit.ts (writeAudit, tx-scoped), prisma-errors.ts
                        (PRISMA_ERROR codes + isKnownRequestError — single
                        source, also used by tests/schema/helpers.ts),
                        rate-limit.ts (loginEmailRateLimiter,
                        createGlobalLoginFloodLimiter factory, D23),
                        route-registry.ts (defineRoute — the one place every
                        route is declared; getRegisteredRoutes for the audit
                        test), pagination.ts (toSkipTake/buildPaginationMeta),
                        list-query.ts (buildOrderBy, 2.1, D33),
                        duplicates.ts (findDuplicateCompanies/Contacts/
                        Leads, 2.1, D33)
    middleware/          request-id.ts, request-log.ts, error-handler.ts
                        (ApiError + ZodError/body-parser/Prisma mapping),
                        session.ts (attachSessionContext), csrf.ts
                        (enforceOriginAndContentType — Origin allow-list +
                        JSON-only-when-body-present, D20), validate.ts
                        (validateRequest — body/params overwrite req.*,
                        query goes to req.validatedQuery since Express 5's
                        req.query has no setter, D19)
    modules/
      auth/               auth.service.ts, auth.routes.ts — POST
                        /auth/login,/logout, GET /auth/me, POST
                        /auth/change-password
      users/              users.service.ts, users.routes.ts — GET/POST
                        /users, GET/PATCH /users/:id, POST
                        /users/:id/{deactivate,reactivate,reset-password},
                        GET /users/options (2.1, D33 — auth:'authenticated',
                        registered before /users/:id); last-Admin rule via
                        a raw SELECT...FOR UPDATE (assertNotLastActiveAdmin)
      audit/              audit.service.ts, audit.routes.ts — GET
                        /audit-events
      lead-sources/       lead-sources.service.ts, lead-sources.routes.ts
                        (2.1, D33) — GET /lead-sources, active only,
                        leads:read
      companies/          companies.service.ts, companies.routes.ts (2.2,
                        D34) — full CRUD + archive/restore,
                        companies:read/write, records:archive
      contacts/           contacts.service.ts, contacts.routes.ts (2.2,
                        D34) — full CRUD + archive/restore, optional
                        companyId link (nullable, detachable),
                        contacts:read/write, records:archive
      leads/              leads.service.ts, leads.routes.ts (2.3, D35) —
                        full CRUD + archive/restore, POST /:id/status
                        (separate from PATCH, no note), GET
                        /:id/status-history, GET /duplicates (registered
                        before /:id), leads:read/write, records:archive;
                        getLead (3.5, D50) now also fetches the lead's
                        LeadConversion row (one extra, cheap findUnique —
                        null for a non-converted lead) and passes it to
                        toLeadResponse's new second parameter, defaulted
                        to null so every other call site is unaffected —
                        found a real bug fixing this: listLeads's
                        `rows.map(toLeadResponse)` had been passing
                        Array.map's numeric index straight into that new
                        parameter, caught by pnpm typecheck, fixed with an
                        explicit arrow wrapper; lead-conversion.service.ts
                        (3.1, D46) — one $transaction (row-locks the lead,
                        link-or-create Company/Contact, optional Deal,
                        convert + history + audit), GET
                        /:id/conversion-matches, POST /:id/convert, both
                        leads:read/leads:write; convertLead (3.5, D50) now
                        accepts an optional companyName override, read
                        only when creating a new company, so a lead with
                        no company name can still convert
      deals/              deals.service.ts, deals.routes.ts (3.2, D47) —
                        full CRUD + archive/restore (allowed on closed
                        deals, deliberately not gated the same as the other
                        mutations), POST /:id/stage, POST /:id/close
                        (Won/Lost, Lost requires a LOSS_REASONS reason),
                        POST /:id/reopen (back to the pipeline's first open
                        stage), PUT /:id/contacts (full replace + one
                        primary), deals:read/write, records:archive;
                        GET /:id/stage-history (3.3, D48 — same shape as
                        Lead's status-history, D35); every query that
                        builds a DealResponse now includes dealContacts
                        (3.3, D48's `dealContactsInclude` — one shared
                        Prisma include, not duplicated per query) so the
                        response's `contacts` summary is always accurate
      pipeline/           pipeline.service.ts, pipeline.routes.ts (3.2,
                        D47) — GET /pipeline/stages, GET /pipeline/summary
                        (per-stage + open totals computed entirely in
                        Postgres SQL, not recomputed in JS), deals:read
    lib/pipeline.ts       getDefaultPipeline/getFirstOpenStage (3.1, D46 —
                        factored out so 3.2's deals.service.ts could reuse
                        them unchanged, not duplicate them)
    routes/health.ts     GET /health, /health/db, mirrored at /api/v1/* — now
                        registered via defineRoute too (auth: 'public'), so
                        the route-registry audit covers it like every other
                        route
    types/express.d.ts   Request.id/.log/.ctx/.validatedQuery augmentation
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
  tsconfig.check.json     widened typecheck (tests/, prisma/*.ts, scripts/,
                        not just src/) — wired into the `typecheck` script
                        (package 1.2c)
  tests/
    health.test.ts, health-db.test.ts   pre-existing health-check tests
    schema/               11 files proving the DATABASE itself rejects bad
                        data (not application-level validation) — helpers.ts
                        re-exports PG_ERROR/isKnownRequestError from
                        src/lib/prisma-errors.ts (single source, package 1.3)
    helpers/              reset-database.ts (TRUNCATE all tables, refuses
                        unless the db name ends `_test`; global beforeEach in
                        setup.ts), tenant.ts (createTestTenant/
                        createTwoTestTenants — real argon2id users, known
                        passwords), http.ts (ALLOWED_ORIGIN,
                        sessionCookieHeader), route-audit.ts (walks the real
                        Express 5 route tree — app.router.stack + rawPath,
                        D19 — and diffs it against the registry)
    auth/, users/, audit/, lib/, middleware/, shared/   one directory per
                        concern added in 1.3/1.3b/1.4 — see §7 for what each
                        proves; 33 test files, 124 tests total as of 1.4
    leads/conversion.test.ts   (3.1, D46) — 12 tests: every conversion
                        combination, the forced-rollback test, the two-
                        concurrent-conversions test, cross-org isolation,
                        the conversion-matches endpoint; 3 more (3.5, D50)
                        — the companyName override creates the company
                        with that name, the 422 still fires with neither
                        source present, GET /leads/:id's conversion
                        summary round-trip
    deals/              crud.test.ts, stage-and-close.test.ts,
                        pipeline.test.ts (3.2, D47) — 19 tests: CRUD +
                        archive/restore, stage moves and close/reopen
                        (including the closed-deal-is-read-only 409s and
                        the probability-overwrite behaviour), and the
                        pipeline summary cross-checked against an
                        independently hand-written SQL query;
                        stage-history.test.ts (3.3, D48) — ordering, actor
                        name, Staff can read, cross-org/missing 404; crud
                        tests extended with the `contacts` summary
                        round-trip and the new contactId filter

packages/shared/        Zod schemas + enums, consumed as a compiled package
  src/roles.ts           ROLES enum
  src/health.ts          health response Zod schema
  src/loss-reasons.ts    LOSS_REASONS constant + Zod enum (package 1.2)
  src/permissions.ts     PERMISSIONS map, ROLE_PERMISSIONS, hasPermission (1.3)
  src/auth.ts            loginSchema, changePasswordSchema, meResponseSchema (1.3)
  src/common.ts          idParamSchema, pageQuerySchema, sortQuerySchema
                        factory, booleanQueryParam (NOT z.coerce.boolean() —
                        see §10) (1.4)
  src/users.ts           create/update/resetPassword/listQuery/response
                        schemas for the users module (1.4)
  src/audit.ts           listAuditEventsQuerySchema, auditEventResponseSchema (1.4)
  src/normalize.ts       normalizeEmail/normalizePhone/normalizeCompanyName (2.1, D33)
  src/lead-statuses.ts    LEAD_STATUSES/OPEN_LEAD_STATUSES tuples + z.enum,
                        not TS enums (2.1, D33)
  src/priorities.ts      PRIORITIES tuple + z.enum (2.1, D33)
  src/duplicates.ts      duplicateMatchSchema — { id, reason } (2.1, D33)
  src/lead-sources.ts    leadSourceResponseSchema + list response (2.1, D33)
  src/companies.ts       create/update/listQuery/response schemas,
                        `{ data, duplicates }` mutation envelope (2.2, D34);
                        phone field now phoneFieldSchema, not free text
                        (2.7 item 2, D41/D45)
  src/contacts.ts        create/update/listQuery/response schemas (2.2,
                        D34); restructured in 2.7 item 3 (D43/D45) — an
                        exported contactCreatableFields map plus a refined
                        createContactSchema (email-or-phone, ZodEffects has
                        no .partial(), so updateContactSchema is built from
                        the same field map directly, same pattern as
                        leads.ts's D39 split); phone field now
                        phoneFieldSchema (2.7 item 2)
  src/leads.ts           create/update/status/listQuery/response schemas,
                        duplicate-check query, status-history schema
                        (2.3, D35); leadCreatableFields exported (2.6,
                        D39 — apps/web rebuilds a form-local schema from it);
                        phone field now phoneFieldSchema (2.7 item 2,
                        D41/D45); leadStatusHistoryResponseSchema gained
                        changedByName (2.7 item 4, D44/D45);
                        leadResponseSchema gained `conversion:
                        {companyId,contactId,dealId} | null` (3.5, D50 —
                        only ever populated by GET /leads/:id, never by
                        the list endpoint)
  src/phone.ts           (2.7 item 2, D41/D45) COUNTRY_CALLING_CODES
                        (fixed, closed list, default +91), toE164,
                        matchCountryCallingCode, isValidPhoneNumber (+91 =
                        10 digits starting 6-9, else 7-15 digits),
                        phoneFieldSchema (strict, manual entry),
                        parsePhoneLenient (reserved, unused — future
                        website-intake path, deliberately separate from
                        the strict validator)
  src/lead-conversion.ts (3.1, D46) convertLeadSchema (companyId/contactId
                        optional — presence means link existing, absence
                        means create new; createDeal + an optional deal
                        sub-object only read when true; 3.5 D50 added
                        companyName, read only when companyId is absent,
                        overriding the lead's own companyName so a
                        nameless lead can still convert),
                        leadConversionResponseSchema,
                        leadConversionMatchesResponseSchema
  src/deals.ts           (3.2, D47) dealCreatableFields (stageId
                        deliberately excluded — create-only, same pattern
                        as Lead's requirement), create/update/moveStage/
                        close/setContacts schemas, listDealsQuerySchema
                        (status/stageId/companyId/contactId/ownerId/
                        archived/q/sort — contactId added in 3.3, D48, for
                        3.5's Contact Deals tab); dealResponseSchema now
                        carries a `contacts` summary array (3.3, D48 — a
                        read gap found and approved while building the
                        Contacts tab); dealContactResponseSchema (the PUT
                        response shape, unchanged);
                        dealStageHistoryResponseSchema +
                        dealStageHistoryListResponseSchema (3.3, D48 — GET
                        /deals/:id/stage-history, same shape as Lead's
                        status history, D35)
  src/pipeline.ts        (3.2, D47) stageTypeSchema,
                        pipelineStageResponseSchema,
                        pipelineSummaryResponseSchema (per-stage totals +
                        a separate open-only aggregate, all string-encoded
                        Decimal values)
  tsconfig.watch.json     incremental build config used only by `dev`/
                        `dev:prepare` (package 1.3b, D24) — tsconfig.json
                        (build/typecheck) stays non-incremental per D12
  scripts/clean-watch-cache.mjs   deletes tsconfig.watch.tsbuildinfo before
                        every `dev:prepare`, so that cache can never go stale
                        the way D12's did

scripts/dev.mjs          root-level orchestrator replacing `pnpm -r
                        --parallel dev` (package 1.3b, D24) — see the `pnpm
                        dev` note in §4

docker-compose.yml       postgres:17-alpine only; project name
                        growspark-sales-crm, named volume, 127.0.0.1:5433 only
docker/init-db.sh        creates crm_test (crm_dev comes from POSTGRES_DB)

docs/
  NEXT-SESSION-START.md   the first file a fresh session reads — brief,
                        hard rules, reading order, the Day 2 plan, open items
  decisions.md           D1–D39 (see §9)
  PROJECT-STATE.md        this file
  DAY-1-SUMMARY.md        what was built/verified per package 1.1–1.7, bugs
                        found and fixed, "how to run the app and log in"
  MANUAL-TEST-DAY1.md     15-section browser click-through script (package
                        1.5, extended in 1.6/1.7) — not yet run by anyone,
                        this environment has no browser (§14)
  design-system/          the Grow Spark Workspace design system handed to
                        this session (README.md, tokens.css, tokens.json,
                        manifest.json, api/, components/*/README.md +
                        preview.html, components/bundle.css) — source of
                        truth for package 1.6, read-only reference, not
                        copied wholesale into apps/web (only tokens.css is
                        copied verbatim, into apps/web/app/design-tokens.css)
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
| apps/api | `cookie` | 2.0.2 | Session cookie serialize/parse. v2 renamed `serialize`/`parse` to `stringifySetCookie`/`parseCookie` (D16) |
| apps/api | `express-rate-limit` | 8.7.5 | Login rate limiting (D16, redesigned in D23) |
| apps/api | `vitest` / `supertest` | 5.1.1 / 7.3.2 | |
| apps/web | `next` | 16.4.6 | `next lint` was removed in 16.0.0; ESLint runs directly |
| apps/web | `react` / `react-dom` | 19.3.1 | |
| apps/web | `tailwindcss` | 4.3.5 | |
| apps/web | `shadcn` (CLI, dev) | 4.23.0 | |
| apps/web | `cn`, `radix-ui`, `class-variance-authority` | 0.5.2, 1.8.1, 0.7.1 | What the installed shadcn CLI actually generates now — verified live, not assumed; see `decisions.md` D11 |
| apps/web | `@tanstack/react-query` | 5.108.0 | |
| apps/web | `react-hook-form`, `@hookform/resolvers` | 7.92.0, 7.0.7 | Package 1.5. CLI-added with `^` ranges, re-pinned exact (D26) |
| apps/web | `sonner`, `next-themes` | 2.0.8, 0.4.6 | Package 1.5, same re-pin story. `next-themes` only exists for Sonner's `useTheme()` call — no theme toggle built (D26) |
| apps/web | `lucide-react` | 1.76.0 | Package 1.5 — the shadcn CLI referenced it in 4 components but didn't actually install it (D26) |
| apps/web | `vitest` | 5.1.1 | Package 1.6 — added (with explicit sign-off) so `lib/format.ts` could ship with real unit tests; same pinned version as `apps/api` (D27) |
| apps/web | `jsdom`, `@testing-library/react`, `@testing-library/dom` | 31.0.1, 16.3.3, 10.4.2 | Package 2.3b — added for component tests (2.4); `vitest.config.mts` sets `environment: "jsdom"` globally (D36) |
| apps/web | `@dnd-kit/core` | 6.3.1 | Package 3.4 — the pipeline board's drag and drop; confirmed no peer-dependency warning against `react@19.3.1` before installing. `@dnd-kit/sortable`/`/utilities` deliberately **not** added — approval was core only (D49) |
| apps/web | `recharts` | 3.11.0 | Exact-pinned by the owner in `064a0f7`; approved for Day 4 dashboard charts, peer range includes React 19.3.1; first used in package 4.5 |
| packages/shared | `zod` | 4.6.7 | |

## 7. What has been built, package by package

Claude Code itself never runs `git push` — every commit below was made
locally only, from this tool's side. **The project owner pushes manually**,
after reviewing each report, so `git status` showing `main` already "up to
date with origin/main" at the start of a session (seen around package
1.4/1.5, and again after packages 1.6/1.7) simply means the owner reviewed
and pushed what was committed before that session started — not a mystery,
not something to investigate.

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
- **Package 1.2c — housekeeping** (`307e373`): widened typecheck
  (`tsconfig.check.json`) to cover `tests/`/`prisma/*.ts`/`scripts/`;
  refreshed the stale README; added the website-repo rule to `CLAUDE.md`;
  added `resetDatabase()` (TRUNCATE, guarded to `_test`-suffixed databases)
  and `createTestTenant()`/`createTwoTestTenants()` ahead of package 1.3
  needing them.
- **Package 1.3 — API core, sessions, auth, permissions** (`c095a9c`):
  server-side sessions (opaque token, SHA-256 hash stored, sliding 7-day
  expiry), argon2id passwords with a login timing defence, the permission
  map (`PERMISSIONS`/`ROLE_PERMISSIONS`/`hasPermission`), the route registry
  (`defineRoute` — every route declares `'public'`/`'authenticated'`/a
  permission; a test audits the live Express route tree against it), the
  central error handler (ZodError/body-parser/Prisma mapping), CSRF (Origin
  allow-list + conditional JSON check), login/logout/me/change-password. 90
  tests. Full detail in `docs/decisions.md` D16–D22.
- **Package 1.3b — fixes before the gate approval** (`2f43bf4`): (1)
  resolved D21 (Next's proxy never forwards the real client IP) by replacing
  the per-IP login limiter with a global flood ceiling (`skipSuccessfulRequests`
  on both remaining limiters, D23); (2) root-caused and fixed the `pnpm dev`
  startup race — not a timing issue with `packages/shared`'s rebuild (though
  that redundant rebuild was real and separately fixed) but `pnpm -r
  --parallel`'s own scheduler breaking `tsx watch`'s child-process startup
  (D24); replaced with `scripts/dev.mjs`. Verified with 5 clean cold-state
  runs, then re-verified again after the review gate (see §15's latest
  entry). 92 tests (2 net new after the rate-limit test rewrite).
- **Package 1.4 — users module, last-Admin rule, audit log** (`7e780de`):
  full user CRUD, the last-Admin rule via a raw `SELECT ... FOR UPDATE`
  (verified with a real concurrency test — two Admins demoted at once,
  exactly one succeeds), deactivate/reset-password deleting the target's
  sessions, one audit row per mutation with before/after metadata and no
  secrets, cross-organisation 404s. 123 tests (124 after the D25 follow-up
  fix below). `docs/decisions.md` D25.
- **Package 1.4 follow-up** (`18510fb`): fixed a real gap flagged on review
  — `user.role_changed`'s audit metadata only carried `oldRole`/`newRole`
  when a `PATCH` changed both `name` and `role` in one request; it now also
  carries `oldName`/`newName`. One new test added (124 tests total). This
  commit also brought this file current through 1.2c–1.4 (it had been
  stale since the 1.1/1.2 session).
- **Package 1.5 — web shell, login, Users page**: Next.js UI for everything
  1.3/1.4 built. `AuthGuard` (client-side nav only, never the security
  control — D26) + role-aware `AppShell` (sidebar, user menu, logout);
  `/login` (React Hook Form + the shared Zod schema, inline errors, generic
  failure message); `/` (Home placeholder); `/users` (server-paginated
  table, search/role/status filters, create/edit/deactivate/reactivate/
  reset-password dialogs, 409 `LAST_ADMIN` and field errors shown inline,
  unexpected errors as a toast with the request id); `/forbidden` (403);
  `not-found.tsx` (404). 10 shadcn components added
  (input/label/form/table/dialog/dropdown-menu/badge/sonner/skeleton/
  select/alert). Verified: `pnpm build` clean, all 5 routes render; full
  login→me→users-list→logout cycle proven with curl through the :3000 proxy
  (no browser in this environment); `docs/MANUAL-TEST-DAY1.md` written for
  the user to run the parts only a browser can show. See `docs/decisions.md`
  D26 for what was non-obvious (the missing `lucide-react` dependency, the
  `Suspense fallback={null}` blank-flash finding, the deliberate absence of
  any `proxy.ts`).
- **Package 1.6 — Grow Spark design system applied to `apps/web`**: tokens
  loaded once (`design-tokens.css`, verbatim from `docs/design-system/`)
  and mapped through Tailwind v4's `@theme inline` to every shadcn semantic
  colour; theming switched to `data-theme` with a Light/Dark/System toggle
  in the (rebuilt) user menu; Inter + JetBrains Mono via `next/font`
  (400/500/600 only); `AppShell` rebuilt as a 240px dark sidebar (Sales
  product chip) + 56px top bar carrying the page title; Button/Field
  (Input/Label)/Badge/Alert/Table restyled and Tabs added, all matching
  their component READMEs; shared INR/date/time formatters
  (`lib/format.ts`) with 12 unit tests (new `vitest` devDependency,
  approved before adding); the one other hard-coded colour found
  (`dialog.tsx`'s `bg-black/50` scrim) fixed to the README's documented
  `bg-ink/40`; duplicate per-page `<h1>`s removed now that the top bar
  carries the title; the pasted hydration-mismatch error fixed with
  `suppressHydrationWarning` on `<html>`. `pnpm typecheck && pnpm lint &&
  pnpm test && pnpm build` all pass (136 tests total: 124 `apps/api` +
  12 new `apps/web`). Console-clean on `/login` and `/` was checked via
  `curl` against the SSR payload (confirms `suppressHydrationWarning`
  reaches `<html>`, no server exception markers) — not a live browser
  console, which this environment cannot run; added as an explicit manual
  check in `docs/MANUAL-TEST-DAY1.md` §15 instead (renumbered from §12
  after package 1.7 inserted its own sections before it — see §13/§14).
  Full detail in `docs/decisions.md` D27.
- **Package 1.7 — search box pattern, session expiry, Cache Components
  validation**: `SearchInput` (magnifier runs the search, clear-`x`
  appears once there's text and resets the filter) replaces the Users
  page's separate input+button, built as a reusable wrapper so Leads/
  Companies/Contacts can reuse it unchanged. A global 401 handler
  (`api-client.ts`'s `onUnauthorized`, registered by the new
  `SessionExpiryHandler`) now clears the TanStack Query cache and redirects
  to `/login?next=<path>` on **any** API call's 401, not just the ones
  TanStack Query itself tracks — guarded against redirect loops and
  against firing on `/login`'s own (expected) failed-login 401.
  `useMe()` now revalidates on window focus; `AuthGuard` revalidates it on
  every route change inside the protected shell too — together these catch
  a deactivated user on their next focus or navigation, not just on a
  manual refresh. Cache Components' dev-only "instant navigation"
  validation notice on protected pages is silenced with one `export const
  instant = false;` on `(protected)/layout.tsx` (confirmed with the user
  what the fix should be — the earlier decision referenced wasn't
  recoverable from this repo's history). `pnpm typecheck && pnpm lint &&
  pnpm test && pnpm build` all pass (140 tests: 124 `apps/api` + 16
  `apps/web`, 4 new this package). Full detail in `docs/decisions.md` D28.

- **Package 2.0 — Day 1 leftovers**: (a) every `page.tsx` under
  `app/(protected)/` is now a thin Server Component wrapper carrying its own
  `export const instant = false` — `users/page.tsx` (a Client Component
  before, unable to carry `instant` at all) now renders the new
  `components/users/users-page-client.tsx` (`UsersPageClient`, logic
  unchanged); `page.tsx` (Home) and `forbidden/page.tsx`, already Server
  Components with no interactivity, simply gained the same export directly,
  no client split introduced for static content. (b) `PasswordInput`
  (`apps/web/components/ui/password-input.tsx`, Lucide Eye/EyeOff toggle)
  replaces the plain password `Input` in `login-form.tsx`,
  `create-user-dialog.tsx`, and `reset-password-dialog.tsx`. `pnpm typecheck
  && pnpm lint && pnpm test && pnpm build` all pass (140 tests, unchanged —
  UI restructuring/wiring, no new logic needing its own test). Full detail
  in `docs/decisions.md` D31.
- **Package 2.1 — foundations (list helper, normalisers, duplicate finder,
  lookups)**: `packages/shared/src/normalize.ts`
  (normalizeEmail/normalizePhone/normalizeCompanyName); `lead-statuses.ts`/
  `priorities.ts` (tuple + z.enum, not TS enums — see D33 for why);
  `duplicates.ts` (shared `duplicateMatchSchema`); `lead-sources.ts`
  (response schemas). `apps/api/src/lib/duplicates.ts`
  (findDuplicateCompanies/Contacts/Leads, three explicit functions) and
  `list-query.ts` (`buildOrderBy`, the one generic helper this package
  added — `pagination.ts`'s toSkipTake/buildPaginationMeta from 1.4 were
  reused unchanged). New `lead-sources` module (`GET /api/v1/lead-sources`,
  active-only, `leads:read`). `GET /api/v1/users/options` added to the
  existing `users` module (`auth: 'authenticated'`, not `users:manage` —
  Staff needs it for owner pickers; registered before `/users/:id` for
  Express route-ordering reasons), which required updating
  `registry-permissions.test.ts`'s Staff-403 sweep to exclude it. Also
  recorded, before this package started: a real conflict between the 2.3
  brief (lead status changes should record an optional note) and the
  already-migrated schema (`lead_status_histories` has no note column) —
  stopped and asked per instruction; resolved as "drop the note entirely,"
  affecting package 2.3, not this one. `pnpm typecheck && pnpm lint && pnpm
  test && pnpm build` all pass (149 tests: 124 carried over + 25 new, all
  `apps/api`). Full detail in `docs/decisions.md` D32 (the conflict) and
  D33 (this package).
- **Package 2.2 — Companies and Contacts API**: full CRUD plus
  archive/restore for both resources (`apps/api/src/modules/companies/`,
  `modules/contacts/`), server-side search/filter/sort/paging reusing
  2.1's `buildOrderBy` + 1.4's pagination helpers, Contact-to-Company
  linking (nullable, so a contact can detach), create/update responses
  carrying `{ data, duplicates }` via the duplicate finder from 2.1,
  same-organisation checks on `ownerId`/`companyId` before they're wired
  onto a row (the FK alone doesn't prove cross-org safety — D13), audit
  rows for every create/update/archive/restore. `pnpm typecheck && pnpm
  lint && pnpm test && pnpm build` all pass (187 tests: 149 carried over +
  38 new, all `apps/api`). Full detail in `docs/decisions.md` D34.
- **Package 2.3 — Leads API**: full CRUD plus archive/restore
  (`apps/api/src/modules/leads/`); the status workflow from D29/D32 as a
  separate `POST /leads/:id/status` endpoint (`CONVERTED` excluded as a
  target by the `OpenLeadStatus` type itself, rejected as a current state
  with 409, every change writing one `LeadStatusHistory` row — no note
  column); `requirement`/`capturedFields` genuinely absent from the update
  schema (not rejected — silently stripped by Zod, like any other unknown
  key), so they survive a `PATCH` unchanged; clearing both email and phone
  on update is a service-level 422 (not a database `P2039` falling through
  to 500); `GET /leads/duplicates` (the standalone duplicate-check
  endpoint the brief asked for) and `GET /leads/:id/status-history` (not
  explicitly asked for, added anyway — cheap now, useful for the 2.4–2.6
  UI ahead of Day 4's richer timeline). `pnpm typecheck && pnpm lint &&
  pnpm test && pnpm build` all pass (215 tests: 187 carried over + 28 new,
  all `apps/api`). Full detail in `docs/decisions.md` D35.
- **Package 2.3b — small backend fixes**: archive/restore on a record
  already in that state now returns 409 (`ALREADY_ARCHIVED`/
  `NOT_ARCHIVED`), not 404, across Companies/Contacts/Leads; missing or
  cross-organisation stays 404. Re-confirmed (read-only) that `activities`
  can hold a `NOTE` type for Day 4, no schema change. Contact
  `lifecycleStatus` stays free text and will be hidden from the Day 2 UI
  (PRD never enumerates its values). Added `jsdom`/`@testing-library/react`/
  `@testing-library/dom` to `apps/web` for 2.4's component tests. `pnpm
  typecheck && pnpm lint && pnpm test && pnpm build` all pass (219
  `apps/api` tests: 215 carried over + 4 new). Full detail in
  `docs/decisions.md` D36.
- **Package 2.4 — shared UI building blocks**: `DataTable`
  (`components/ui/data-table.tsx` — server-side paging/sorting, filter bar
  slot, loading skeleton, empty/error states, first column opens the
  record via a real `Link`, not row-level click handling); `RecordLayout`
  (`components/ui/record-layout.tsx` — header/key-fields-strip/Tabs, built
  but not yet wired into a page); `OwnerSelect` and `CompanySelect`
  (`components/pickers/`); `useListUrlState`
  (`hooks/use-list-url-state.ts` — page/pageSize/filters live in the URL).
  Wired into a real Companies list page (`app/(protected)/companies/`) with
  a new sidebar entry. `ConfirmActionDialog` moved from `components/users/`
  to `components/ui/` (it was always generic). Component tests for
  `DataTable`, `SearchInput`, and `OwnerSelect` (the one picker tested, per
  the brief) — needed a new `apps/web/tests/setup.ts`
  (`afterEach(cleanup)`) since RTL's auto-cleanup doesn't self-register
  without vitest's `globals: true`, which this repo doesn't use. `pnpm
  typecheck && pnpm lint && pnpm test && pnpm build` all pass (249 tests:
  219 `apps/api` unchanged + 30 `apps/web`, 14 new). Full detail in
  `docs/decisions.md` D37.
- **Package 2.5 — Companies and Contacts UI**: a real PRD/schema conflict
  found and resolved before building (Contact's "alternate phone"/
  "preferred communication method" aren't in the schema — dropped, no
  migration). Companies get full create/edit pages
  (`/companies/new`, `/companies/[id]/edit`) and a detail page with a
  Contacts tab; Contacts get a `ContactFormDialog` (create/edit, reusable
  from both `/contacts` and a Company's Contacts tab) and a detail page.
  Both forms validate against the *create* schema even when editing
  (avoids a real `react-hook-form`/Zod generic conflict — `annualRevenue`'s
  `z.coerce.number()` has an `unknown` input type in Zod v4). Duplicate
  hint on company-name blur (no dedicated endpoint — reuses the list's `q`
  search, warn-only). Archive/restore via the shared `ConfirmActionDialog`
  everywhere. New `Textarea` component; new `stripEmptyOptionalFields`
  helper so a blank optional field means `null`, not a literal `""`. `pnpm
  typecheck && pnpm lint && pnpm test && pnpm build` all pass (249 tests,
  unchanged — UI wiring over already-tested 2.2 endpoints). Full detail in
  `docs/decisions.md` D38.
- **Package 2.6 — Leads UI**: list page (`/leads`) with search plus all
  five named filters (status/source/priority/owner/created-date-range),
  server-side sort limited to name/status/priority/created, archived
  toggle; create form (`/leads/new`) and edit form (`/leads/[id]/edit`)
  sharing `leadCreatableFields` (newly exported from
  `packages/shared/src/leads.ts`) but genuinely different form-local
  schemas — `requirement` is create-only, never editable; the
  name+email-or-phone rule enforced client-side via `.refine()` on both;
  duplicate-warning banner calls the real `GET /leads/duplicates` endpoint
  (unlike Company's blur-hint approximation, D38) and never blocks saving.
  Detail page (`/leads/[id]`) shows status-change buttons for every open
  status except the current one, hides the whole section once
  `CONVERTED` (D29 — no Day 3 convert action exists yet), a read-only
  "Original enquiry" panel (`requirement` + `capturedFields`), and a
  History tab listing every `LeadStatusHistory` row newest-first. New
  `lib/datetime-local.ts` converts between the native
  `datetime-local` input and ISO instants for "Next follow-up". Sidebar
  gained a **Leads** entry, placed first. `pnpm typecheck && pnpm lint &&
  pnpm test && pnpm build` all pass (249 tests, unchanged — UI wiring over
  already-tested 2.3 endpoints). Full detail in `docs/decisions.md` D39.

- **Package 2.7 item 1 (`569b27d`) — D42, new-record forms always open
  empty.** Root cause confirmed (not assumed) from Next's own bundled docs:
  `cacheComponents: true` plus `/leads/new`/`/companies/new` building as
  fully static routes means Next's Cache Components hides a navigated-away-
  from page with React's `Activity` instead of unmounting it, so form state
  survives a revisit — but effect cleanup still fires on hide, exactly like
  unmount. Fixed with a `useLayoutEffect` whose cleanup unconditionally
  resets the form to blank, scoped to create mode only, in `LeadForm`,
  `CompanyForm`, and `ContactFormDialog` (which also force-closes itself on
  hide, since Activity can preserve an open dialog's stale draft too). 11
  new `apps/web` tests. Full detail in `docs/decisions.md` D45.
- **Package 2.7 item 2 (`f8a5e9f`) — D41, structured E.164 phone input.**
  New `packages/shared/src/phone.ts` (country-code list default +91,
  strict per-country validation, `phoneFieldSchema`, a reserved-but-unused
  `parsePhoneLenient` for a future website-intake path); new
  `PhoneInput`/`formatPhoneForDisplay` wired into all three forms and every
  phone display site. Found and fixed a real bug in `PhoneInput`'s first
  draft: it updated its own change-tracker inside `emit`, mistaking a
  same-render echo of its own `onChange` for an external change and
  stomping the just-typed digit — fixed to only ever update the tracker
  from the external prop, matching `CompanySelect`'s actual mechanism
  (D37). Updated two pre-existing API tests that posted a non-E.164 phone
  directly. Full detail in `docs/decisions.md` D45.
- **Package 2.7 item 3 (`abb10fb`) — D40 + D43, minimal required fields.**
  Every required field across Company/Contact/Lead now shows `*`; every
  "(optional)" suffix dropped. Company gets a new collapsed "More details"
  section (new `Collapsible` primitive) for its non-core fields, expanded
  automatically on edit only when it already has a value in one of them.
  Lead's Source now preselects the seed's "Manual" source by name on
  create. Contacts now require an email or a phone (`contacts.ts`
  restructured the same way `leads.ts` was for D39; `contacts.service.ts`
  gained the same post-patch guard `leads.service.ts` has). Found and fixed
  seven pre-existing tests that created a contact via the API with neither
  email nor phone. Full detail in `docs/decisions.md` D45.
- **Package 2.7 item 4 (`1dfbeb7`) — D44, lead history shows the actor;
  hint only when unmet.** `leadStatusHistoryResponseSchema` gained
  `changedByName` (joined at query time, no schema change); the lead
  detail page's History tab now reads "by `<name>`". The lead form's
  "provide an email or phone" hint is now conditional, matching the
  pattern already built correctly for Contact in item 3. Full detail in
  `docs/decisions.md` D45.

**Package 2.7 is now done (items 1–4 built and verified; item 5 is this
documentation pass).** `pnpm typecheck && pnpm lint && pnpm test && pnpm
build` all pass after every one of the four commits above, final count
244 `apps/api` + 53 `apps/web` = 297 tests. Nothing pushed.

- **Package 3.1 (`3f08a38`) — the lead conversion transaction.** The
  hardest item on the roadmap, built first per the brief:
  `lead-conversion.service.ts`'s `convertLead` is one `$transaction`
  (row-locks the lead with a raw `SELECT ... FOR UPDATE`, same pattern as
  the last-Admin rule), following the brief's five steps — refuse unless
  the lead is `QUALIFIED` and not archived/already-converted; link or
  create a Company; link (fill-empty-fields-only, never overwrite) or
  create a Contact; optionally create a Deal in the pipeline's first open
  stage with a `DealContact`/`DealStageHistory` row; convert the lead,
  write its history, write a `LeadConversion` row, repoint its activities,
  audit the whole thing. `GET /leads/:id/conversion-matches` (plain,
  non-blocking) and `POST /leads/:id/convert` are the two new routes.
  `tests/helpers/tenant.ts` now also builds a real six-stage pipeline per
  tenant, matching the seed. 12 new tests (`tests/leads/conversion.test.ts`)
  including a forced mid-transaction rollback and a two-concurrent-
  conversions race. `pnpm typecheck && pnpm lint && pnpm test && pnpm
  build` all pass (256 `apps/api` + 53 `apps/web` = 309 tests). Full detail,
  including the "company name required to create a new company" judgment
  call, in `docs/decisions.md` D46.
- **Package 3.2 (`f2c59e0`) — Deals API, stage moves, close/reopen,
  pipeline summary.** Full Deal CRUD (`deals.service.ts`/`deals.routes.ts`)
  on top of 3.1's pipeline helpers (factored into the new, shared
  `apps/api/src/lib/pipeline.ts`): create (company required and in-org
  checked, owner defaults to the caller, stage defaults to the pipeline's
  first open stage); `POST /:id/stage` (refuses a non-open target or a
  non-open deal, copies the new stage's probability every time per the
  roadmap's D7); `POST /:id/close` (Won/Lost, Lost requires a
  `LOSS_REASONS` reason); `POST /:id/reopen` (back to the first open
  stage); archive/restore (deliberately **not** blocked by the closed-deal
  read-only rule — see D47); `PUT /:id/contacts` (full replace, one
  primary). New `pipeline` module: `GET /pipeline/stages`, `GET
  /pipeline/summary` (per-stage counts/totals/weighted-totals plus a
  separate open-only aggregate, computed entirely as Postgres SQL so it
  reconciles exactly with a hand-written SQL check, never recomputed in JS
  over floats). 19 new tests across `tests/deals/{crud,stage-and-close,
  pipeline}.test.ts`. `pnpm typecheck && pnpm lint && pnpm test && pnpm
  build` all pass (275 `apps/api` + 53 `apps/web` = 328 tests). Full
  detail, including the "reopen goes to the pipeline's first open stage"
  and "archive/restore allowed on closed deals" judgment calls, in
  `docs/decisions.md` D47.

**Packages 3.1 and 3.2 were committed before this file (and
`docs/decisions.md`) were updated for them — this section and D46/D47 were
written in a docs-only catch-up pass on 2026-11-20, immediately before
package 3.3 started, once the gap was noticed and flagged to the user.**
Nothing about either package's actual behaviour changed in that catch-up —
only the documentation caught up to the already-shipped, already-tested
code.

- **Package 3.3 (`fd8fb2b`) — Deals list, forms, detail, close dialogs.**
  `/deals` (list — search, stage/status/owner/company filters, archived
  toggle, server-side sort on name/value/probability/expectedCloseDate);
  `/deals/new` and `/deals/[id]/edit` sharing one `DealForm` (Stage is
  create-only — `updateDealSchema` has no `stageId` key at all, D47 —
  defaults to the pipeline's first open stage and copies its probability;
  `value`/`probability` hit the same `z.coerce.number()` gotcha as
  Company/Lead, D38/D39); `/deals/[id]` (`RecordLayout` — key facts
  include a client-computed Weighted value; Overview/Contacts/Stage
  history tabs; Edit, Move stage via a `DropdownMenu`, Close as Won, Close
  as Lost requiring a `LOSS_REASONS` reason, Reopen, and Archive/Restore,
  all correctly gated by `deal.status` per D47, with Archive/Restore
  deliberately not gated). Three backend additions, each checked against
  the pre-approved allowance before being built: `GET
  /deals/:id/stage-history` (same shape as Lead's status history, D35);
  a `contactId` filter on `GET /deals` (via the `DealContact` join, ahead
  of 3.5); and, after stopping to ask because it was genuinely outside the
  pre-approved allowance, a `contacts` summary array added to
  `dealResponseSchema` itself (one shared Prisma include reused across
  every Deal query), closing a real gap — the brief's "list this deal's
  contacts" had no corresponding read endpoint, only the write-and-return
  `PUT /deals/:id/contacts`. New `ContactSelect` picker (same hand-built
  combobox as `CompanySelect`, D37) and `apiPut` (this frontend's first
  `PUT` route). Component tests deliberately avoid simulating a Radix
  `Select` open/pick, consistent with every existing test in this repo.
  `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all pass (279
  `apps/api`: 275 carried over + 4 new; 63 `apps/web`: 53 carried over +
  10 new; 342 total). Full detail in `docs/decisions.md` D48.
- **Package 3.4 (pipeline board, `@dnd-kit/core`).** A Board/List toggle
  on `/deals` (`?view=board`, kept in the URL); Board shows one column per
  `OPEN` pipeline stage (Won/Lost never get a column — their totals
  surface in a small "Open pipeline" summary bar instead, from `GET
  /pipeline/summary`'s own `open` aggregate, D47); every card carries an
  always-present "Move to…" dropdown plus real pointer/keyboard drag via
  the new, exact-pinned `@dnd-kit/core@6.3.1` (confirmed no
  peer-dependency warning against `react@19.3.1` before installing;
  `@dnd-kit/sortable`/`/utilities` deliberately not added — approval was
  core only). Each column runs its own fixed-shape `useDealsList` query
  (no filters/sort choice) so its cache key stays predictable for the
  optimistic move-mutation shared by both the dropdown and the drag
  handler (snapshot both affected columns, patch both, roll back on
  error, broadly invalidate `deals`+`pipeline` on settle either way). The
  one explicitly required test (dropdown move calls the stage endpoint
  and updates the column; a failed move rolls back) is proven against a
  small stateful fake backend; **the actual pointer/touch drag gesture
  itself could not be interactively verified** — no browser-automation
  tool exists in this environment, the same limitation already true of
  every other UI feature in this project — so "clean and reliable" drag
  specifically is for the user to confirm in a real browser, per the
  brief's own time-box clause. `pnpm typecheck && pnpm lint && pnpm test
  && pnpm build` all pass (279 `apps/api`, unchanged; 65 `apps/web`: 63
  carried over + 2 new; 344 total). Full detail in `docs/decisions.md`
  D49.
- **Package 3.5 (Convert dialog and related tabs) — Day 3 is now
  complete.** `companyName` added to `convertLeadSchema` (read only when
  creating a new company, overriding the lead's own — the Convert
  dialog's "create new company" field stays editable and required even
  for a lead with no company name, instead of the existing 422); `GET
  /leads/:id` gained a `conversion` summary (found and fixed a real bug
  while wiring it in — `listLeads`'s bare `rows.map(toLeadResponse)` was
  passing the array index into the new parameter, caught by `pnpm
  typecheck`). Lead detail's Convert action is a real trigger only when
  `QUALIFIED` and not archived, disabled elsewhere, hidden once
  `CONVERTED`/archived, with a new "Converted" panel (links + date)
  replacing "Change status". `ConvertLeadDialog` (three Link/Create
  `ModeToggle` sections) prefills from `GET
  /leads/:id/conversion-matches`; **a genuine race condition was found by
  this package's own tests** — the first draft could silently overwrite
  text the user had already typed once the async matches arrived — fixed
  by keeping the form unrendered until the lookup settles. `DealsTab`
  (Company's and Contact's detail pages) and `DealForm`'s new
  `defaultCompanyId` close the loop back to Deals. `pnpm typecheck &&
  pnpm lint && pnpm test && pnpm build` all pass (282 `apps/api`: 279
  carried over + 3 new; 74 `apps/web`: 65 carried over + 9 new; 356
  total). Full detail in `docs/decisions.md` D50.

**Package 4.0 (lead-source optionality, numeric input and SQL reconciliation) is complete.**
Lead Source is optional in shared validation and the form; omitted values resolve
to the organization-scoped `Manual` source in the API. Money/number controls
preserve editable text (including leading zeroes) and send decimal strings to
the API, where Prisma `Decimal` receives those exact strings. The independent
SQL and authenticated `GET /pipeline/summary` both returned count 1, value
56677, weighted value 14169.25; details in `docs/reconciliation.md`. No schema
migration or dependency was added. Root verification passed: 283 API + 75 web
tests (358 total). See `docs/decisions.md` D51.

**Day 3 (lead conversion, deals, pipeline) is done.** Day 4 packages 4.0,
4.1 and 4.2 are complete. Day 4's UI is intentionally pending a separate
user prompt.

**Package 4.1 (Activities API, timelines and organisation time bounds) is complete.**
Added `GET|POST /activities`, `GET|PATCH /activities/:id`, complete/cancel
actions, and timelines for leads, contacts, companies and deals, all guarded
by the existing `activities:read`/`activities:write` permissions. Cross-org
links return 404; deal activities inherit the deal's company; Notes start
DONE; repeat completion is 409. Timelines merge activities with lead status,
conversion and deal stage history, with computed `nextActivity`. `orgDayBounds`
and `orgMonthBounds` are the shared UTC-boundary helpers. Existing link and
assignee/due indexes were reused; no schema migration, new permission or
dependency. Root verification: 288 API + 75 web tests (363 total), all gates
passed. See `docs/decisions.md` D52.

**Package 4.2 (Today, dashboard and sample data) is complete.** Added
`GET /today` (`activities:read`, default scope `mine`) and `GET /dashboard`
(`dashboard:read`, default scope `all`). Metrics and breakdowns follow the
approved definitions, use organisation-scoped SQL, and exclude archived
records; metric, chart, pipeline and recent-activity results are checked
against independent SQL for `all`/`mine`, one-day/empty ranges, empty
organisations and cross-org isolation. Added the dev-only, production-
refusing, idempotent `pnpm db:seed:sample` script. No schema or permission
change and no dependency. Root verification: 290 API + 75 web tests (365
total), all gates passed. See `docs/decisions.md` D53.

**Package 4.2b (Day 4 backend gaps) is complete.** Lead and deal detail
responses now include the computed next open task/call/meeting with an
organisation-local overdue flag. Activity listing supports inclusive due
bounds and `overdue=true` via `orgDayBounds`; existing owner, status, type,
record-link and dueAt sort filters remain. The monthly revenue chart now
anchors to the organisation's local month. Tests cover fixed-clock endpoint
boundaries, mixed timelines, both detail endpoints, Staff access, cross-org
Today isolation, empty-range/empty-org dashboard auxiliary SQL and the month
transition. Root verification: 294 API + 75 web tests (369 total); all gates
passed. See `docs/decisions.md` D54.

**Package 4.3 (Activity composer and record timelines) is complete.** Added a
shared composer for Task, Call, Meeting and Note to Lead, Contact, Company and
Deal timelines; activities link to the current record, Notes omit due date
and are stored DONE, and the assignee defaults to the signed-in user. The
shared timeline merges activities with lead status/conversion and deal-stage
history newest-first, with load-more paging and Complete/Cancel actions.
Completed activity entries show completion time and actor, enriched from
existing audit events without a schema change. Lead/deal key facts show the
API's next activity and overdue status. Tests: 295 API + 79 web = 374.
`pnpm typecheck`, `pnpm lint`, `pnpm --filter api test`,
`pnpm --filter web test`, and `pnpm build` passed. Lint retains three
existing React Hook Form warnings. No schema, migration, permission change or
dependency added. Browser/theme/focus checks remain unverified; no browser
was launched. See `docs/decisions.md` D55.

**Package 4.4 (My Tasks and Today workspace UI) is complete — resumed and
finished after a prior session left it half-built and uncommitted.** The
prior session's uncommitted backend diffs (a `priority` filter on
`GET /activities`, and `GET /today` items linking straight to their own
record via new `recordType`/`recordId` fields instead of a filtered-list
href) were audited, kept (they match this package's brief and the per-row
"open the record" requirement), and the existing `workspace.test.ts`
assertions that still expected the old filtered-list hrefs were corrected
rather than left to fail. The prior session's partial `/tasks` page was
rewritten to reuse `DataTable`, the shared `Tabs` primitive (Open/Overdue/
Done), and the existing `priorityLabel`/`priorityBadgeVariant` helpers,
rather than a hand-rolled list and raw enum text — it had also imported a
`formatDateTime` helper that does not exist in `lib/format.ts`, which would
have failed to compile. `/today` did not exist at all in the prior
session's work despite the sidebar already linking to it; it is now built:
one card per section (Overdue, Tasks due today, Meetings this week, New
leads, Deals closing soon, Deals with no next activity, Recently updated
deals), a Mine/All scope toggle kept in the URL (`GET /today?scope=`), a
Complete action on the two task sections, and an "Add follow-up" quick
action on every row with a record (a new `AddFollowUpDialog` reusing the
existing `ActivityComposer` inside a controlled `Dialog`, closing itself via
`ActivityComposer`'s own new `onCreated` callback — that callback was the
one part of the prior session's `ActivityComposer` diff this package
actually needed). New `apps/web/lib/activity-presentation.ts` mirrors the
existing `lead-presentation.ts` pattern for activity type/status labels and
badge variants. Tests: 5 new `apps/web` component tests for `/tasks`, 3 for
`/today`, 1 new `apps/api` test for the priority filter, plus the corrected
`workspace.test.ts` assertions — **296 `apps/api` + 87 `apps/web` = 383
total.** `pnpm typecheck`, `pnpm lint`, `pnpm --filter api test`, `pnpm
--filter web test`, and `pnpm build` all passed (Docker Desktop needed a
manual restart first — it was not already running at session start, same
as previously documented in §4). Lint retains the same three pre-existing
React Hook Form warnings. No schema, migration, permission, or dependency
change. One jsdom-only finding worth knowing: Radix's `Tabs.Trigger`
activates on `mousedown`/`focus`, not `click` — `fireEvent.mouseDown` is
needed in tests, the same class of jsdom quirk already recorded for the
pipeline board's dropdown in D49. Browser/theme/focus/keyboard checks
remain unverified; no browser was launched. See `docs/decisions.md` D56.

**Package 4.5 (dashboard on Home) is complete — Day 4 is now done.** The
Home placeholder is replaced by the real dashboard: a date-range control
(This month default, Last 30 days, Custom range) and an All (default)/Mine
scope toggle, both kept in the URL; nine `StatCard` KPI tiles (new
`components/ui/stat-card.tsx`, built from the design system's own
`StatCard` README — the brief's nine cards exceed that README's stated
six-card cap, logged as a conflict resolved in the brief's favour, D57);
four single-series `DashboardBarChart`s (new, `components/dashboard/`) —
leads by source, leads by status (coloured per bar by status tone, reusing
the Leads list's own `leadStatusBadgeVariant` mapping), pipeline by stage
(`OPEN` stages only, matching the Kanban board's Won/Lost exclusion), and
monthly won revenue — each a decorative chart plus a screen-reader-only
data table, both populated straight from `GET /dashboard`, no recomputation
in the browser; and a recent-activity list reusing the same
`activityRecordHref` helper `/tasks` already had (promoted to
`activity-presentation.ts` so both share one copy). `recharts@3.11.0`
(already pinned in `064a0f7`) is used for the first time. No `apps/api`
change — the dashboard endpoint and its metrics were already built in
4.2/4.2b; `packages/shared` gained only a missing `DashboardResponse` type
export (the schema already existed). Tests: 4 new `apps/web` component
tests (`dashboard-page-client.test.tsx`). `pnpm typecheck`, `pnpm lint`,
`pnpm --filter api test`, `pnpm --filter web test`, and `pnpm build` all
passed — **296 `apps/api` + 91 `apps/web` = 387 total.** Lint retains the
same three pre-existing React Hook Form warnings. No schema, migration,
permission, or dependency change. Browser/theme/focus/keyboard checks, and
an actual look at the rendered charts, remain unverified — no browser was
launched. See `docs/decisions.md` D57.

**Day 5a (website intake, API keys, Enquiries inbox) is complete — built and
verified 2026-11-24, resumed from a mid-build checkpoint the same day.** The
full design (D71) was built exactly, with two flagged judgment calls where
the plan's literal text left a gap: a replay of a previously-`REJECTED`
submission re-throws the same stored error (read as "idempotency wins"
applying to every outcome, not only a success), and the Enquiries list
endpoint got a `sort` param even though D71's item 10 text didn't name one
explicitly (every other list endpoint in this app has one).

- **API keys**: `lib/api-key.ts` (`gsk_live_` + 32 random bytes, base64url;
  SHA-256 hash, same pattern as `session.ts`; `crypto.timingSafeEqual` on
  top of the exact indexed DB lookup). `modules/api-keys/` — Admin only
  (`SETTINGS_MANAGE`): create/list/revoke/rotate, rotate = revoke-old-plus-
  create-new in one transaction, the raw key returned exactly once in a
  response shape distinct from the list shape.
- **Authentication for the intake path**: `middleware/api-key-auth.ts`
  (`attachApiKeyContext`) mounted globally but scoped to `/api/v1/intake`,
  **before** `enforceOriginAndContentType` — on any missing/invalid/revoked
  key it rejects 401 immediately, before the Origin check is ever reached.
  `csrf.ts`'s Origin exemption is conditioned on `req.apiKeyCtx` already
  being set (never on the request path alone), so a session cookie with no
  key is still rejected upstream. `route-registry.ts` gained a new
  `'apiKey'` `RouteAuth` value — no session or permission middleware for
  those routes, since `attachApiKeyContext` already handled auth.
- **Rate limiting**: two new limiters on the intake route only — 60/min per
  verified key (the real protection) and a much looser 120/min per IP
  (documented as honestly weak given `TRUST_PROXY=false`, D60, untouched).
- **The intake endpoint** (`modules/intake/`): a lenient field mapper
  (`intake-mapping.ts` — a short alias list per target field, formType →
  sourceDetail via a lookup table with a sensible fallback, everything
  unrecognised preserved in `capturedFields`); `intake.service.ts`
  (`processWebsiteIntake`) — the `(organizationId, externalId)` idempotency
  lookup runs against the raw body *before* `websiteEnquiryIntakeSchema`
  is ever parsed, so a repeat `Idempotency-Key` always returns the original
  result, even with a different and invalid replayed body; a honeypot hit
  stores `SPAM` (never `REJECTED`) and responds with the exact same shape
  as a real success; a genuine mapping failure (no email/phone after
  mapping) or a malformed envelope stores `REJECTED` with the error and
  responds 422 — nothing is lost silently. On success: one transaction
  creates the Lead (source "Website", looked up the same way the existing
  "Manual" lookup works) and the `WebsiteSubmission` row already as
  `LEAD_CREATED` (one insert), then `findDuplicateLeads` (now callable with
  just `{ orgId }`, per groundwork laid before this session) supplies
  `possibleDuplicateLeadIds`. Audit rows for every outcome (success,
  honeypot, rejection) bypass the shared `writeAudit()` helper — that
  helper hard-codes a human `actorId`, which doesn't exist on this
  no-user path — and carry only `{ submissionId, apiKeyPrefix }`, `actorId:
  null`, never the raw key/Idempotency-Key/any enquiry field.
  `intake.routes.ts` is the one route in this app with no declarative
  `validate: { body }`, by design, flagged inline.
- **The Enquiries inbox** (`modules/enquiries/`), same visibility as Leads
  (`LEADS_READ`/`LEADS_WRITE`) plus the standard `RECORDS_ARCHIVE`
  convention for archive/restore: list (status/formType/archived/date-range
  filters, sortable), detail (adds the raw payload and a linked-lead
  summary list rows don't pay for), mark-spam (409 on a second call;
  archives the linked Lead too, in the same transaction, if one exists and
  isn't already archived).
- **Frontend**: `/settings/api-keys` (the first `/settings` route, Admin-
  gated like `/users`) — create and rotate both reveal their raw key
  exactly once, in a dedicated dialog with a copy button, since neither can
  reuse the plain `ConfirmActionDialog`. `/enquiries` (visible to both
  roles, next to Deals in the nav) — the existing `DataTable`/`RecordLayout`
  components, a Raw Payload tab (pretty-printed JSON, deliberately no
  syntax highlighting — not asked for), mark-spam/archive/restore via
  `ConfirmActionDialog`.
- **A pre-existing bug fixed first, at the user's own request**:
  `pnpm db:verify-fresh`/`pnpm db:reset` had the exact Windows `.cmd`-shim
  `spawnSync ENOENT` bug D63 already diagnosed and fixed for
  `staging-migrate.ts`, but explicitly left unfixed in these two scripts at
  the time. Both now use the same already-tested `runPrismaCli()` helper.
- **Testing**: added throughout, not batched to the end — API-key hashing/
  rotation/revocation (a revoked/rotated key stops working on its very next
  request), the CSRF exemption's own unit tests, the route-registry
  allow-list, a full intake suite (happy-path mapping across all four form
  types, duplicate warnings, idempotency including the required
  replay-with-an-invalid-body test, honeypot, validation/rejection, the
  three Origin-exemption scenarios, per-key rate limiting, cross-
  organisation isolation), a full enquiries suite (filters, detail,
  mark-spam's linked-Lead archive, archive/restore, Staff-equal-access,
  cross-org 404 isolation). 409 `apps/api` tests (up from 359) + 91
  `apps/web` tests (unchanged) = 500 total, all passing at that point.
  `pnpm typecheck`/`pnpm lint` clean throughout. Full detail, every
  judgment call, and a per-checkpoint test-count breakdown (359 → 402 →
  409) are in `docs/decisions.md` D72 (backend) and D73 (frontend). Docs:
  `docs/intake-contract.md` (new) and `apps/api/scripts/replay-intake.sh`
  (new, syntax-checked but not run live against a real key, to avoid
  creating persistent demo data in the shared local `crm_dev` database
  without asking first).

  **A user-requested audit then closed two real test-coverage gaps
  (D74)**: asked for a plain, per-refinement accounting of D71's eight
  binding items against actual test files, which found the key-hash/
  compare mechanism and the audit/log-redaction behaviour were correctly
  implemented but never independently unit-tested. Closed with
  `tests/lib/api-key.test.ts`, `tests/intake/audit.test.ts`,
  `tests/logger.test.ts` (after exporting `LOG_REDACT_PATHS` from
  `logger.ts`), and a per-IP rate-limit test enabled by refactoring
  `lib/rate-limit.ts`'s per-IP limiter into a ceiling-parameterised
  factory (`createIntakeIpRateLimiter`, same pattern as the existing
  `createGlobalLoginFloodLimiter`) — the test is explicit that it proves
  the limiter mechanism, not what `req.ip` actually is on Render. **427
  `apps/api` + 91 `apps/web` = 518 total, all passing.**
  `docs/DAY-5A-SUMMARY.md` now has an explicit tested-vs-reasoning-only
  table, one row per refinement. Manual browser verification is still
  unstarted — no browser-automation tool exists in this environment; see
  `docs/MANUAL-TEST-DAY5A.md`.

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
- **Current state after package 4.2b:** `crm_dev` retains the normal seed plus
  the fictional sample set (3 companies, 3 contacts, 5 leads, 4 deals, 14
  activities, including 3 overdue tasks, one due-today task and a meeting
  today); verified by running the sample seed twice and querying counts.
  `crm_test` is truncated by the API test harness
  before each test and was left empty by the final root verification.
- **No migration was added for packages 3.1 or 3.2.** Every table Day 3
  needed — `LeadConversion`, `Deal`, `DealContact`, `DealStageHistory`,
  `Pipeline`, `PipelineStage` — was already created in the one Day 1
  migration (`20261118202744_init`); Day 3 is pure application-layer work
  on top of an unchanged schema, exactly as the roadmap intended ("all
  tables are created in the first migration, so later days add behaviour,
  not schema churn").

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
- D16 — Package 1.3 dependencies: `cookie@2.0.2` (renamed exports, v2), `express-rate-limit@8.7.5`
- D17 — `@node-rs/argon2` library defaults (Argon2id, v0x13, m=19456, t=2, p=1); the login timing-defence dummy hash
- D18 — body-parser error shapes for malformed/oversized bodies (`status`+`type`, both mapped to code `BAD_REQUEST`)
- D19 — Express 5's internal route-tree shape (`app.router.stack`, `rawPath`); `req.query` has no setter
- D20 — CSRF Content-Type check only applies when a request actually carries a body (bodyless writes like logout have none)
- D21 — Next's `rewrites()` proxy forwards neither `X-Forwarded-For` nor `X-Forwarded-Proto` — addressed by D23
- D22 — `NODE_ENV=test` during `pnpm test` (vitest sets it; `process.loadEnvFile` never overrides an already-set var) — logger goes silent in tests
- D23 — Package 1.3b: replaced the per-IP login limiter with a global flood ceiling (`createGlobalLoginFloodLimiter`, default 50/15min); both limiters now use `skipSuccessfulRequests`; real per-IP limiting deferred to a deployment decision
- D24 — Package 1.3b: root cause and fix for the `pnpm dev` startup race — `pnpm -r --parallel`'s own scheduler breaks `tsx watch`; replaced with `scripts/dev.mjs` (independent `pnpm --filter` children, no new dependency)
- D25 — Package 1.4: last-Admin `SELECT ... FOR UPDATE` locking pattern; the `isActive` boolean query-param gotcha (`z.coerce.boolean()` is wrong — `Boolean("false")` is `true`); the `sort=<field>:asc|desc` convention; one audit row per `PATCH`, with before/after for every changed field (fixed after review to include `oldName`/`newName`, not just the role pair)
- D26 — Package 1.5: no `proxy.ts` (Next 16 renamed `middleware`, recommends against relying on it for security either way); `lucide-react` missing from the shadcn CLI's own output; `next-themes` is Sonner's dependency, not a separate choice; a `Suspense fallback={null}` is a real blank flash under Cache Components, not a no-op; the error-display split (422 inline on the field, 409/401/403 as a dialog banner, 500/network as a toast with the request id)
- D27 — Package 1.6: design system tokens mapped through Tailwind v4's `@theme inline`; theming switched to `attribute="data-theme"` with the toggle in the user menu; shadcn's structural `accent` repointed to `surface-hover`/`ink` so GS's brand clay accent (its own `--color-brand-accent*` names) stays rare, not merged into generic hover states; `@custom-variant dark` now targets `[data-theme="dark"]`, not `.dark`, so shadcn's baked-in `dark:*` utilities follow the app's own toggle instead of the OS media query; Button/Badge/Alert variants remapped (not renamed) onto the component READMEs, including fixing `destructive`'s old literal `text-white`; the dialog scrim fixed to the README's documented `bg-ink/40`; `vitest@5.1.1` added to `apps/web` (approved first) for `lib/format.ts`'s unit tests; INR/date/time formatting choices (`Intl.NumberFormat("en-IN")` for grouping, not `style: "currency"`; L/Cr thresholds at exactly 1 lakh/1 crore; `en-US` for reliably upper-cased AM/PM)
- D28 — Package 1.7: `SearchInput` reusable component (magnifier + clear-x, wraps the existing `Input`); global 401 handling lives in `api-client.ts`'s `apiFetch` itself (`onUnauthorized`), not TanStack Query's `QueryCache`/`MutationCache`, because several mutations are plain awaited calls those hooks never see; `SessionExpiryHandler` clears the cache and redirects once, guarded against both a parallel-request burst and `/login`'s own expected 401 on a wrong password; `useMe()` gets `refetchOnWindowFocus: true` as a deliberate one-query exception to the `QueryClient`'s app-wide `false`; `AuthGuard` revalidates `/auth/me` on every route change after first mount; Cache Components' "instant navigation" dev notice fixed with `export const instant = false` on `(protected)/layout.tsx` only (can't be set on `users/page.tsx`, a Client Component — throws if you try)
- D30 — Notes policy for Day 2: no dedicated notes table added; `leads.notes`/`contacts.notes` stay plain internal remarks text fields, `companies` gets none; confirmed (no schema change) that `activities.activity_type` already includes `NOTE` and its `activities_done_has_completed_at` CHECK already matches the roadmap's Day 4 "notes are created as DONE" plan
- D31 — Package 2.0: every `page.tsx` under `(protected)/` now carries its own `export const instant = false` (thin Server Component wrapper pattern — `users/page.tsx` now renders a new `UsersPageClient`; Home/Forbidden needed no client split, just the export); `PasswordInput` (Lucide Eye/EyeOff toggle) replaces the plain password `Input` on login, Create user, and Reset password
- D32 — Conflict found before 2.3: the brief wants an optional note on every lead status change, but `lead_status_histories` has no column for one; stopped and asked; resolved as drop the note entirely, no schema change
- D33 — Package 2.1: normalisers (`normalize.ts`); `LEAD_STATUSES`/`PRIORITIES` as `as const` tuples + `z.enum` (not TS enums, so no `ROLES`-style bridge cast is needed against Prisma's own literal-union enum types); three explicit duplicate-finder functions (`duplicates.ts`, one per resource — different normalised columns per model); `buildOrderBy` (`list-query.ts`, the one generic helper added, reusing 1.4's pagination helpers unchanged); `GET /api/v1/lead-sources` (new module); `GET /api/v1/users/options` (`auth: 'authenticated'`, Staff-allowed, registered before `/users/:id`)
- D34 — Package 2.2: `{ data, duplicates }` create/update envelope; `archived` tri-state via `booleanQueryParam`; archive/restore of a record already in that state is 404, not a no-op; blank string clears a text field to null on PATCH, `null` detaches a relation field (`companyId`/`ownerId` schemas changed to `.nullable().optional()` so this is expressible); `blankToNull` typed `(string) => string | null` only, never `string | undefined` in, because of an `exactOptionalPropertyTypes` conflict with Prisma's generated update types; `assertOwnerInOrg`/`assertCompanyInOrg` close the real (not just theoretical) same-organisation FK gap from D13; `lifecycleStatus` stays free text (brief never enumerates it), defaults `'ACTIVE'`
- D35 — Package 2.3: status change is its own `POST /leads/:id/status` (no note, D32); `CONVERTED` as a target excluded by the `OpenLeadStatus` type, as a current state refused with 409; `requirement`/`capturedFields` silently stripped by `PATCH`, not rejected, so they stay read-only; clearing both email and phone on update is a service-level 422, not a DB `P2039`-to-500; `GET /leads/duplicates` (standalone check, brief-requested) and `GET /leads/:id/status-history` (not requested, added anyway — cheap, useful ahead of Day 4); `z.iso.datetime()` verified to require a trailing `Z`, matching every other UTC timestamp in the app
- D36 — Package 2.3b: archive/restore on a record already in that state is 409 (`ALREADY_ARCHIVED`/`NOT_ARCHIVED`), missing/cross-org stays 404; re-confirmed `activities` can hold `NOTE` for Day 4 (no schema change); Contact `lifecycleStatus` stays free text and hidden from the UI (PRD never enumerates values); added `jsdom`/`@testing-library/react`/`@testing-library/dom` to `apps/web`, `vitest.config.mts` set to `environment: "jsdom"` globally
- D37 — Package 2.4: `DataTable`/`RecordLayout`/`OwnerSelect`/`CompanySelect`/`useListUrlState` built; `DataTable` wired into a real Companies list page; row-opens-record via a real `Link` in the first column, not row click handling; `OwnerSelect` kept to form use, list-page owner filter is a separate plain `Select` (different semantics: "no filter" vs "owner = nobody"); `CompanySelect` hand-built (no Combobox primitive installed); two `useEffect`s in `CompanySelect` rewritten as render-time state adjustments to satisfy `react-hooks/set-state-in-effect`; `ConfirmActionDialog` moved to `components/ui/`; added `apps/web/tests/setup.ts` for RTL's `afterEach(cleanup)` (not automatic without vitest `globals: true`)
- D38 — Package 2.5: real PRD/schema conflict on Contact's "alternate phone"/"preferred communication method" (not in the schema) — stopped, asked, dropped both; Companies use full create/edit pages, Contacts use a Dialog (different field counts and reuse contexts); both forms validate against the *create* schema even in edit mode, submitting the full field set as PATCH; `z.coerce.number()`'s `unknown` input type (Zod v4) broke a plain `useForm<CreateCompanyInput>` — fixed with a form-local schema overriding just that one field to a non-coercing validator; duplicate hint on company-name blur reuses the plain list `q` search (no dedicated endpoint, unlike Leads); new `Textarea` and `stripEmptyOptionalFields` (blank optional fields must become `null`/omitted, not a literal `""`)
- D39 — Package 2.6: `leadCreatableFields` exported from `packages/shared` so a form-local schema override could be rebuilt without `.extend()` (`createLeadSchema` is a `ZodEffects`, not a plain `ZodObject`); create and edit use two genuinely different form-local schemas (unlike Company/Contact's one-schema-for-both, D38) because `requirement` is create-only and never editable; duplicate warning calls the real `GET /leads/duplicates` endpoint (unlike Company's blur-hint approximation); status-change buttons omit the current status and the whole section disappears once `CONVERTED` (D29 — no convert action exists yet); new `lib/datetime-local.ts` bridges the native `datetime-local` input and ISO instants; a Zod `.refine()` options object needed its `path` cast away from `as const` (`readonly ["email"]` vs. Zod's mutable `PropertyKey[]`)
- D40–D44 — approved 2026-11-20, package 2.7 scope (D40 minimal required fields + Company's "More details" section + Lead's "Manual" source default; D41 country-code-select phone with strict E.164 validation; D42 new-record forms always open empty; D43 Contacts require email-or-phone; D44 lead History shows the actor, hint only when unmet) — **all four built 2026-11-20, see D45**
- D45 — Package 2.7 (items 1–4, closing out D40–D44): D42's root cause confirmed from Next's own bundled docs (Cache Components hides a page with React's `Activity` instead of unmounting, effect cleanup still fires on hide) and fixed with a `useLayoutEffect` cleanup that resets create-mode forms to blank, including `ContactFormDialog` force-closing itself; D41's `packages/shared/src/phone.ts` (fixed country-code list, strict `phoneFieldSchema`, a reserved-unused `parsePhoneLenient` for future website intake) plus a `PhoneInput` component, and a found-and-fixed bug where the component mistook its own just-emitted `onChange` for an external change; D40's Company "More details" `Collapsible` (new primitive, not yet in `docs/design-system/`) and Lead's Source preselecting "Manual" by name; D43's `contacts.ts` restructured like `leads.ts` (D39) plus a service-level post-patch guard, with seven pre-existing tests fixed that created email/phone-less contacts; D44's `changedByName` join and the hint's visibility fix. 244 `apps/api` + 53 `apps/web` = 297 tests.
- D46 — Package 3.1 (lead conversion transaction, built 2026-11-20, documented in this same-day catch-up pass before 3.3): one `$transaction` with a `SELECT ... FOR UPDATE` row lock on the lead, link-or-create Company (422 if creating one and the lead has no company name — judgment call, no placeholder name invented), link-with-fill-empty-only-or-create Contact (an existing contact's company is never overwritten), an optional Deal in the pipeline's first open stage with its `DealContact`/first `DealStageHistory` row, then convert + history + `LeadConversion` row + activity repoint + audit, all in the same transaction; `GET /leads/:id/conversion-matches` (plain, non-blocking) and `POST /leads/:id/convert`; `getDefaultPipeline`/`getFirstOpenStage` built here, reused by 3.2; `tests/helpers/tenant.ts` extended with a real six-stage pipeline per tenant
- D47 — Package 3.2 (Deals API, stage moves, close/reopen, pipeline summary, built 2026-11-20, documented in the same catch-up pass): full Deal CRUD; `stageId` excluded from the shared update field map (create-only, like Lead's `requirement`); stage move refuses a non-open target (422) or a non-open deal (409) and copies the target stage's probability every time (roadmap D7, overwrites a manual edit by design); close requires a `LOSS_REASONS` reason for Lost; **reopen returns the deal to the pipeline's first open stage** (judgment call — the brief doesn't say which stage to land on); **archive/restore are deliberately NOT blocked by the closed-deal-is-read-only rule** (judgment call — archiving is a records-management action, not a pipeline mutation); `PUT /deals/:id/contacts` fully replaces the set with one primary; `GET /pipeline/{stages,summary}`, the summary computed entirely as Postgres SQL (`COALESCE`/`SUM`/weighted-value multiplication over `NUMERIC`, never JS floats) and cross-checked in its test against an independently hand-written SQL query — found empirically that `Prisma.Decimal` stringifies an empty stage's zero as `"0"`, not `"0.00"`
- D48 — Package 3.3 (Deals list, forms, detail, close dialogs): three backend additions found while building the UI — `contactId` filter on `GET /deals` (via the `DealContact` join, for 3.5's Contact Deals tab); `GET /deals/:id/stage-history` (same shape as Lead's status-history, D35); and, after stopping to ask because it was genuinely outside the pre-approved allowance, a `contacts` summary array added to `dealResponseSchema` itself (populated by one shared `dealContactsInclude` Prisma include reused across every Deal query), so the Contacts tab can read a deal's current contacts without a second round trip or a `PUT` just to list them. `DealForm` shares create/edit (Stage is create-only — `updateDealSchema` has no `stageId` key); hit the same `z.coerce.number()` gotcha as Company/Lead (D38/D39) for `value`/`probability`. `ContactSelect` (new picker, same hand-built pattern as `CompanySelect`, D37). Detail-page actions (Edit, Move stage, Close Won/Lost, Reopen) are gated by `deal.status`; Archive/Restore are not, mirroring D47's backend choice exactly. Component tests deliberately avoid simulating a Radix `Select` open/pick (no existing test in this repo does either) — "stage pre-fills probability" is proven via the create-mode default-autofill, not a simulated manual pick.
- D49 — Package 3.4 (pipeline board, `@dnd-kit/core`): new dependency `@dnd-kit/core@6.3.1` only (confirmed no peer-dependency warning against `react@19.3.1` first; `/sortable`/`/utilities` deliberately not added); Board/List toggle on `/deals` kept in the URL; columns = `OPEN`-type pipeline stages only, Won/Lost totals shown in a summary bar from `GET /pipeline/summary`'s `open` aggregate instead (D47); each column's query uses a fixed, filter-free shape so its cache key is predictable for the optimistic move-mutation (snapshot both affected columns, patch both, roll back on error, broadly invalidate on settle) shared by the drag handler and every card's own "Move to…" dropdown fallback; `PointerSensor` uses an 8px activation distance so the card's nested link/dropdown stay clickable, `KeyboardSensor` uses `@dnd-kit/core`'s own built-in default coordinate getter (not `/sortable`'s), `closestCenter` for collision detection. The required dropdown-move test passes against a stateful fake backend; the actual drag gesture itself could not be interactively verified (no browser-automation tool in this environment) — flagged plainly rather than claimed as proven.
- D50 — Package 3.5 (Convert dialog and related tabs), closing out Day 3: `companyName` added to `convertLeadSchema` (read only when creating a new company, overrides the lead's own name — lets a nameless lead still convert instead of dead-ending in the existing 422); `conversion` added to `leadResponseSchema`, populated only by `GET /leads/:id` (found and fixed a real bug while wiring this in — `listLeads`'s bare `rows.map(toLeadResponse)` was passing the array index into the new second parameter, caught by `pnpm typecheck`); Convert on the lead detail page is a real trigger only when `QUALIFIED` and not archived, disabled elsewhere, hidden once `CONVERTED`/archived, with a new "Converted" panel (company/contact/deal links + date) replacing "Change status"; `ConvertLeadDialog`'s three Link/Create `ModeToggle` sections prefill from `GET /leads/:id/conversion-matches`; **a genuine race condition found by this package's own tests** — the first draft initialised defaults in a `useEffect` keyed on the async matches arriving, which could silently overwrite text the user had already started typing — fixed by keeping the form entirely unrendered until the matches lookup settles, and separately moved the initialisation off `useEffect` onto the "adjust state during render" pattern (D37) to satisfy this repo's `react-hooks/set-state-in-effect` lint rule; no-double-submit via a `pending` guard checked first in the handler, proven by a two-synchronous-clicks test; `DealsTab` (shared by Company's and Contact's detail pages, via `GET /deals`'s `companyId`/`contactId` filters) and `DealForm`'s new create-mode-only `defaultCompanyId` (from `CreateDealPageClient`'s `?companyId=` param, which needed a `<Suspense>` boundary added to `deals/new/page.tsx`, D26's rule) close the loop back to Deals.

- D51 — Package 4.0: optional lead source, decimal-string numeric editing and SQL reconciliation
- D52 — Package 4.1: Activities API/timelines and organisation calendar bounds; no migration
- D53 — Package 4.2: approved Today/dashboard metrics, independent SQL checks and fictional sample seed
- D54 — Package 4.2b: detail next activity, activity due/overdue filters, expanded tests and Today sample coverage
- D55 — Package 4.3: shared activity composer and merged record timelines, completion actor/time enrichment, no schema change
- D56 — Package 4.4: My Tasks and Today workspace UI, resumed from a half-built uncommitted session; Today items link straight to their own record
- D57 — Package 4.5: dashboard on Home, nine StatCard KPIs (a logged conflict with the design system's six-card guidance), four single-series bar charts with a sr-only table alternative each, no schema/dependency change
- D58 — Package 4C Part A: schema targeting for staging — `@prisma/adapter-pg`'s own `schema` option (not Prisma's `multiSchema`, not the URL's `?schema=` param, which only steers `migrate`) is what makes the runtime Client target the `sales` schema; tested against a local non-superuser stand-in role, not just assumed
- D59 — Package 4C Part B: `DATABASE_URL`'s `?schema=` and `DATABASE_SCHEMA` must always agree (a new pure, reusable guard) and local dev/test refuse to start against a non-localhost `DATABASE_URL`, scoped to never apply in production or to the staging scripts
- D60 — Package 4C Part B: `TRUST_PROXY` stays `false` on Render too, closing D21/D23's "revisit at deployment" note by documentation, not a code change — Next's `rewrites()` proxy still breaks the forwarding chain regardless of hosting platform
- D61 — Package 4C Part A completion: `DATABASE_POOL_MAX` (default 10, staging sets 5) and `DATABASE_SSL_CA`/`DATABASE_SSL_REJECT_UNAUTHORIZED` (unused today — see D66)
- D62 — Package 4C Part C: the three staging scripts (`staging:migrate`/`staging:create-admin`/`staging:seed-sample`); `seed-lib.ts` split into `seedBaselineOrganization()` and `seedDemoUsers()` so staging structurally cannot get the two local demo accounts
- D63 — Fix: `pnpm staging:migrate` failed on Windows (`pnpm` resolves to a `.cmd` shim; Node 22 refuses to spawn one without a shell) — fixed by running the Prisma CLI's own entry file via `process.execPath` directly, no shell involved
- D64 — Fix: new `APP_ENV` env var (no default, on purpose) tells staging apart from Render's real production deployment for the sample-seed guard, which was refusing staging for the wrong reason (`NODE_ENV=production`, which staging legitimately sets)
- D65 — Milestone: `staging:migrate` and `staging:create-admin` ran successfully against the real Supabase project, confirmed by the user — the first real-world validation of D58's mechanism and D62's bootstrap flow
- D66 — TLS against the real Supabase pooler is verified (on), but via a version-specific `pg-connection-string` aliasing of `sslmode=require`→`verify-full` that is scheduled to change in a future major version; recommended fix is a one-line connection-string edit (`sslmode=verify-full` explicitly) in the user's own `.env.staging.local`, not a code change
- D67 — Package 4C Part D: `render.yaml` (two services, `region: singapore`, every env var `sync: false`) and `docs/STAGING.md`; the API's `startCommand` had to bypass its own `package.json` `start` script (`node --env-file=.env`, which crashes with no `.env` file present, as every Render deployment has)
- D68 — Fix: `DATABASE_SSL_CA` was being silently discarded whenever `sslmode` appeared in `DATABASE_URL` (confirmed by reading `pg-connection-string`'s source); fixed by stripping `sslmode`-family params from the URL whenever an explicit SSL config is supplied; also consolidated a second, pre-existing connection factory (`src/db/pool.ts`, used by `/health/db`, had neither the pool-size limit nor any SSL config) into the one in `src/db/prisma.ts`; new read-only `pnpm staging:check-db` diagnostic
- D69 — Change of plan: web app moves to Vercel, API stays on Render as a manual Web Service, not a Blueprint
- D70 — First real Render deploy attempt failed at the build step; fixed the Build Command and Node version, and pre-emptively corrected the same risk in the Vercel instructions
- D71 — Day 5a kickoff: the full design for API keys/intake/Enquiries, including eight binding mid-build refinements (honeypot invisibility, timing-safe key comparison, the Origin exemption conditioned on a verified key not just the path, idempotency winning over body validation, log/audit minimisation, per-IP limiting's honest weakness, spam/rejected retention deferred, nothing run against staging) — recorded before most of it was actually built; see D72/D73 for the build
- D72 — Day 5a completed, backend: API keys, the intake endpoint, and Enquiries built exactly per D71 (two flagged judgment calls: a replayed-`REJECTED` submission re-throws its original error, and the Enquiries list got a `sort` param D71's text didn't name explicitly); a pre-existing Windows `db:verify-fresh`/`db:reset` bug (D63's same `.cmd`-shim `ENOENT`) fixed first at the user's request; 359 → 402 → 409 `apps/api` tests across this session's two backend checkpoints
- D73 — Day 5a completed, frontend: the Admin-only API Keys screen (create/rotate both reveal a raw key exactly once) and the Enquiries screen (visible to both roles, reusing `DataTable`/`RecordLayout`); `docs/intake-contract.md` and `apps/api/scripts/replay-intake.sh` written; manual browser verification explicitly unstarted (no browser-automation tool in this environment)
- D74 — Day 5a audit follow-up: a user-requested per-refinement accounting of D71's eight items against actual test files found two real gaps (key-hash/compare mechanism, audit/log-redaction content) — closed with `tests/lib/api-key.test.ts`, `tests/intake/audit.test.ts`, `tests/logger.test.ts` (new `LOG_REDACT_PATHS` export), and a per-IP rate-limit test enabled by a `createIntakeIpRateLimiter` ceiling-parameterised factory refactor (same pattern as `createGlobalLoginFloodLimiter`); 409 → **427** `apps/api` tests; `docs/DAY-5A-SUMMARY.md` gained an explicit tested-vs-reasoning-only table
- D75–D82 — Day 5a/5b fixes and features (Rotate key reveal; CSV export; Docker full profile and its three incidents; audit log page; Excel SYLK fix) — see each entry
- D83 — Day 5c Quotations: data model, numbering, status flow, endpoints, screens, the accept → "mark deal Won?" offer; a pg@9-incompatible in-transaction reload found by the tests and fixed
- D84 — Quotation PDF (pdfkit 0.20.2, Noto Sans, on demand, never stored; PDF reference = number + version) and the organisation header columns + `org:set-details` scripts
- D85 — The quotation money rule: exact decimals, half-up to 2 dp, three roundings; one shared formatter for API/PDF/screen
- D86 — Quotation auto-expiry on read: effective status everywhere, best-effort audited write that never fails a read
- D87 — Approved PRD deviations (no catalogue, no GST split, no PDF reports, owner added) and future items
- D88 — A Draft with a past valid-until date cannot be marked Sent (409 VALID_UNTIL_PASSED)
- D89 — Notifications started: migration `20261124191130_add_notifications` + shared schemas only; no text/personal data stored, titles built at read time
- D91 — Notifications: five approved PRD deviations; future items notification preferences and deal-change notifications
- D92 — Reports: `reports:read`, five reports + CSV, shared range rule/queries with Home, reconciliation test, PRD 5.10 gaps reported
- D90 — Notifications built: service, four endpoints (org + user scoped), triggers after commit (best-effort), task reminders on load (dedupe keys, 50 cap), bell polling 60 s paused when hidden, Render free-tier effect, PRD 5.8/5.11 gaps reported

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
- **`pnpm -r --parallel` can break `tsx watch` on this machine** — reproduced
  with zero output, zero errors, even with a single package in scope. Fixed
  by not using it (`scripts/dev.mjs`, D24). If `pnpm dev` ever seems to hang
  again with apps/api never logging "api listening", check that this script
  is still what's being invoked, not a reverted `pnpm -r --parallel dev`.
- **`z.coerce.boolean()` is wrong for a query-string boolean** —
  `Boolean("false")` is `true` in JS. Use an explicit `z.enum(['true',
  'false']).transform(...)` instead (`booleanQueryParam`, D25).
- **Express 5's `req.query` has no setter** (`defineGetter` only, verified in
  `express/lib/request.js`) — a validated query goes on `req.validatedQuery`
  instead (D19). `req.body`/`req.params` are plain properties and can be
  overwritten normally.
- **`cookie@2.x` renamed its exports** — no `serialize`/`parse`; use
  `stringifySetCookie`/`parseCookie` (D16).
- **Prisma's query builder has no row-locking API** — the last-Admin rule
  uses a raw `tx.$queryRaw` with `SELECT ... FOR UPDATE`, casting to the
  Postgres enum by its mapped name (`'ADMIN'::role`, not `'ADMIN'::"Role"`) — D25.
- **The shadcn CLI can write a component's imports without actually
  installing the import's package.** `dialog`/`dropdown-menu`/`select`/
  `sonner` all import from `lucide-react`; the CLI never added it as a
  dependency. Surfaced immediately by `tsc`, not silently — but check
  `node_modules/<pkg>` exists after any future `shadcn add`, don't assume
  the CLI's dependency step actually ran for everything it should have.
- **A `<Suspense fallback={null}>` is not equivalent to "nothing changes
  while loading"** — with `cacheComponents: true`, the fallback genuinely
  replaces that subtree in the *prerendered* HTML. `null` means the real
  content (here, the entire login form) is simply absent from the page
  until client-side hydration completes, which a `curl` of the page makes
  obvious immediately (no form markup at all) but a fast browser might hide
  well enough to go unnoticed. Give it a real fallback shaped like the
  content (D26).
- **Next.js route groups `(name)` share a URL with whatever's outside
  them** — `app/(protected)/page.tsx` and a pre-existing `app/page.tsx`
  both resolve to `/`; the old one has to be deleted, not just left
  alongside, or the build fails on a route conflict.
- **This repo's own command examples use Windows `cmd.exe` syntax, not
  PowerShell** — `netstat -ano | findstr :3000`, `taskkill /PID <pid> /T
  /F`, `copy apps\api\.env.example apps\api\.env` (see §4's "Starting
  everything from scratch"). Keep new examples in that same style (e.g.
  `findstr`, not `Select-String`; `copy`, not `Copy-Item`) unless the user
  specifically asks for PowerShell.
- **Two browser windows split-screened side by side (tiled on the same
  desktop) still share one cookie store if they're the same browser
  profile** — only one authenticated session can exist across them at a
  time. Testing two different users signed in simultaneously (e.g. the
  session-expiry-while-open scenario in `MANUAL-TEST-DAY1.md` §14, or the
  deactivate-while-signed-in scenario in §10) needs a normal window *plus*
  an incognito/private window — two genuinely separate cookie stores — not
  two tiled views of the same window.
- **With `cacheComponents: true`, a navigated-away-from page is hidden with
  React's `Activity`, not unmounted — `useState`/react-hook-form state
  survives a revisit, confirmed directly from Next's own bundled docs
  (`node_modules/next/dist/docs/01-app/02-guides/migrating-to-cache-
  components.md` → "UI state preservation"; `preserving-ui-state.md` →
  "Forms, inputs, and state").** Effect cleanup still fires on hide though
  — exactly like a real unmount — so a `useLayoutEffect` whose cleanup
  resets what needs resetting is the documented, correct fix (D42, D45),
  not a workaround. A build's own route list (`pnpm build`'s `--- (Static)`
  markers) tells you which routes are actually subject to this: static
  routes get held in the Client Cache across navigation; genuinely dynamic
  ones may not.
- **"Adjust state during render" (the pattern `CompanySelect` already uses,
  D37) breaks if the component updates its OWN tracker at the same moment
  it calls the external `onChange`.** `PhoneInput`'s first draft did this
  and stomped a just-typed digit back to the previous value on every
  keystroke, because its own just-emitted change (not yet echoed back by
  the parent on this same render) looked identical to a genuine external
  prop change. The tracker must only ever move in response to the
  *external* prop actually changing — never from the component's own
  emit — see D45 for the exact before/after.
- **An async `useEffect`-driven "initialise defaults once data loads"
  pattern races with the user, not just with React's own render timing.**
  `ConvertLeadDialog`'s first draft set its Company/Contact/Deal defaults
  in a `useEffect` keyed on `GET /leads/:id/conversion-matches`'s response
  arriving. Because that's a real network round trip, a user who started
  typing in the gap between "dialog opened" and "matches finished
  loading" had their input silently overwritten the instant the (by-then-
  stale) default applied — found by this package's own test, not by
  inspection (D50). The fix wasn't a debounce or a "has the user touched
  this" flag — it was simpler: keep the editable fields entirely
  unrendered until the async lookup settles, so there is no field for the
  user to type into before the one-time default-setting has already run.
  If a future dialog/form needs defaults from an async lookup, give it the
  same "nothing editable until the lookup settles" shape rather than
  trying to detect the user's intent after the fact.
- **Running the same `pnpm --filter api exec vitest run` invocation twice
  without confirming the first one had actually exited stacked two full
  test suites (≈50 isolated worker processes each) against the same
  `crm_test` database at once.** Combined with Docker Desktop already
  being mid-restart on this machine, it wedged the Docker engine badly
  enough that even `docker ps` returned a blanket 500 from Docker's own
  API, and a plain Docker Desktop restart didn't clear it — the user
  resolved it with a full machine reboot. No code, config, or container
  was touched to work around it (see `docs/decisions.md` D50's closing
  note for the full account). Lesson: when a background test run reports
  a timeout and gets moved to the background, treat it as still running —
  check its actual output before launching the same command again, don't
  assume the timeout meant it died.
- **Don't read a record with several relation `include`s inside an
  interactive `$transaction`** (D83). Prisma fetches the relations
  concurrently; on the transaction's single pg connection that prints pg@8's
  "client.query() when the client is already executing a query" deprecation,
  which becomes an error in pg@9. Return the id from the transaction and read
  the full record after commit. A whole-suite `grep DeprecationWarning` is a
  cheap check.
- **This tool may not apply migrations to `crm_test`** (blocked by the
  permission system, D83, same as D71's precedent): write the migration, then
  ask the user to run `pnpm db:verify-fresh`. Until they do, every
  `apps/api` test fails at the global reset if a new table was added to
  `tests/helpers/reset-database.ts`.
- **A running `pnpm dev` can miss a nested route folder created in the same
  instant as its parent** (`mkdir -p a/[id]/edit`): it served 404 until the
  page file was touched. A production build is the reliable check (D83).
- **Generating a migration without touching any database**: `pnpm exec prisma
  migrate diff --from-schema <copy of the previous schema.prisma> --to-schema
  prisma/schema.prisma --script` (D83); `git show HEAD:apps/api/prisma/
  schema.prisma` gives the previous schema.

## 11. Testing

- `pnpm test` (root) runs `packages/shared` (no tests yet — its schemas are
  exercised via `apps/api/tests/shared/`), `apps/web` (`vitest run` — 17
  files: `tests/lib/format.test.ts` (12, package 1.6),
  `tests/lib/api-client.test.ts` (4, package 1.7),
  `tests/components/data-table.test.tsx` (7),
  `tests/components/search-input.test.tsx` (4),
  `tests/components/owner-select.test.tsx` (3) — the last three package
  2.4; plus package 2.7's `tests/components/lead-form.test.tsx`,
  `company-form.test.tsx`, `contact-form-dialog.test.tsx`, and
  `phone-input.test.tsx`; plus package 3.3's `deal-form.test.tsx`,
  `close-lost-dialog.test.tsx`, `deal-detail-page-client.test.tsx`; plus
  package 3.4's `pipeline-board.test.tsx`; plus package 3.5's
  `convert-lead-dialog.test.tsx` and `lead-detail-page-client.test.tsx`),
  plus package 4.3's `tests/components/activity-composer.test.tsx` (4 — selected
  type/link, Note without due date, completion refresh with actor/time, and
  overdue label), and `apps/api` (`vitest run`) — **295 `apps/api` tests + 79
  `apps/web` tests, 374 total**, all passing after package 4.3 (package 4.4
  brought this to 296 + 87 = 383, and package 4.5 to 296 + 91 = 387 — see
  below). Package 2.7
  (items 1–4) brought the count to 244 + 53 =
  297 (D42's reset-on-hide tests, D41's phone-validation and `PhoneInput`
  composition tests, D40/D43's "More details"/Source-preselect/Contact-
  email-or-phone tests, D44's actor-name and hint-visibility tests — full
  breakdown in `docs/decisions.md` D45); package 3.1 added 12
  (`tests/leads/conversion.test.ts` — every conversion combination, a
  forced mid-transaction rollback, two concurrent conversions, D46) for
  256; package 3.2 added 19 (`tests/deals/{crud,stage-and-close,
  pipeline}.test.ts`, D47) for 275 + 53 = 328; package 3.3 added 4
  `apps/api` tests (the `contacts` summary round-trip and `contactId`
  filter folded into `crud.test.ts`, plus the new
  `stage-history.test.ts`) and 10 `apps/web` tests (D48) for 279 + 63 =
  342; package 3.4 added 2 `apps/web` tests
  (`pipeline-board.test.tsx` — a successful dropdown move and a rolled-
  back failed one, D49) for 279 + 65 = 344; package 3.5 added 3 `apps/api`
  tests (the `companyName` override, the still-422 case, and the
  conversion-summary round-trip, all folded into
  `tests/leads/conversion.test.ts`) and 9 `apps/web` tests
  (`convert-lead-dialog.test.tsx`, `lead-detail-page-client.test.tsx`,
  D50) for 282 + 74 = 356; package 4.3 added one API test in
  `tests/activities/activities.test.ts` and four web tests above, bringing the
  count to 295 + 79 = 374; package 4.4 added one `apps/api` test (the
  `priority` filter on `GET /activities`) and eight `apps/web` tests
  (`tasks-page-client.test.tsx`, `today-page-client.test.tsx`), bringing the
  count to 296 + 87 = 383; package 4.5 added four more `apps/web` tests
  (`dashboard-page-client.test.tsx`), bringing the current count to
  **296 + 91 = 387**. `apps/web` runs under jsdom (D36) with
  `tests/setup.ts` registering RTL's `afterEach(cleanup)` (D37) —
  needed because RTL's own auto-cleanup never self-registers without
  vitest's `globals: true`, which this repo doesn't use.
- `apps/web/vitest.config.mts` only sets a resolve alias (`@` -> the package
  root, mirroring `tsconfig.json`) — no database, no global setup, unlike
  `apps/api`'s config; nothing in `apps/web` touches the database.
- `apps/api/tests/schema/helpers.ts` provides `createTestOrganization`,
  `createTestUser`/`LeadSource`/`Company`/`Contact`/`Pipeline`/`Deal`,
  `cleanupOrganization` (deletes a test org's rows in FK-safe,
  children-first order, since everything is `onDelete: Restrict`), and
  `expectRejection(promise, code, constraintNameFragment)` for asserting a
  specific Prisma error code *and* that the right constraint fired.
  `PG_ERROR`/`isKnownRequestError` are now re-exported from
  `src/lib/prisma-errors.ts` (single source, since the app's own error
  handler needs the same codes — package 1.3).
- **Global test isolation (package 1.2c/1.3b)**: `tests/setup.ts` registers
  a global `beforeEach` that calls `resetDatabase()` (TRUNCATEs every
  application table; refuses unless the connected database name ends
  `_test`) and `resetLoginRateLimiters()` (clears the in-memory rate-limit
  stores) before *every* test in *every* file — not just the schema tests.
  Existing per-test `cleanupOrganization()` calls stay in place and are
  harmless (redundant, not conflicting).
- `createTestTenant()`/`createTwoTestTenants()` (`tests/helpers/tenant.ts`)
  build a full organisation with real argon2id-hashed Admin/Staff users
  (known passwords) and a lead source — used throughout the auth/users/audit
  tests, not just where they were first built.
- `apps/api/vitest.config.ts` sets `fileParallelism: false` — all tests share
  one database (`crm_test`, via `TEST_DATABASE_URL`) and must not run
  concurrently. Vitest still spawns one worker process per test *file*
  (`isolate: true`, the default) — module-level state (e.g. the rate-limit
  stores) is shared across `it()` blocks *within* one file but fresh per
  file; the global `beforeEach` above exists because of this.
- **`db:verify-fresh` is manual and intentionally never part of `pnpm test`**
  — it drops and recreates `crm_test` from zero, and Prisma's own CLI refuses
  to run that without fresh human consent each time anyway. Run it yourself
  before a release: `pnpm db:verify-fresh`.
- **Day 5a (2026-11-24) brought the total to 427 `apps/api` + 91 `apps/web`
  = 518.** No new `apps/web` tests this phase — matching this repo's
  established, deliberate choice for list/detail page clients (Companies/
  Contacts/Leads, Day 2) rather than an oversight. New `apps/api` coverage:
  API-key hashing/rotation/revocation (including dedicated unit tests of
  the hash/compare functions themselves, D74), the CSRF Origin exemption,
  the route-registry `apiKey` allow-list, a full intake suite (idempotency,
  honeypot, validation/rejection, rate limiting — both per-key and, via a
  low-ceiling factory test, per-IP — cross-org isolation), audit-row
  content and log redaction (D74), and a full enquiries suite. Full
  breakdown in `docs/decisions.md` D72 and D74.
- **Known gaps**: `apps/web`'s test coverage is still only pure-logic
  (`lib/format.ts`, `lib/api-client.ts`'s `onUnauthorized`) — no component/
  integration tests for `SearchInput`, `SessionExpiryHandler`, `AuthGuard`,
  or anything else that needs a DOM. That needs `jsdom` +
  `@testing-library/react`, neither installed; not added in package 1.7
  since it wasn't the dependency actually asked for that package (unlike
  `vitest` itself in 1.6, which was asked and approved) — raise it
  explicitly if/when component tests are wanted. Test files aren't
  type-checked by plain `tsc -p tsconfig.json` but now are by the wider
  `tsconfig.check.json` (package 1.2c) wired into `pnpm typecheck`.

## 12. Conventions every future module must follow

- Service functions take a context `{ userId, orgId, role }` — never read
  these off a raw request object inside a service.
- Every database query is scoped by `organizationId` taken from that context
  via the `scoped(ctx)` helper (`apps/api/src/lib/scoped.ts` — returns
  `{ organizationId: ctx.orgId }`), not a hand-written filter re-spelled per
  module; a record belonging to a different organisation must look like a
  404, not a 403 (don't leak existence).
- Every route declares a required permission explicitly.
- Request bodies/params/query are validated via `validateRequest`
  (`apps/api/src/middleware/validate.ts`) using a `packages/shared` Zod
  schema — body/params overwrite `req.body`/`req.params`; a validated query
  goes on `req.validatedQuery` instead, since Express 5's `req.query` has
  no setter (D19). Never validate ad hoc inside a route handler.
- Multi-table writes happen inside one transaction, with the audit row
  written inside that same transaction (not after, not best-effort).
- `packages/shared`'s Zod schemas are the single source of validation — don't
  re-declare the same shape in `apps/api` or `apps/web`.
- Error responses follow the shape already established in
  `apps/api/src/middleware/error-handler.ts`:
  `{ error: { code, message, details?, requestId } }`.
- API routes live under `/api/v1/*` (already true for `/health`; follow the
  same prefix for every real endpoint).
- **Every route is declared via `defineRoute()`**
  (`apps/api/src/lib/route-registry.ts`), never `app.get()`/`router.post()`
  etc. directly — `defineRoute` wires the session and permission middleware
  consistently and records the route so a test can audit the live Express
  app's route tree against it. `tests/lib/route-registry.test.ts` includes
  a deliberate proof that this check can actually fail (adds a route
  bypassing `defineRoute`, asserts it's caught, then asserts a clean app
  passes again) — a future module can copy that proof pattern instead of
  re-inventing it.
- An exclusivity/cardinality invariant that must survive concurrent
  requests (so far: "at least one active Admin") is enforced with a raw
  `SELECT ... FOR UPDATE` inside the transaction, not an application-level
  check-then-write — see `assertNotLastActiveAdmin` in
  `users.service.ts` for the pattern, and its concurrency test for how to
  prove it.
- **Frontend (package 1.5 conventions):** every authenticated page goes
  inside the `app/(protected)/` route group, behind its one `AuthGuard` +
  `AppShell` layout — never a standalone auth check re-implemented per
  page. A mutation's error handling always goes through
  `handleApiFormError` (`apps/web/lib/handle-form-error.ts`), not a
  bespoke try/catch per dialog, so the 422-inline / 409-banner /
  500-toast-with-request-id split stays consistent everywhere. Client
  components that read `useSearchParams()` need a real `<Suspense>`
  fallback (not `null`) — see the gotcha above.
- **Every colour, radius, shadow, size and font comes from a Grow Spark
  design-system token** (`apps/web/app/design-tokens.css`, mapped through
  Tailwind v4's `@theme inline` in `globals.css`) — never a hex literal or
  a bare Tailwind palette class (`bg-slate-500`, `text-red-600`, etc.) and
  never `white`/`black` directly. Use the generated utility (`bg-surface`,
  `text-ink-muted`, `border-danger`, …) or an explicit token reference
  (`h-(--control-md)`) for a size that has no Tailwind equivalent. See
  `docs/decisions.md` D27.
- **A page needing its own route-segment config (`export const dynamic`,
  `instant`, etc.) must be a Server Component** — Next.js throws if
  `instant` (or most other segment config) is exported from a file with
  `"use client"` at the top. `(protected)/layout.tsx` is one today
  (`instant = false`, D28). **Applied package 2.0, D31 — this is now the
  rule for every `page.tsx` under `(protected)/`**: keep `page.tsx` itself a
  thin Server Component (default export, no `"use client"`, carrying its own
  `export const instant = false`) that just renders a separate client
  component holding the actual interactive logic (`"use client"` on that
  inner component instead), e.g. `users/page.tsx` renders
  `components/users/users-page-client.tsx`'s `UsersPageClient`. A page with
  no client-side logic (Home, Forbidden) has nothing to extract — it just
  carries the `instant = false` export directly on the Server Component
  page itself. Follow this from the start for every new page (Leads,
  Companies, Contacts, …), not just when a Cache Components warning
  appears.
- **Search inputs reuse `SearchInput`**
  (`apps/web/components/ui/search-input.tsx`) — a magnifier icon runs the
  search (same as Enter), a clear `x` appears once there's text and
  re-runs the search empty. Don't rebuild a separate input+button pattern
  for Leads/Companies/Contacts' search boxes.
- **Password fields reuse `PasswordInput`**
  (`apps/web/components/ui/password-input.tsx`, D31) — a show/hide toggle
  (Lucide Eye/EyeOff) wrapping `Input`, same styling, drop-in replacement
  for `<Input type="password" />`. Don't add a bare password `Input`
  anywhere new.
- **Any new `apiGet`/`apiPost`/`apiPatch` call automatically participates
  in session-expiry handling** — `apps/web/lib/api-client.ts`'s `apiFetch`
  notifies a registered `onUnauthorized` listener on every 401, regardless
  of how the call was made (a direct `await`, not just a `useMutation`).
  Nothing extra is needed per call site for this to work; don't add a
  bespoke 401 check in a new dialog/page.

## 13. What's next

- **Day 1 (packages 1.1–1.7) is done** (see §7). Every explicit approval
  gate (1.3's permission map, D20/D21→D23) was approved; D25's
  audit-metadata gap was fixed on review before 1.5 started; adding
  `vitest` to `apps/web` in 1.6 was confirmed with the user before doing it;
  1.7's Cache Components fix was confirmed with the user (the earlier
  decision it referenced wasn't recoverable from this repo's history, so
  it was asked again rather than guessed). `docs/MANUAL-TEST-DAY1.md` still
  has no recorded browser run in this repo (see §14) — not confirmed either
  way, not assumed done.
- **Day 2 (packages 2.0–2.6) is done** (see §7 and `docs/DAY-2-SUMMARY.md`
  for the plain-language version). All four Day 2 rules approved on
  2026-11-19 (D29) are now actually built: lead status transitions, the
  name-plus-email-or-phone rule (Leads only, so far — see D43 below),
  warn-only duplicate detection, and Staff standing equal to Admin on
  Companies/Contacts/Leads. The user ran `docs/MANUAL-TEST-DAY2.md` in a
  real browser on **2026-11-20** and confirmed all five named acceptance
  items passed.
- **That same browser pass surfaced five approved refinements — D40
  through D44 — and package 2.7 (items 1 through 4) now builds all of
  them** (`docs/decisions.md` D45 has the full detail): trimming every
  form down to the PRD's actual minimum required fields, with a `*` on
  what's actually required and a new collapsed "More details" section on
  Company (D40); structured, validated phone input with E.164 storage,
  strict for manual entry only (D41); new-record forms now always open
  blank, with the Cache Components root cause confirmed from Next's own
  docs, not left as a guess (D42); Contacts now require an email or a
  phone, the same as Leads (D43); and the lead History tab now names the
  actor, with the email-or-phone hint fixed to only show while unmet
  (D44). 244 `apps/api` + 53 `apps/web` = 297 tests, four commits (one per
  item), nothing pushed. **Package 2.7 is done.**
- **Day 3 (lead conversion, deals, pipeline) is underway.** Packages 3.1
  (the lead conversion transaction) and 3.2 (Deals API, stage moves,
  close/reopen, pipeline summary) are built and committed (`3f08a38`,
  `f2c59e0`) — full detail in §7 and `docs/decisions.md` D46/D47. This
  file was updated for both in a docs-only catch-up pass on 2026-11-20,
  done immediately before package 3.3 started, once it was noticed the
  docs hadn't kept pace with the two already-shipped commits. 275
  `apps/api` + 53 `apps/web` = 328 tests, nothing pushed.
- **Package 3.3 (Deals list, forms, detail, close dialogs) is built** —
  full detail in §7 and `docs/decisions.md` D48. A real gap (no way to
  read a deal's current contacts before any write) was found while
  building the Contacts tab; stopped and asked per instruction; approved
  option built (a `contacts` summary on `dealResponseSchema` itself). 279
  `apps/api` + 63 `apps/web` = 342 tests, nothing pushed.
- **Package 3.4 (the Kanban pipeline board) is built** — full detail in
  §7 and `docs/decisions.md` D49. New dependency `@dnd-kit/core@6.3.1`
  only, confirmed peer-clean against `react@19.3.1` before installing.
  The required dropdown-move test passes; the actual drag gesture itself
  could not be interactively verified in this environment (no
  browser-automation tool) — flagged plainly, not claimed as proven. 279
  `apps/api` (unchanged) + 65 `apps/web` = 344 tests, nothing pushed.
  **Package 3.5 (the convert dialog and related tabs) is next, in the
  same session.** Day 6/7 (testing, stabilisation, demo) remain
  explicitly out of scope until the build days are done.

- **Day 4 is complete — all packages 4.0–4.5 are built** (details in §7 and
  decisions D51–D57). The Activity composer, merged record timelines, My
  Tasks, the Today workspace, and the Home dashboard are implemented and
  automated verification passed (296 `apps/api` + 91 `apps/web` = 387
  tests). No manual browser pass has been run on any Day 4 screen yet —
  that's the next thing to do, per the roadmap's own Day 4 acceptance
  checklist.
- **Package 4C (hosted staging) is built and the database steps have run
  for real** (details in §7/§9, decisions D58–D67; full walkthrough in
  `docs/STAGING.md`). Schema targeting (`@prisma/adapter-pg`'s own `schema`
  option, D58), config guards (D59/D60), connection pool/TLS config (D61,
  verified safe in D66), the three staging scripts (D62, plus Windows and
  `APP_ENV` fixes in D63/D64), and the Render Blueprint (`render.yaml`,
  D67) are all committed, not pushed. **Confirmed against the real Supabase
  project, by the user**: `pnpm staging:migrate` and
  `pnpm staging:create-admin` both succeeded (D65). **Not yet done**:
  `pnpm staging:seed-sample` (optional, needs `APP_ENV=staging` added to
  the user's own `.env.staging.local` first, per D64); deploying either
  Render service from the Blueprint; clicking through the deployed app.
  This tool has never run a staging script itself and never will without
  being told to — `apps/api/.env.staging.local` is git-ignored and
  deny-listed from this tool's own Read/Edit/Write.
- **Day 5a (website intake, API keys, Enquiries inbox) is done, 2026-11-24.**
  Resumed from the mid-build checkpoint the same day, once the user
  confirmed `crm_test` had migration
  `20261123194049_add_submission_spam_and_archive` applied
  (`pnpm db:verify-fresh` — which needed a small Windows bug fixed first,
  see `docs/decisions.md` D72). Everything D71 designed is now built and
  tested: API keys (generation, hashing, an Admin-only management screen),
  the intake endpoint (idempotent, honeypot-aware, lenient field mapping),
  and the Enquiries inbox (list/detail/mark-spam/archive/restore, a screen
  visible to both roles). A later same-day follow-up (D74) closed two real
  test-coverage gaps a user audit found (the key-hash/compare mechanism and
  audit/log-redaction content had no dedicated test), plus added a per-IP
  rate-limit test. Full detail in §7, `docs/decisions.md` D72–D74, and
  `docs/DAY-5A-SUMMARY.md` (rewritten from its mid-build placeholder into a
  real finished-day summary, same style as Days 1–4, now with an explicit
  tested-vs-reasoning-only table). `pnpm typecheck`/`pnpm lint` clean;
  `pnpm test` is **apps/api 427/427, apps/web 91/91** (518 total). Nothing
  pushed; nothing run against staging. The rest of Day 5 (CSV export,
  Docker packaging, the P0 freeze) is not yet
  detailed in this repo — confirm exact scope with the user before starting
  it. *(Superseded: Day 5b was then built — see §1 and D76–D82.)*
- **Day 5c is complete (2026-11-25)**: Quotations (D83–D88),
  Notifications (D90/D91) and Reports (D92), see §1 and
  `docs/DAY-5C-SUMMARY.md`. Next: the user's browser pass
  (`docs/MANUAL-TEST-DAY5C.md`), `pnpm staging:migrate`, then Day 6 (confirm
  scope with the user first). Ready-to-paste resume prompt:
  `docs/DAY-5C-HANDOVER-PROMPT.md`.
- **Future items (not scheduled; D87)**: **GST split** (CGST/SGST/IGST,
  place of supply, HSN/SAC) and **product catalogue** (products/services
  with SKU, category and price, picked into quotation lines) — both PRD
  5.7/13.1 capabilities deliberately left out of Day 5c. **Notification
  preferences** (PRD 5.11) and **deal-change notifications** (stage moves,
  Won/Lost; PRD 5.8) — added by D91.

## 14. Open questions and unverified items

- **Resolved**: the website-repo rule is now in `CLAUDE.md` (1.2c);
  `README.md`'s stale "package 1.1 only" wording is fixed (1.2c).
- **D21/D23 — real per-IP login limiting is deferred, not solved.** It needs
  the true client IP to reach this API, which it currently does not when
  traffic comes through the Next.js web app's proxy. This is a deployment-
  architecture decision (how/whether a reverse proxy in front of both apps
  sets and forwards `X-Forwarded-For`), not something to engineer around in
  application code. Revisit before relying on it as a real control.
  **Checked against the real Render/Supabase deployment architecture once
  it was actually known (D60)**: the conclusion is unchanged and now
  confirmed, not just assumed — Next's `rewrites()` proxy still breaks the
  forwarding chain the same way on Render as it does locally, so
  `TRUST_PROXY` stays `false` there too. Genuine per-IP limiting still
  needs a different network path and is still deferred.
- The exact plan for Days 2–5 beyond what's already built — the user told me
  the 7-day shape (build/test/stabilise) but not full detail for every
  package; don't invent content for them.
- **`docs/MANUAL-TEST-DAY1.md` has not actually been run by anyone yet** —
  written this session, but this environment has no browser to execute it
  against. Everything in it is believed correct from the curl-based
  verification and the automated test suite, but a real click-through may
  still surface something (e.g. a layout issue, a focus/accessibility
  detail) that neither of those would catch.
- **Package 1.6's console-clean check is unverified in a real browser** —
  same root cause as above (no browser-automation tool in this
  environment). The `suppressHydrationWarning` fix is the standard,
  documented fix for the exact pasted error (next-themes writing
  `class`/`style`/`data-theme` onto `<html>` after mount) and the SSR
  payload confirms the prop is reaching `<html>`, but neither proves the
  browser console is actually silent — that's §15 of
  `docs/MANUAL-TEST-DAY1.md`, still outstanding.
- **CORRECTED 2026-11-20 — the paragraph below was stale.** It described
  package 1.7's end-of-Day-1 open items as still current; two of them
  (the Cache Components notice on `/users`, and the missing
  password-visibility toggle) were actually resolved back in package 2.0
  and had already been marked resolved in `docs/NEXT-SESSION-START.md`
  itself — this summary paragraph just never caught up. Corrected summary,
  still current as of Day 2's end: the Users search value isn't in the URL
  (unlike Leads/Companies/Contacts, which all use `useListUrlState`, D37);
  `SearchInput`/`SessionExpiryHandler` have no component tests; and
  whether route-change revalidation produces a fast redirect or needs a
  refresh on a deactivated session was reasoned through from the code but
  never watched happen in a real browser — still unresolved, see
  `docs/NEXT-SESSION-START.md` item (e) for the full detail.
- **New from Day 2**: no component tests exist yet for the Companies,
  Contacts, or Leads screens built in 2.4–2.6 (only `DataTable`,
  `SearchInput`, and `OwnerSelect` — the shared building blocks — have
  them, D37); this was a deliberate scope choice for Day 2 (manual
  coverage via `MANUAL-TEST-DAY2.md` instead), not an oversight, but add
  key-flow tests for these screens on Day 6 per the roadmap. **Partially
  addressed in package 2.7**: `LeadForm`, `CompanyForm`,
  `ContactFormDialog`, and `PhoneInput` now have real component tests
  (D45) — but the list/detail pages (`companies-page-client.tsx`,
  `contacts-page-client.tsx`, `leads-page-client.tsx`, and the three
  detail-page clients) still have none; this bullet still applies to
  those. The
  company-name duplicate hint (2.5, D38) reuses the plain `?q=` list
  search rather than a dedicated endpoint, so it may miss a genuine
  duplicate that doesn't share a contiguous substring with the typed name
  (a real, accepted limitation, not a bug). **The Day 4 hosted-staging plan
  is now built and partly run for real** — see the Package 4C bullet in
  §13 and `docs/STAGING.md` (this sentence was a stale "still just a plan"
  note by the time of this edit; deploying the Render services themselves
  is the remaining step) — and the website-forwarding
  patch remains explicitly **not approved**.
- **New from package 3.4**: the pipeline board's actual pointer/touch and
  keyboard drag gesture has never been interactively verified in a real
  browser — same root cause as every item above (no browser-automation
  tool in this environment). The "Move to…" dropdown fallback (the
  explicitly required, always-present alternative) is proven by an
  automated test; the drag code itself follows `@dnd-kit/core`'s own
  documented usage exactly and typechecks/builds clean, but "clean and
  reliable," specifically, needs a human to actually drag a card at least
  once. Worth a specific check in a future manual-test pass for Day 3.

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
- **2026-11-19 (continued, same day)** — Packages 1.2c, 1.3, 1.3b, and 1.4
  completed and committed locally (4 more commits: `307e373`, `c095a9c`,
  `2f43bf4`, `7e780de`; still nothing pushed). 1.3's permission map and D20
  were an explicit approval gate (approved); D21 (per-IP limiter weakness)
  and the `pnpm dev` race were fixed in 1.3b before that approval; D25's
  audit-metadata gap (role_changed missing name before/after when both
  changed in one PATCH) was fixed on review, before starting 1.5 — one new
  test added, not yet in its own commit at the time this entry was written
  (will land with or just before 1.5's commit). Test count: 124 passing in
  `apps/api`. Re-verified on request, after the review gate: the 5
  rate-limit tests (`tests/auth/rate-limit.test.ts`) all pass, proving D21's
  fix; `pnpm dev` ran cleanly 5 more times in a row from a cold state (ports
  checked free before each, both services answering within 10–32s each
  time, ports confirmed free after each `taskkill .../T /F`). Working tree
  clean after each commit.
- **2026-11-19 (continued, same day) — package 1.5, Day 1 complete.** Web
  shell, login page, role-aware navigation, 403/404 pages, and a full Users
  page (create/edit/deactivate/reactivate/reset-password, server-side
  pagination/search/filters) built on top of 1.3/1.4's API. 10 shadcn
  components added; `lucide-react` had to be added separately (the CLI
  referenced it without installing it); `next-themes`/`react-hook-form`/
  `@hookform/resolvers`/`sonner` re-pinned to exact versions after the CLI
  added them with `^` ranges. Found and fixed one real bug via this
  session's own curl verification (not assumed): `/login`'s `Suspense`
  fallback was `null`, so the entire form was missing from the prerendered
  HTML until hydration — replaced with a skeleton matching the form's
  shape. `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all pass
  from a clean state (124 tests, unchanged from 1.4 — this package added no
  new `apps/api` code). Verified end-to-end through the real :3000 proxy
  with curl: login → me → users list → logout, each returning exactly what
  it should. Wrote `docs/MANUAL-TEST-DAY1.md` for the user to run in an
  actual browser, which this session could not do itself — that run is
  still outstanding (see §14). This file (`PROJECT-STATE.md`) was updated
  fully for status/repository-map/stack/decisions-index/gotchas/what's-next
  per the explicit "end of Day 1" instruction, not just appended to.
  Day 1 (packages 1.1 through 1.5) is now complete and committed locally;
  nothing has been pushed. Next: Day 2 (companies, contacts, leads) —
  not yet detailed in this repo.
- **2026-11-19 (continued, same day) — package 1.6, design system applied.**
  Loaded `docs/design-system/` (README, tokens.css, component READMEs,
  bundle.css — all present) and applied it to `apps/web`: tokens wired
  through Tailwind v4's `@theme inline`; theming switched from the 1.5
  `forcedTheme="light"` placeholder to `data-theme` with a real
  Light/Dark/System toggle in a rebuilt user menu; Inter + JetBrains Mono
  via `next/font`; `AppShell` rebuilt (240px dark sidebar with the Sales
  product chip, 56px top bar carrying the page title); Button, Field
  (Input/Label), Badge, Alert, Table restyled and Tabs added, each matching
  its component README; shared `formatINR`/`formatINRCompact`/`formatDate`/
  `formatTime` helpers added with 12 unit tests, which needed `vitest`
  adding to `apps/web` as a devDependency — asked the user first per
  `CLAUDE.md`, approved, pinned to the same `5.1.1` already in `apps/api`.
  Fixed the hydration-mismatch error pasted at the start of this package
  (`suppressHydrationWarning` on `<html>` in `layout.tsx`) and the one other
  hard-coded colour found outside the token file (`dialog.tsx`'s
  `bg-black/50` scrim, now `bg-ink/40` per the README's own spec). Removed
  the duplicate per-page `<h1>`s now that the top bar owns the title.
  `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all pass clean
  (136 tests: 124 `apps/api` + 12 new `apps/web`). Verified via `curl`
  against the already-running dev server that `/login` and `/` still
  return 200 and that `suppressHydrationWarning: true` actually reaches
  `<html>` in the SSR payload; a live browser console check was not
  possible in this environment (no browser-automation tool available) and
  is now an explicit manual item in `docs/MANUAL-TEST-DAY1.md` §15
  (renumbered from §12 in package 1.7), which also gained checks for theme
  switching, no-pure-white/black, fonts, visible focus rings, and the badge
  dot-plus-word rule. Two ports (3000, 4000) were already occupied at
  session start by node processes that predate this session (the user's
  own long-running `pnpm dev`, consistent with the pasted error having
  come from a live dev session) — left running rather than killed, since
  this session did not start them.
- **2026-11-19 (continued, same day) — package 1.7, three small fixes.**
  (1) Replaced the Users page's separate search `Input` + "Search"
  `Button` with a new reusable `SearchInput` (magnifier runs the search,
  clear-`x` resets it) meant for Leads/Companies/Contacts to reuse later;
  confirmed the search value was never actually in the URL before this
  package, so nothing needed preserving there beyond not regressing it.
  (2) Added real session-expiry-while-open handling: a module-level
  `onUnauthorized` listener in `api-client.ts` fires on any 401 from any
  `apiGet`/`apiPost`/`apiPatch` call (covering direct mutation calls, not
  just ones wrapped in TanStack Query), and the new `SessionExpiryHandler`
  (mounted once in `providers.tsx`) clears the query cache and redirects
  to `/login?next=<path>` exactly once — guarded against both a parallel-
  request burst and `/login`'s own expected 401 on a wrong password.
  `useMe()` now revalidates on window focus; `AuthGuard` revalidates it on
  every route change inside the protected shell. Added 4 unit tests for
  `onUnauthorized` (mocked `fetch`, no DOM needed); `SearchInput` and
  `SessionExpiryHandler` themselves are not unit tested — that needs
  `jsdom`/`@testing-library/react`, not installed and not what was asked
  for in this package, flagged as a gap rather than added silently.
  (3) For the Cache Components "instant navigation" dev notice: the
  earlier decision this package's brief referred to wasn't recoverable
  from `decisions.md`, `PROJECT-STATE.md`, or any stored session
  transcript, so it was asked again rather than guessed — confirmed as
  `export const instant = false` on the affected routes, applied as one
  export on `(protected)/layout.tsx` (the only Server Component ancestor
  shared by every protected route; can't be set on `users/page.tsx`
  itself, a Client Component — throws if you try). `pnpm typecheck && pnpm
  lint && pnpm test && pnpm build` all pass clean (140 tests: 124
  `apps/api` + 16 `apps/web`, 4 new). Verified via `curl` that `/`,
  `/users`, `/login` still return 200 on the already-running dev server
  after all three changes; a live browser/DevTools check (the search box's
  keyboard/screen-reader behaviour, the two-cookie-store session-expiry
  scenario, the Cache Components dev notice itself) was not possible in
  this environment and is now `docs/MANUAL-TEST-DAY1.md` §13/§14, plus one
  added check in the renumbered §15. `docs/decisions.md` D28. Day 1
  (packages 1.1 through 1.7) remains complete and committed locally;
  nothing has been pushed. The two pre-existing node processes on ports
  3000/4000 were left untouched again, for the same reason as last time.
- **2026-11-19 (continued, same day) — end-of-Day-1 docs handover, no code
  changes.** Full pass over the documentation per the user's explicit
  request, so a brand-new session can continue Day 2 from the repo alone:
  added an explicit environment-variable-names
  subsection to §4; added two gotchas that existed in practice but weren't
  written down (`cmd.exe`-style command examples, split-screen windows
  sharing one cookie store); added conventions for the design tokens, the
  `SearchInput` pattern, the global 401 handler, and the planned "thin
  Server Component page wrapper" pattern for `instant`; added `docs/
  design-system/`, `DAY-1-SUMMARY.md`, `MANUAL-TEST-DAY1.md`, and
  `NEXT-SESSION-START.md` to the repo map. `docs/decisions.md` got a
  numbering/dating note at the top (every entry D1–D29 happened on
  2026-11-19) and a new **D29** for four Day 2 rules the user approved at
  the end of this session (lead status transitions, lead-creation
  requirements, duplicate-detection-warns-only, Staff permissions on
  companies/contacts/leads) — none of them built yet. Wrote two new files:
  `docs/DAY-1-SUMMARY.md` (plain-language what-was-built/verified/fixed,
  and a how-to-run-and-log-in section) and `docs/NEXT-SESSION-START.md`
  (the actual first-file-to-read: brief, hard rules, reading order, the
  known shape of the Day 2 plan, the Day 4 staging plan, and every open
  item re-verified against the current code before being written down).
  `CLAUDE.md` got one small edit — its "start of session" line now points
  to `NEXT-SESSION-START.md` first.

  Each open item carried into `NEXT-SESSION-START.md` was individually
  checked against the actual code in this session, not carried over on
  assumption: (a) the Cache Components notice on `/users` is confirmed
  still open — `(protected)/layout.tsx` has `instant = false`, but
  `users/page.tsx` is a Client Component and can't carry its own
  exemption, and per the user's own browser testing the layout-level
  setting alone isn't enough; the fix (a thin Server Component wrapper) is
  real but not yet implemented. (b) no password-visibility toggle exists
  anywhere — confirmed by grep, still open. (c) the Users search value is
  still plain `useState`, not in the URL — confirmed by grep, still open.
  (d) no `jsdom`/`@testing-library/react` in `apps/web/package.json` —
  confirmed, no component tests exist for `SearchInput` or
  `SessionExpiryHandler`, still open. (e) **not resolved either way**:
  traced the actual `@tanstack/query-core` reducer source to confirm a
  failed background refetch does set `status: "error"` (so `AuthGuard`'s
  redirect condition should fire), and the global 401 handler is wired
  independently of `AuthGuard` too — on paper this should already work
  promptly, but that's a code reading, not a watched browser test (no
  browser-automation tool in this environment), and it contradicts the
  user's own report of it only working after a refresh. Written up as an
  open, unreconciled discrepancy rather than claimed as fixed. (g) the
  design-system `.zip` is still untracked, confirmed via `git status` —
  intentional, unchanged.

  Verification: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
  all pass, test counts unchanged from package 1.7 as expected for a
  docs-only change (140: 124 `apps/api` + 16 `apps/web`). Process hygiene:
  no process was started this session; ports 3000 and 4000 were both
  already free at session start and remained so throughout — nothing to
  stop. Committed as one docs-only commit; nothing pushed.
  **Correction (same session, separate commit)**: the first commit above
  wrongly framed `main` matching `origin/main` at session start as an
  unresolved "mystery." The user clarified: they push manually after
  reviewing each report; Claude Code never pushes. Fixed throughout this
  file, `NEXT-SESSION-START.md`, and `DAY-1-SUMMARY.md`, and removed from
  the open-items list entirely (it was never something to investigate).
- **2026-11-19 (new session) — package 2.0, Day 1 leftovers closed out.**
  (a) Every `page.tsx` under `app/(protected)/` is now a thin Server
  Component wrapper carrying its own `export const instant = false`:
  `users/page.tsx` (previously `"use client"` itself, unable to carry
  `instant` at all — Next throws) now renders a new
  `components/users/users-page-client.tsx` (`UsersPageClient`, the exact
  same logic, just moved, not rewritten); `page.tsx` (Home) and
  `forbidden/page.tsx`, already plain Server Components with nothing
  interactive, simply gained the same export directly — no artificial
  client split was introduced for static content. This closes open item
  (a) from `NEXT-SESSION-START.md` and is now documented as the standing
  convention for every future protected page (§12). (b) Added
  `PasswordInput` (`apps/web/components/ui/password-input.tsx`) — a
  show/hide toggle (Lucide `Eye`/`EyeOff`, with `aria-label`/`aria-pressed`)
  wrapping the existing `Input`, same styling, drop-in compatible with
  react-hook-form's `{...field}` spread. Replaced the bare
  `<Input type="password" />` in `login-form.tsx`, `create-user-dialog.tsx`,
  and `reset-password-dialog.tsx` — all three password fields in the app,
  closing open item (b). One lint fix needed along the way: ESLint's
  `@typescript-eslint/no-empty-object-type` rejected an empty `interface
  PasswordInputProps extends Omit<...> {}`; changed to a `type` alias.
  `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all pass clean
  (140 tests, unchanged from package 1.7 — this package was UI
  restructuring/wiring with no new logic needing its own test). No process
  was started this package (no dev server run); nothing to stop. Committed
  locally; nothing pushed. Full detail in `docs/decisions.md` D31 (and D30
  for the separately-recorded notes policy decided at the same time, ahead
  of package 2.3).
- **2026-11-19 (same session, continued) — package 2.1, backend
  foundations.** Before starting, found and reported a real conflict
  between the 2.3 brief (lead status changes should record an optional
  note) and the already-migrated `lead_status_histories` table (no note
  column) — stopped and asked rather than choosing, per instruction;
  resolved as "drop the note entirely," recorded as `docs/decisions.md`
  D32. Then built: normalisers (`packages/shared/src/normalize.ts` —
  normalizeEmail/normalizePhone/normalizeCompanyName, with iterative
  legal-suffix stripping for company names); `LEAD_STATUSES`/
  `OPEN_LEAD_STATUSES`/`PRIORITIES` as `as const` tuples + `z.enum` (not TS
  enums, so no `ROLES`-style bridge cast is needed); the duplicate finder
  (`apps/api/src/lib/duplicates.ts` — three explicit functions, one per
  resource, since Company/Contact/Lead each have a different set of
  normalised columns); `buildOrderBy` (`apps/api/src/lib/list-query.ts`,
  the one genuinely new generic helper — pagination.ts's
  toSkipTake/buildPaginationMeta from package 1.4 were reused unchanged,
  not replaced); a new `lead-sources` module (`GET /api/v1/lead-sources`,
  active-only, `leads:read`); `GET /api/v1/users/options` added to the
  existing `users` module (`auth: 'authenticated'` so Staff can populate
  owner pickers too, registered before `/users/:id` for Express
  route-ordering reasons). Adding `/users/options` required updating
  `tests/users/registry-permissions.test.ts`'s "every `/users*` route is
  403 for Staff" sweep to carve out this one exception (with its own
  200-for-Staff test) — a necessary consequence, not scope creep. One lint
  fix needed: `normalize.ts`'s character-class regex had an unnecessary
  escape on a trailing `-` (`no-useless-escape`), removed. `pnpm typecheck
  && pnpm lint && pnpm test && pnpm build` all pass clean (149 tests: 124
  carried over + 25 new, all `apps/api`; `apps/web` unchanged at 16). No
  process was started this package; nothing to stop. Committed locally;
  nothing pushed. Full detail in `docs/decisions.md` D32–D33.
- **2026-11-19 (same session, continued) — package 2.2, Companies and
  Contacts API.** Full CRUD plus archive/restore for both resources, built
  on 2.1's foundations (normalisers, duplicate finder, `buildOrderBy`).
  Create/update responses carry `{ data, duplicates }` (duplicates always
  present, an empty array when there are none, never the error envelope —
  D29). `archived` is a tri-state list filter via the existing
  `booleanQueryParam` (hidden by default, `archived=true` shows only
  archived rows). Archiving an already-archived record (or restoring an
  active one) is 404, consistent with how every other "not in the state
  you expected" case in this codebase is handled. A blank string on PATCH
  clears a text field to null; `companyId`/`ownerId` were changed to
  `.nullable().optional()` in the shared schemas specifically so a client
  can send `null` to detach a contact from its company or clear an owner
  (`z.uuid()` alone has no valid empty-string form to overload for that).
  Hit one real type-level bug caught by `pnpm typecheck` before any test
  ran: a `blankToNull` typed to accept/return `string | undefined` made the
  conditionally-built Prisma update object's inferred type include
  `undefined` on an optional property, which Prisma's generated
  `*UpdateInput` types (compiled with `exactOptionalPropertyTypes: true`)
  reject outright — fixed by narrowing `blankToNull` to a plain
  `(string) => string | null` and only calling it from a branch that had
  already excluded `undefined`. Added `assertOwnerInOrg`/
  `assertCompanyInOrg` in both service files — a real, not just
  theoretical, instance of the cross-organisation FK gap D13 flagged
  (Postgres's plain FK on `ownerId`/`companyId` only proves the id exists
  *somewhere*, not that it's in the caller's organisation); without this, a
  bogus cross-org id would have silently attached instead of 404ing like
  every other cross-org reference in the app. `lifecycleStatus` stayed
  free text (defaulting `'ACTIVE'`) rather than inventing an enum the brief
  never specified values for. `pnpm typecheck && pnpm lint && pnpm test &&
  pnpm build` all pass clean (187 tests: 149 carried over + 38 new, all
  `apps/api`; `apps/web` unchanged at 16). No process was started this
  package; nothing to stop. Committed locally; nothing pushed. Full detail
  in `docs/decisions.md` D34.
- **2026-11-19 (same session, continued) — package 2.3, Leads API.** Full
  CRUD plus archive/restore, built on 2.1/2.2's patterns. The status
  workflow is a separate `POST /leads/:id/status` endpoint, not folded into
  the general `PATCH` — its input type (`OpenLeadStatus`) structurally
  excludes `CONVERTED` as a target, so submitting it is a 422 at the
  validation layer, not a runtime check; the complementary "the lead is
  already CONVERTED" case can't be expressed in the type system, so the
  service checks `existing.status === 'CONVERTED'` and refuses with 409.
  Every successful change writes one `LeadStatusHistory` row and one audit
  row in the same transaction — no `note` field, per D32's earlier
  resolution. `requirement` and `capturedFields` are simply absent from
  `updateLeadSchema`'s shape, so a `PATCH` that mentions them succeeds
  (200) and silently changes nothing about them (Zod's default
  non-`.strict()` stripping) — a test asserts the original values survive,
  read as the more consistent interpretation of "read-only" (matching how
  `updateUserSchema` already treats `email`, not a special new error).
  Clearing both email and phone on a `PATCH` is caught as a clean
  service-level 422 before the write, rather than letting the database's
  `leads_has_email_or_phone` CHECK fire as an unmapped `P2039` that would
  otherwise fall through to a generic 500 (the central error handler's own
  comment explains why that code is deliberately left unmapped). Added
  `GET /api/v1/leads/duplicates` (the standalone duplicate-check endpoint
  the brief asked for, registered before `GET /leads/:id` for the same
  Express route-ordering reason as `GET /users/options` in 2.1) and `GET
  /api/v1/leads/:id/status-history` (not explicitly asked for, added
  anyway since it's a thin read over rows the status endpoint already
  writes — useful for the 2.4–2.6 lead detail UI ahead of Day 4's richer
  merged timeline, nothing to migrate later). Verified Zod v4's
  `z.iso.datetime()` empirically (`node -e` against the installed
  `zod@4.6.7`) before using it for `nextFollowUpAt`/the list's date-range
  filters: its default mode requires a trailing `Z` and rejects both a bare
  local datetime and a `+05:30` offset, matching every other UTC timestamp
  in this app. `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
  all pass clean (215 tests: 187 carried over + 28 new, all `apps/api`;
  `apps/web` unchanged at 16). No process was started this package;
  nothing to stop. Committed locally; nothing pushed. Full detail in
  `docs/decisions.md` D35.
  **Day 2 backend (packages 2.1–2.3) is now complete.**
- **2026-11-19 (new session) — package 2.3b, small backend fixes.** Before
  the Day 2 UI packages: (1) archive/restore on a record already in that
  state now returns 409 (`ALREADY_ARCHIVED` archiving an archived record,
  `NOT_ARCHIVED` restoring an active one) instead of 404, across
  Companies/Contacts/Leads — the lookup in each service function dropped
  its `archivedAt` filter so it can distinguish "doesn't exist" (still 404)
  from "exists but already in that state" (now 409); one pre-existing test
  updated, new tests added for all three resources plus a "missing id
  stays 404" boundary check. (2) Re-confirmed, read-only, that `activities`
  can hold a `NOTE` type for Day 4 (`activity_type` already includes
  `NOTE`; the `activities_done_has_completed_at` CHECK already matches the
  roadmap's "notes created as DONE" plan) — same finding as D30, asked for
  again directly this package. (3) Checked the PRD directly for Contact
  `lifecycleStatus` values: never enumerated, so it stays free text in the
  API and will not appear in package 2.5's UI. (4) Added the pre-approved
  `jsdom`/`@testing-library/react`/`@testing-library/dom` devDependencies
  to `apps/web` and set `vitest.config.mts`'s `test.environment` to
  `"jsdom"` globally, ahead of package 2.4's component tests. `pnpm
  typecheck && pnpm lint && pnpm test && pnpm build` all pass clean (219
  `apps/api` tests: 215 carried over + 4 new; `apps/web` unchanged at 16,
  now running under jsdom — duration rose from under 1s to ~9s, almost
  entirely jsdom setup, no code change needed). No process was started
  this package; nothing to stop. Committed locally; nothing pushed. Full
  detail in `docs/decisions.md` D36.
- **2026-11-19 (new session, continued) — package 2.4, shared UI building
  blocks.** Built `DataTable` (wraps the existing, already-restyled Table
  components; server-side paging/sorting; filter-bar slot; loading
  skeleton; empty state with one action; error state with retry; a
  sortable header is a real focusable `<button>`, not a styled `<div>`;
  row-opens-record is a real `<Link>` in the first column's own `render`,
  not row-level click/keydown handling — matches the Table README's "first
  column is the record name... and opens the record" literally).
  `RecordLayout` (header + key-fields strip + Tabs) built but not yet
  wired into a page — only `DataTable` needed real-page proof this
  package. `OwnerSelect` (wraps `Select` over `GET /users/options`,
  deliberately kept to form use — a list-page owner *filter* has different
  "no filter" vs "owner = nobody" semantics, so the Companies list uses a
  separate plain `Select` instead) and `CompanySelect` (a small hand-built
  async combobox, debounced 300ms into `GET /companies?q=`, since no
  Combobox/Command primitive is installed and one wasn't added for a
  single picker). `useListUrlState` (page/pageSize/filters live in the
  URL via `router.replace`). Wired all of this into a real Companies list
  page (`/companies`) — search, owner/archived filters, sort limited to
  the two fields the API's `COMPANY_SORT_FIELDS` actually allows — plus a
  new sidebar entry; the "Add company"/row links point at `/companies/new`
  and `/companies/:id`, which don't exist until package 2.5 (a known,
  temporary 404, not an oversight). Moved `ConfirmActionDialog` from
  `components/users/` to `components/ui/` — it was always fully generic.
  Found and fixed a real ESLint catch in `CompanySelect`: two `useEffect`s
  syncing derived state tripped `react-hooks/set-state-in-effect`;
  rewritten using React's own documented "adjust state during render"
  pattern instead, with no `useEffect` at all. Component tests added for
  `DataTable`, `SearchInput`, and `OwnerSelect` (the one picker tested per
  the brief — `CompanySelect`'s async/debounced behaviour was judged not
  worth the added timer-mocking fragility for this package; it'll be
  exercised through the Lead form in 2.6 instead). The very first test run
  surfaced a real gap: `@testing-library/react`'s automatic cleanup never
  self-registers without vitest's `globals: true` (not used anywhere in
  this repo), so `render()` calls were piling up across tests in the same
  file instead of unmounting — fixed with a new `apps/web/tests/setup.ts`
  (`afterEach(cleanup)`), mirroring `apps/api`'s own existing setup-file
  convention. `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all
  pass clean (249 tests: 219 `apps/api` unchanged + 30 `apps/web`, 14
  new). No process was started this package; nothing to stop. Committed
  locally; nothing pushed. Full detail in `docs/decisions.md` D37.
- **2026-11-20 (new session, continued) — package 2.5, Companies and
  Contacts UI.** Before building the Contact form, found a real PRD/schema
  conflict and stopped to ask per instruction: PRD §13.1 names "alternate
  phone (optional)" and "preferred communication method (optional)" as
  Contact fields, but the already-approved `contacts` table has no columns
  for either. Resolved: drop both, no migration — confirmed by the user.
  Built full create/edit pages for Companies (`/companies/new`,
  `/companies/[id]/edit` — richer, ~15-field form with a two-column grid,
  matching the Field README's own guidance for that case) and a
  `ContactFormDialog` for Contacts (fewer fields, launched from two
  different contexts: standalone from `/contacts`, and "Add contact" on a
  Company's own Contacts tab via a `lockedCompany` prop). Both forms
  validate against the *create* schema even when editing, submitting the
  full field set as `PATCH` — sidesteps a real `react-hook-form`/Zod
  generic-typing conflict entirely rather than fighting it: Zod v4's
  `z.coerce.number()` (used for `annualRevenue`) has an *input* type of
  `unknown` by default (confirmed by reading the installed `zod@4.6.7`'s
  own `coerce.d.ts`), which broke a plain `useForm<CreateCompanyInput>`
  everywhere a `FormField` touched it; fixed with a form-local
  `companyFormSchema` that overrides just that one field with a
  non-coercing validator, rather than react-hook-form's own documented but
  messier 3-generic `useForm` fix. Added a Company detail page
  (`RecordLayout`, Overview + Contacts tabs) and a Contact detail page,
  both with archive/restore via the shared `ConfirmActionDialog` and
  success toasts. Added a duplicate hint on company-name blur — no
  dedicated backend endpoint exists for this (unlike Leads' `GET
  /leads/duplicates`), so it reuses the ordinary `GET /companies?q=` list
  endpoint as an approximate, warn-only hint; the real normalised-exact
  match still runs server-side on save regardless. Added `Textarea`
  (no shadcn-generated one existed) and `stripEmptyOptionalFields` (a real
  gap reasoned through before shipping, not caught by a failing test:
  react-hook-form sends `""` for every untouched optional field, which a
  create endpoint's `?? null` fallback doesn't catch, so without this a
  blank field would save as a literal empty string instead of `null`).
  `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all pass clean
  (249 tests, unchanged — this package was UI wiring over 2.2's
  already-tested endpoints; new routes confirmed directly in the build
  output instead). No process was started this package; nothing to stop.
  Committed locally; nothing pushed. Full detail in `docs/decisions.md`
  D38. Next: package 2.6 (Leads UI) — the last package before the combined
  report and `docs/MANUAL-TEST-DAY2.md`.
- **2026-11-20 (continued, same day) — package 2.6, Leads UI, Day 2's last
  package.** Built the list page (`/leads`) with all five named filters
  (status/source/priority/owner/created-date-range) plus search, all
  server-side and reflected in the URL (`useListUrlState`, D37); sort
  limited to the fields the API actually allows
  (name/status/priority/createdAt). Built a shared `lead-form.tsx` for
  both create (`/leads/new`) and edit (`/leads/[id]/edit`), but — unlike
  Company/Contact's "always validate against create, PATCH the full set"
  shortcut (D38) — these needed two genuinely different form-local
  schemas, because `requirement` ("original enquiry") is create-only and
  must never be editable afterwards; exported a new
  `leadCreatableFields` from `packages/shared/src/leads.ts` so both
  schemas could be rebuilt from the same ~13 field validators without
  duplicating them (`createLeadSchema` is a `ZodEffects`, not a plain
  `ZodObject`, so it has no `.extend()` the way Company's schema did).
  Hit the same `z.coerce.number()`-vs-`useForm` generic clash as
  Company's `annualRevenue` (D38), this time for `estimatedBudget` — same
  fix, a form-local non-coercing override. The duplicate-warning banner
  calls the real `GET /leads/duplicates` endpoint (2.3, D35) rather than
  approximating like Company's blur hint — Leads already had the
  purpose-built endpoint — and, per D29, still never blocks the save.
  Built the lead detail page (`/leads/[id]`) with status-change buttons
  for every open status except the current one, the whole "Change
  status" section omitted entirely once `CONVERTED` (no convert action
  exists yet — Day 3), a read-only "Original enquiry" panel
  (`requirement` + a generic `capturedFields` dump), and a History tab
  listing every `LeadStatusHistory` row newest-first — satisfying this
  session's "qualifying a lead writes a visible history entry"
  acceptance item. Added `lib/datetime-local.ts` to bridge the native
  `datetime-local` input (bare local string) and the API's ISO instants
  for "Next follow-up". Added a **Leads** sidebar entry, placed first.
  One small Zod typing fix along the way: a `.refine()` options object's
  `path: ["email"] as const` produced a `readonly` tuple Zod's own type
  rejects; dropped `as const` and cast the options object directly
  instead. `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all
  pass clean (249 tests, unchanged — UI wiring over 2.3's already-tested
  endpoints, same as 2.5; manual coverage lives in the new
  `docs/MANUAL-TEST-DAY2.md` instead). New routes confirmed in the build
  output: `/leads`, `/leads/new`, `/leads/[id]`, `/leads/[id]/edit`. No
  process was started this package; nothing to stop. Committed locally;
  nothing pushed. Full detail in `docs/decisions.md` D39. This closes out
  the 2.3b–2.6 scope for this session — a single combined report was
  given after this package, and no Day 3 work (lead conversion, deals,
  pipeline) was started, per explicit instruction.
- **2026-11-20 (new session) — Day 2 handover, docs only, no code
  changes.** The user ran `docs/MANUAL-TEST-DAY2.md` in a real browser and
  confirmed all five named acceptance items passed, and separately
  approved five refinements found during that same pass as package 2.7's
  scope (`docs/decisions.md` D40–D44 — minimal required fields, structured
  phone input, new-forms-must-open-empty, Contacts needing email-or-phone,
  two small Leads UI fixes) — **none of D40–D44 is built**, this session
  only recorded them. Wrote `docs/DAY-2-SUMMARY.md` (package-by-package
  recap, endpoints/screens added, bug list, how-to-run, mirroring
  `DAY-1-SUMMARY.md`'s structure). Updated this file's §9 (added D40–D44),
  §13 (Day 2 marked done, 2.7 named as the next work), and §14 — found and
  corrected a real stale statement: the open-items summary here still
  described two package-1.7 items (the `/users` Cache Components notice,
  no password-visibility toggle) as outstanding, when `docs/
  NEXT-SESSION-START.md` had already marked both resolved back in package
  2.0; this file's copy just never caught up. Rewrote
  `docs/NEXT-SESSION-START.md` for the next session: Day 2 complete,
  package 2.7 (D40–D44) as the immediate next work, then Day 3 (lead
  conversion first, as its own transaction, then deals/pipeline).
  Re-verified `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
  after all doc edits — all pass, 249 tests unchanged (docs-only, no
  source files touched). No process was started this session; nothing to
  stop. One commit, docs only; nothing pushed.
- **2026-11-20 (new session) — package 2.7, items 1 through 4, D40–D44
  built and verified; this entry (item 5) is the documentation pass.**
  Read the full required reading order first (`CLAUDE.md`,
  `NEXT-SESSION-START.md`, this file, `decisions.md`, `SCHEMA-SUMMARY.md`,
  both day summaries, the design-system README) and confirmed
  understanding before starting, per the owner's explicit instruction. Per
  the owner's session-specific instruction, did **not** stop for review
  after each item — ran full verification and committed after each one,
  stopping only if something couldn't be fully verified or needed a
  decision; nothing did.
  - **Item 1 (D42, `569b27d`)**: root-caused, not assumed — read Next's own
    bundled Cache Components docs directly rather than guessing, confirmed
    `/leads/new`/`/companies/new` build as fully static routes (so they're
    exactly the kind `Activity` preserves), and fixed with the pattern
    those docs themselves recommend.
  - **Item 2 (D41, `f8a5e9f`)**: built the phone architecture, then found a
    real bug in `PhoneInput`'s first draft via its own test suite before
    committing — not caught by typecheck or lint, only by actually running
    the new tests. Fixed properly (matching `CompanySelect`'s real
    mechanism, not just copying its shape) rather than patched around.
    Updated two pre-existing tests that the stricter validation correctly
    started rejecting.
  - **Item 3 (D40 + D43, `abb10fb`)**: settled the "does a lead source
    named exactly 'Manual' exist" question the previous session had
    flagged as needing to ask, by reading `seed-lib.ts` directly — it does,
    so no question was needed. Found seven pre-existing tests (six in one
    file, one in another the first grep pass missed) that the new
    Contacts email-or-phone rule correctly started rejecting, and fixed
    each to keep testing what it actually tests.
  - **Item 4 (D44, `1dfbeb7`)**: confirmed `LeadStatusHistory.changedById`
    already existed (not assumed) before adding the join; fixed Lead's
    permanently-visible hint using the same pattern already built
    correctly for Contact's brand-new equivalent in item 3.
  - **Item 5 (this entry)**: updated `docs/MANUAL-TEST-DAY2.md` for all
    four items (new §1.2a, §1.5a, and a "Package 2.7" block in the
    acceptance checklist; fixed several steps that would otherwise now
    fail under the stricter validation, e.g. a contact created with no
    email/phone); updated `docs/decisions.md` (new D45, closing out
    D40–D44 with what was actually built, including the two real bugs
    found); updated this file (§1, §5, §7, §9, §10, §11, §13, §14, this
    entry).
  - Final verification after every commit: `pnpm typecheck && pnpm lint &&
    pnpm test && pnpm build` all pass, final count 244 `apps/api` + 53
    `apps/web` = 297 tests (up from 219 + 30 = 249 at the start of this
    session). Four commits, one per item (1–4); this documentation pass is
    a fifth. Nothing pushed. Package 2.7 is done; Day 3 (lead conversion,
    deals, pipeline) is next.
- **2026-11-20 (new session) — packages 3.1 and 3.2 built, then a docs-only
  catch-up pass before 3.3.** Package 3.1 (`3f08a38`): the lead conversion
  transaction (`lead-conversion.service.ts`'s `convertLead`, one
  `$transaction` with a `SELECT ... FOR UPDATE` row lock, link-or-create
  Company and Contact with the fill-empty-only/never-overwrite rule, an
  optional Deal in the pipeline's first open stage, convert + history +
  `LeadConversion` + activity-repoint + audit), plus `GET
  /leads/:id/conversion-matches`; `tests/helpers/tenant.ts` extended with a
  real six-stage pipeline per tenant; 12 new tests including a forced
  mid-transaction rollback and two concurrent conversions on the same lead.
  Package 3.2 (`f2c59e0`): full Deals API on top of 3.1's pipeline helpers
  (factored into the new `apps/api/src/lib/pipeline.ts`) — create, `POST
  /:id/stage` (probability copied from the target stage every time, per the
  roadmap's D7), `POST /:id/close` (Won/Lost, Lost requires a reason), `POST
  /:id/reopen` (back to the first open stage), archive/restore (deliberately
  not blocked on a closed deal), `PUT /:id/contacts`, and the new `pipeline`
  module (`GET /pipeline/{stages,summary}`, the summary computed entirely as
  Postgres SQL); 19 new tests. Both packages were built and committed in
  this session with their own `pnpm typecheck && pnpm lint && pnpm test &&
  pnpm build` verification (309 tests after 3.1, 328 after 3.2), but
  `docs/decisions.md` and this file were **not** updated at the time — a
  genuine gap, not an intentional deferral. Before starting package 3.3, the
  user asked for a docs-only catch-up commit: this session re-derived both
  packages' actual behaviour directly from the shipped code (not from
  memory or the commit messages alone, though both commit messages turned
  out to already contain accurate, detailed write-ups) and from the real
  commit diffs (`git show --stat` on both), then wrote `docs/decisions.md`
  D46 (package 3.1) and D47 (package 3.2) — including the three genuinely
  new judgment calls confirmed by reading the actual code (converting into a
  new company requires the lead to have a company name, 422 otherwise;
  reopen always returns to the pipeline's first open stage; archive/restore
  are deliberately not gated by the closed-deal-is-read-only rule) — and
  updated this file's §1 snapshot, §5 repository map (the `leads/
  lead-conversion.service.ts`, `deals/`, `pipeline/` modules and
  `apps/api/src/lib/pipeline.ts`; the new `packages/shared` schema files;
  the new test files), §7 (package-by-package entries for 3.1/3.2), §8 (a
  note that no migration was needed — every Day 3 table already existed
  from Day 1's schema), §9 (the D46/D47 index lines), §11 (test counts), and
  §13 (what's next). Two of the five judgment calls the user's approval
  message named ("a closed, fixed country-code list" and "Company's core
  fields vs. a collapsed 'More details' section") turned out to already be
  fully recorded — they're package 2.7's D41 and D40/D45, not new to 3.1/
  3.2 — so no new decision entry was written for those two, only a short
  cross-reference note at the end of D47; nothing about them was re-decided
  or changed. No code changed in this pass; `pnpm typecheck && pnpm lint &&
  pnpm test && pnpm build` were re-run anyway to confirm nothing had been
  disturbed, same result as before (275 `apps/api` + 53 `apps/web` = 328).
  One docs-only commit. Nothing pushed. Packages 3.3 (deals list/forms/
  detail UI), 3.4 (the Kanban pipeline board), and 3.5 (the convert dialog
  and related tabs) are next, in the same session.
- **2026-11-20 (same session, continued) — package 3.3, Deals list, forms,
  detail, close dialogs.** Backend groundwork first: a `contactId` filter
  on `GET /deals` (via the `DealContact` join — a deal has no direct
  contact column), ahead of 3.5's Contact Deals tab; `GET
  /deals/:id/stage-history` (`dealStageHistoryResponseSchema`,
  `listDealStageHistory`), same shape and actor-join pattern as Lead's
  status history (D35). While building the Contacts tab, found that the
  brief's "list this deal's contacts" requirement had no corresponding
  read endpoint — only `PUT /deals/:id/contacts`, which returns state only
  after a write — stopped and asked per instruction rather than guessing;
  approved option: extend `dealResponseSchema` itself with a `contacts:
  { contactId, contactName, isPrimary }[]` summary, populated by one
  shared Prisma include (`dealContactsInclude`) added to every query that
  builds a `DealResponse` (create, get, update, move-stage, close, reopen,
  archive, restore, list) — a freshly created deal correctly returns
  `contacts: []`, not an absent field, confirmed by a new test.
  Frontend: `/deals` (list — search, stage/status/owner/company filters,
  archived toggle, sortable name/value/probability/expectedCloseDate);
  `/deals/new` and `/deals/[id]/edit` sharing one `DealForm` (Stage is
  create-only — `updateDealSchema` has no `stageId` key at all, D47 — and
  defaults to the pipeline's first open stage, copying its probability;
  hit the same `z.coerce.number()` Zod v4 gotcha as Company/Lead for
  `value`/`probability`, same fix as D38/D39, the third time now); new
  `ContactSelect` picker (same hand-built combobox pattern as
  `CompanySelect`, D37); `/deals/[id]` (`RecordLayout` — key facts include
  a client-computed Weighted value; Overview/Contacts/Stage history tabs;
  actions: Edit, Move stage via a `DropdownMenu` of the pipeline's other
  open stages, Close as Won via a plain `ConfirmActionDialog`, Close as
  Lost via a new `CloseLostDialog` requiring a `LOSS_REASONS` reason
  before its submit button enables, Reopen once closed — all correctly
  gated on `deal.status`; Archive/Restore are **not** gated, mirroring
  D47's backend choice exactly, not an independent frontend call). New
  `apiPut` added to `lib/api-client.ts` — this app's first `PUT` route.
  Component tests deliberately avoid simulating a Radix `Select`
  dropdown's open/pick interaction, the same restraint every existing test
  in this repo already shows (`lead-form.test.tsx`'s Source-preselect test
  only ever reads the trigger's displayed text) — "stage pre-fills
  probability" is proven via the create-mode default-autofill (the same
  code path a real pick would also run), and "Lost dialog cannot submit
  without a reason" is proven by opening the `Dialog` (not a `Select` —
  no established avoidance pattern needed there) and reading the footer
  button's `disabled` property directly, since this repo has no
  `@testing-library/jest-dom` (D37) and therefore no `toBeDisabled()`
  matcher. `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all
  pass clean (279 `apps/api`: 275 carried over + 4 new; 63 `apps/web`: 53
  carried over + 10 new; 342 total). One commit. Nothing pushed.
  `docs/decisions.md` D48 has the full detail. Packages 3.4 (the Kanban
  pipeline board) and 3.5 (the convert dialog and related tabs) are next,
  in the same session.
- **2026-11-20 (same session, continued) — package 3.4, the pipeline
  board.** Checked and confirmed `@dnd-kit/core@6.3.1` (current npm
  "latest") installs with no peer-dependency warning against this repo's
  `react@19.3.1` — both on the initial `pnpm add` and again on a clean
  `pnpm install` afterward — before writing any code; added it exact-
  pinned, `apps/web` only, no `/sortable` or `/utilities` alongside it.
  Built `components/deals/pipeline-board.tsx`: one column per `OPEN`
  pipeline stage (Won/Lost never get a column; their totals show in a
  small "Open pipeline" summary bar instead, sourced from `GET
  /pipeline/summary`'s existing `open` aggregate, D47 — no new
  client-side aggregation); each column runs its own deliberately simple,
  filter-free `useDealsList` query so its cache key is predictable;
  every card carries an always-present "Move to…" dropdown and is also a
  real `@dnd-kit/core` draggable (`PointerSensor` with an 8px activation
  distance so the card's nested link and dropdown trigger stay clickable;
  `KeyboardSensor` with its own built-in default coordinate getter, not
  `/sortable`'s; `closestCenter` collision detection). One shared
  `useMoveDealMutation` backs both the dropdown and the drag handler —
  TanStack Query's own documented optimistic-update recipe (cancel both
  affected columns' queries, snapshot both, patch both caches, roll back
  both on error with a toast, broadly invalidate `deals` and `pipeline`
  on settle regardless of outcome). Added a Board/List toggle to
  `/deals` (`?view=board`, kept in the URL via the existing
  `useListUrlState` mechanism), hiding the 3.3 list and its filter bar
  entirely when Board is selected. Wrote the one explicitly required
  test (`pipeline-board.test.tsx`): a successful dropdown move calls
  `POST /deals/:id/stage` and the card ends up in the target column; a
  failed move rolls back to the original column — both proven against a
  small stateful fake backend so the same assertions hold whether read
  immediately (optimistic) or after the settle-time invalidation's
  refetch resolves. Opening the dropdown in the test needed keyboard
  activation (focus + Enter) rather than a plain `fireEvent.click` —
  found empirically that Radix's menu trigger opens on `pointerdown` in a
  real browser, which jsdom doesn't simulate from a plain click; keyboard
  activation is a genuine alternative every Radix trigger supports, not a
  workaround that tests something different. **Stated plainly, not
  glossed over: the actual pointer/touch drag gesture itself was not, and
  could not be, interactively verified** — this environment has no
  browser-automation tool (true of every UI feature built in this project
  so far), and the user's own `pnpm dev` session, already running on
  ports 3000/4000, was correctly left untouched rather than started a
  second time to poke at manually. The implementation follows
  `@dnd-kit/core`'s own documented usage exactly, typechecks, lints
  clean, and builds — but "clean and reliable" drag specifically needs
  the user to confirm it in a real browser, per the brief's own time-box
  clause; this was not treated as license to silently skip building it.
  `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all pass clean
  (279 `apps/api`, unchanged; 65 `apps/web`: 63 carried over + 2 new; 344
  total). One commit. Nothing pushed. `docs/decisions.md` D49 has the
  full detail. Package 3.5 (the convert dialog and related tabs) is next,
  in the same session.
- **2026-11-20 (same session, continued) — package 3.5, Convert dialog
  and related tabs, closing out Day 3.** Backend first: `companyName`
  added to `convertLeadSchema` (read only when creating a new company,
  overriding the lead's own `companyName`) and wired into
  `lead-conversion.service.ts` so a lead with no company name can still
  convert via the dialog's typed-in name, instead of dead-ending in the
  existing 422; a `conversion` summary (`{companyId, contactId, dealId} |
  null`) added to `leadResponseSchema`, populated only by `GET
  /leads/:id`'s `getLead` (one extra, cheap `leadConversion.findUnique` —
  `null` for a non-converted lead). Found and fixed a real bug while
  wiring the latter in: `listLeads`'s `rows.map(toLeadResponse)` had been
  passing `Array.map`'s `(value, index, array)` signature straight into
  `toLeadResponse`'s new second parameter, silently handing the row's
  numeric index to `conversion` — caught immediately by `pnpm typecheck`
  (a real type error), fixed with an explicit arrow wrapper.
  `LeadDetailPageClient`'s Convert action is now a real `ConvertLeadDialog`
  trigger only when `status === 'QUALIFIED'` and not archived, a plain
  disabled button (title "Qualify the lead first") for every other open
  status, and hidden entirely once archived or `CONVERTED` — matching the
  service's own real constraints, not an independent frontend guess. A new
  "Converted" panel (links to company/contact/deal + the conversion date)
  replaces "Change status" at the top of the Overview tab once converted;
  the History tab is untouched. Built `ConvertLeadDialog`: three
  Link/Create `ModeToggle` sections (Company, Contact, Deal — a two-button
  toggle, not a Radix `RadioGroup`, no new primitive needed), defaults
  derived once per dialog-open from `GET /leads/:id/conversion-matches`.
  **Found a genuine race condition via this package's own test, not by
  inspection**: the first draft set defaults in a `useEffect` keyed on the
  matches response arriving — since that's a real network round trip, a
  user who started typing before it resolved had their input silently
  overwritten the instant the (by-then-stale) "no match" default applied.
  Fixed by keeping the three sections entirely unrendered while the
  matches lookup is in flight, so there is no field to type into before
  the one-time initialisation has already committed; separately moved
  that initialisation off `useEffect` entirely onto React's own "adjust
  state during render" pattern (`CompanySelect`/`ContactSelect`'s existing
  convention, D37), since the effect's several direct `setState` calls
  had tripped this repo's `react-hooks/set-state-in-effect` lint rule
  (not the cause of the race — the loading-gate fixed that — just a
  separate, genuine lint violation found at the same time).  No-double-
  submit via a `pending` guard checked first in `handleSubmit`, proven by
  a test firing two synchronous clicks. Built `DealsTab` (shared by
  Company's and Contact's detail pages, via `GET /deals`'s
  `companyId`/`contactId` filters — `contactId` was 3.3's own forward-
  looking addition for exactly this) and gave `DealForm` a create-mode-only
  `defaultCompanyId`, read from `CreateDealPageClient`'s new `?companyId=`
  query param (which needed a real `<Suspense>` boundary added to
  `deals/new/page.tsx`, D26's rule, since the page didn't read
  `useSearchParams()` before this).
  
  **A real environment incident happened mid-verification, unrelated to
  any code change**: a background `apps/api` test run was re-launched
  without first confirming an earlier one had actually exited, stacking
  two full ~50-worker test suites against the same `crm_test` database at
  once; combined with Docker Desktop already being mid-restart on this
  machine, the Docker engine itself got wedged badly enough that even
  `docker ps` returned a blanket 500 from Docker's own API, and a plain
  Docker Desktop restart didn't clear it. Stopped and asked the user
  rather than guessing or touching any process/container; the user
  resolved it with a full machine reboot, after which `docker ps` and the
  Postgres container were immediately healthy again and verification
  completed cleanly on the first clean run. No workaround was applied to
  the code or environment — the fix was entirely "wait for a healthy
  Docker, then re-run." Full account in `docs/decisions.md` D50's closing
  note and a new gotcha in §10.
  
  `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all pass clean
  (282 `apps/api`: 279 carried over + 3 new; 74 `apps/web`: 65 carried
  over + 9 new; 356 total). One commit. Nothing pushed.
  `docs/decisions.md` D50 has the full detail. **Day 3 (lead conversion,
  deals, pipeline) is done.** Day 4 is not yet detailed in this repo —
  confirm scope with the user before starting it.
- **2026-11-21 - Package 4.0 complete.** Optional lead source with
  organisation-scoped Manual fallback, shared decimal-string numeric input,
  and SQL/API reconciliation documented in `docs/reconciliation.md`. No schema
  migration or dependency. Verification: `pnpm typecheck`, `pnpm lint`,
  `pnpm test` (283 API + 75 web = 358 tests), and `pnpm build` all passed.
  One transient initial test expectation was corrected before the final green
  verification. The initial sandboxed build could not fetch existing Google
  Fonts; the elevated rerun passed. API process stopped by its recorded PID;
  ports 3000 and 4000 clear. Package 4.0 was committed locally, not pushed.
- **2026-11-21 — Package 4.1 complete.** Built activity CRUD/actions,
  organisation-scoped link validation, deal-to-company timeline propagation,
  merged timelines and computed next activity. Added UTC day/month bounds.
  No schema migration, index migration, permission change or dependency.
  Focused tests: 11 passing. Full root verification: 288 API + 75 web tests
  (363 total), typecheck/lint/build passed. Package 4.1 was committed locally,
  not pushed; package 4.2 remains.
- **2026-11-21 — Package 4.2 complete.** Added Today and dashboard APIs,
  independent SQL reconciliation tests for all metrics/charts and scope cases,
  and the idempotent production-guarded sample seed. Verified sample counts
  remained 3 companies, 3 contacts, 5 leads, 3 deals and 12 activities after
  two runs, including 3 overdue tasks; production refusal also verified.
  No schema migration, dependency or permission change. Root gates passed:
  290 API + 75 web tests (365 total), typecheck, lint and build. Day 4 UI is
  deferred to a later prompt as instructed. Package 4.2 was committed locally,
  not pushed.
- **2026-11-21 — Package 4.2b complete.** Closed the Day 4 backend gaps with
  lead/deal detail nextActivity summaries, due-range and overdue activity
  filters, local-month chart boundary correction, expanded endpoint/timeline/
  SQL/access tests, and Today-complete sample seed data. Final root
  verification: 294 API + 75 web tests (369 total), typecheck, lint and build
  passed. No schema, permission or dependency changes. Package committed
  locally, not pushed; Day 4 UI remains deferred.
- **2026-11-21 — Package 4.3 complete.** Added the shared activity composer,
  paginated merged Timeline tabs on Lead/Contact/Company/Deal, next-activity
  display on Lead/Deal, and completion actor/time sourced from existing audit
  rows. Added one API test and four web tests. Verification passed sequentially:
  `pnpm typecheck`, `pnpm lint` (three existing warnings),
  `pnpm --filter api test` (55 files, 295 tests),
  `pnpm --filter web test` (17 files, 79 tests), and `pnpm build`. No schema,
  migration, permission change or dependency added. No browser was started;
  browser-only checks remain unverified. Package 4.3 was committed locally,
  not pushed; package 4.4 is next.
- **2026-11-23 — Package 4C (hosted staging) built end-to-end, and the
  database steps confirmed working against the real Supabase project.**
  Full detail in `docs/decisions.md` D58–D67 and `docs/STAGING.md`.
  Summary: Part 0 added `.claude/settings.json` deny rules plus a
  `.gitignore` fix so this tool can never read, create, edit or delete
  `apps/api/.env.staging.local` or any other real env file (exact paths,
  not globs, so `.example` files stay editable) — a guardrail, explicitly
  not a guarantee (command-pattern Bash/PowerShell denies can be bypassed
  by quoting, aliases, or other tools; documented as such, not oversold).
  Part A found, by testing against a local non-superuser stand-in role
  (not the real `sales_app`, never reachable from here), that
  `@prisma/adapter-pg`'s own `schema` constructor option — not Prisma's
  `multiSchema` feature, not the connection string's `?schema=` param,
  which only steers `migrate` — is what makes the Client actually target
  the `sales` schema, with zero `schema.prisma` changes (D58); also added
  `DATABASE_POOL_MAX`/`DATABASE_SSL_CA`/`DATABASE_SSL_REJECT_UNAUTHORIZED`
  (D61). Part B added two new startup guards — `DATABASE_URL`'s `?schema=`
  must agree with `DATABASE_SCHEMA` (D59), local dev/test refuse a
  non-localhost `DATABASE_URL` (D59) — and closed D21/D23's "revisit at
  deployment" note now that the Render/Next.js topology is known:
  `TRUST_PROXY` stays `false` there too (D60). Part C built the three
  staging scripts and split `seed-lib.ts` so staging cannot get the local
  demo accounts even by accident (D62) — this tool never ran any of them
  itself, only their extracted pure logic, against a fake file or the
  local database. Two bugs were found by the user actually running the
  scripts and fixed the same session: `staging:migrate` failed on Windows
  with `ENOENT` (`pnpm` resolves to a `.cmd` shim Node 22 refuses to spawn
  without a shell — fixed by running Prisma's own CLI entry file via
  `process.execPath` directly, D63), and `staging:seed-sample` refused
  with "refuses to run in production" because `NODE_ENV=production` is
  what staging legitimately sets (fixed with a new `APP_ENV` env var that
  has no default, on purpose, D64). **After those fixes, the user
  confirmed `pnpm staging:migrate` and `pnpm staging:create-admin` both
  succeeded against the real Supabase project** (D65) — the first
  real-world validation of the schema-targeting mechanism. That also
  answered a standing TLS question: certificate verification is on, via a
  `pg-connection-string` version-specific aliasing of `sslmode=require` to
  `verify-full` that is scheduled to change in a future major version; a
  one-line `sslmode=verify-full` edit to the user's own connection string
  was proposed as the future-proof fix (D66). Part D added `render.yaml`
  (two services, `region: singapore`, every env var `sync: false`) and
  `docs/STAGING.md` (D67). Final state: typecheck/lint/build clean across
  the whole repo; `apps/api` test count progressed 324 → 332 → 333 → 347
  across this session's commits as each piece landed. Eight commits this
  session, nothing pushed. Remaining for next time: `APP_ENV=staging`
  needs adding to the user's own `.env.staging.local` before
  `pnpm staging:seed-sample` can run; deploying the two Render services
  from the Blueprint; clicking through the deployed app.
- **2026-11-24 — Day 5a (website intake, API keys, Enquiries inbox) started,
  then paused mid-build at the user's own checkpoint request.** Plan
  approved first (auto-create a Lead on intake; Enquiries visible to both
  roles same as Leads; document API keys as intake-only rather than add an
  unused `scope` column; keep the shared 100KB body limit rather than a
  separate 64KB one for intake). Built so far: migration
  `20261123194049_add_submission_spam_and_archive` (`website_submissions`
  gains `archived_at` and a `SPAM` status; applied to `crm_dev` only),
  `apps/api/prisma/SCHEMA-SUMMARY.md` updated to match, `scoped()` and the
  three duplicate finders (`apps/api/src/lib/scoped.ts`,
  `apps/api/src/lib/duplicates.ts`) widened to take `{ orgId }` instead of a
  full `RequestContext` (backward compatible — no existing call site
  changed), and two new, not-yet-exported shared schema files
  (`packages/shared/src/api-keys.ts`, `packages/shared/src/intake.ts`).
  Mid-build, the user sent eight binding refinements to the approved plan
  (honeypot responses must be indistinguishable from success; API keys need
  a constant-time hash comparison; the Origin-check exemption must depend
  on a *verified* key, not just the URL path, and needs a test proving a
  cookie-without-a-key is still rejected; the per-IP rate limit must be
  honestly documented as weak on Render given `TRUST_PROXY=false`, D60,
  which is not being changed; no key/idempotency-value/personal data may
  reach the logs, and audit rows may hold only a submission id and key
  prefix; a repeated Idempotency-Key must win over body validation, which
  changes how the route has to validate its input; spam/rejected rows are
  kept forever for now, a retention policy is explicitly deferred as a
  note, not built; nothing is run against staging by this tool, the exact
  migration name for the user's own `pnpm staging:migrate` is recorded).
  All eight are fully designed, with the reasoning, in `docs/decisions.md`
  D71 — none of the actual intake endpoint, API-key management, or
  Enquiries screens exist in code yet. Checkpoint actions: full check suite
  run (`pnpm typecheck`/`pnpm lint` clean; `pnpm test` — `apps/web` 91/91,
  `apps/api` 358/359, the one failure being the pre-existing
  `website-submissions.test.ts` schema test against `crm_test`, which
  doesn't have today's migration yet and which this tool does not apply
  itself without being asked); `docs/DAY-5A-SUMMARY.md`,
  `docs/MANUAL-TEST-DAY5A.md` (placeholder — nothing user-facing exists
  yet), and `docs/DAY-5A-HANDOVER-PROMPT.md` (the ready-to-paste prompt for
  the session that resumes this) written. Nothing committed or pushed.
- **2026-11-24 (continuation) — Day 5a resumed and completed.** The user
  confirmed Docker was running and `pnpm db:verify-fresh` had succeeded
  against `crm_test`, but that script itself failed first on Windows with
  `spawnSync pnpm ENOENT` — the same `.cmd`-shim bug D63 had already fixed
  for `staging-migrate.ts` but explicitly left unfixed in `db-verify-fresh.ts`/
  `db-reset.ts`. Fixed first, at the user's own request, using the same
  already-tested `runPrismaCli()` helper (no new test needed — the only
  change is which already-tested helper does the spawning). Confirmed via
  `pnpm test` that the one previously-failing schema test now passes (apps/api
  359/359 at that point). Then built the rest of `docs/DAY-5A-HANDOVER-PROMPT.md`'s
  plan (items 2–13) in order, without stopping for approval between
  packages, reporting only at four checkpoints as instructed: `packages/shared/
  src/enquiries.ts` and the three missing `index.ts` export blocks (checkpoint
  after item 1); API-key crypto, the `attachApiKeyContext` middleware, the
  `csrf.ts` Origin exemption, `route-registry.ts`'s new `'apiKey'` auth type,
  two intake rate limiters, a log-redact entry, the API Keys module, and the
  full intake module (checkpoint after item 9 — 402 `apps/api` tests);
  the Enquiries module and a full re-read of `app.ts`'s wiring (checkpoint
  after item 11 — 409 `apps/api` tests); the Admin-only API Keys screen and
  the both-roles Enquiries screen (checkpoint after item 13). Two deviations
  flagged to the user rather than silently decided: a replayed-`REJECTED`
  submission re-throws its original error (read as "idempotency wins"
  applying to every outcome, not only a success), and the Enquiries list
  endpoint got a `sort` param the plan's text didn't name explicitly (kept,
  per the user's reply). Finished with docs: `docs/decisions.md` D72
  (backend) and D73 (frontend), this file (§1, §7, §9, §11, §13, here),
  `docs/NEXT-SESSION-START.md`, `docs/DAY-5A-SUMMARY.md` (rewritten from its
  mid-build placeholder into a real finished-day summary), `docs/
  MANUAL-TEST-DAY5A.md` (filled in with real, runnable steps — still
  unchecked, since nothing was verified in an actual browser), `docs/
  intake-contract.md` (new), and `apps/api/scripts/replay-intake.sh` (new,
  syntax-checked, not run live against a real key — avoided creating
  persistent demo data in the shared local `crm_dev` database without
  asking first). Final state: `pnpm typecheck`/`pnpm lint` clean across the
  whole repo throughout; **`pnpm test` — apps/api 409/409, apps/web 91/91,
  500 total.** Two dev servers were started for a manual smoke check (both
  new screens return 200 through the proxy, both new API routes correctly
  401 unauthenticated through the proxy) and then shut down cleanly by exact
  PID, with ports 3000/4000 confirmed clear afterward — no browser-
  automation tool exists in this environment, so neither screen has
  actually been clicked through. Nothing committed or pushed.
- **2026-11-24 (further same-day follow-up) — a user-requested audit closed
  two real test-coverage gaps.** The user asked for a short, plain,
  per-refinement accounting of D71's eight binding items: DONE-and-proven
  (naming the exact test), or documented-only. That answer, built by
  actually grepping the test files rather than from memory, found two
  genuine gaps: `lib/api-key.ts`'s hash/constant-time-compare functions had
  no dedicated unit test (only end-to-end proof via the real middleware),
  and nothing read back a real `auditEvent` row to confirm D71's
  logging/audit-minimisation promise (nor was the new `Idempotency-Key`
  log-redact path tested). The user then asked for small tests closing
  both, plus a real test for the per-IP rate limiter (previously untested
  at all — only the per-key limiter had one, via 61 cheap real requests).
  Closed with: new `tests/lib/api-key.test.ts` (11 tests — key
  generation/prefix/length/uniqueness, hash determinism and format,
  `verifyApiKeyHash` true/false/mismatched-length-without-throwing); new
  `tests/intake/audit.test.ts` (3 tests — reads back the real `auditEvent`
  row after a success, a honeypot hit, and a rejection, asserting
  `actorId: null`, `metadata` deep-equals exactly `{ submissionId,
  apiKeyPrefix }`, and that the raw key/Idempotency-Key value/submitted
  name/email/phone/message appear nowhere in the row); `logger.ts` gained a
  named export `LOG_REDACT_PATHS` (the single source of truth for the real
  `pino()` config) and new `tests/logger.test.ts` (3 tests — asserts the
  path list names both headers, then proves a `pino` instance built from
  that exact config actually censors them in a parsed log line while an
  unrelated field passes through); `lib/rate-limit.ts`'s per-IP limiter
  refactored from a fixed singleton into `createIntakeIpRateLimiter(ceiling,
  windowMs?)` (the same ceiling-parameterised-factory pattern this file's
  own `createGlobalLoginFloodLimiter` already used for the login flood
  limiter), with a new test in `tests/intake/auth-and-rate-limit.test.ts`
  proving the mechanism trips at a low test ceiling (3) — its own comment
  states plainly that this proves the code works as written, not what
  `req.ip` actually resolves to once deployed on Render (still reasoning
  only, per D60/D71/D72, unchanged by this test). The one remaining D71
  item (the spam/rejected retention note) stayed reasoning-only by design —
  it is a decision not to build something, with no behaviour to assert on.
  `docs/decisions.md` D74 records all of this; `docs/DAY-5A-SUMMARY.md`
  gained an explicit "What is tested vs. reasoning only" table, one row per
  refinement, naming the exact test file for each. Final state: `pnpm
  typecheck`/`pnpm lint` clean across the whole repo (same 3 pre-existing
  `apps/web` warnings, 0 errors); full repo `pnpm test` — **apps/api
  427/427 (up from 409), apps/web 91/91, 518 total, all passing.** No
  schema, migration, permission, or dependency change. Nothing committed
  or pushed; nothing run against staging.

### 2026-11-25 — Day 5c, feature 1: Quotations

- Plan approved (permissions `quotations:read`/`quotations:write`/
  `reports:read` for both roles; `pdfkit@0.20.2` + `@types/pdfkit@0.17.7`;
  bundled Noto Sans; percentage discounts; yearly numbering; new-enquiry
  notifications to every active user) plus seven follow-up requirements
  (org header details via script, safe auto-expiry, rounding rule +
  awkward-number tests, duplicate test, polling pause, record PRD
  deviations, report only at the end of Quotations).
- Built: migration `20261124181711_add_quotations`; shared
  `quotations.ts`/`money-format.ts`; API `lib/quotation-{money,number,pdf}.ts`,
  `lib/organization-details.ts`, `modules/quotations/`; scripts
  `org:set-details` / `staging:set-org-details`; fonts in
  `apps/api/assets/fonts/` (NotoSans-Regular.ttf sha256 478c558ea716033cd60c03438f628dfa75694dcf6b5f6d505a2f05fd2b4f3823,
  NotoSans-Bold.ttf 1df075a380fc7cb898acf64c1f7b3b4dd780de3caa860178bf929de35817a913, OFL.txt cee9892f9f0cc8fe882c9e9537ee6a89621d86ee7ceaf70b02e2b2b1c25c061a); web hooks,
  presentation, form, list, detail, create/edit, `QuotationsTab` on Deal and
  Company pages, sidebar item. Decisions D83–D87.
- This tool's attempt to apply the migration to `crm_test` was blocked by
  the permission system; the user ran `pnpm db:verify-fresh`. Not applied to
  `crm_dev` or staging. No write to `crm_dev`; nothing run against staging.
- Found and fixed by running the tests: a pg@9-incompatible relation reload
  inside transactions (D83). Found while smoke-testing: the user's running dev
  server missed the new nested edit route until touched (watcher, not code).
- Verified: `pnpm typecheck` clean; `pnpm lint` 0 errors (same 3 older
  warnings); `pnpm test` **apps/api 539/539, apps/web 109/109 (648)**; web
  production build lists all quotation routes; sample PDFs rendered and
  inspected; read-only smoke requests against the user's own running dev
  servers (PIDs 19804/14724, left running, not touched). Not clicked through
  in a browser. Nothing committed or pushed.

### 2026-11-25 (later) — D88 rule added; Notifications started, stopped cleanly

- D88: a Draft whose valid-until date has passed can no longer be marked
  Sent (409 `VALID_UNTIL_PASSED`, "Valid-until date has passed, change it
  first."), tested; `MANUAL-TEST-DAY5C.md` §5 rewritten to match.
- Notifications (D89): migration `20261124191130_add_notifications`
  (complete, applied nowhere) and `packages/shared/src/notifications.ts`
  written; no service/routes/UI/tests yet. Stopped at the user's request
  (usage limit).
- Verified: `pnpm typecheck` clean; `pnpm lint` 0 errors (3 older
  warnings); `pnpm test` **apps/api 540/540, apps/web 109/109 (649)**.
  Nothing committed or pushed; nothing run against staging or `crm_dev`.
  Resume with `docs/DAY-5C-HANDOVER-PROMPT.md`.

### 2026-11-25 (evening) — Day 5c, feature 2: Notifications finished (D90)

- The user started Docker and ran `pnpm db:verify-fresh` and `pnpm
  db:migrate` themselves (both Day 5c migrations now on `crm_test` and
  `crm_dev`; not staging). Rule confirmed for this phase: the user commits
  and pushes; this tool does neither.
- Added `'notifications'` to `tests/helpers/reset-database.ts`; full API
  suite re-run first: 540/540 baseline held.
- Built: `apps/api/src/modules/notifications/` (service + routes, registered
  in `app.ts`); after-commit triggers in `leads.service.ts`,
  `deals.service.ts`, `lead-conversion.service.ts`, `intake.service.ts`,
  `quotations.service.ts`; web `hooks/use-notifications.ts`,
  `components/notifications/{notification-bell,notifications-page-client}.tsx`,
  `app/(protected)/notifications/page.tsx`, bell + page title in
  `app-shell.tsx`. Tests: 4 API files (32), 2 web files (12).
- Test fixtures first failed on the `activities_has_link` and
  `activities_done_has_completed_at` CHECKs and on quotation totals being
  required (fixtures fixed; no code change). The polling-pause test was
  shown to fail with background polling on, then restored.
- Verified: `pnpm typecheck` clean; `pnpm lint` 0 errors (3 older warnings);
  `pnpm test` **apps/api 572/572, apps/web 121/121 (693)**; `pnpm --filter
  web build` lists `/notifications`; read-only smoke against the user's
  running dev servers (web PID 6960, API PID 9784; not touched): new GETs
  answer 401 unauthenticated, `/notifications` 200. Not clicked through in
  a browser. Not committed; nothing run against staging; nothing written to
  `crm_dev`.
- Reported to the user: PRD 5.8/5.11 items not in the approved plan
  (deal-change and invitation notifications, notification preferences), and
  the Render free-tier effect of polling. Next: Reports, on "continue".

### 2026-11-25 (night) — D91 recorded; Day 5c, feature 3: Reports (D92)

- The user approved Notifications and the five PRD differences as
  deviations (D91); future items gained notification preferences and
  deal-change notifications.
- Built Reports: `PERMISSIONS.REPORTS_READ` (`reports:read`, both roles);
  shared `packages/shared/src/reports.ts`; `apps/api/src/modules/reports/`
  (service + routes, registered in `app.ts`); `workspace.service.ts` now
  exports its count helpers and `resolveReportingRange()` (Home's range
  rule, extracted, behaviour unchanged); web `hooks/use-reports.ts`,
  `components/reports/reports-page-client.tsx`,
  `app/(protected)/reports/page.tsx`, sidebar item and title; Home's range
  and All/Mine controls extracted to
  `components/dashboard/range-scope-controls.tsx` (Home now uses it too).
  README status and permission tables updated.
- Tests: API `tests/reports/{reports,reconciliation,export}.test.ts` (21) +
  `tests/helpers/reports.ts`; web `reports-page-client.test.tsx` (5). The
  reconciliation test was shown to fail on a deliberately broken query.
- Verified: `pnpm typecheck` clean; `pnpm lint` 0 errors (3 older
  warnings); `pnpm test` **apps/api 593/593, apps/web 126/126 (719)**;
  `pnpm --filter web build` lists `/reports`; read-only smoke (web PID 6960,
  API PID 23016 after `tsx watch` restarted its child on file changes):
  reports endpoints 401 unauthenticated, `/reports` 200. Not clicked through
  in a browser; not committed; nothing run against staging or written to
  `crm_dev`.
- **Day 5c is complete.** Remaining for the user: the browser pass
  (`MANUAL-TEST-DAY5C.md` §1–§9), organisation PDF details, `pnpm
  staging:migrate` (both Day 5c migrations). Then Day 6.
