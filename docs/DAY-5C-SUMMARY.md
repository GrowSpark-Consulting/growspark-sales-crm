# Day 5c — summary

Day 5c adds three PRD features that were still missing, one at a time, each
stopping for review: **(1) Quotations**, (2) Notifications, (3) Reports.
This file is filled in as each feature is finished. Decisions: D83 onward in
`docs/decisions.md`. Click-through steps: `docs/MANUAL-TEST-DAY5C.md`.

## 1. Quotations — done (2026-11-25)

### What a user can now do

- Create a quotation for a company and one of its contacts, optionally
  linked to one of that company's deals, with any number of typed line items
  (description, quantity, unit price, optional discount %), a
  quotation-level discount %, a GST % (default 18%), terms and notes. Totals
  update live as you type, calculated by the server.
- Each quotation gets a number like **Q-2026-0001**, restarting at 0001
  every year, unique even if two people press Create at the same moment.
- Move it through **Draft → Sent → Accepted or Rejected**. Only a Draft can
  be edited; each edit raises its version (v1, v2, …). A Sent quotation
  whose valid-until date has passed becomes **Expired** automatically.
- When a quotation with an open deal is accepted, the app **offers** to mark
  that deal Won (you can say "Not now"; a reminder stays on the page).
- **Duplicate** any quotation into a fresh Draft (new number, today's date,
  same customer, deal and lines). **Archive / Restore**.
- **Download PDF**: a professional A4 quotation with your organisation's
  details, the customer, the line items, discount, GST, total, terms and
  notes, page numbers, and the ₹ sign printed correctly. Built fresh each
  time, never stored.
- Find quotations by number or company, filter by status, company, owner and
  issue date, sort by number, dates or total. Quotations also appear on each
  Deal's and Company's page.
- Admin and Staff can do all of this (same as Deals).

### How the money is worked out

Half-up rounding to 2 decimal places, applied exactly three times: once per
line, once for the discount, once for the GST. Example from the brief: 3 ×
₹0.10 with a 33.33% discount and 18% GST is **₹0.24** — the API, the screen
and the PDF all show exactly that, because they all print the server's own
number through one shared formatter. Full rule: D85.

### What was checked

| Check | Result |
|---|---|
| `pnpm typecheck` | clean |
| `pnpm lint` | 0 errors (the same 3 older warnings in untouched files) |
| `pnpm test` | **apps/api 540/540** (was 483; 539 + the D88 test), **apps/web 109/109** (was 101) — 649 total |
| Web production build | every quotation route compiles |
| PDF | rendered and looked at (1-page and 3-page samples); fonts proven to contain ₹ |
| Running app | new pages answer 200 and the API answers 401 when not signed in |
| Clicked through in a browser | **No** — no browser tool here; see `MANUAL-TEST-DAY5C.md` |

### Tested vs. reasoning only

| Requirement | Proven by |
|---|---|
| Totals exact, server-computed, client totals ignored | `tests/lib/quotation-money.test.ts`, `tests/quotations/crud.test.ts` |
| Awkward numbers equal across API, PDF and screen | the two above + `tests/quotations/pdf.test.ts` + `apps/web/tests/components/quotation-detail-page-client.test.tsx` |
| Unique numbers under concurrency, yearly reset | `crud.test.ts` (8 parallel creates; a 31 Dec / 1 Jan boundary) |
| Status flow enforced on the server | `crud.test.ts` |
| Auto-expiry never fails a read, is audited as System, list filter = detail | `tests/quotations/expiry.test.ts` (including a forced write failure and 5 concurrent reads) |
| Duplicate: new number, Draft, new dates, same company and deal | `crud.test.ts` |
| PDF valid, right total, needs sign-in, other organisations can't see it | `pdf.test.ts` |
| Accept offers (not forces) "mark deal Won" | `quotation-detail-page-client.test.tsx` (shown to fail with the offer disabled) |
| Audit rows with safe metadata only | `crud.test.ts` (read back through the audit API) |
| How it looks in a browser, both themes | **Not yet** — manual script |

### Things to know

- **You need to apply the migration** `20261124181711_add_quotations` to your
  local database (`pnpm db:migrate`) before the screens work locally, and to
  staging (`pnpm staging:migrate`) when you're ready. This tool applied it
  nowhere.
- **Your organisation's PDF header details** are empty until you fill them:
  copy `apps/api/org-details.example.json`, fill it in, run
  `pnpm org:set-details --file <file>` (and later
  `pnpm staging:set-org-details --file <file>` from `apps/api`). Both only
  show what they'd change unless you add `--confirm`. Until then the PDF
  shows just the organisation's name.
- **Known PRD deviations (approved, D87)**: no product catalogue, no
  CGST/SGST/IGST split, no PDF reports, owner added to quotations. Future
  items: **GST split**, **product catalogue**.
- **One addition to the plan**: a "calculate totals" endpoint, so the form's
  live totals come from the server rather than browser arithmetic.
- **Answered after review (D88)**: a Draft whose valid-until date has
  already passed can no longer be marked Sent — the server answers "Valid-
  until date has passed, change it first." (tested). Valid until *today* is
  still allowed.

## 2. Notifications — done (2026-11-25)

### What a user can now do

- See a **bell** at the top right of every page, with a red number for
  unread notifications. Click it to open **Notifications**.
- On the Notifications page: see your notifications newest first, switch
  between **All** and **Unread**, click one to open the record it's about
  (it's marked read as you go), **Mark read** one at a time, or **Mark all as
  read**.
- You're told when:
  - someone else assigns a **lead** or a **deal** to you (when it's created,
    when its owner is changed, or when a lead conversion creates a deal for
    you);
  - a **website enquiry** creates a new lead (everyone active in the
    organisation hears about it);
  - a **quotation you own** is accepted or rejected by someone else;
  - one of **your tasks is due today**, or is **overdue**.
- You never see anyone else's notifications, and nobody sees yours.

### How it behaves

- The bell checks for news **once a minute while the tab is visible**, and
  stops while the tab is hidden. When you come back to the tab it checks
  straight away.
- **Free Render server**: a visible tab makes one small request a minute,
  so while anyone has the app open and visible, the server never sleeps.
  A hidden tab sends nothing, so the server can sleep after about 15
  minutes; the next visit then waits for it to wake (tens of seconds). D90
  has the detail.
- Task reminders are created when *you* open the app. No email, no
  background job. "Due today" uses the organisation's time zone.
- Nothing about the person or record is copied into the notification
  itself: the title is built from the live record each time, so a renamed
  lead shows its new name.
- If writing a notification fails, the lead/deal/quotation change it was
  about still goes through (PRD §11), and the failure is logged.

### What was checked

| Check | Result |
|---|---|
| `pnpm typecheck` | clean |
| `pnpm lint` | 0 errors (the same 3 older warnings) |
| `pnpm test` | **apps/api 572/572** (was 540), **apps/web 121/121** (was 109), 693 total |
| Web production build | `/notifications` compiles |
| Running app | the new API endpoints answer 401 when not signed in; `/notifications` answers 200 |
| Clicked through in a browser | **No**: see `MANUAL-TEST-DAY5C.md` §8 |

### Tested vs. reasoning only

| Requirement | Proven by |
|---|---|
| Isolation between users and between organisations (404, never counted) | `apps/api/tests/notifications/api.test.ts` |
| Each trigger, including "not when you did it yourself" and "only when the owner really changes" | `tests/notifications/triggers.test.ts` |
| Due today / overdue, org time zone, de-duplication, concurrency, batch cap | `tests/notifications/tasks.test.ts` |
| A failed notification doesn't roll back the lead (or deal, quotation, intake) | `tests/notifications/failure.test.ts` (with a control test) |
| Mark one read (idempotent) / read all | `api.test.ts` |
| Bell count, 60-second polling, paused while hidden | `apps/web/tests/components/notification-bell.test.tsx` (pause test shown to fail with background polling on) |
| Notifications page actions | `notifications-page-client.test.tsx` |
| Render free-tier sleep behaviour | **Reasoning only**: from Render's published free-tier terms, not measured |
| How it looks in a browser, both themes | **Not yet**: manual script |

### Things to know

- **Differences from the PRD, not approved deviations.** PRD 5.8 also lists
  notifications for **deal changes** (stage moves, Won/Lost) and
  **invitations**, and 5.11 lists **notification preferences**. None of
  these are built. There's no invite flow at all: an Admin creates users
  directly. "Reminders" is covered by "task due today"; the activity's own
  reminder time isn't used. A manually created lead notifies only its owner
  (through the assignment rule), not everyone.
- **Limits**: the bell can be up to a minute behind; a task reminder stays
  in the list after the task is done; at most one "overdue" per task and one
  "due today" per task per day; up to 50 task reminders are created per page
  load (latest due first); reassigning back and forth notifies again each
  time; old notifications are never deleted.
