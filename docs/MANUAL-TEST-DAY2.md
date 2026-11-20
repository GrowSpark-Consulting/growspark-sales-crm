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
3. **Expected (D40 — minimal required fields)**: only **Company name**
   carries a `*`; every other visible label has no `*` and no "(optional)"
   suffix — optional is now the unmarked default. The only fields visible
   by default are: Company name, Industry, Website, Business email, Phone,
   Owner. Below them is a collapsed row reading **"More details"** with a
   right-pointing chevron — Legal name, Employee size, Annual revenue, the
   address fields, and Description are **not** visible until you click it.
4. Click **More details**. **Expected**: it expands (chevron rotates down)
   to reveal Legal name, Employee size, Annual revenue, Address line 1/2,
   City, State, Postal code, Country, and Description.
5. Fill in:
   - **Company name \***: `Example Foods Pvt Ltd`
   - **Industry**: `Manufacturing`
   - **Business email**: `hello@examplefoods.test`
   - **Phone**: see §1.2a below before filling this in.
6. Click **Add company** (the submit button at the bottom right).
7. **Expected**: a green success toast appears bottom-right reading
   "Example Foods Pvt Ltd was added.", and you land on
   `http://localhost:3000/companies/<some-id>` — the new company's detail
   page, heading **"Example Foods Pvt Ltd"**.

### 1.2a The phone field (D41 — country code + number, not free text)

1. Look at the **Phone** field on the form you're on. **Expected**: it is
   now two controls side by side — a country-code dropdown (defaulting to
   **+91**) and a plain number box (placeholder "e.g. 98400 12345"), not one
   free-text box.
2. Leave the country code at **+91** and type `98400 12345` (with the
   space) into the number box.
3. Save the company, then reopen its detail page. **Expected**: the Phone
   field in the key-facts strip reads **"+91 98400 12345"** (grouped and
   readable) — never a raw `+919840012345` with no spaces.
4. Edit the company again, open the Phone field. **Expected**: the country
   code shows **+91** and the number box shows `9840012345` (the number
   split back out correctly from what you saved).
5. Try an invalid number: change the number box to `123` (too short) and
   save. **Expected**: an inline error under Phone, and the save is
   blocked. Change it to 11 digits (e.g. `98400123456`) — same result,
   blocked. Change it to a valid 10-digit number starting 6–9 and save
   successfully.

### 1.3 Duplicate hint on company name (warn only, never blocks)

1. Go back to **Companies** in the sidebar, click **Add company** again.
2. In **Company name**, type `Example Foods` (a close variant of the one
   you just created), then click into a different field (e.g. click
   **Industry**) so the Company name field loses focus.
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
3. **Expected (D40 — "More details" opens expanded on edit when it has
   values)**: if this company has nothing in Legal name/Employee size/
   Annual revenue/Address/Description, "More details" opens **collapsed**;
   if it has any one of those filled in, it opens **expanded**
   automatically, with no click needed. Confirm whichever applies to this
   company.
4. Change **Industry** to `Food Processing`, click **Save changes**.
5. **Expected**: toast "Example Foods Pvt Ltd was updated.", and you land
   back on the company's detail page with Industry now showing "Food
   Processing" in the key-fields strip under the title.

### 1.5a New-record forms always open empty (D42)

1. Go to `http://localhost:3000/companies/new`. Type something into
   **Company name** (e.g. `Abandoned Draft`), but do **not** submit.
2. Click **Companies** in the sidebar (navigating away without saving).
3. Click **Add company** again.
   **Expected**: the form is **completely blank** — no trace of
   "Abandoned Draft". If you still see it, that's the exact bug D42 fixed;
   report it.
4. Repeat the same check on `http://localhost:3000/leads/new` (type a
   First name, navigate away via the sidebar, come back) and on **Add
   contact** (type a First name in the dialog, close it with Escape or the
   overlay — not Save — reopen **Add contact**). Both must also open
   blank.

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
   editable — it's locked to this company). **First name** carries a `*`;
   every other field (Last name, Email, Phone, Job title, Department,
   Location, Owner) does not.
6. **D43 check**: fill in only **First name**: `No Contact Info`, leave
   both Email and Phone blank, click **Add contact**.
   **Expected**: the dialog does **not** close; a small grey hint reads
   "Provide an email or a phone number." under Email, and an inline error
   appears once you try to submit. Fill in either Email or Phone and the
   hint disappears immediately (D44-style: only visible while the rule is
   actually unmet).
7. Now fill in **First name**: `Asha`, **Last name**: `Rao`, **Email**:
   `asha.rao@examplefoods.test`. Click **Add contact** (the dialog's submit
   button).
8. **Expected**: toast "Asha Rao was added.", dialog closes, and "Asha Rao"
   now appears in the Contacts tab's table.
9. Repeat steps 4, 7–8 for a second contact: **First name**: `Deepak`,
   **Last name**: `Shah`, **Email**: `deepak.shah@examplefoods.test`.
10. **Expected (the acceptance item)**: both **Asha Rao** and **Deepak
    Shah** are now listed in the company's Contacts tab, each as a link.
11. Click **Asha Rao**'s name in that table.
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
   **Company** field is a real search box, not locked text.
5. Type **First name**: `Priya`, **Phone**: a valid +91 number (country
   code already defaults to +91 — see §1.2a), leave Company blank, click
   **Add contact**.
6. **Expected**: toast, dialog closes, "Priya" appears in the list with no
   company.

### 2.2 The async company picker

1. Click **Add contact** again.
2. Click into the **Company** field and type `Example`.
3. **Expected**: after a brief pause (it waits for you to stop typing
   before searching), a dropdown list appears under the field showing
   "Example Foods Pvt Ltd".
4. Click that result.
5. **Expected**: the field now shows "Example Foods Pvt Ltd" as plain text
   inside the search box.
6. Fill **First name**: `Test Linked Contact`, **Email**:
   `test.linked@example.com`, submit.
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
3. **Expected (D40 labelling)**: **First name** and **Source** carry a `*`;
   every other field (Last name, Company name, Website, Job title,
   Industry, Source detail, Priority, Owner, Estimated budget, Purchase
   timeline, Next follow-up, Requirement, Notes) does not.
4. **Expected (D44 — hint only shown while unmet)**: with both Email and
   Phone still blank, a small grey hint under Email reads "Provide an
   email or a phone number." Type anything into either field and the hint
   disappears immediately — it should never stay visible once the rule is
   satisfied.
5. Clear both again (so neither has a value) and leave **First name**
   filled in (e.g. `Ravi`). Click **Add lead**.
   **Expected**: the form does **not** submit; an inline red error appears
   under the **Email** field reading "Provide an email or a phone number."
6. Fill in **Phone**: a valid +91 number (country code defaults to +91 —
   see §1.2a for the two-part phone field) only, still no email. Click
   **Add lead** again.
   **Expected**: this time it submits successfully — a phone alone is
   enough. Toast "Ravi was added.", and you land on the new lead's detail
   page.
7. Go back to **Leads** → **Add lead** and try submitting with **First
   name** left blank entirely (but a valid email filled in).
   **Expected**: inline error under **First name**.

### 3.2 Source defaults to "Manual" (D40 — never forces an explicit choice)

1. On a fresh **Add lead** form, look at **Source** *before* clicking
   anything in it.
   **Expected**: it already shows **"Manual"** — not a blank "Select a
   source" placeholder. You were never forced to make an explicit choice.
2. Open the dropdown and confirm **Manual** is one of several real options
   (e.g. Website, Referral, LinkedIn, Event, Cold outreach, Import) — it's
   just the one preselected by default, not the only one available.
3. Pick a different source (e.g. "Referral"), fill in First name and
   Email, and submit successfully — confirm the lead saved with
   "Referral", not "Manual" (check its detail page).
4. Open **Add lead** again fresh. **Expected**: Source is back to
   "Manual" by default — your earlier change on a *different* lead did not
   persist as a new default.

### 3.3 Duplicate warning banner (acceptance item — never blocks)

1. Note the email address of the lead you created in §3.1 step 6 (or
   create one now with a known email, e.g. `duplicate-test@example.com`,
   plus any phone).
2. Go to **Leads** → **Add lead**.
3. Fill **First name**: `Second Lead`, **Email**: the **same** email
   address as an existing lead (e.g. `duplicate-test@example.com`), leave
   **Source** at its "Manual" default, then click into another field so
   the Email field loses focus.
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
   with a timestamp, **and now also "by <your name>"** (e.g. "by Test
   Admin") on the same row (D44 — the actor, not just the from/to statuses
   and a timestamp).
6. Change the status one more time (e.g. to **Contacted**) and check the
   History tab again — it should now show **two** rows, newest first, each
   still showing who made that particular change.
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

### Package 2.7 (D40–D44), re-verified this round

- [ ] **§1.2 / §1.6 / §3.1**: every required field is marked `*`; no field
      anywhere still says "(optional)".
- [ ] **§1.2**: Company's "More details" section is collapsed by default on
      create, and on edit only opens automatically when it already has a
      value in one of its fields (§1.5 step 3).
- [ ] **§1.2a**: the Phone field is a country-code select (defaulting
      +91) plus a number box everywhere it appears (Company, Contact,
      Lead); an invalid number (wrong length, wrong starting digit for
      +91) is rejected; a saved number displays grouped
      ("+91 98400 12345"), never as raw digits.
- [ ] **§1.5a**: a fresh Add company / Add lead / Add contact always opens
      blank, even right after visiting it, abandoning a draft, and coming
      back.
- [ ] **§1.6 step 6 / §2.1**: Contacts now require an email or a phone,
      the same rule Leads already had.
- [ ] **§3.2**: Lead's Source defaults to "Manual" without any click
      needed, and never overrides a source you explicitly picked.
- [ ] **§3.1 / §1.6 step 6**: the "provide an email or a phone" hint is
      visible only while the rule is actually unmet, on both the Lead form
      and the Contact dialog.
- [ ] **§3.5 step 5**: each History row names who made that status change,
      not just the from/to statuses and a timestamp.

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
