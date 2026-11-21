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
  stabilise and demo. **Days 1, 2, and 3 are all done** (see below). **Day
  4** (activities, timelines, Today workspace, dashboard) is next, but not
  yet detailed in this repo — confirm exact scope with the user before
  starting it.
- A **staging deployment is planned for around Day 4** — see "Day 4" below.
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
4. **`docs/decisions.md`** — every approved decision, D1 through D50 (D3
   and D5 don't exist — never assigned), append-only, each with the
   reasoning behind it. Don't re-litigate something already decided here
   without a new entry. D46–D50 cover all of Day 3 (lead conversion, the
   Deals API, the Deals UI, the pipeline board, and the Convert dialog) —
   D46/D47 were written in a docs-only catch-up pass after the fact (the
   code was already built and committed first; see §7 of
   `docs/PROJECT-STATE.md` for why), D48–D50 as each package was built.
5. **`apps/api/prisma/SCHEMA-SUMMARY.md`** — the factual per-model
   column/index/FK/CHECK reference for the database. Read this instead of
   `schema.prisma` itself when you just need to know what a table looks
   like.

Also worth a skim before starting: **`docs/DAY-1-SUMMARY.md`**,
**`docs/DAY-2-SUMMARY.md`**, and **`docs/DAY-3-SUMMARY.md`** — plain-
language look-backs at what was built and how it was verified each day. Not
required reading like the five files above, but faster than re-deriving the
same picture from `PROJECT-STATE.md`'s session log.

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

## The next work, in order

### Day 4 — activities, timelines, Today workspace, dashboard

Backend packages 4.0–4.2 are complete as of 2026-11-21, including the
owner-approved metrics and Today rules (decisions D51–D53). See
`docs/PROJECT-STATE.md` §7 and `docs/reconciliation.md`. The Day 4 UI is
intentionally not started; wait for the user's separate prompt before
building it.

## Day 4: staging deployment (as currently planned)

Not yet started. As currently planned (per the user, 2026-11-19):

- Hosted staging around **Day 4**: the API and web app on **Render**, the
  database on **Supabase**, using a **separate `sales` schema** (not the
  website's own schema) and its **own database role** — i.e. genuinely
  isolated from the live Grow Spark website's data, not just a different
  table prefix in the same schema.
- A **create-first-admin command** will be needed for that environment,
  since the seed script refuses to run in production (by design, D15) and
  there's no admin account otherwise.
- **The website-forwarding patch is explicitly NOT approved and NOT
  applied.** Nothing in this repo should assume or build toward it without
  a fresh, explicit approval naming the exact file list, per the hard
  rules above.

## Open items

A fuller, individually-verified version of some of these lives in
`docs/PROJECT-STATE.md` §14 — this is the short list to act on.

- **No browser-automation tool exists in this environment.** Every manual
  browser check (console errors, hydration warnings, light/dark theme,
  focus order, and anything in `MANUAL-TEST-DAY1.md`/`MANUAL-TEST-DAY2.md`/
  `MANUAL-TEST-DAY3.md`) needs the user to actually run it; don't claim to
  have verified any of that yourself.
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
