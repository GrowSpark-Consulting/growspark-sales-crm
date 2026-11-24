# Manual test script — Day 5c (Quotations; Notifications and Reports to follow)

Written for someone who has never used this app before. This environment
has no browser-automation tool, so none of this has been clicked through by
the person who wrote it — if a step doesn't match reality, that's a real
bug to report, not a typo in this script.

Do not check any box until it has actually been done in a real browser or
terminal.

## 0. Before you start

- [ ] `pnpm db:verify-fresh` (rebuilds `crm_test` with migration
      `20261124181711_add_quotations`), then
      `pnpm typecheck && pnpm lint && pnpm test` — expected 648 tests: 539
      `apps/api`, 109 `apps/web`.
- [ ] Apply the migration to your own local database: `pnpm db:migrate`
      (applies `20261124181711_add_quotations` to `crm_dev`; additive only).
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
       Set **Quotation discount (%)** to `33.33`, leave **GST (%)** at `18`.
       **Expected**, within about half a second, in the totals box on the
       right: Subtotal **₹ 0.30**, Discount (33.33%) **− ₹ 0.10**, Taxable
       amount **₹ 0.20**, GST (18%) **₹ 0.04**, Total **₹ 0.24**; the line's
       Amount column shows **0.30**.
4. [ ] Click **Add line**; type `Workshop`, Qty `2`, Unit price `45000`,
       Disc. % `10`. **Expected**: that line's Amount shows **81000.00**,
       totals update.
5. [ ] Try a bad value: Unit price `1.005`. **Expected**: totals show `…`
       (the server isn't asked until the lines are valid); on **Create
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
      `20261124181711_add_quotations`.
- [ ] Optional: `pnpm staging:set-org-details --file <your file>` (dry run),
      then again with `--confirm`.
