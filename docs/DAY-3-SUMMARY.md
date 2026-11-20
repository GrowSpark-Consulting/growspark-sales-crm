# Day 3 Summary — Sales & CRM

Written at the end of Day 3 (2026-11-20) for anyone who wants a plain read of
what exists and how it was checked, without digging through `decisions.md`'s
full technical log. For the *next* session's starting point, read
`docs/NEXT-SESSION-START.md` instead — this file is a look back, not a plan
forward.

## What was built, package by package

- **3.1 — the lead conversion transaction**: the hardest item on the
  roadmap, built first. `POST /leads/:id/convert` turns a `QUALIFIED`, non-
  archived lead into a linked-or-created Company and Contact, optionally a
  Deal in the pipeline's first open stage, all inside one row-locked
  transaction — so two people converting the same lead at once can't both
  succeed. `GET /leads/:id/conversion-matches` suggests existing records to
  link instead of creating duplicates.
- **3.2 — the Deals API and pipeline**: full Deal CRUD, moving a deal
  between stages, closing a deal Won or Lost (Lost requires a reason),
  reopening a closed deal (back to the first open stage), archiving and
  restoring deals (allowed even while closed — a deliberate choice), linking
  contacts to a deal, and a pipeline summary endpoint that computes every
  total directly in the database so it can't drift from what's actually
  stored.
- **3.3 — Deals list, forms, detail, close dialogs**: a searchable/
  filterable Deals list; create and edit forms; a detail page showing the
  company, stage, value, probability, weighted value, expected close date,
  and owner, plus tabs for an overview, the deal's contacts, and its full
  stage-move history; dedicated Close as Won / Close as Lost actions, the
  latter requiring a reason; a closed deal is read-only except for
  reopening it.
- **3.4 — the Kanban pipeline board**: a Board/List toggle on the Deals
  page. Board view shows one column per open pipeline stage, with running
  totals per column; every card can be moved either by dragging it to
  another column or by a plain dropdown menu — the dropdown always works,
  regardless of whether dragging does in a given browser or input method.
- **3.5 — the Convert dialog and related tabs**: a proper dialog for
  converting a qualified lead, letting you link to an existing company and
  contact or create new ones, and optionally start a deal at the same time
  — all in one submission. The lead's own detail page now shows a "Convert"
  button only when it makes sense to use it, and once a lead has been
  converted, its page shows exactly what that conversion created. Company
  and Contact pages also gained a Deals tab, so you can see (and, for
  companies, start) deals connected to that record without leaving it.

## Endpoints added this phase (`apps/api`)

- `GET /leads/:id/conversion-matches`, `POST /leads/:id/convert`
- `GET/POST /deals`, `GET/PATCH /deals/:id`, `POST /deals/:id/stage`,
  `POST /deals/:id/close`, `POST /deals/:id/reopen`,
  `POST /deals/:id/archive`, `POST /deals/:id/restore`,
  `PUT /deals/:id/contacts`, `GET /deals/:id/stage-history`
- `GET /pipeline/stages`, `GET /pipeline/summary`

## Screens added this phase (`apps/web`)

- `/deals`, `/deals/new`, `/deals/[id]`, `/deals/[id]/edit`, plus a Board
  view at `/deals?view=board`
- A **Deals** sidebar entry, visible to both roles, placed after Contacts
- A "Convert" action on the lead detail page, opening the new Convert
  dialog
- A Deals tab on Company and Contact detail pages

## How it was verified

**Automated** — every package ran `pnpm typecheck && pnpm lint && pnpm test
&& pnpm build` from a clean state before being committed. Test count grew
through the phase: 297 (end of package 2.7) → 309 (3.1) → 328 (3.2) → 342
(3.3) → 344 (3.4) → **356** (3.5): 282 `apps/api` + 74 `apps/web`.

**Manual** — `docs/MANUAL-TEST-DAY3.md` is written and ready for the user to
run in a real browser, covering the roadmap's own six Day 3 acceptance
items (qualify-and-convert linking an existing company with no duplicate
created; the lead stays viewable with its history and shows what it became;
a converted deal appears on the board in the first open stage; both the
dropdown and drag move a deal and record history; a deal can't be marked
Lost without a reason; pipeline totals on screen match a SQL check), plus a
Network-tab check for the deals list filters and a light/dark/keyboard spot
check on the new screens — same style as `MANUAL-TEST-DAY2.md`. As with
every earlier day, this environment has no browser-automation tool, so the
script itself has not been run by the session that wrote it; everything in
it is believed correct from the automated test suite and direct API
verification, not from having watched it happen.

## Judgment calls worth knowing about

A handful of decisions in this phase weren't spelled out in the original
brief and were made explicitly, not guessed silently — all recorded in
`docs/decisions.md` (D46–D50):

- Converting a lead into a *new* company requires the lead to actually have
  a company name; if it doesn't, the Convert dialog's "create new company"
  field is editable and required, rather than the conversion failing with
  no way to fix it.
- Reopening a closed deal always returns it to the pipeline's first open
  stage — not wherever it happened to be before it closed, since nothing is
  recorded about that.
- Archiving and restoring a deal works regardless of whether it's open,
  Won, or Lost — "a closed deal is read-only" was read as applying to its
  pipeline/commercial fields, not to whether it can be archived.
- The Deal detail page's Contacts tab needed a genuine backend addition
  beyond what was originally planned — there was no way to read a deal's
  current contacts without writing to them first. This was flagged and
  approved before building it, not added silently.
- A real race condition was found (and fixed) in the Convert dialog by its
  own test suite: if the dialog's background lookup for existing matches
  took a moment, a fast typist could have their input silently overwritten
  once that lookup finished. Fixed by not showing the editable fields until
  that lookup is done.

## An environment hiccup, not a code issue

Partway through verifying the last package, Docker Desktop on the
development machine got into a genuinely broken state (an earlier
background test run was accidentally left running while a second one was
started, which combined with an already-restarting Docker Desktop to wedge
it badly enough that even `docker ps` failed). Nothing in the code or
configuration was changed to work around it — the user resolved it with a
full machine restart, after which everything verified cleanly on the first
try. Recorded here only so it isn't mistaken for a code problem later.

## How to run and test it

Same setup as Day 1/Day 2 (`docs/DAY-1-SUMMARY.md` has the full first-time
steps). Once running:

- The sidebar now has a **Deals** entry, after Contacts.
- To re-run the full automated check from a clean state:
  ```
  pnpm typecheck && pnpm lint && pnpm test && pnpm build
  ```
  Expect 356 tests passing (282 `apps/api`, 74 `apps/web`).
- To re-run the manual browser script, follow `docs/MANUAL-TEST-DAY3.md`
  top to bottom.
