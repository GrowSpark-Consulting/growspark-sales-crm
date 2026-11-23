# Day 4 Summary — Sales & CRM

Written at the end of Day 4 (2026-11-21 for the backend packages, 2026-11-23
for the UI packages) for anyone who wants a plain read of what exists and how
it was checked, without digging through `decisions.md`'s full technical log.
For the *next* session's starting point, read `docs/NEXT-SESSION-START.md`
instead — this file is a look back, not a plan forward.

## What was built, package by package

- **4.0 — small backend groundwork**: manual leads can be created without
  picking a Source (it resolves to "Manual" automatically); money and
  percentage fields on the frontend use text-backed inputs so deleting a
  leading zero or clearing the field entirely works properly.
- **4.1 — the Activities API and record timelines**: tasks, calls, meetings,
  and notes can be created, completed, or cancelled, each linked to a lead,
  contact, company, or deal; a merged timeline endpoint combines activities
  with a record's status/stage history, newest first.
- **4.2 — Today and the dashboard, backend only**: `GET /today` (what needs
  attention right now) and `GET /dashboard` (KPIs, breakdowns, and a
  six-month revenue trend) were built and checked against hand-written SQL,
  plus a script that creates realistic, clearly fictional sample data for
  local development (`pnpm db:seed:sample`). No screens yet — the brief was
  explicit that the UI comes later, as its own packages.
- **4.2b — closing backend gaps**: a lead or deal's detail view now shows
  its own next upcoming activity (including whether it's overdue); the
  activities list can be filtered by a due-date range or by "overdue only".
- **4.3 — the Activity composer and the Timeline tab**: every Lead,
  Contact, Company, and Deal detail page gained a shared "Add activity" box
  (Task/Call/Meeting/Note) and a combined Timeline tab showing everything
  that's happened to that record, with Complete/Cancel actions and
  load-more paging.
- **4.4 — My Tasks and the Today workspace**: a new `/tasks` page (your
  open, overdue, and completed work, with filters) and a new `/today` page
  (seven at-a-glance cards: overdue, due today, this week's meetings, new
  leads, deals closing soon, deals that have gone quiet, and recently
  updated deals), each with quick actions to complete a task or log a new
  follow-up without leaving the page.
- **4.5 — the dashboard on Home**: the placeholder Home page is now a real
  dashboard — nine KPI tiles, four charts (leads by source, leads by
  status, pipeline by stage, and the last six months of won revenue), a
  recent-activity feed, and controls for the date range and whether you're
  looking at your own work or everyone's.

## An important wrinkle in package 4.4

A different AI tool had started package 4.4 in an earlier session and left
it half-finished and **uncommitted** — a `/tasks` page existed as a file on
disk, but it wasn't working code ready to ship: it imported a formatting
function that doesn't actually exist in this codebase (so it wouldn't have
compiled), it didn't reuse this app's existing table/filter/badge
components the way every other list page does, and the `/today` page it
was supposed to link to hadn't been built at all. This session read that
work carefully before touching anything, kept the one backend change that
was genuinely correct (an activity-priority filter, and a sensible change to
how "Today" items link to records), fixed the one existing test that change
had broken, and rewrote the rest properly. Full detail is in
`docs/decisions.md` D56, for anyone curious exactly what was kept versus
replaced.

## Endpoints added this phase (`apps/api`)

- `GET/POST /activities`, `GET/PATCH /activities/:id`, `POST
  /activities/:id/complete`, `POST /activities/:id/cancel`
- `GET /{leads,contacts,companies,deals}/:id/timeline`
- `GET /today`, `GET /dashboard`
- A `priority` filter added to the activities list (package 4.4)

## Screens added this phase (`apps/web`)

- An "Add activity" composer and a Timeline tab on every Lead, Contact,
  Company, and Deal detail page
- `/tasks` (My Tasks) and `/today` (the Today workspace), both new sidebar
  entries placed right after Home
- The Home page itself, replaced with the dashboard

## How it was verified

**Automated** — every package ran `pnpm typecheck && pnpm lint && pnpm
--filter api test && pnpm --filter web test && pnpm build` before being
committed. Test count grew through the phase: 356 (end of Day 3) → 363
(4.1) → 365 (4.2) → 369 (4.2b) → 374 (4.3) → 383 (4.4) → **387** (4.5): 296
`apps/api` + 91 `apps/web`.

**Manual — not yet done by anyone.** `docs/MANUAL-TEST-DAY4.md` is written
and ready for the user to run in a real browser, covering the roadmap's own
five Day 4 acceptance items (a logged call and a scheduled meeting on a deal
both appearing on that deal's, its company's, and its contact's timelines;
an overdue task appearing on Today; a deal with no open activity appearing
under "Deals with no next activity"; every dashboard number matching an
independent SQL check, including for "Mine"; and "Today" being correct
around midnight India time), plus a copy-pasteable SQL block for the
reconciliation check and a light/dark/keyboard/console spot-check on the
new screens — same style as `MANUAL-TEST-DAY3.md`. As with every earlier
day, this environment has no browser-automation tool, so **nothing in this
summary should be read as "seen working in a browser."** In particular:

- The four dashboard charts have only ever been exercised through their
  hidden, screen-reader-only data table in an automated test — Recharts
  renders at zero size in the jsdom test environment (there's no
  `ResizeObserver` there), so the actual bars, colours, and tooltips have
  never been looked at.
- Light/dark theming, keyboard focus order, and a clean browser console on
  any Day 4 screen are unverified.
- The pipeline board's drag gesture (a Day 3 item) was already a known gap
  going into Day 4 and remains one.

## Judgment calls worth knowing about

All recorded in `docs/decisions.md` (D51–D57):

- Today's items link straight to the record they're about (a lead, contact,
  company, or deal page) rather than to a filtered list — the only way to
  satisfy "a link to open each record" once there's no dedicated
  activity-detail page in this app.
- The dashboard shows nine KPI cards even though the design system's own
  StatCard component guidance caps a dashboard at six — the brief's
  explicit, literal list of nine won out over that general guidance.
- Chart colours reuse this project's own already-published, already
  contrast-checked design tokens rather than a newly invented palette —
  including reusing the Leads list's own status-colour mapping for the
  "leads by status" chart, since that chart *is* status data.
- "Leads by source", "pipeline by stage", and "monthly won revenue" use one
  plain colour per chart rather than a different colour per bar, since each
  is a single measurement compared across categories already labelled on
  the axis — adding per-bar colour there would have been decoration, not
  information.

## How to run and test it

Same setup as earlier days (`docs/DAY-1-SUMMARY.md` has the full first-time
steps). Once running:

- The sidebar now has **Today** and **My Tasks** entries, right after Home.
- Run `pnpm db:seed:sample` once to get realistic-looking sample data to
  look at on Today, My Tasks, and the dashboard — it's safe to run again.
- To re-run the full automated check from a clean state:
  ```
  pnpm typecheck && pnpm lint && pnpm --filter api test && pnpm --filter web test && pnpm build
  ```
  Expect 387 tests passing (296 `apps/api`, 91 `apps/web`).
- To re-run the manual browser script, follow `docs/MANUAL-TEST-DAY4.md`
  top to bottom.
