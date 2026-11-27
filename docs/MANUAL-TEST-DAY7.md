# Manual test — Day 7 (manager's review changes)

Three changes: **(1)** quotation GST per line and a tax inclusive/exclusive
switch, **(2)** "Enquiries" renamed **Form submissions**, **(3)** visible
feedback on status buttons. Nothing here has been clicked through by the
developer tool — this is for you to run in a real browser. Tick each box.

**Before you start**

- [ ] Run `pnpm db:migrate` once so `crm_dev` has migration
      `20261127100000_quotation_per_line_gst`, then `pnpm dev`, and sign in
      with fictional data only.
- [ ] If you already have quotations from before this change, note the total
      of two of them first (step 1.9 checks they did not change).

---

## 1. Quotations: GST per line + tax inclusive / exclusive

Open **Quotations → New quotation**. Pick a company and contact.

- [ ] **1.1 No quotation-wide boxes.** There is no "Quotation discount (%)" and
      no "GST (%)" box. The line table has **Disc. %** and a new **GST %**
      column (between Disc. % and Amount). A new line's GST % shows **18**.
- [ ] **1.2 Tax exclusive worked example.** One line: Qty 1, Unit price
      1000, GST 18. "Prices are" shows **Tax exclusive** pressed. Totals box:
      Subtotal ₹ 1,000.00 · GST 18% ₹ 180.00 · Total ₹ 1,180.00. The line
      **Amount** reads 1,180.00.
- [ ] **1.3 Tax inclusive worked example.** Click **Tax inclusive**. Totals:
      Subtotal ₹ 847.46 · GST 18% ₹ 152.54 · Total ₹ 1,000.00, and the note
      "Prices are inclusive of GST" appears. Line Amount reads 1,000.00.
      Click **Tax exclusive** again: back to 1,180.00.
- [ ] **1.4 Free rates.** Type GST 0 → no GST row amount (₹ 0.00), allowed.
      Type 0.25, 12.5, 28, 100 → accepted. Type 100.5 or 18.123 or clear the
      box and click **Create quotation** → a message under the box, nothing is
      saved (blank says "Enter a GST rate (0 if exempt)").
- [ ] **1.5 Mixed rates.** Add a second line: Qty 1, Unit price 800, GST 12.5,
      and change line 1 to GST 5. Totals show **two** GST rows ("GST 5%" and
      "GST 12.5%"), Subtotal 1,800.00, Total = Subtotal + both GST rows
      (1,950.00 tax exclusive).
- [ ] **1.6 Line discount.** Disc. % 10 on line 1 (1000 @ 5%): Amount = 945.00
      (900 + 45 GST). The total updates as you type.
- [ ] **1.7 Save and reopen.** **Create quotation**. The detail page shows the
      same totals box, a **GST** column per line, and the same figures you saw
      in the form.
- [ ] **1.8 PDF.** **Download PDF**. It has a **GST** column per line, the same
      GST rows as the screen, the same Total, and — on a Tax inclusive
      quotation — the line "Prices are inclusive of GST". Amount figures match
      the screen.
- [ ] **1.9 Old quotations did not change.** Open the two quotations you noted
      before. Total, and the GST amount, are identical to before. Each line now
      shows its GST % (the quotation's old rate). If the old quotation had a
      quotation-wide discount, each line's **Disc.** is now higher (the two
      discounts combined) and the total is still the same.
- [ ] **1.10 Edit a draft.** Edit a Draft, switch Tax inclusive/exclusive and
      change a GST %; the totals update and **Save** keeps them. A Sent
      quotation has no Edit button, as before.
- [ ] **1.11 Duplicate.** **Duplicate** a quotation: the copy has the same
      per-line GST rates, discounts and the same Tax setting.
- [ ] **1.12 Audit.** As Admin, Settings → **Audit log**, entity "quotation":
      the created/updated rows show the total and `pricesIncludeTax`.

## 2. Enquiries → Form submissions

- [ ] **2.1 Menu.** The sidebar item reads **Form submissions** (no
      "Enquiries" anywhere in the menu).
- [ ] **2.2 List page.** Page title **Form submissions**. Empty/archived
      states say "No form submissions yet" / "No archived form submissions".
      The filter dropdown reads **Active submissions** / **Archived**.
- [ ] **2.3 Detail page.** Open one. Buttons: **Mark as spam**, **Archive**.
      Dialog titles say "…submission…". Toast after Archive/Restore says
      "Submission archived." / "Submission restored."
- [ ] **2.4 Old links.** In the address bar open `/enquiries` → you land on
      `/form-submissions`. Open `/enquiries/<an id>` → lands on
      `/form-submissions/<id>`. `/enquiries?status=SPAM` keeps its filter.
- [ ] **2.5 Notifications.** Send a test website form (or use
      `apps/api/scripts/replay-intake.sh` against local only). The bell shows
      **"New form submission from …"**, and clicking it opens
      `/form-submissions/<id>`. The Notifications page help text says
      "…a website form submission arrives…".
- [ ] **2.6 Other text.** Settings → **API keys** description says "…send form
      submissions into the CRM". Audit log: a website submission row links to
      the Form submissions page.
- [ ] **2.7 Unchanged on purpose.** A lead's **Original enquiry** heading is
      still there (it is the lead's own text, D104). The website form itself
      still works exactly as before.

## 3. Status buttons: visual feedback

Check each place; the behaviour is the same everywhere.

- [ ] **3.1 Lead status** (Leads → a lead → Overview → **Change status**).
      The current status is highlighted with a tick. Hover another button: its
      background changes and the cursor is a hand. Press **Tab**: a clear focus
      ring appears on the focused button.
- [ ] **3.2 While saving.** Click another status. A small spinner appears on
      the clicked button and **all** the buttons are greyed out for a moment
      (to see it, throttle the network in the browser's developer tools to
      "Slow 3G"). Clicking again does nothing. Afterwards the new status is
      highlighted and a toast says **"Status changed to <Status>"**.
- [ ] **3.3 Error case.** Stop the API (or go offline) and click a status: an
      error toast appears, the old status stays highlighted, the buttons work
      again.
- [ ] **3.4 Quotation status.** On a Draft: **Draft** (highlighted) and
      **Mark as sent**. Click it → confirm dialog → on confirm the button shows
      a spinner and "Working…", the dialog closes, toast "Status changed to
      Sent". On Sent: **Sent** (highlighted), **Accepted**, **Rejected** →
      same pattern. After Accepted with an open deal, the "Mark the deal as
      Won?" prompt still appears.
- [ ] **3.5 Deal.** Open deal: **Close as Won** and **Close as Lost** behave as
      before (Lost still asks for a reason); toast "Status changed to Won" /
      "Lost". Closed deal: **Reopen** → toast "Status changed to Open".
- [ ] **3.6 Tasks.** My Tasks, Today and a record's Timeline: **Complete** /
      **Cancel** show the spinner, lock both buttons while saving, then toast
      "Status changed to Completed" / "Cancelled".
- [ ] **3.7 Form submission.** **Mark as spam** → confirm → toast "Status
      changed to Spam. Its linked lead, if any, was archived."
- [ ] **3.8 Nothing else changed.** The same changes are allowed or refused as
      before (e.g. a Converted lead still has no status buttons; an Accepted
      quotation has none).

**Known limits to remember while testing**

- The deal page's **Move stage** menu and the pipeline board's drag-and-drop /
  "Move to…" were not changed.
- Other buttons across the app may not show a keyboard focus ring (D105); the
  status groups do.
