# Manual test script — Day 6a (Settings, Global search, CSV import)

Written for someone who has never used this app before. This environment
has no browser-automation tool, so none of this has been clicked through by
the person who wrote it — if a step doesn't match reality, that's a real
bug to report, not a typo in this script.

Do not check any box until it has actually been done in a real browser.

## 0. Before you start

- [ ] No migration is needed for Day 6a. From the repo root run
      `pnpm typecheck && pnpm lint && pnpm test` (expected counts are in
      `docs/PROJECT-STATE.md` §1, latest entry).
- [ ] Start native dev with `pnpm dev`, open `http://localhost:3000`.
- [ ] You need two accounts: an **Admin** and a **Staff** user (create the
      Staff user on the **Users** page if you don't have one). Use a second
      browser, or a private window, for the second account.

## 1. Settings — as Admin

### 1.1 The Settings page

1. [ ] Sign in as **Admin**. In the left sidebar, click **Settings** (the
       last item). **Expected**: a page titled "Settings" with a
       **Personal** section (one card, "My profile") and an
       **Administration** section with six cards: Organisation, Lead
       sources, Pipeline stages, Users, API keys, Audit log.
2. [ ] Click **Users**, **API keys** and **Audit log** in turn (use the
       browser's Back button between them). **Expected**: each opens the
       same page it always did.

### 1.2 Organisation profile

1. [ ] Settings → **Organisation**. **Expected**: a form in three boxes
       (Organisation, Address, Contact details) filled with whatever is
       stored, and a fourth box "Regional settings" showing Currency `INR`
       and Time zone `Asia/Kolkata` as plain text (not editable).
2. [ ] Type GSTIN `33abcde1234f1z5` (lower case on purpose), City
       `Chennai`, click **Save changes**. **Expected**: a green "Organisation
       details saved." message, and the GSTIN now reads `33ABCDE1234F1Z5`.
3. [ ] Change GSTIN to `1234`, click **Save changes**. **Expected**: a red
       message under GSTIN, "Not a valid 15-character GSTIN"; nothing saved.
       Put the valid one back.
4. [ ] Empty the **Display name** box and save. **Expected**: "Organisation
       name is required". Put the name back and save.
5. [ ] Open any quotation and click **Download PDF**. **Expected**: the
       header shows the details you just saved.
6. [ ] Settings → **Audit log**. **Expected**: a row "organization.
       details_updated" by you, listing the field names that changed (never
       the values).

### 1.3 Lead sources

1. [ ] Settings → **Lead sources**. **Expected**: a table of sources with
       up/down arrows, a Status badge, a Leads count, and "Website",
       "Manual" and "Import" each marked **System** with no Rename or
       Deactivate buttons.
2. [ ] Click **Add source**, type `Trade show`, click **Add**. **Expected**:
       it appears at the bottom, Active, 0 leads.
3. [ ] Click **Add source** again and type `trade SHOW`. **Expected**: a red
       message "A lead source called "Trade show" already exists."
4. [ ] On "Trade show", click the **up arrow** twice. **Expected**: it moves
       up two rows. Go to **Leads → New lead** and open the **Source**
       list. **Expected**: the same order.
5. [ ] Back in Settings → Lead sources, click **Rename** on "Trade show",
       change it to `Trade fair`, **Save**. **Expected**: the new name.
6. [ ] Create a lead with Source **Trade fair** (Leads → New lead). Then in
       Settings click **Deactivate** on "Trade fair" and confirm.
       **Expected**: Status "Inactive", Leads count 1, a **Reactivate**
       button.
7. [ ] Leads → New lead → open **Source**. **Expected**: "Trade fair" is
       **not** offered.
8. [ ] Open the lead you made in step 6. **Expected**: its Source still
       reads "Trade fair". Click **Edit**. **Expected**: Source shows "Trade
       fair (inactive)". Change only the Job title and **Save**.
       **Expected**: it saves normally.
9. [ ] Settings → Lead sources → **Reactivate** "Trade fair". **Expected**:
       Active again, offered on New lead again.

### 1.4 Pipeline stages

1. [ ] Settings → **Pipeline stages**. **Expected**: the open stages first
       (with up/down arrows), then **Won** and **Lost** (no arrows, no
       Delete). Each row shows its probability and how many deals are in it.
2. [ ] Click **Add stage**, name `Contract sent`, Probability `90`, **Add**.
       **Expected**: it appears as the last open stage, just above Won.
3. [ ] Go to **Deals** and switch to **Board**. **Expected**: a "Contract
       sent" column before the closed stages.
4. [ ] Back in Settings, **Edit** "Contract sent" → name `Contract issued`,
       probability `85`, **Save**. **Expected**: both updated.
5. [ ] Click **Edit** on **Won**. **Expected**: Probability shows 100 and
       cannot be changed. Rename it to `Closed won`, **Save**. Check the
       Deals board/close dialog wording. Rename it back to `Won`.
6. [ ] On "Contract issued" click the **up arrow**. **Expected**: it moves
       above Negotiation. On the Deals board, the columns follow.
7. [ ] Find a stage that has deals (Deals count above 0). **Expected**: its
       **Delete** button is greyed out. Hover it: "Deals have been in this
       stage, so it cannot be deleted. Rename it instead."
8. [ ] On "Contract issued" (no deals) click **Delete**, confirm.
       **Expected**: it disappears and the remaining stages close up.
9. [ ] Move the first open stage (e.g. Qualification) down one place.
       Create a new deal. **Expected**: the new deal starts in whichever
       stage is now first. Move it back afterwards.
10. [ ] Settings → **Audit log**. **Expected**: rows for each stage and
        source change you made, by you.

## 2. Settings — as Staff

1. [ ] Sign in as **Staff** (second browser). Click **Settings**.
       **Expected**: only the **Personal** section with "My profile".
2. [ ] Type `http://localhost:3000/settings/organization` into the address
       bar. **Expected**: you land on the "Forbidden" page. Same for
       `/settings/lead-sources` and `/settings/pipeline`.

## 3. My profile and change password (do this with both accounts)

1. [ ] Settings → **My profile**. **Expected**: your name, email and role
       (Admin or Staff Executive), not editable.
2. [ ] Under **Change password**, type a **wrong** current password and a
       valid new one twice, click **Change password**. **Expected**: a red
       "Current password is incorrect" — and you are **still signed in**
       (you are not sent to the login page).
3. [ ] Type the right current password, but two **different** new
       passwords. **Expected**: "The two new passwords do not match";
       nothing is sent.
4. [ ] Sign in to the same account in a **second** browser. In the first
       browser, change the password properly. **Expected**: a green
       "Password changed. You have been signed out everywhere else." and you
       stay signed in in the first browser.
5. [ ] In the second browser, click anything. **Expected**: you are sent to
       the login page. The **old** password no longer works; the new one
       does.

## 4. Global search (both roles)

You need some sample records whose names share a word, e.g. a lead, a
company with a contact, a deal and a quotation all mentioning "Zephyr".

1. [ ] Sign in. **Expected**: a search box in the top bar, left of the bell,
       showing "Search…  Ctrl+K".
2. [ ] Click it and type one letter, `z`. **Expected**: a small panel saying
       "Type at least 2 characters"; no results.
3. [ ] Type `ze`. **Expected**: after a moment, results grouped under
       headings — Leads, Contacts, Companies, Deals, Quotations (only the
       groups that have matches), each row a name with a grey second line
       (company, email, stage…).
4. [ ] Type a person's first and last name with a space (e.g. `asha rao`).
       **Expected**: that person is found.
5. [ ] Type a quotation number (e.g. `Q-2026-0001`). **Expected**: it
       appears under Quotations.
6. [ ] Press **↓** a few times. **Expected**: the highlight moves down
       through the rows and across group headings; **↑** from the top jumps
       to the last row. Press **Enter**. **Expected**: that record opens and
       the search box empties.
7. [ ] Click anywhere on the page (not in a text box) and press **/**.
       **Expected**: the cursor jumps into the search box. Press **Ctrl+K**
       from anywhere — same.
8. [ ] Inside any other text box (e.g. a lead's notes), type a `/`.
       **Expected**: the `/` is typed there; the cursor does **not** jump.
9. [ ] Search for something, then press **Esc**. **Expected**: the panel
       closes, your text stays. Press **Esc** again. **Expected**: the box
       empties.
10. [ ] Create 6 or more leads sharing a word (e.g. `Banyan 1` … `Banyan 6`)
        and search `banyan`. **Expected**: 5 leads, then "See all matching
        leads →". Click it. **Expected**: the Leads list filtered by
        `banyan`.
11. [ ] Archive one of those leads and search again. **Expected**: the
        archived lead is no longer offered.
12. [ ] Type `%%`. **Expected**: "No matches" (not every record).
13. [ ] Sign in as **Staff** and repeat steps 3 and 6. **Expected**: the
        same kinds of results (Staff can see every record, as in the lists).
14. [ ] Use the search in both Light and Dark theme (user menu → Theme).
        **Expected**: the panel is readable, the highlighted row visible.

## 5. CSV import (leads and contacts)

Use only fictional data. Make the small files below in Excel or Notepad and
save them as **CSV UTF-8** (Excel: File → Save As → "CSV UTF-8 (Comma
delimited)").

### 5.1 The sample file

1. [ ] Go to **Leads** and click **Import CSV** (next to Download CSV).
       **Expected**: a page titled "Import Leads", step "1. Choose a CSV
       file", and a **Download a sample file** button.
2. [ ] Click **Download a sample file** and open it in Excel. **Expected**:
       two fictional leads, columns First name, Last name, Email, Phone,
       Company, Job title, Source, Priority, Requirement.
3. [ ] Back in the app, click **Choose CSV file** and pick that sample file.
       **Expected**: step "2. Match the columns", every column already
       matched to the field of the same name, and the first value of each
       column shown.
4. [ ] Click **Check rows**. **Expected**: step 3 with "Ready to import 2".
       Click **Import 2 leads**. **Expected**: "Import finished — 2 leads
       imported". Click **Go to leads**: both are there, status New.
5. [ ] Import the **same file again**. **Expected**: in step 3 both rows are
       "Duplicate" ("A lead with this email already exists"), and the button
       reads "Import 0 leads" and cannot be clicked.

### 5.2 A messy leads file

Make a file with exactly these lines:

```
Full Name,E-mail,Mobile,Organisation,Lead source,Favourite colour
Asha Test,asha.test@example.test,98400 12345,"Rao, Test & Co",Referral,Teal
Ravi Test,ravi.test@example.test,,=SUM(1+1),Billboard,
,,,,,
Meera Test,not-an-email,,,,
Karthik Test,,12345,,,
Nisha Test,nisha.test@example.test,,,,
Nisha Again,NISHA.TEST@example.test,,,,
```

1. [ ] Import it. **Expected** in step 2: Full Name → Full name, E-mail →
       Email, Mobile → Phone, Organisation → Company, Lead source → Source,
       Favourite colour → Don't import.
2. [ ] Click **Check rows**. **Expected** in step 3: Ready 3, Duplicates 1,
       Errors 2, Blank rows ignored 1, and a note that "Favourite colour" is
       kept on each lead. In the table:
       - Ravi: Ready, with a grey note that "Billboard" is not an active
         lead source and will be saved as "Import".
       - Meera: Error — "Email "not-an-email" is not a valid email address."
       - Karthik: Error — the phone "12345" is not recognisable.
       - Nisha Again: Duplicate — "Same email as row 7".
3. [ ] Click the **Errors (2)** tab. **Expected**: only Meera and Karthik.
4. [ ] Click **Import 3 leads**. **Expected**: 3 imported, 1 duplicate, 2
       errors, and a **Download the 3 skipped rows** button. Click it and
       open the file in Excel. **Expected**: columns Row, Result, Problem,
       then your original columns, one line per skipped row.
5. [ ] Open the lead **Asha Test**. **Expected**: company "Rao, Test & Co",
       phone +91 98400 12345, source Referral, and "Favourite colour: Teal"
       under "Other captured answers".
6. [ ] Open **Ravi Test**. **Expected**: the company shown literally as
       `=SUM(1+1)` (not calculated to 2), source "Import", source detail
       "Billboard".
7. [ ] Settings → **Audit log**. **Expected**: one "import.completed" row
       for this import (not one row per lead), showing the counts.
8. [ ] Check the bell. **Expected**: no notification per imported lead.

### 5.3 Contacts and companies

Make this file, replacing the placeholder with the exact name of a company
that already exists in your CRM:

```
Name,Email,Company,Title
Meera Contact,meera.contact@example.test,EXISTING COMPANY NAME,Finance Manager
Karthik Contact,karthik.contact@example.test,Brand New Test Co,Plant Manager
Divya Contact,divya.contact@example.test,BRAND NEW TEST CO,Buyer
```

1. [ ] **Contacts → Import CSV**, choose the file, **Check rows**.
       **Expected**: Ready 3, and "New companies that will be created (1):
       Brand New Test Co". Karthik and Divya show a "New" badge next to the
       company; Meera does not.
2. [ ] Import. **Expected**: "3 contacts imported, 1 new company created".
3. [ ] Open **Companies**. **Expected**: exactly one "Brand New Test Co",
       with Karthik and Divya on its Contacts tab; Meera is on the existing
       company's Contacts tab.

### 5.4 Limits and broken files

1. [ ] Try a file larger than 1 MB. **Expected**: "The file is larger than
       1 MB" straight away.
2. [ ] Try a file whose header row is `Foo,Bar`. **Expected**: step 2 with
       both columns on "Don't import"; **Check rows** shows "Choose a column
       for First name or Full name" and "Choose a column for Email or Phone".
3. [ ] Try an empty file. **Expected**: "The file is empty."
4. [ ] Export your leads (Leads → Download CSV) and import that file into
       Contacts. **Expected**: phone numbers are recognised (not errors).
5. [ ] Sign in as **Staff** and import a small leads file. **Expected**: it
       works the same (Staff can create leads and contacts).
