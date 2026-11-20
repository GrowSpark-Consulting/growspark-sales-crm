# Day 2 Summary — Sales & CRM

Written at the end of Day 2 (2026-11-20) for anyone who wants a plain read of
what exists and how it was checked, without digging through `decisions.md`'s
full technical log. For the *next* session's starting point, read
`docs/NEXT-SESSION-START.md` instead — this file is a look back, not a plan
forward.

## What was built, package by package

- **2.0 — Day 1 leftovers**: every protected page became a thin
  Server-Component wrapper (needed so each can carry Next's `instant = false`
  dev flag, including `/users`, which couldn't before); a show/hide toggle
  was added to every password field.
- **2.1 — backend foundations**: shared normalisers for email/phone/company
  name (so "the same" lead, contact, or company can be recognised despite
  formatting differences), a duplicate-finder, a generic sort-order helper,
  and two small new endpoints — `GET /lead-sources` and `GET /users/options`
  (for owner pickers).
- **2.2 — Companies and Contacts API**: full create/read/update/
  archive/restore for both, with duplicate-detection built into create and
  update (warns via the response, never blocks the save), and same-org
  ownership checks on every link between records.
- **2.3 — Leads API**: full CRUD + archive/restore; a dedicated status-change
  endpoint enforcing the agreed workflow (any open status to any other;
  "Converted" reserved for a not-yet-built Day 3 action) with every change
  recorded in a status-history table; a standalone duplicate-check endpoint
  and a status-history endpoint, both built ahead of the UI that would need
  them.
- **2.3b — small fixes**: archiving something already archived (or
  restoring something already active) now returns a clear "already in that
  state" response instead of a misleading "not found."
- **2.4 — shared UI building blocks**: the reusable pieces every list/detail
  screen since has built on — a data table with server-side sort/paging, a
  record-detail layout (header + key facts + tabs), an owner picker, and a
  company picker — proved by wiring the first one (the data table) into a
  real Companies list page.
- **2.5 — Companies and Contacts screens**: list, create, edit, and detail
  pages for Companies; a reusable create/edit dialog and a detail page for
  Contacts; a company's detail page can list and add its contacts directly;
  archive/restore with a confirmation step everywhere.
- **2.6 — Leads screens**: list (with every filter named in the brief —
  status, source, priority, owner, created-date range — plus search, sort,
  and paging, all server-side), create and edit forms enforcing "name plus
  an email or a phone," a duplicate-warning banner that never blocks saving,
  and a detail page with status-change buttons, a read-only panel showing
  the lead's original enquiry, and a visible history of every status change.

## Endpoints added this phase (`apps/api`)

- `GET /lead-sources`
- `GET /users/options`
- `GET/POST /companies`, `GET/PATCH /companies/:id`,
  `POST /companies/:id/archive`, `POST /companies/:id/restore`
- `GET/POST /contacts`, `GET/PATCH /contacts/:id`,
  `POST /contacts/:id/archive`, `POST /contacts/:id/restore`
- `GET/POST /leads`, `GET/PATCH /leads/:id`,
  `POST /leads/:id/archive`, `POST /leads/:id/restore`,
  `POST /leads/:id/status`, `GET /leads/:id/status-history`,
  `GET /leads/duplicates`

## Screens added this phase (`apps/web`)

- `/companies`, `/companies/new`, `/companies/[id]`, `/companies/[id]/edit`
- `/contacts`, `/contacts/[id]` (create/edit is a dialog, not a separate page)
- `/leads`, `/leads/new`, `/leads/[id]`, `/leads/[id]/edit`
- A **Leads** / **Companies** / **Contacts** sidebar section, visible to both
  Admin and Staff.

## How it was verified

**Automated** — every package ran `pnpm typecheck && pnpm lint && pnpm test
&& pnpm build` from a clean state before being committed. Test count grew
through the phase: 219 (`apps/api`, end of 2.3b) → 249 (219 `apps/api` + 30
`apps/web`, from 2.4 onward) → **249**, unchanged through 2.5 and 2.6, since
those two packages were UI wiring over already-tested API endpoints rather
than new logic. No automated browser-driving tests exist yet for the
Companies/Contacts/Leads screens (see Open items in
`docs/NEXT-SESSION-START.md`).

**Manual** — the user ran `docs/MANUAL-TEST-DAY2.md` in a real browser on
**2026-11-20** and confirmed all five named acceptance items passed:

1. Creating a company and adding two contacts shows both on the company page.
2. A lead with an already-used email still saves, after showing a warning.
3. Search, filters, sort, and paging all run on the server (confirmed via
   the Network tab), for both Companies and Leads.
4. Qualifying a lead writes a visible entry on its History tab.
5. Archived records disappear from the default list and reappear after
   Restore, for Companies, Contacts, and Leads.

That same browser pass surfaced real UX gaps beyond the acceptance
checklist — **these are approved but not yet built**; see `decisions.md`
D40–D44 and `docs/NEXT-SESSION-START.md` for package 2.7, which implements
them next session:

- Every create form currently requires more fields than the brief actually
  needs (D40) — Company should need only a name; Contact and Lead should
  need a name plus an email-or-phone (Lead also needs a source, which should
  default to "Manual" rather than forcing a choice).
- Phone fields take free text with no format checking, which both allows
  genuinely bad numbers and can miss duplicates that are the same number in
  a different format (D41).
- Contacts can currently be saved with no email and no phone at all — Leads
  already block that, Contacts should too (D43).
- A new lead/company/contact form can show a previous session's leftover
  values instead of opening blank (D42) — most likely a side effect of
  Next.js's Cache Components feature retaining client state across
  navigations; needs a real fix, not a workaround.
- The lead status-history list doesn't say *who* made each change (D44);
  and the lead form's "needs an email or a phone" hint stays visible even
  after one is filled in, instead of only showing while the rule is actually
  unmet (D44).

**Update, same calendar date, a later session: all five of the above
(package 2.7, items 1–4) are now built and verified** — see
`docs/decisions.md` D45 and `docs/PROJECT-STATE.md` §7 for what was
actually done, including two real bugs found and fixed while building it
(the Cache Components root cause behind D42, confirmed from Next's own
docs rather than left as a guess; and a real state-tracking bug in the new
phone input, found by its own test suite before it shipped). 244
`apps/api` + 53 `apps/web` = 297 tests. Item 5 (this kind of documentation
pass) is what produced this note.

Separately, every session that built UI also did what verification it
could **without** a browser (no browser-automation tool is available in
this environment): `curl`/direct API calls to prove endpoints return the
right shapes and status codes, and `pnpm build`'s route listing to confirm
every expected page actually exists. That's real evidence the server side
and the build itself work — it predates, and is independent of, the user's
own browser pass above.

## Bugs found and fixed during Day 2

- **2.3b**: archiving an already-archived record (or restoring an
  already-active one) returned 404 "not found," indistinguishable from the
  record genuinely not existing. Changed to a distinct 409 "already in that
  state" response across Companies, Contacts, and Leads, with a test added
  per resource plus one proving a truly missing id still gets a plain 404.
- **2.4**: two `useEffect`s inside the company picker were setting state
  derived from props — not wrong at runtime, but flagged by this repo's
  React Compiler lint rule as a pattern prone to extra renders. Rewritten
  using React's own documented "adjust state during render" alternative.
  Also found, from the very first component-test run, that this repo's
  testing-library setup needed an explicit `afterEach(cleanup)` — it isn't
  automatic without a vitest option this repo deliberately doesn't use —
  otherwise tests in the same file interfered with each other.
- **2.5**: Zod v4's "coerce to number" validator (used for annual revenue)
  has a looser input type than plain numbers, which broke strict form
  typing wherever that field was read. Fixed by overriding just that one
  field with a stricter, non-coercing validator in the form itself, rather
  than loosening the form's typing everywhere.
- **2.5**: react-hook-form sends an empty string for every optional field
  someone leaves blank, not nothing at all — which, sent as-is, would have
  saved as a literal empty string in the database instead of a proper
  "no value." Added a small helper that strips those before every save.
  Found by reasoning through the save path before it shipped, not by a
  failing test.
- **2.6**: the same "coerce to number" issue as 2.5, this time for a lead's
  estimated budget — same fix, applied again.
- **(found during the user's own 2026-11-20 browser pass, not yet fixed)**:
  the five issues listed above under D40–D44 — logged as approved decisions
  for package 2.7, not patched ad hoc, so they get the same review the rest
  of this build has had.

## How to run and test it

Same setup as Day 1 (`docs/DAY-1-SUMMARY.md` has the full first-time steps —
`pnpm install`, copy the two `.env` files, `pnpm db:up`, `pnpm db:migrate`,
`pnpm db:seed`, `pnpm dev`). Once running:

- Log in at `http://localhost:3000/login` as either seeded account
  (`admin@growspark.test` sees everything; `staff@growspark.test` sees the
  same Leads/Companies/Contacts screens but not Users).
- The new sidebar sections are **Leads**, **Companies**, and **Contacts** —
  all visible to both roles.
- To re-run the full automated check from a clean state:
  ```
  pnpm typecheck && pnpm lint && pnpm test && pnpm build
  ```
  Expect 249 tests passing (219 `apps/api`, 30 `apps/web`).
- To re-run the manual browser script, follow `docs/MANUAL-TEST-DAY2.md`
  top to bottom — it's written so someone who has never seen the app before
  can follow it exactly, with the acceptance items called out explicitly.
