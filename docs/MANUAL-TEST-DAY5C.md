# Manual test script — Day 5c (Quotations, Notifications, Reports)

Written for someone who has never used this app before. This environment
has no browser-automation tool, so none of this has been clicked through by
the person who wrote it — if a step doesn't match reality, that's a real
bug to report, not a typo in this script.

Do not check any box until it has actually been done in a real browser or
terminal.

## 0. Before you start

- [ ] `pnpm db:verify-fresh` (rebuilds `crm_test` with migrations
      `20261124181711_add_quotations` and `20261124191130_add_notifications`),
      then `pnpm typecheck && pnpm lint && pnpm test` — expected 719 tests:
      593 `apps/api`, 126 `apps/web`.
- [ ] Apply the migrations to your own local database: `pnpm db:migrate`
      (applies both migrations above to `crm_dev`; additive only).
      Without this, every quotation screen shows an error.
- [ ] Optional, for a realistic PDF header: copy
      `apps\api\org-details.example.json` to a file of your own (e.g.
      `apps\api\org-details.local.json`), fill in Grow Spark's real details,
      then run `pnpm org:set-details --file org-details.local.json`
      (path relative to `apps\api`). It only **shows** what it would write.
      Check the list, then re-run with `--confirm` added at the end.
- [ ] Start native dev: `pnpm dev` from the repo root, sign in as **Admin**
      at `http://localhost:3000`. You need at least one company with a
      contact, and an open deal for that company (the sample data has these).

## 1. Create a quotation (and the awkward-number total)

1. [ ] In the left sidebar, click **Quotations** (between Deals and
       Enquiries). **Expected**: an empty list, "No quotations yet", and a
       **New quotation** button top right.
2. [ ] Click **New quotation**. Pick a **Company** (type a few letters, click
       a result), then a **Contact** (only that company's contacts are
       offered), then a **Deal** from the dropdown.
3. [ ] In line 1 type Description `Sensor labels`, Qty `3`, Unit price `0.10`.
       Set that line's **Disc. %** to `33.33`, leave its **GST %** at `18`
       (changed in Day 7: discount and GST are per line, see
       `MANUAL-TEST-DAY7.md`). **Expected**, immediately, in the totals box on
       the right: Subtotal **₹ 0.20**, GST 18% **₹ 0.04**, Total **₹ 0.24**;
       the line's Amount column shows **0.24**.
4. [ ] Click **Add line**; type `Workshop`, Qty `2`, Unit price `45000`,
       Disc. % `10`, GST % `18`. **Expected**: that line's Amount shows
       **95,580.00** (81,000.00 + 14,580.00 GST), totals update.
5. [ ] Try a bad value: Unit price `1.005`. **Expected**: totals show `…`
       (no total is shown until the lines are valid); on **Create
       quotation**, an error appears under that field. Fix it back to `45000`.
6. [ ] Click **Create quotation**. **Expected**: you land on the new
       quotation's page; title **Q-2026-0001** (current year); status badge
       **Draft**; key fields show Company, Contact, Deal (all links), Issued
       today, Valid until 30 days later, Total, Owner = you, PDF reference
       **Q-2026-0001-v1**.

## 2. The PDF

1. [ ] On the quotation page click **Download PDF**. **Expected**: a file
       named `Q-2026-0001-v1.pdf` downloads and opens.
2. [ ] Check the PDF: your organisation's name (and the details from
       step 0, if you set them) top left; **QUOTATION**, number, reference,
       issue/valid dates, status and deal top right; **BILL TO** with the
       company and "Attn: <contact>"; a table with both lines; the totals
       block; every rupee sign shows as **₹** (not a box or a question mark);
       amounts use Indian grouping (e.g. **₹ 81,000.00**).
3. [ ] **Same total everywhere**: the PDF's **Total**, the quotation page's
       **Total** key field, its totals box, and the list's Total column all
       show exactly the same text.

## 3. Edit, send, accept — and the "mark deal Won?" offer

1. [ ] Click **Edit**, change a quantity, click **Save changes**.
       **Expected**: toast "…updated (version 2)"; the PDF reference is now
       **…-v2**; downloading the PDF again gives `…-v2.pdf`.
2. [ ] Click **Mark as sent** → confirm. **Expected**: badge **Sent**;
       **Edit** has gone; **Accepted** and **Rejected** appear.
3. [ ] Click **Accepted** → **Mark accepted**. **Expected**: badge
       **Accepted**, then a dialog "Mark the deal as Won?". Click **Not now**.
       **Expected**: the dialog closes; the Overview tab shows "This
       quotation was accepted, but the linked deal … is still open" with a
       **Mark deal as Won** button.
4. [ ] Click that **Mark deal as Won** → **Mark deal as Won**. **Expected**:
       toast "… closed as Won"; the notice disappears; opening the deal (key
       field link) shows it **Won**.
5. [ ] Open the deal page → **Quotations** tab. **Expected**: this
       quotation is listed with its total and **Accepted** badge.

## 4. Duplicate, reject, archive

1. [ ] On the accepted quotation click **Duplicate** → confirm.
       **Expected**: you land on a new **Draft** with the next number
       (Q-…-0002), today's issue date, valid until +30 days, the same
       company/contact/deal, line items and total, owner = you, version 1.
2. [ ] On the new draft: **Mark as sent**, then **Rejected** → **Mark
       rejected**. **Expected**: badge **Rejected**; no "mark deal Won"
       dialog; no status buttons remain except Duplicate/Archive.
3. [ ] **Archive** → confirm. **Expected**: **Archived** badge; it disappears
       from the Quotations list; switching the list's last filter to
       **Archived** shows it. **Restore** brings it back.

## 5. Out-of-date drafts, and expiry (expiry needs one day of patience)

1. [ ] Create a quotation with **Issue date** a month ago and **Valid until**
       yesterday (both editable on the form), then click **Mark as sent** →
       confirm. **Expected**: the dialog shows "Valid-until date has passed,
       change it first." and the quotation stays **Draft** (D88).
2. [ ] Click **Edit**, set **Valid until** to **today**, save, then **Mark as
       sent**. **Expected**: badge **Sent** (a quotation is still valid on its
       valid-until date).
3. [ ] **The next day**, open that quotation again. **Expected**: badge
       **Expired** and the notice "This quotation expired after …". (Expiry
       itself is fully covered by automated tests, D86; this step just shows
       it in the real app.)
4. [ ] On the list, set Status = **Expired**: it's there. Status = **Sent**:
       it isn't.
5. [ ] **Accepted** is no longer offered. (If you call the API directly it
       answers 409 with "This quotation expired on …".)
6. [ ] As Admin, open **Audit Log** and filter Action `quotation.expired`.
       **Expected**: one row for this quotation, actor **System**.

## 6. Lists, filters, tabs, Staff access

1. [ ] Quotations list: search by number, then by company name; filter by
       Status, Company, Owner, and an Issued from/to range; click the
       **Number**, **Issued**, **Valid until** and **Total** headers to sort.
       Refresh the page: the filters stay (they live in the URL).
2. [ ] Open a company → **Quotations** tab: lists that company's quotations;
       **New quotation** opens the form with the company already chosen.
3. [ ] Sign out, sign in as **Staff**. Quotations appears in the sidebar;
       Staff can create, edit, send, accept, duplicate, archive and download
       the PDF exactly like Admin.
4. [ ] Light and dark theme: the quotation form, detail page and totals box
       are readable in both (top-right user menu → Theme).

## 7. Staging (only when you choose to)

- [ ] `pnpm staging:migrate` (from `apps\api`) applies
      `20261124181711_add_quotations` and `20261124191130_add_notifications`.
- [ ] Optional: `pnpm staging:set-org-details --file <your file>` (dry run),
      then again with `--confirm`.

## 8. Notifications

You need two people signed in at once: **Admin** in a normal browser window
and **Staff** in a private/incognito window (two windows of the same browser
profile share one sign-in — see PROJECT-STATE §10).

### 8.1 The bell and the empty page

1. [ ] As **Staff**, look at the top bar, right side, just left of your
       name. **Expected**: a bell icon. (If Staff already has overdue tasks
       from the sample data, a red number may show — that's 8.4, fine.)
2. [ ] Hover the bell. **Expected**: tooltip "Notifications" (or
       "Notifications, N unread"). Click it. **Expected**: page title
       **Notifications**; either a list or "No notifications yet" with a
       sentence explaining what you'll be told about; buttons **All**,
       **Unread**, and **Mark all as read** (greyed out when nothing is
       unread).

### 8.2 A lead and a deal assigned to Staff

1. [ ] As **Admin**: **Leads** → **Add lead**; First name `Notify`, Email
       `notify@example.com`, **Owner** = the Staff user; **Create lead**.
2. [ ] As **Staff**: wait up to one minute, or click back into the tab.
       **Expected**: the bell shows **1**. Open it: "Lead assigned to you:
       Notify", in bold, with a dot and a **Mark read** button.
3. [ ] Click the title. **Expected**: the lead's page opens. Go back to
       Notifications: that row is no longer bold, has no dot and no Mark
       read; the bell's number has gone.
4. [ ] As **Admin**: open the lead, **Edit**, change something other than
       the owner (e.g. Job title), save. **Expected (Staff)**: nothing new.
       Then change **Owner** to Admin, save, change it back to Staff, save.
       **Expected (Staff)**: one new "Lead assigned to you: Notify".
5. [ ] As **Admin**: **Deals** → **Add deal** for any company, **Owner** =
       Staff, create it. **Expected (Staff)**: "Deal assigned to you: <deal
       name>"; clicking it opens the deal.
6. [ ] As **Admin**, create another lead with **Owner** = Admin (yourself).
       **Expected**: no new notification for anyone.
7. [ ] As **Admin**, rename the first lead's first name to `Notified`.
       **Expected (Staff)**: the existing notification now reads "Lead
       assigned to you: Notified" (titles come from the live record).

### 8.3 Quotation accepted / rejected

1. [ ] As **Staff**: create a quotation (§1) and **Mark as sent**.
2. [ ] As **Admin**: open that quotation → **Accepted** → **Mark accepted**
       (choose **Not now** on the deal offer). **Expected (Staff)**:
       "Quotation Q-…-… accepted (<company>)"; clicking it opens the
       quotation.
3. [ ] Repeat with a second Staff quotation; this time Admin clicks
       **Rejected**. **Expected (Staff)**: "Quotation … rejected (…)".
4. [ ] As **Staff**, send and accept a quotation you own yourself.
       **Expected**: no notification for anyone.

### 8.4 Tasks due today and overdue

1. [ ] As **Admin**: open any lead → **Timeline** → add a **Task** assigned
       to Staff, due later **today**. Add a second task assigned to Staff,
       due **yesterday**.
2. [ ] As **Staff**: reload any page. **Expected**: "Task due today:
       <subject>" and "Task overdue: <subject>"; each opens the lead.
3. [ ] Reload several times. **Expected**: still exactly one of each.
4. [ ] Complete the due-today task (My Tasks). **Expected**: its
       notification stays in the list (known limit, D90).

### 8.5 New website enquiry

1. [ ] Send one test enquiry the same way as `docs\MANUAL-TEST-DAY5A.md`,
       with a new Idempotency-Key.
2. [ ] **Expected**: both Admin and Staff get "New website enquiry from
       <name>"; clicking it opens the enquiry. Sending again with the
       **same** Idempotency-Key: no second notification.

### 8.6 Mark all, Unread filter, privacy

1. [ ] With two or more unread, click **Unread (N)**. **Expected**: only
       unread rows; the address bar ends `?unread=true`; reloading keeps it.
2. [ ] Click **Mark all as read**. **Expected**: toast "N notifications
       marked as read."; the Unread view is empty with "You're all caught
       up."; the bell's number disappears; the button greys out.
3. [ ] As **Admin**, open Notifications. **Expected**: none of Staff's
       notifications appear (each user only sees their own).

### 8.7 The bell pauses while the tab is hidden

1. [ ] As **Staff**, press F12 → **Network**, filter `unread-count`.
       **Expected**: one request about every 60 seconds while the tab is in
       front.
2. [ ] Switch to another browser tab for 3 minutes, then come back.
       **Expected**: no requests while you were away; one straight away when
       you return, then every 60 seconds again.

### 8.8 Both themes

1. [ ] Light and dark (user menu → Theme): the bell, its red number and the
       Notifications page (bold unread rows, the dot, the buttons) are
       readable in both.

## 9. Reports

Sign in as **Admin**. The sample data (or the records you created in §1–§8)
is enough; the point is that Reports and Home agree.

### 9.1 The page

1. [ ] In the left sidebar, click **Reports** (after Enquiries).
       **Expected**: page title **Reports**; a **Date range** dropdown
       (This month), **All** / **Mine** buttons, a line "Showing <1st of
       this month> – <last day> · everyone in the organisation", and five
       cards: **Pipeline by stage**, **Lead sources and conversion**, **Sales
       performance by owner**, **Quotations summary**, **Overdue tasks by
       assignee**. Each card has a one-line explanation and a **Download
       CSV** button.
2. [ ] Each table ends with a bold **Total** row. Pipeline, Lead sources and
       Sales by owner also show a bar chart.

### 9.2 Reports agree with Home

1. [ ] Open **Home** in a second tab, same range (This month) and **All**.
2. [ ] Compare:
       - Home **Leads created** = Reports → Lead sources → Total **Leads
         created**.
       - Home **Open deals** / **Open pipeline value** / **Weighted value**
         = Reports → Pipeline by stage → Total row (Home shows rounded
         values like ₹12.5L; Reports shows exact rupees).
       - Home **Won revenue** / **Win rate** = Reports → Sales performance
         → Total **Won value** / **Win rate**.
3. [ ] Switch both pages to **Mine**. **Expected**: they still agree, and the
       "Showing" line says "only records you own or are assigned".
4. [ ] Overdue: on Reports choose **Custom range**, From `2000-01-01`, To
       today. **Expected**: Overdue tasks → Total = Home's **Overdue
       tasks** card. Back on **This month**, the Reports number may be
       smaller (only items due this month count; known, D92).

### 9.3 Ranges

1. [ ] **Last 30 days**, then **Custom range** with a single past month.
       **Expected**: the "Showing" line changes; Lead sources, Sales by
       owner, Quotations and Overdue change; **Pipeline by stage does not**
       (it's "right now", as its card says).
2. [ ] Reload the page. **Expected**: the same range and scope stay (they
       are in the address bar).

### 9.4 Quotations summary and Expired

1. [ ] With the quotations from §1–§5 in range: the summary lists Draft,
       Sent, Accepted, Rejected and Expired with a count and value each.
       Compare with the Quotations list: set its Status filter and Issued
       from/to to the same dates. **Expected**: same counts.

### 9.5 CSV downloads

1. [ ] On **Sales performance by owner**, click **Download CSV**.
       **Expected**: a file named like
       `report-sales-by-owner-2026-11-01-to-2026-11-30.csv` downloads.
2. [ ] Open it in **Excel**. **Expected**: it opens straight away (no "SYLK"
       warning); columns Owner, Deals won, Won value (INR), Deals lost, Win
       rate (%); plain numbers like `125000.50`; "Unassigned" where a deal
       has no owner; a last row **Total** matching the screen.
3. [ ] Download the other four. **Expected**: each opens, has a Total row,
       and matches its card. With **Mine** selected, the file name ends in
       `-mine.csv`.

### 9.6 Staff, and both themes

1. [ ] Sign in as **Staff**. **Expected**: Reports is in the sidebar and
       everything above works the same (All shows the whole organisation).
2. [ ] Light and dark theme: the cards, tables, Total rows, status badges
       and charts are readable in both.
