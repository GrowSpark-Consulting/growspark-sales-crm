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
  stabilise and demo. **Day 1 and Day 2 are both done** (see below).
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
4. **`docs/decisions.md`** — every approved decision, D1 through D44 (D3
   and D5 don't exist — never assigned), append-only, each with the
   reasoning behind it. Don't re-litigate something already decided here
   without a new entry. **D40–D44 are approved but not yet built** — read
   them carefully, they are this session's starting work.
5. **`apps/api/prisma/SCHEMA-SUMMARY.md`** — the factual per-model
   column/index/FK/CHECK reference for the database. Read this instead of
   `schema.prisma` itself when you just need to know what a table looks
   like.

Also worth a skim before starting: **`docs/DAY-1-SUMMARY.md`** and
**`docs/DAY-2-SUMMARY.md`** — plain-language look-backs at what was built
and how it was verified each day. Not required reading like the five
files above, but faster than re-deriving the same picture from
`PROJECT-STATE.md`'s session log.

Only after those should you start reading application code for the
specific package you're about to work on.

## Where the build actually stands

- **Day 1 (packages 1.1–1.7) is done.** Auth, sessions, permissions, the
  Users module, and the whole app shell/design system are built and
  automatically verified. `docs/MANUAL-TEST-DAY1.md` exists but this repo
  has no record of anyone having actually run it — don't assume it has or
  hasn't been; ask if it matters for what you're about to do.
- **Day 2 (packages 2.0–2.6) is done.** Companies, Contacts, and Leads
  each have a full backend (CRUD, archive/restore, duplicate detection)
  and a full UI (list with server-side search/filter/sort/paging, create/
  edit, detail with tabs, archive/restore). 249 automated tests pass
  (219 `apps/api` + 30 `apps/web`). The user ran
  `docs/MANUAL-TEST-DAY2.md` in a real browser on **2026-11-20** and
  confirmed all five named acceptance items passed.
- **Five refinements were approved the same day, as package 2.7's scope,
  but nothing against them is built yet** — see immediately below.

## The next work, in order

### 1. Package 2.7 — implement D40 through D44 (`docs/decisions.md`)

Read the full D40–D44 entries before starting; this is a summary, not a
replacement for them.

- **D40 — minimal required fields.** Company needs only a name. Contact
  needs a first name plus an email or a phone. Lead needs a first name
  plus an email or a phone, plus a source (preselect a "Manual" source
  rather than forcing a choice — check whether a source actually named
  "Manual" exists in the seed data; if not, that's a question for the
  user, not something to invent). Lead priority defaults to Medium.
  Everything else becomes genuinely optional. Forms mark required fields
  with `*` and drop the `(optional)` suffix everywhere (the current
  convention is the opposite — flip it consistently across all three
  forms). Company's create/edit form additionally needs a collapsed
  "More details" section for the non-core fields.
- **D41 — structured phone input.** Country-code select (default `+91`)
  plus a plain number field, replacing the current single free-text phone
  field on Company/Contact/Lead forms. `+91` = exactly 10 digits starting
  6–9; other codes = 7–15 digits. Store as E.164 in the existing `phone`
  and normalised columns — no schema change. Duplicate matching must
  still work across formats. Display formatted, not as raw E.164.
  **Important**: this strict validation is for manual CRM entry only — if
  anything shared with a future website-intake path is touched, it must
  stay lenient and never reject an enquiry; don't let one validator serve
  both without a mode flag.
- **D42 — new-record forms must open empty.** Found during browser
  testing: a fresh create form can show a previous session's leftover
  values. Probable cause (not yet confirmed) is Next.js 16 Cache
  Components retaining client state across a navigation that looks
  unchanged. Confirm the actual mechanism before fixing it — don't paper
  over it with a workaround that doesn't address the root cause.
- **D43 — Contacts require an email or a phone.** Same rule Leads already
  enforce (D29); add it to `createContactSchema` and the contact form's
  validation, same shape as the lead form's `emailOrPhoneRefine` (2.6,
  D39).
- **D44 — two small Leads UI fixes.** Lead History rows must show who made
  each change (check first whether `LeadStatusHistory` already records an
  actor column — it should, given every other audited table here does;
  if it doesn't, that's a schema question, stop and ask). The lead form's
  "provide an email or a phone number" hint must only show while the rule
  is actually unmet, not permanently once one has been filled in.

After building, update `docs/MANUAL-TEST-DAY2.md` wherever these changes
affect its steps (required-field markers, the phone input's new shape,
the "forms open empty" behaviour, Contacts' new validation, the History
tab's actor column). Run the full verification
(`pnpm typecheck && pnpm lint && pnpm test && pnpm build`), commit, and
update `PROJECT-STATE.md`/`decisions.md` same as every other package.

### 2. Day 3 — lead conversion, deals, pipeline

Starts only after 2.7 is done, verified, and reported. Build the
**conversion transaction first** (turning a Lead into a Company/Contact/
Deal, the one genuinely multi-table write in this phase — needs a
transaction with the audit row inside it, per the standing rule), then
deals and the pipeline around it. Exact scope beyond that ordering isn't
detailed in this repo yet — confirm with the user before building ahead of
what's written here, same as every other package boundary.

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

- **Package 2.7 (D40–D44 above) is the immediate next work** — not an
  "open item" in the loose sense, a named, approved, unbuilt package.
- **No browser-automation tool exists in this environment.** Every manual
  browser check (console errors, hydration warnings, light/dark theme,
  focus order, and anything in `MANUAL-TEST-DAY1.md`/`MANUAL-TEST-DAY2.md`)
  needs the user to actually run it; don't claim to have verified any of
  that yourself.
- **The Users page's search value lives in component state, not the URL**
  (unlike Leads/Companies/Contacts, which all use `useListUrlState`) —
  refreshing `/users` loses any active search/filter/page. Not fixed, not
  blocking, just inconsistent with the newer pages.
- **No component tests exist yet for the Companies/Contacts/Leads screens**
  built in 2.4–2.6 (only the shared building blocks — `DataTable`,
  `SearchInput`, `OwnerSelect` — have them). Deliberate Day 2 scope choice
  (manual coverage instead); add key-flow tests for these screens on
  Day 6, per the roadmap, not before unless asked.
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
