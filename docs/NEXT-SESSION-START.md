# Start Here — Next Session

Read this file **first**, before touching any code. It tells you what this
project is, the rules that don't change, what to read next and in what
order, where the build actually stands, and the specific work queued up
next.

## The project, in brief

- **Sales & CRM** for Grow Spark Consulting — an internal tool for Admin
  and Staff users covering the lead-to-deal journey: leads → companies/
  contacts → deals → pipeline → activities → dashboard.
- This CRM is **one of three independent apps** being built by different
  people (stated by the user; not independently verifiable from this repo
  alone).
- The build is a **7-day plan**: Days 1–5 build, Day 6 testing, Day 7
  stabilise and demo. **Days 1 through 5a are all done** (see below). The
  rest of Day 5 (CSV export, Docker packaging, the P0 freeze) is next, but
  not yet detailed in this repo — confirm exact scope with the user before
  starting it.
- A **staging deployment was built after Day 4** — see "Staging deployment"
  below.
- Single developer, nothing reviewed by anyone else: correctness over
  speed, and every package stops for review before the next one starts.
- TypeScript strict everywhere; `packages/shared`'s Zod schemas are the
  single source of validation; controllers stay thin, services take
  `{ userId, orgId, role }`; every query is organisation-scoped; every
  route declares a permission; multi-table writes are transactional with
  the audit row inside the same transaction.

## Hard rules that don't change

- **The live Grow Spark website is off limits.** This CRM is additive and
  must never disturb the real website, its Supabase database, its SMTP
  sending, its HubSpot integration, or visitor-facing behaviour. The
  website's own repository is not touched, read, or looked for until the
  user approves an **exact file list** in advance — not a general "go
  ahead."
- **This tool never pushes to `git`.** Commit locally, every time; never
  `git push`. The project owner pushes manually, after reviewing each
  report — so `main` already matching `origin/main` at the start of a
  session just means the owner reviewed and pushed what was committed
  before. That is not permission to push from this tool.
- **One work package per prompt, and stop for review after each one.**
  Report what was built, what was verified (commands + actual output), any
  deviation, any new dependency, known gaps, and the next step — then wait.
- **Process hygiene, every time**: record the PID of anything started;
  stop it by exact PID (`taskkill /PID <pid> /T /F` on Windows, never a
  broad pattern match); prove ports 3000 and 4000 are clear before and
  after. Never kill a dev server you didn't start without asking first.
- **Exact version pinning, no `^`/`~` ranges**, anywhere in this workspace.
  Record *why* in `decisions.md` when the choice isn't obvious.
- **Ask before adding any dependency**, running a destructive command
  (`migrate reset`, `git reset --hard`, deleting a Docker volume), or doing
  anything outside the current package's stated scope.
- **The PRD is the literal source of truth** for field lists, labels, and
  screen content. Where it's silent, prefer the HubSpot-style convention
  already used for Leads/Companies/Contacts (clean list, a record page with
  a key-fields strip, tabs) and note the choice in `decisions.md`. Don't
  invent features the PRD doesn't list.
- **If the PRD, the roadmap, and the actual database schema disagree on
  anything, stop and ask** rather than choosing unilaterally — this has
  happened more than once already (D32, D38) and both times the user
  answered directly.
- **Any change to the role-permission table needs explicit approval.**
- Prisma's own CLI will refuse certain destructive commands against this
  project unless a human gives fresh, in-the-moment consent — that's
  Prisma's built-in safety check, not something to script around.

## What to read, in order

1. **`CLAUDE.md`** — the short, standing rules (stack, code rules, process
   rules). Checked into the repo, not just chat history.
2. **This file** — you're reading it.
3. **`docs/PROJECT-STATE.md`** — the full handover: status of every
   package, the repository map, the pinned stack and exact versions, every
   command you'll need, ports, environment variable *names*, the database
   setup, coding conventions, gotchas, and the session log. This is the
   detailed reference; skim its table of contents (the `##` headings) and
   come back to specific sections as needed rather than reading linearly
   every time.
4. **`docs/decisions.md`** — every approved decision, D1 through D105 (D3
   and D5 don't exist — never assigned; D83–D92 is Day 5c, D93–D95 Day 6a,
   D96–D100 Day 6b, D101–D105 Day 7), append-only, each with the
   reasoning behind it. Don't re-litigate something already decided here
   without a new entry. D46–D50 cover all of Day 3 (lead conversion, the
   Deals API, the Deals UI, the pipeline board, and the Convert dialog) —
   D46/D47 were written in a docs-only catch-up pass after the fact (the
   code was already built and committed first; see §7 of
   `docs/PROJECT-STATE.md` for why), D48–D50 as each package was built.
   D58–D67 cover package 4C (hosted staging, built after Day 4).
5. **`apps/api/prisma/SCHEMA-SUMMARY.md`** — the factual per-model
   column/index/FK/CHECK reference for the database. Read this instead of
   `schema.prisma` itself when you just need to know what a table looks
   like.

Also worth a skim before starting: **`docs/DAY-1-SUMMARY.md`**,
**`docs/DAY-2-SUMMARY.md`**, and **`docs/DAY-3-SUMMARY.md`** — plain-
language look-backs at what was built and how it was verified each day. Not
required reading like the five files above, but faster than re-deriving the
same picture from `PROJECT-STATE.md`'s session log. **If you're about to
touch anything staging-related, read `docs/STAGING.md` in full first** — it
is the walkthrough, not just a summary, and this file's own staging section
below is deliberately short.

Only after those should you start reading application code for the
specific package you're about to work on.

## Where the build actually stands

- **Day 1 (packages 1.1–1.7) is done.** Auth, sessions, permissions, the
  Users module, and the whole app shell/design system are built and
  automatically verified. `docs/MANUAL-TEST-DAY1.md` exists but this repo
  has no record of anyone having actually run it — don't assume it has or
  hasn't been; ask if it matters for what you're about to do.
- **Day 2 (packages 2.0–2.7) is done.** Companies, Contacts, and Leads
  each have a full backend (CRUD, archive/restore, duplicate detection)
  and a full UI (list with server-side search/filter/sort/paging, create/
  edit, detail with tabs, archive/restore). The user ran
  `docs/MANUAL-TEST-DAY2.md` in a real browser on **2026-11-20** and
  confirmed all five named acceptance items passed, which surfaced five
  refinements approved the same day as package 2.7 (D40–D44) —
  **package 2.7 is now built**: minimal required fields with `*` labelling
  and a collapsed "More details" section on Company; a structured,
  validated E.164 phone input (country-code select + number) on all three
  forms; new-record forms that always open blank (the Cache Components
  root cause is confirmed, not guessed — see D45); Contacts requiring an
  email or a phone, same as Leads; and the lead History tab naming the
  actor, with its email-or-phone hint now only showing while actually
  unmet. **244 `apps/api` + 53 `apps/web` = 297 automated tests pass.**
  Full detail in `docs/decisions.md` D45 and `docs/PROJECT-STATE.md` §7.
- **Day 3 is done.** All five packages (3.1–3.5) are built and committed:
  **3.1** is the lead conversion transaction — `POST /leads/:id/convert`
  links or creates a Company and Contact from a `QUALIFIED` lead, optionally
  creates a Deal in the pipeline's first open stage, all in one row-locked
  transaction; `GET /leads/:id/conversion-matches` suggests existing
  records to link instead. **3.2** is the Deals API and pipeline — full
  Deal CRUD, `POST /deals/:id/stage`, `POST /deals/:id/close` (Won/Lost
  with a required reason for Lost), `POST /deals/:id/reopen` (back to the
  pipeline's first open stage), archive/restore (allowed even on a closed
  deal — a deliberate choice), `PUT /deals/:id/contacts`, and `GET
  /pipeline/{stages,summary}`. **3.3** is the Deals list/create/edit/
  detail screens, with Close Won/Lost dialogs and a Stage history tab.
  **3.4** is the Kanban pipeline board (`@dnd-kit/core`) — a Board/List
  toggle, one column per open stage, drag-and-drop plus an always-present
  "Move to…" dropdown fallback. **3.5** is the Convert dialog (three
  Link/Create sections for Company, Contact, and Deal) plus a "Converted"
  panel on the lead page and a Deals tab on Company/Contact. **282
  `apps/api` + 74 `apps/web` = 356 automated tests pass.** Full detail in
  `docs/decisions.md` D46–D50 and `docs/PROJECT-STATE.md` §7. Note: 3.1 and
  3.2 were committed before the docs caught up to them — a gap fixed in a
  dedicated docs-only pass before 3.3 started; 3.3–3.5 were documented as
  each was built. `docs/MANUAL-TEST-DAY3.md` is written and ready for the
  user to run in a real browser — not yet run by anyone, same as every
  other manual test script in this repo (no browser-automation tool here).
- **Day 4 is done.** Backend packages 4.0–4.2b (D51–D54) built the
  Activities API, record timelines, organisation time-bounds helpers, the
  `GET /today`/`GET /dashboard` endpoints with the owner-approved metrics,
  and a fictional sample-data seed (`pnpm db:seed:sample`). UI packages
  4.3–4.5 (D55–D57) built: a shared Activity composer and merged Timeline
  tab on Lead/Contact/Company/Deal detail pages (4.3); `/tasks` (My Tasks —
  Open/Overdue/Done tabs, type/priority/due-range filters) and `/today` (one
  card per Today section, a Mine/All scope toggle, Complete and "Add
  follow-up" actions) (4.4 — this package was resumed from a prior session
  that had left it half-built and uncommitted; see D56 for the full audit of
  what was kept versus rewritten); and the real dashboard on Home (nine
  StatCard KPIs, four Recharts bar charts each with a screen-reader-only
  data-table alternative, a recent-activity list, date-range and scope
  controls) (4.5). **296 `apps/api` + 91 `apps/web` = 387 automated tests
  pass.** `docs/MANUAL-TEST-DAY4.md` is written and ready for the user to
  run in a real browser — not yet run by anyone; see
  `docs/DAY-4-SUMMARY.md` for a plain-language look back at the whole day,
  including exactly what has and hasn't been verified.

- **Day 5a (website intake, API keys, Enquiries inbox) is done — built and
  verified 2026-11-24, resumed and completed from a same-day mid-build
  checkpoint.** API keys (generation, SHA-256 hashing, timing-safe
  verification, an Admin-only management screen at `/settings/api-keys`
  with create/revoke/rotate, the raw key shown exactly once); the website
  intake endpoint (`POST /api/v1/intake/website-enquiries` — idempotent,
  honeypot-aware, a lenient best-effort field mapper, duplicate-lead
  warnings); and the Enquiries inbox (`/enquiries`, visible to both roles —
  list/detail/mark-spam/archive/restore). Full design reasoning in
  `docs/decisions.md` D71 (the plan), D72/D73 (the build, including two
  flagged judgment calls), and D74 (a user-requested audit that closed two
  real test-coverage gaps — the key-hash/compare mechanism and audit/log-
  redaction content had no dedicated test — plus added a per-IP rate-limit
  test). `docs/DAY-5A-SUMMARY.md` is now a real finished-day summary (same
  style as Days 1–4, not the mid-build placeholder it used to be), with an
  explicit tested-vs-reasoning-only table for all eight of D71's
  refinements. `pnpm typecheck`/`pnpm lint` clean; **`pnpm test` — apps/api
  427/427, apps/web 91/91, 518 total.** Nothing pushed; nothing run against
  staging. `docs/MANUAL-TEST-DAY5A.md` is filled in
  with real, runnable steps but **unchecked** — this environment has no
  browser-automation tool, so neither new screen has actually been clicked
  through yet; that, plus `apps/api/scripts/replay-intake.sh`'s curl-based
  demonstration, is the user's to run.

- **Day 5b (CSV export, a Docker "full" profile, README rewrite, an RBAC
  sweep, a P0 freeze list) is done — built and verified 2026-11-24.** CSV
  export: Leads, Companies, Contacts, Deals (not Enquiries — confirmed with
  the user), formula-injection-safe, gated on the (previously unused)
  `reports:export` permission. Docker: `docker compose --profile full up
  --build -d` runs the whole stack on its own ports (**web 3100, api
  4100** — deliberately not 3000/4000) against its own database
  (**crm_docker**, never `crm_dev`), auto-seeded with fixed demo
  credentials every container start. **Read `docs/decisions.md` D76–D80
  before touching anything Docker-related** — building this surfaced five
  real problems, including two serious incidents (a verification step
  briefly overwrote the real local Admin/Staff passwords in `crm_dev`,
  caught and reported immediately, fixed by giving Docker its own
  database; a `.dockerignore` mistake let real `.env`/staging credentials
  get baked into a built image, fixed, the leaked images and build cache
  were deleted from this machine, and a permanent guard —
  `pnpm docker:check-env-leak` — now exists). RBAC sweep: every route and
  screen checked against the PRD/roadmap; no permission-table change made;
  one real gap found and reported (no frontend page for the audit log,
  despite the backend being fully built and Admin-only) — **the user asked
  for it to be built immediately, and it was, same session (D81)**:
  `/settings/audit-log`, Admin-only, filters for actor/action/entity type/
  date range, and a server-side **allowlist**
  (`sanitizeAuditMetadata`, `apps/api/src/lib/audit-metadata.ts`) so the
  free-form `metadata` JSON column — written by many different call sites
  — can never leak something sensitive into this screen just because a
  future call site adds an unsafe field; proven with a test that inserts
  a row with deliberately dangerous key names and confirms none reach the
  JSON response. README rewritten for a cold reviewer. **apps/api 478/478,
  apps/web 101/101 — 579 total, all passing.** Full plain-language account
  in `docs/DAY-5B-SUMMARY.md`; the audit page build specifically is D81.
  Nothing committed or pushed (explicit instruction this session); nothing
  run against staging.

- **Same session, D82 — two more bugs found in manual testing, both
  fixed.** Every CSV export's first column was the bare text "ID" — Excel
  on Windows misdetects that as an old SYLK file and refuses to open it
  ("Excel has detected that the file is a SYLK file..."); fixed (renamed
  to "Lead ID"/"Company ID"/"Contact ID"/"Deal ID", a structural guard
  added to `rowsToCsv` so this specific mistake can't recur unnoticed, plus
  a UTF-8 BOM on every export). Separately, `pnpm docker:check-env-leak`
  failed on Windows cmd/PowerShell (it needed a POSIX `sh`, which Windows
  doesn't have by default) — rewritten as plain Node
  (`scripts/check-dockerignore.mjs`, no shell anywhere), proven to still
  catch the original `.dockerignore` bug exactly the way the `.sh` version
  did. **apps/api 483/483 (up from 478), apps/web 101/101 (unchanged) —
  584 total, all passing.**

- **Day 5c (three missing PRD features, one at a time) is in progress —
  feature 1, Quotations, is done (2026-11-25).** Migration
  `20261124181711_add_quotations`; exact-decimal money rule (half-up, 2 dp,
  D85); yearly `Q-YYYY-NNNN` numbers; Draft → Sent → Accepted/Rejected with
  audited auto-expiry on read (D86); edit/duplicate/archive; an on-demand
  pdfkit PDF with bundled Noto Sans (D84); list/detail/form screens,
  Quotations tabs on Deal and Company, and an optional "mark the deal Won?"
  after Accept. New permissions `quotations:read`/`quotations:write`; new
  dependency `pdfkit@0.20.2`. **apps/api 539/539, apps/web 109/109 (648).**
  Applied to `crm_test` by the user; **not yet applied to `crm_dev`
  (`pnpm db:migrate`) or staging (`pnpm staging:migrate`)**. Organisation
  PDF header details are filled by `pnpm org:set-details` /
  `pnpm staging:set-org-details` (the user's to run). Approved PRD
  deviations and future items (GST split, product catalogue): D87. See
  `docs/DAY-5C-SUMMARY.md` and `docs/MANUAL-TEST-DAY5C.md`. Nothing
  committed or pushed. Later the same day: D88 (a Draft past its
  valid-until date cannot be marked Sent, tested) — counts now **apps/api
  540/540, apps/web 109/109 (649)**.
- **Day 5c feature 2, Notifications, is done (D90, 2026-11-25).** Bell with
  unread count in the header (polls every 60 s, paused while the tab is
  hidden), `/notifications` page, mark one / all read; events for lead/deal
  assignment, new website enquiry, quotation accepted/rejected, and task
  due today/overdue (generated on app load). Both Day 5c migrations are on
  `crm_test` and `crm_dev` (run by the user); **not yet on staging**.
  **apps/api 572/572, apps/web 121/121 (693).** Not clicked through in a
  browser (`docs/MANUAL-TEST-DAY5C.md` §8). PRD 5.8/5.11 gaps (deal-change
  and invitation notifications, preferences) are approved deviations (D91).
  For this phase the user commits and pushes; this tool does neither.
- **Day 5c feature 3, Reports, is done (D92, 2026-11-25) — Day 5c is
  complete.** `/reports` (permission `reports:read`, both roles): pipeline
  by stage, lead sources and conversion, sales by owner, quotations summary
  (effective status), overdue tasks by assignee; Home's date range and
  All/Mine controls; a CSV per report (`reports:export`); a reconciliation
  test proving Reports agree with `GET /dashboard`. **apps/api 593/593,
  apps/web 126/126 (719).** Not clicked through in a browser
  (`MANUAL-TEST-DAY5C.md` §9). PRD 5.10 gaps reported in D92, not built.

- **Day 6a (Settings, global search, CSV import — the last three PRD core
  features) is complete (2026-11-25): Settings (D93), Global search (D94),
  CSV import of leads and contacts (D95).** `/settings` hub, organisation
  profile, lead sources, pipeline stages, My profile with change password;
  a top-bar search (Ctrl+K) across all five record types; `/leads/import`
  and `/contacts/import` with column mapping, row-by-row preview, duplicate
  skip and an errors file. No migration. **apps/api 644/644, apps/web
  147/147 (791).** Manual steps: `docs/MANUAL-TEST-DAY6A.md`. Resume prompt:
  `docs/DAY-6A-HANDOVER-PROMPT.md`.

- **Day 6b (four user-requested refinements) is complete (2026-11-25),
  D96–D100.** D96: bulk operations (PRD 5.3), calendar view (5.6) and
  enquiry read/unread (5.8) are approved deviations. D97: company/contact
  pickers list the first 20 A–Z as soon as they are opened; list-page company
  filters reach every company. D98: leads and contacts need first name +
  company + email or phone (forms, API, CSV import; website enquiries
  exempt; companies need only a name); source optional everywhere. D99: one
  phone input everywhere with a per-country digit table (India exactly 10,
  not starting with 0, landlines allowed), typing limited, pastes cleaned up.
  D100: My Tasks defaults to the signed-in user's tasks with an "Assigned to"
  dropdown. Two pre-existing bugs fixed on the way (sourceless new lead could
  not be saved; picker blanked after a pick). No migration, dependency or
  permission change. **apps/api 658/658, apps/web 183/183 (841).** Manual
  steps: `docs/MANUAL-TEST-DAY6B.md` (D98 also updated
  `MANUAL-TEST-DAY6A.md` §5). Resume prompt: `docs/DAY-6B-HANDOVER-PROMPT.md`.

- **Day 7 (three changes from the manager's review) is complete (2026-11-27),
  D101–D105.** D101–D103: quotation GST rate per line (any 0–100) plus a Tax
  inclusive/exclusive switch per quotation, the quotation-wide discount and GST
  removed, one shared BigInt money function (`packages/shared`) for the API and
  the form preview; migration `20261127100000_quotation_per_line_gst` (applied
  to `crm_test` only). D104: "Enquiries" renamed **Form submissions** (UI text
  and web route; `/enquiries` redirects; DB/API/permission keys unchanged).
  D105: shared `StatusButtonGroup` gives every status-change button group a
  spinner, a locked group while saving, a selected current status and a
  "Status changed to …" toast. **apps/api 671/671, apps/web 207/207
  (878).** Manual steps: `docs/MANUAL-TEST-DAY7.md`. The user still has to
  run `pnpm db:migrate` (crm_dev) and, before pushing, `pnpm staging:migrate`.

## The next work, in order

Day 7 (above) is finished and not yet committed. Before anything else the user
runs `pnpm db:migrate`, the browser pass of `docs/MANUAL-TEST-DAY7.md`, then
`pnpm staging:migrate` together with the deploy.

Day 6b is finished. Next, in order: (0) the user reviews and commits Day 6b
and decides the open items in `docs/PROJECT-STATE.md` §13 (the Day 6a
approved-deviation candidates, and D97's "company names for deals beyond the
first 100 companies"); then the browser passes of
`docs/MANUAL-TEST-DAY6B.md` §1–§4 and `docs/MANUAL-TEST-DAY6A.md` §1–§5; (1) the user's browser pass of
`docs/MANUAL-TEST-DAY5C.md` §1–§9 and any fixes it surfaces; (2) the user's
organisation PDF details and `pnpm staging:migrate` (both Day 5c
migrations); (3) Day 6 (testing, stabilisation) — confirm its scope with the
user first. Context for any Day 5c follow-up: `docs/DAY-5C-HANDOVER-PROMPT.md`.

## Staging deployment (package 4C — deployed on Vercel, Render and Supabase)

Built on 2026-11-23, after Day 4. Full detail in `docs/decisions.md`
D58–D67 and the complete walkthrough in `docs/STAGING.md` — read that file
before touching staging, not this summary.

- API on **Render** (one manual Web Service, not a Blueprint — D69), web
  app on **Vercel**, database on **Supabase**, in a separate `sales` schema
  with its own `sales_app` role — genuinely isolated from the live Grow
  Spark website's data, not just a different table prefix.
  The schema-targeting mechanism is `@prisma/adapter-pg`'s own `schema`
  option (D58), not Prisma's `multiSchema` and not the connection string's
  `?schema=` param alone (that only steers `migrate`).
- `pnpm staging:migrate` and `pnpm staging:create-admin` **have been run
  for real by the user and succeeded** against the actual Supabase
  project (D65) — the organisation and first Admin exist there now. This
  tool has never touched the real `apps/api/.env.staging.local` and never
  will without being told to (git-ignored, and deny-listed from this
  tool's own Read/Edit/Write in `.claude/settings.json`).
- `pnpm staging:seed-sample -- --confirm` (optional fictional demo data)
  has **not** been run yet — it needs `APP_ENV=staging` added to the
  user's own `.env.staging.local` first (D64; the file may predate that
  line).
- **Staging is deployed**: the API on Render, the web app on Vercel and
  the database on Supabase. The walkthrough for both services is in
  `docs/STAGING.md`'s "Render: API" and "Vercel: web" sections (note
  `render.yaml` is documentation only, not an applied Blueprint, D69).
- TLS against the real Supabase pooler is confirmed on, via a
  version-specific `pg-connection-string` behaviour that's scheduled to
  change later (D66) — a one-line `sslmode=verify-full` edit to the user's
  own connection string was proposed as the durable fix; not yet confirmed
  whether the user made that edit.
- **The website is connected to the CRM** (live since 25 Nov 2026). The
  website's own repository is still off limits from this repo, per the
  hard rules above.

## Open items

A fuller, individually-verified version of some of these lives in
`docs/PROJECT-STATE.md` §14 — this is the short list to act on.

- **Docker "full" profile ports are 3100 (web) / 4100 (api), not 3000/4000
  — this is deliberate, not a typo to "fix".** Running it alongside native
  `pnpm dev` is the whole point; see `docs/decisions.md` D80 for why they
  were ever the same port in the first place and what that cost.

- **No browser-automation tool exists in this environment.** Every manual
  browser check (console errors, hydration warnings, light/dark theme,
  focus order, and anything in `MANUAL-TEST-DAY1.md`/`MANUAL-TEST-DAY2.md`/
  `MANUAL-TEST-DAY3.md`/`MANUAL-TEST-DAY4.md`) needs the user to actually
  run it; don't claim to have verified any of that yourself.
- **The Day 4 dashboard's four Recharts bar charts have never been looked
  at in a real browser.** Automated tests cover their screen-reader-only
  data-table alternative (Recharts' `ResponsiveContainer` renders at zero
  width/height in jsdom — there is no `ResizeObserver` there — so the
  actual SVG bars/tooltips/axis labels are untested territory); whether
  they actually look right, in both themes, is for `MANUAL-TEST-DAY4.md`
  §4 and §6 to confirm.
- **The pipeline board's actual drag-and-drop gesture (package 3.4) has
  never been watched happen in a real browser**, for the same reason —
  only the always-present "Move to…" dropdown fallback has an automated
  test. The implementation follows `@dnd-kit/core`'s own documented usage
  exactly, but "clean and reliable" drag specifically still needs a human
  to try it at least once (`MANUAL-TEST-DAY3.md` §3.3).
- **No component tests exist yet for the Deals list/board page
  (`deals-page-client.tsx`) or the Company/Contact Deals tabs
  (`deals-tab.tsx`)** — the same deliberate "manual coverage instead"
  scope choice already made for Companies/Contacts/Leads in Day 2 (see
  below), not an oversight specific to Day 3.
- **The Users page's search value lives in component state, not the URL**
  (unlike Leads/Companies/Contacts, which all use `useListUrlState`) —
  refreshing `/users` loses any active search/filter/page. Not fixed, not
  blocking, just inconsistent with the newer pages.
- **No component tests exist yet for the Companies/Contacts/Leads list and
  detail screens** built in 2.4–2.6 (`companies-page-client.tsx`,
  `contacts-page-client.tsx`, `leads-page-client.tsx`, and the three
  detail-page clients). Deliberate Day 2 scope choice (manual coverage
  instead); add key-flow tests for these screens on Day 6, per the
  roadmap, not before unless asked. (Package 2.7 did add component tests
  for `LeadForm`, `CompanyForm`, `ContactFormDialog`, and `PhoneInput` —
  this bullet is narrower than it used to be, not resolved.)
- **The company-name duplicate hint (package 2.5) reuses the plain `?q=`
  list search**, not a dedicated endpoint like Leads has — it can miss a
  genuine duplicate that doesn't share a contiguous substring with the
  typed name. Accepted limitation, not a bug to silently fix.
- **Whether a deactivated user's already-open page redirects promptly, or
  only after a manual refresh, has never been watched happen in a real
  browser** — reasoned through from the code (`AuthGuard` + the global 401
  handler should both catch it promptly) but the user's own earlier report
  contradicted that reading, and it was never reconciled. Worth settling
  with an actual browser test if you're touching anything nearby.
- **Day 4 staging plan** — see the dedicated section above. Recorded as
  information, not a code-verifiable item.
- **The design-system `.zip` in `docs/design-system/` is intentionally
  untracked.** Its contents were extracted and *those* files are what's
  committed and used; the zip itself is redundant. No action needed unless
  the user asks for it to be removed from disk too.
