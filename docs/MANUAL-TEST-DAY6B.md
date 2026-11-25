# Manual test script — Day 6b (pickers, required fields, phone input, My Tasks)

Written for someone who has never used this app before. This environment
has no browser-automation tool, so none of this has been clicked through by
the person who wrote it — if a step doesn't match reality, that's a real
bug to report, not a typo in this script.

Do not check any box until it has actually been done in a real browser.
Use fictional data only.

## 0. Before you start

- [ ] No migration is needed for Day 6b. From the repo root run
      `pnpm typecheck && pnpm lint`, then `pnpm --filter api test`, then
      `pnpm --filter web test` (expected counts: `docs/PROJECT-STATE.md` §1,
      latest entry).
- [ ] Start native dev with `pnpm dev`, open `http://localhost:3000`.
- [ ] You need an **Admin** and a **Staff** account, and at least 25
      companies (the sample-data seed is enough, or add a few by hand) so the
      "type to search more" hint can appear.

## 1. Pickers show options as soon as they are opened (D97)

1. [ ] **Contacts → New contact**. Click the **Company** box **without
       typing**. **Expected**: a list of companies A–Z drops down straight
       away; at the bottom, a grey line "Showing 20 of N · type to search
       more" (or just "N companies" if you have 20 or fewer). Some rows have
       a grey second line (the industry).
2. [ ] Type two or three letters of a company name. **Expected**: the list
       narrows; while it updates you may briefly see "Searching…" with the
       old rows still showing (never an empty flash). Type nonsense
       (`zzzq`). **Expected**: "No companies match "zzzq"."
3. [ ] Clear the box, press **↓** (the list opens), **↓ ↓**, then **Enter**.
       **Expected**: the highlighted company is picked and the list closes.
       Press **Esc** inside an open list: it closes. Press **Tab**: focus
       moves on.
4. [ ] Click the filled Company box again. **Expected**: the full first page
       appears again, with a tick next to the picked company (not a list
       containing only that one).
5. [ ] **Deals → New deal**: click **Company** without typing — same list.
       Open an existing deal → **Contacts** tab → the contact picker: click
       it without typing. **Expected**: only that deal's company's contacts,
       each with its email as a grey second line.
6. [ ] **Quotations → New quotation**: pick a **Company**, then click
       **Contact** without typing. **Expected**: only that company's
       contacts. The **Deal** list shows only that company's deals.
7. [ ] Open a **Qualified** lead → **Convert**. In the Company section choose
       to link an existing company and click the box without typing.
       **Expected**: companies listed straight away. Same for the contact
       picker in the Contact section. (Cancel the dialog afterwards.)
8. [ ] **Deals** list (List view): click the **Any company** filter without
       typing. **Expected**: "Any company" first, then companies A–Z with the
       hint. Type part of the name of a company that sorts late in the
       alphabet and pick it. **Expected**: the list shows only that
       company's deals, and the page address contains `companyId=`. Refresh
       the page: the filter box still shows that company's name.
9. [ ] With that filter on, type a few letters in the filter box and then
       click elsewhere without picking. **Expected**: the deals list did not
       change while you typed, and the box shows the filtered company's name
       again. Open it and choose **Any company**: the filter is removed.
10. [ ] **Quotations** list: repeat steps 8–9 with its company filter.
11. [ ] Archive a company, then open any Company picker. **Expected**: the
        archived company is not offered. Restore it afterwards.
12. [ ] Do one picker as **Staff**. **Expected**: the same behaviour.
13. [ ] Switch theme (user menu → Theme) and open a picker in Dark and
        Light. **Expected**: the list, highlighted row, tick and grey status
        line are readable in both.

## 2. Required fields (D98)

1. [ ] **Leads → New lead**. **Expected**: labels "First name *" and
       "Company name *"; the **Source** box shows "Not specified (saved as
       Manual)".
2. [ ] Type First name `Asha` and Email `asha.d6b@example.test`, leave
       Company name empty, click **Add lead**. **Expected**: a red "Company
       name is required" under Company name; nothing saved.
3. [ ] Type Company name `Example Foods`, leave Source as "Not specified",
       click **Add lead**. **Expected**: the lead is created (before Day 6b
       this failed with "Invalid UUID" under Source). Its detail page shows
       Source **Manual**.
4. [ ] **Edit** that lead. **Expected**: Source shows "Manual"; its list has
       no "Not specified" option. Empty the Company name and **Save**.
       **Expected**: "Company name is required"; nothing saved.
5. [ ] Create another lead with a phone but no email (e.g. `98400 12345`).
       **Expected**: saved — email **or** phone is enough. Try one with
       neither: "Provide an email or a phone number".
6. [ ] **Contacts → New contact**. **Expected**: "Company *" and the text
       "Every contact belongs to a company." Fill First name and Email only,
       click **Add contact**. **Expected**: "A company is required";
       nothing saved. Pick a company and save: it works.
7. [ ] Open a **Company** → Contacts tab → **Add contact**. **Expected**:
       the company is filled in and locked; saving needs only a first name
       and an email or phone.
8. [ ] **Companies → New company**: only "Company name *" is required —
       save one with just a name. **Expected**: saved.
9. [ ] **Deals → New deal** and **Quotations → New quotation**: unchanged
       (deal: name and company; quotation: company, contact and one line).
       In the Deal form, Source can be "No source".
10. [ ] Pick a company in the **Deal**, **Quotation** and **Contact** forms.
        **Expected**: the company's name stays in the box after you pick it
        (it used to blank out briefly or stay empty).
11. [ ] **Leads → Import CSV** with this file:

        ```
        Name,Email,Company
        Ravi D6b,ravi.d6b@example.test,Example Foods
        Meera D6b,meera.d6b@example.test,
        ```

        **Expected**: Ravi Ready; Meera Error "Company name is required.";
        importing creates only Ravi. A file with no Company column at all
        shows "Choose a column for Company (each row needs one)."
12. [ ] **Contacts → Import CSV** with the same file. **Expected**: the same
        — Meera is an Error; Ravi links to (or creates) "Example Foods".
13. [ ] A website enquiry with no company (only if you can send one — see
        `docs/MANUAL-TEST-DAY5A.md`) still becomes a lead.

## 3. Phone input (D99)

Do steps 1–8 on **Leads → New lead**; then repeat steps 1, 3 and 5 on
**Contacts → New contact**, **Companies → New company** and **Settings →
Organisation** (Admin).

1. [ ] **Expected**: a country box showing "India (+91)" and an empty number
       box (no digit counter inside it). Open the country list: India first,
       then countries A–Z.
2. [ ] Type `98a40-0`. **Expected**: only `9840` appears (letters and symbols
       are ignored).
3. [ ] Keep typing until there are 10 digits, then type one more digit.
       **Expected**: the 11th digit does not appear; a grey note "India (+91)
       numbers have at most 10 digits." under the field.
4. [ ] Clear the box and type `0`. **Expected**: nothing appears (a leading 0
       is dropped). Type `098400 12345`. **Expected**: `9840012345`.
5. [ ] Clear the box and paste (Ctrl+V) each of these in turn, clearing
       between them. **Expected** each time: India, `9840012345`.
       - `+91 98400-12345`
       - `098400 12345`
       - `919840012345`
6. [ ] Paste `+44 20 7946 0958`. **Expected**: the country switches to
       "United Kingdom (+44)", and the box shows `2079460958`.
       Clear the digits: the country stays United Kingdom.
7. [ ] Choose India again and paste `98400 1234 5678` (14 digits).
       **Expected**: nothing is pasted, and a grey note says the number has 14
       digits and India numbers have at most 10. Paste `+999 1234 5678`:
       refused, "… is not a country code in the list".
8. [ ] Type only `98400` and click **Add lead** (with the other required
       fields filled). **Expected**: a red "Enter all 10 digits of the number
       for India (+91)"; nothing saved. Complete the number: it saves, and the
       lead shows "+91 98400 12345".
9. [ ] Type a Chennai landline `4423456789` on a **Company** and save.
       **Expected**: saved (landlines are allowed).
10. [ ] Open an existing lead, contact and company that already have a phone,
        click **Edit**. **Expected**: the number shows in the box under the
        right country, and saving without touching it works.
11. [ ] **Settings → Organisation**: type an organisation phone, save, then
        open a quotation PDF. **Expected**: the phone is in the header.
12. [ ] **Leads → Import CSV** with:

        ```
        Name,Email,Phone,Company
        Asha P1,asha.p1@example.test,098400 12345,Example Foods
        Ravi P2,ravi.p2@example.test,91-98450-67890,Example Foods
        Meera P3,meera.p3@example.test,12345,Example Foods
        ```

        **Expected**: Asha and Ravi Ready (phones +91 98400 12345 and
        +91 98450 67890 after import); Meera an Error (the phone "12345" is not
        recognisable).
13. [ ] Light and Dark theme: the notes under the field are readable.

## 4. My Tasks — "Assigned to" (D100)

Before you start: as **Admin**, create two open tasks from any lead's
Activity box — one assigned to yourself ("Admin task D6b") and one assigned
to the Staff user ("Staff task D6b").

1. [ ] As **Admin**, open **My Tasks**. **Expected**: a dropdown "Assigned to
       me" before the other filters; only "Admin task D6b" (and your other
       tasks) — not "Staff task D6b"; no "Assigned to" column. The page
       address has no `assignee=`.
2. [ ] Choose **Everyone**. **Expected**: both tasks, plus everyone else's;
       a new "Assigned to" column showing "You", the Staff user's name, or
       "Unassigned". The address now contains `assignee=all`. Refresh the
       page: still Everyone.
3. [ ] Choose the **Staff user's name**. **Expected**: only "Staff task D6b"
       (and their other tasks), with the column showing their name. If they
       have none on this tab, the empty message names them.
4. [ ] Switch between **Open**, **Overdue** and **Done** tabs, and use the
       type/priority/due filters: the "Assigned to" choice stays.
5. [ ] Back on **Assigned to me**, click **Complete** on one of your tasks.
       **Expected**: it moves to Done, as before.
6. [ ] Sign in as **Staff** (second browser) → **My Tasks**. **Expected**:
       only "Staff task D6b" (and their own). Everyone works for Staff too.
7. [ ] Copy the address while viewing the Staff user's tasks and open it in
       the Admin's browser. **Expected**: the same filtered view.
8. [ ] Light and Dark theme: the dropdown and the column are readable.

## 5. Recorded, not built (D96)

Nothing to click — for the record, these PRD items are approved deviations:
bulk operations on lists (5.3), a calendar view (5.6), and read/unread on
enquiries (5.8).
