# Manual test script — Day 2 (Companies, Contacts, Leads)

Written for someone who has never used this app before. Follow the steps in
order; each one names the exact page, the exact button or field label, and
what you should see happen. This environment has no browser-automation tool,
so none of this has been run by the person who wrote it — if a step doesn't
match reality, that's a real bug to report, not a typo in this script.

Run this after `docs/MANUAL-TEST-DAY1.md` has already passed (you need a
working login). Day 1's design-system checks (dark theme, focus rings, no
pure white/black, console-clean) apply to every new screen below too —
re-check a sample of them here, not just on Day 1's three pages.

## 0. Before you start

1. Start the app: `pnpm dev` from the repo root (same as Day 1).
2. Open `http://localhost:3000/login` in a real browser.
3. Sign in as the seeded Admin (`admin@growspark.test`, the password you set
   in `SEED_ADMIN_PASSWORD`). You should land on `http://localhost:3000/`
   (Home).
4. Look at the left sidebar. You should now see, top to bottom: **Home**,
   **Leads**, **Companies**, **Contacts**, and (because you're Admin)
   **Users**. If any of these are missing, stop — that's a bug, not
   something later steps will explain.
5. Open your browser's DevTools and keep the **Network** tab visible for
   the rest of this script — several steps ask you to check it.

---

## 1. Companies

### 1.1 Empty-state check (skip if companies already exist)

1. Click **Companies** in the sidebar. URL: `http://localhost:3000/companies`.
2. If no companies exist yet, you should see a message **"No companies
   yet"** with the text "Add your first company to start tracking deals and
   contacts." and a button labelled **Add company** inside that message
   area.

### 1.2 Create a company

1. On the Companies page, click the **Add company** button (top right,
   above the table).
2. URL changes to `http://localhost:3000/companies/new`, heading **"Add
   company"**.
3. Fill in:
   - **Company name**: `Example Foods Pvt Ltd`
   - **Industry (optional)**: `Manufacturing`
   - **Business email (optional)**: `hello@examplefoods.test`
   - **Phone (optional)**: `98400 12345`
4. Click **Add company** (the submit button at the bottom right).
5. **Expected**: a green success toast appears bottom-right reading
   "Example Foods Pvt Ltd was added.", and you land on
   `http://localhost:3000/companies/<some-id>` — the new company's detail
   page, heading **"Example Foods Pvt Ltd"**.

### 1.3 Duplicate hint on company name (warn only, never blocks)

1. Go back to **Companies** in the sidebar, click **Add company** again.
2. In **Company name**, type `Example Foods` (a close variant of the one
   you just created), then click into a different field (e.g. click
   **Industry (optional)**) so the Company name field loses focus.
3. **Expected**: a warning-coloured banner appears under the Company name
   field, starting "**This might already exist.**", listing "Example Foods
   Pvt Ltd" as a clickable link.
4. Finish the form (company name can stay as `Example Foods`) and click
   **Add company**.
5. **Expected**: it still saves successfully (a second company is created)
   — the warning did not block the save. This is the Company-side
   equivalent of the Lead duplicate check in §3.3 below.

### 1.4 List: search, filter, sort, paging — all server-side

1. Go to `http://localhost:3000/companies`.
2. In DevTools Network tab, clear the log (the 🚫 icon or Ctrl+Click
   "Clear").
3. Type `Example` into the search box (placeholder "Search name, email or
   phone") and press **Enter**.
4. **Expected in the Network tab**: a new request to a URL starting
   `/api/v1/companies?` containing `q=Example` in the query string. The
   table should now show only companies matching "Example".
5. **Expected in the address bar**: the URL itself now includes `?q=Example`
   — check it by looking at the browser's own address bar, not just
   DevTools.
6. Clear the search (click the **×** that appeared inside the search box).
   The URL's `q=` parameter should disappear and the full list returns.
7. Click the **Name** column header once.
   **Expected**: a new `/api/v1/companies?...sort=name:asc...` request in
   the Network tab, and the address bar gains `&sort=name:asc`. Click
   **Name** again — the request/URL should flip to `sort=name:desc`.
8. If you have more than 25 companies, click **Next** at the bottom of the
   table. **Expected**: a request with `page=2` in it, and the address bar
   gains `&page=2`. (If you have 25 or fewer, **Next** should be disabled
   — grey, not clickable — confirm that instead.)
9. Open the **Any owner** dropdown and pick any user. **Expected**: a
   request with `ownerId=<that user's id>` in it, and the table narrows to
   that owner's companies (or empties out, if none match).
10. Switch the right-most filter from **Active companies** to **Archived**.
    **Expected**: a request with `archived=true`, and the table now shows
    only archived companies (likely empty right now — that's fine, you'll
    populate it in §1.7).

### 1.5 Edit a company

1. From the Companies list, click the **pencil icon** in the Actions
   column for "Example Foods Pvt Ltd" (or open the company and click
   **Edit** there).
2. URL: `http://localhost:3000/companies/<id>/edit`, heading starts "Edit
   Example Foods Pvt Ltd".
3. Change **Industry (optional)** to `Food Processing`, click **Save
   changes**.
4. **Expected**: toast "Example Foods Pvt Ltd was updated.", and you land
   back on the company's detail page with Industry now showing "Food
   Processing" in the key-fields strip under the title.

### 1.6 Company detail page: tabs, and adding contacts (acceptance item)

1. On the company's detail page, you should see two tabs: **Overview** and
   **Contacts**. **Overview** is selected by default and shows Legal name,
   Website, Employee size, Annual revenue, Address, Created, and
   Description.
2. Click the **Contacts** tab.
3. **Expected**: either "No contacts yet — add the first one for Example
   Foods Pvt Ltd." (if this is a fresh company) or a small table of
   existing contacts.
4. Click **Add contact** (top right of the Contacts tab).
5. **Expected**: a dialog titled **"Add contact"** opens, with the
   description "Linked to Example Foods Pvt Ltd." and the **Company**
   field showing "Example Foods Pvt Ltd" as plain, greyed-out text (not
   editable — it's locked to this company).
6. Fill in **First name**: `Asha`, **Last name (optional)**: `Rao`,
   **Email (optional)**: `asha.rao@examplefoods.test`. Click **Add
   contact** (the dialog's submit button).
7. **Expected**: toast "Asha Rao was added.", dialog closes, and "Asha Rao"
   now appears in the Contacts tab's table.
8. Repeat steps 4–7 for a second contact: **First name**: `Deepak`, **Last
   name**: `Shah`, **Email**: `deepak.shah@examplefoods.test`.
9. **Expected (the acceptance item)**: both **Asha Rao** and **Deepak
   Shah** are now listed in the company's Contacts tab, each as a link.
10. Click **Asha Rao**'s name in that table.
    **Expected**: you land on `http://localhost:3000/contacts/<id>`, her
    own detail page, and the **Company** key field near the top shows
    "Example Foods Pvt Ltd" as a link back to the company you just came
    from. Click it to confirm it returns you to the company page.

### 1.7 Archive and restore (acceptance item)

1. Go back to `http://localhost:3000/companies`.
2. Find a company you don't mind archiving (not "Example Foods Pvt Ltd",
   since you'll want it later) and click **Archive** in its Actions
   column.
3. A confirm dialog titled **"Archive company"** opens. Click **Archive**
   inside the dialog.
4. **Expected**: toast "<name> was archived.", and that row **disappears**
   from the default (Active companies) list immediately.
5. Switch the archived filter to **Archived**. **Expected**: the company
   you just archived now appears in this filtered view, and its Actions
   column now shows a **Restore** button instead of Archive.
6. Click **Restore**, confirm in the dialog.
7. **Expected**: toast "<name> was restored.", the row disappears from the
   Archived view, and reappears back in the default Active view.

---

## 2. Contacts

### 2.1 Standalone list and create

1. Click **Contacts** in the sidebar. URL: `http://localhost:3000/contacts`.
2. You should see "Asha Rao" and "Deepak Shah" from §1.6 already in the
   table, each showing their job title (blank), email, phone (blank), and
   owner (blank, "—") columns.
3. Click **Add contact** (top right).
4. **Expected**: the same dialog as before, but this time its description
   reads "A contact can optionally belong to a company." and the
   **Company (optional)** field is a real search box, not locked text.
5. Type `First name`: `Priya`, leave Company blank, click **Add contact**.
6. **Expected**: toast, dialog closes, "Priya" appears in the list with no
   company.

### 2.2 The async company picker

1. Click **Add contact** again.
2. Click into the **Company (optional)** field and type `Example`.
3. **Expected**: after a brief pause (it waits for you to stop typing
   before searching), a dropdown list appears under the field showing
   "Example Foods Pvt Ltd".
4. Click that result.
5. **Expected**: the field now shows "Example Foods Pvt Ltd" as plain text
   inside the search box.
6. Fill **First name**: `Test Linked Contact`, submit.
7. Open this new contact's detail page (click its name in the list) and
   confirm the **Company** key field shows "Example Foods Pvt Ltd" as a
   link.

### 2.3 Search, filters, archive/restore

Repeat §1.4 (search/sort/paging, checking the Network tab for
`/api/v1/contacts?...`) and §1.7 (archive/restore) on the Contacts page —
same mechanics, same expectations, just for Contacts instead of Companies.

---

## 3. Leads

### 3.1 Create a lead — the name + email-or-phone rule

1. Click **Leads** in the sidebar. URL: `http://localhost:3000/leads`.
2. Click **Add lead** (top right).
3. Leave **First name** filled in (e.g. `Ravi`) but leave **both** Email
   and Phone empty. Click **Add lead**.
   **Expected**: the form does **not** submit; an inline red error appears
   under the **Email** field reading "Provide an email or a phone number."
4. Fill in **Phone**: `9876543210` only (still no email). Click **Add
   lead** again.
   **Expected**: this time it submits successfully — a phone alone is
   enough. Toast "Ravi was added.", and you land on the new lead's detail
   page.
5. Go back to **Leads** → **Add lead** and try submitting with **First
   name** left blank entirely (but a valid email filled in).
   **Expected**: inline error under **First name**.

### 3.2 Required field: Source

1. On the Add lead form, note the **Source** dropdown (placeholder "Select
   a source"). Fill in First name and Email, but leave Source unselected,
   and submit.
   **Expected**: inline error under Source (it's required — every lead
   needs a source).
2. Pick any source from the dropdown (e.g. "Website" or "Referral") and
   submit successfully.

### 3.3 Duplicate warning banner (acceptance item — never blocks)

1. Note the email address of the lead you created in §3.1 step 4 (or
   create one now with a known email, e.g. `duplicate-test@example.com`,
   plus any phone).
2. Go to **Leads** → **Add lead**.
3. Fill **First name**: `Second Lead`, **Email**: the **same** email
   address as an existing lead (e.g. `duplicate-test@example.com`), pick
   any **Source**, then click into another field so the Email field loses
   focus.
4. **Expected**: a warning banner appears above the form fields, starting
   "**This might already exist.**", with a line "Matching email" that is a
   clickable link to the original lead's detail page (opens in a new tab).
5. Finish the form and click **Add lead** anyway.
6. **Expected (the acceptance item)**: it **still saves** — a second lead
   is created with the same email. The warning did not block the save.
   Confirm by checking the Leads list: both leads should now appear.
7. Repeat this check by instead matching on **Phone** (same phone number,
   different email) and on **Company name** (same company name) — each
   should independently trigger the same style of warning, naming "phone"
   or "company name" instead of "email".

### 3.4 List: search, filters, sort, paging — all server-side (acceptance item)

1. Go to `http://localhost:3000/leads`. Clear the Network tab log.
2. Type part of a lead's name into the search box (placeholder "Search
   name, email, phone or company") and press Enter.
   **Expected**: a `/api/v1/leads?...q=...` request in the Network tab, URL
   bar gains `?q=...`.
3. Use the **Any status** dropdown to pick "New".
   **Expected**: a request with `status=NEW`, URL bar gains `&status=NEW`,
   table narrows accordingly.
4. Use **Any source**, **Any priority**, and **Any owner** the same way —
   each should produce its own `sourceId=`/`priority=`/`ownerId=` request
   parameter and URL change.
5. Use the two date fields (next to the "–") to set a "Created from" date a
   few days in the past. **Expected**: a request containing
   `createdFrom=...` (an ISO datetime, not just the date you typed).
6. Click the **Status**, **Priority**, or **Name** column headers to sort.
   **Expected**: `sort=status:asc` (etc.) in the request and the URL, and
   clicking the same header again flips to `:desc`. Try clicking a
   **non-sortable** header like **Source** or **Owner** — nothing should
   happen (they're not clickable, since the API doesn't support sorting by
   them).
7. Check paging exactly as in §1.4 step 8.
8. Switch to **Archived** and back, exactly as in §1.4 step 10.

### 3.5 Lead detail page: status buttons, history, and the enquiry panel

1. Open any **New**-status lead's detail page.
2. Near the top, under the title, you should see a status badge reading
   **New** (with a coloured dot).
3. On the **Overview** tab, find the **"Change status"** section with a
   row of buttons. **Expected**: you see buttons for **Contacted**,
   **Qualified**, and **Unqualified** — but **not** a "Converted" button
   anywhere (D29: Converted is never offered here; it's a Day 3 feature).
4. Click **Qualified**.
   **Expected (acceptance item — "qualifying a lead writes a visible
   history entry")**: a success toast "Status changed to Qualified.", the
   status badge at the top changes to **Qualified**, and the "Change
   status" buttons update to show **New**, **Contacted**, **Unqualified**
   (everything except the current status).
5. Click the **History** tab.
   **Expected**: a list showing at least one row: **New → Qualified**,
   with a timestamp. This is the "visible history entry" the acceptance
   item asks for.
6. Change the status one more time (e.g. to **Contacted**) and check the
   History tab again — it should now show **two** rows, newest first.
7. Scroll down the Overview tab to the **"Original enquiry"** section
   (grey background, below the main field grid). It shows **Requirement**
   and, if present, **"Other captured answers"**.
8. Click **Edit** on this lead. **Expected**: the edit form does **not**
   include a Requirement field anywhere — confirming it's read-only after
   creation, exactly as the brief requires. (If you created this lead with
   a Requirement filled in via §3.1, go back to its detail page afterwards
   and confirm the Requirement text is unchanged.)

### 3.6 Archive and restore (acceptance item)

Repeat §1.7 on a lead — same mechanics (Archive/Restore buttons, confirm
dialog, toast, disappears/reappears with the Active/Archived filter).

---

## 4. Acceptance items — quick checklist

- [ ] **§1.6**: create a company and add two contacts, see both on the
      company page.
- [ ] **§3.3**: a lead with an existing email (or phone, or company name)
      warns but still saves.
- [ ] **§1.4 / §3.4**: search, filters, sort and paging all run on the
      server — confirmed via the Network tab and the URL for both
      Companies and Leads.
- [ ] **§3.5**: qualifying a lead writes a visible entry on its History
      tab.
- [ ] **§1.7 / §3.6**: archived records disappear from the default list
      and reappear after Restore, for Companies, Contacts, and Leads.

## 5. Design-system spot-check (re-run from Day 1, on these new screens)

Pick any two of the new pages (e.g. `/leads` and a company detail page) and
confirm, same as Day 1 §15:

- [ ] Switch Light/Dark/System in the user menu — both themes render
      correctly, no pure white or pure black anywhere.
- [ ] Tab through a create form with the keyboard only — every field and
      button gets a visible focus ring, in a sensible order.
- [ ] No warnings or errors in the browser console on page load.
- [ ] Status badges (lead status, priority) always show a coloured dot
      *and* a word — never colour alone.
