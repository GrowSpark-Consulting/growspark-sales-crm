# Grow Spark Sales & CRM — User Guide

Version: November 2026. Written for someone evaluating the app, not for developers.

## Contents

1. [What the app is](#1-what-the-app-is)
2. [Feature map](#2-feature-map)
3. [Signing in, users and passwords](#3-signing-in-users-and-passwords)
4. [Home, Today and My Tasks](#4-home-today-and-my-tasks)
5. [Leads](#5-leads)
6. [Companies and Contacts](#6-companies-and-contacts)
7. [Deals and the pipeline](#7-deals-and-the-pipeline)
8. [Form submissions inbox and the website form](#8-form-submissions-inbox-and-the-website-form)
9. [Quotations](#9-quotations)
10. [Notifications](#10-notifications)
11. [Reports](#11-reports)
12. [Global search](#12-global-search)
13. [Settings, Users, API keys and Audit log](#13-settings-users-api-keys-and-audit-log)
14. [Good to know](#14-good-to-know)
15. [Likely evaluator questions](#15-likely-evaluator-questions)
16. [Technical overview](#16-technical-overview)
17. [PRD coverage](#17-prd-coverage)
18. [5-minute demo walkthrough](#18-5-minute-demo-walkthrough)

---

## 1. What the app is

Grow Spark Sales & CRM is a web app for the sales team. It covers the whole
journey from first form submission to won deal:

**form submission → lead → company and contact → deal → quotation → Won or Lost → reports.**

It runs in a normal web browser. Grow Spark Consulting is the first
organisation using it. Amounts are in Indian rupees (₹) and dates use India
time.

There are two roles. Both do everyday sales work. Only Admins manage people
and settings.

| | Admin | Staff (shown as "Staff Executive") |
| --- | --- | --- |
| Leads, companies, contacts, deals, activities | Yes | Yes |
| Quotations, form submissions, reports, CSV export and import | Yes | Yes |
| Home dashboard, Today, My Tasks, search, notifications | Yes | Yes |
| My profile, change own password | Yes | Yes |
| Users (add, edit, deactivate, reset passwords) | Yes | No |
| Organisation profile, lead sources, pipeline stages | Yes | No |
| API keys, Audit log | Yes | No |

Staff can see every record, not only their own. "Owner" shows who is
responsible for a record. It does not hide it from others.

---

## 2. Feature map

Every screen in the app. "Menu" is the left sidebar unless stated.

| Screen / feature | Where to find it | Admin | Staff | What it does |
| --- | --- | --- | --- | --- |
| Sign in | Login page | Yes | Yes | Email and password sign-in. |
| Home | Menu → **Home** | Yes | Yes | Dashboard: 9 key numbers, 4 charts, recent activity. |
| Today | Menu → **Today** | Yes | Yes | What needs attention today, in 7 cards. |
| My Tasks | Menu → **My Tasks** | Yes | Yes | Your open, overdue and done tasks, calls and meetings (or anyone's). |
| Leads | Menu → **Leads** | Yes | Yes | List, add, edit, qualify, convert and archive leads. |
| Import leads | Leads → **Import CSV** | Yes | Yes | Load leads from a CSV file. |
| Companies | Menu → **Companies** | Yes | Yes | Company records with contacts, deals, quotations and timeline. |
| Contacts | Menu → **Contacts** | Yes | Yes | People, linked to a company. |
| Import contacts | Contacts → **Import CSV** | Yes | Yes | Load contacts from a CSV file (creates missing companies). |
| Deals | Menu → **Deals** | Yes | Yes | Deals as a **List** or a **Board** (pipeline). |
| Quotations | Menu → **Quotations** | Yes | Yes | Priced quotations with a GST rate per line, PDF download and statuses. |
| Form submissions | Menu → **Form submissions** | Yes | Yes | Inbox of website form submissions (called Enquiries in earlier versions). |
| Reports | Menu → **Reports** | Yes | Yes | Five ready-made reports, each downloadable as CSV. |
| Notifications | Bell icon, top right | Yes | Yes | Your own alerts (assignments, form submissions, quotations, tasks). |
| Global search | Search box, top bar (Ctrl+K or /) | Yes | Yes | Find leads, contacts, companies, deals and quotations. |
| Theme and Log out | Your name, top right | Yes | Yes | Light, Dark or System theme; sign out. |
| Settings | Menu → **Settings** | Yes | Yes (My profile only) | Hub for profile and admin settings. |
| My profile | Settings → **My profile** | Yes | Yes | Your details; change your password. |
| Organisation | Settings → **Organisation** | Yes | No | Name, address, GSTIN, contact details printed on quotations. |
| Lead sources | Settings → **Lead sources** | Yes | No | Add, rename, reorder, deactivate lead sources. |
| Pipeline stages | Settings → **Pipeline stages** | Yes | No | Add, rename, reorder, delete deal stages and probabilities. |
| Users | Menu → **Users** (or Settings) | Yes | No | Add users, change roles, deactivate, reset passwords. |
| API keys | Menu → **API Keys** (or Settings) | Yes | No | Keys the website uses to send form submissions in. |
| Audit log | Menu → **Audit Log** (or Settings) | Yes | No | Who changed what, and when. |
| Forbidden page | Shown automatically | — | — | Appears if someone opens a page their role cannot use. |

Behind the scenes the app has 19 permissions. Staff hold every permission
except three: managing users, reading the audit log, and managing settings
(which includes API keys).

---

## 3. Signing in, users and passwords

**Signing in**

1. Open the app's web address.
2. Type your **Email** and **Password**, click **Sign in**.
3. A wrong password shows a general error. It never says whether the email
   exists. After several failed attempts the app asks you to wait.

To sign out, click your name (top right) → **Log out**. A session lasts up
to 7 days. It is extended while you keep using the app.

**New users (Admin only)**

There is no public sign-up and no email invitation. An Admin creates each
account:

1. Menu → **Users** → **New user**.
2. Enter **Name**, **Email**, **Role** (Admin or Staff) and an **Initial
   password** (at least 10 characters). Click **Create user**.
3. Give the person their password yourself, in person or by phone.

On the Users list an Admin can also click **Edit** (name, email, role),
**Reset password**, and **Deactivate** / **Reactivate**. A deactivated
person is signed out at once. The app will not let you remove or demote
the last active Admin.

**Changing your own password**

1. Menu → **Settings** → **My profile**.
2. Under **Change password**, enter **Current password**, **New password**
   and **New password again**. Click **Change password**.
3. You stay signed in here. You are signed out on every other device.

Forgot your password? Ask an Admin to use **Reset password** on the Users
page. There is no "forgot password" email.

---

## 4. Home, Today and My Tasks

**Home** (the dashboard)

- Nine numbers: **Leads created**, **Qualified leads**, **Active leads**,
  **Open deals**, **Open pipeline value**, **Weighted value**, **Won
  revenue**, **Win rate**, **Overdue tasks**.
- Four charts: **Leads by source**, **Leads by status**, **Pipeline by
  stage**, **Monthly won revenue**. Plus a **Recent activity** list.
- **Date range**: **This month**, **Last 30 days** or **Custom range**.
- **All** / **Mine**: everyone's records, or only the ones you own or are
  assigned.

Open deals and pipeline value always show "right now". They ignore the date
range.

**Today**

One card per question: **Overdue**, **Tasks due today**, **Meetings this
week**, **New leads**, **Deals closing soon** (next 14 days), **Deals with
no next activity**, **Recently updated deals**.

- **Mine** (default) or **All** at the top.
- Click a row to open the record. Click **Complete** to tick off a task.
  Click **Add follow-up** to schedule the next step.

**My Tasks**

- Tabs: **Open**, **Overdue**, **Done**.
- **Assigned to**: **Assigned to me** (the default), **Everyone**, or one
  colleague by name. When the list is not only yours, an **Assigned to**
  column shows whose each item is ("You", a name, or "Unassigned").
- Filters: **Any type**, **Any priority**, **Due from**, **Due to**.
- **Complete** or **Cancel** an item from the list.

The choice stays in the web address, so a refresh or a shared link keeps
it. A new activity is assigned to the person who creates it unless they
pick someone else.

**Adding activities (all record pages)**

Every lead, company, contact and deal page has a **Timeline** tab with an
**Add activity** box:

1. Pick **Task**, **Call**, **Meeting** or **Note**.
2. Type a **Subject**. Add a due date (or start and end times for a
   meeting), **Priority**, **Assignee** and **Description** if useful.
3. Click **Save activity** (or **Save note**).

An activity added to a deal also shows on its company's and contacts'
timelines.

---

## 5. Leads

A lead is a possible customer who has not yet been qualified.

**Add a lead**

1. Menu → **Leads** → **Add lead**.
2. Fill in the required fields: **First name \***, **Company name \***, and
   an **Email** or a **Phone** (one of the two; until one is filled the form
   says "Provide an email or a phone number.").
3. Everything else is optional: last name, website, job title, industry,
   **Source**, **Priority**, **Owner**, budget, timeline, **Next
   follow-up**, **Requirement**, **Notes**. **Source** starts as **Not
   specified (saved as Manual)**.
4. Click **Add lead**.

**Typing a phone number** (the same box on leads, contacts, companies and
Settings → Organisation)

- Pick the country on the left. **India (+91)** is the default.
- Type the number without the leading 0. Only digits are accepted.
- An Indian number has exactly 10 digits (mobiles and landlines with their
  area code). Once the box is full, extra digits can't be typed, and a short
  note appears under the box, for example "India (+91) numbers have at most
  10 digits."
- Pasting "+91 98400 12345" or "098400 12345" is tidied up automatically.
  A pasted number that is too long is refused rather than cut short.
- A number that is too short shows a message such as "Enter all 10 digits
  of the number for India (+91)".

If the email, phone or company name matches an existing lead, a yellow
**"This might already exist."** box appears with a link. It is a warning
only. You can still save.

**Edit, owner and status**

- Click **Edit**, change fields (including **Owner**), click **Save
  changes**. The Requirement cannot be changed after creation, so the
  original enquiry is kept. An older lead saved without a company name
  asks for one when you edit it.
- On the **Overview** tab, under **Change status**, click **New**,
  **Contacted**, **Qualified** or **Unqualified**. The current status is
  highlighted with a tick. While saving, the clicked button shows a spinner
  and all the buttons are locked; then a message "Status changed to …"
  appears. The same feedback is used for quotation, deal, task and form
  submission status buttons.
- The **History** tab lists every status change, who made it and when.

**Convert a lead**

Only a **Qualified** lead can be converted. Otherwise the **Convert**
button is greyed out ("Qualify the lead first").

1. Click **Convert**.
2. **Company**: **Link existing** (suggested if one matches) or **Create
   new**.
3. **Contact**: **Link existing** or **Create new** (made from the lead's
   name, email and phone).
4. **Deal**: leave **Create a deal** on to start a deal in the first
   pipeline stage. Adjust **Deal name**, **Value (₹)** and **Expected close
   date** if needed.
5. Click **Convert lead**. Links to the new or linked records appear.

The lead stays in the system with status **Converted**, its history and a
**Converted** panel linking to what it became.

**Archive, filters, export and import**

- **Archive** hides a lead from the list. Nothing is permanently deleted.
  Switch the last filter to **Archived** to see it, then click **Restore**.
- Search box plus filters: **Any status**, **Any source**, **Any
  priority**, **Any owner**, a created-date range. Click a column heading
  to sort. Filters stay in the web address, so a filtered view can be
  bookmarked.
- **Download CSV** exports exactly what the current filters show.
- There are no bulk actions (for example, selecting several leads to
  reassign them at once). This was agreed for this version.

**Import leads from a CSV file**

1. Leads → **Import CSV**. Optional: **Download a sample file**.
2. Click **Choose CSV file** (CSV only, up to 1 MB and 1,000 rows). From
   Excel, use File → Save As → CSV UTF-8.
3. **Match the columns**: the app guesses each one. Change any column, or
   set it to **Don't import**. Unused columns are still saved on the lead
   as "Other captured answers". Each row needs a first name, a company and
   an email or phone, so one column must be matched to **Company**.
4. Click **Check rows**. Every row is marked **Ready**, **Duplicate** (same
   email as an existing lead, or earlier in the file) or **Error** (with
   the reason).
5. Click **Import N leads**. You can download the skipped rows with their
   reasons.

---

## 6. Companies and Contacts

**Companies**

1. Menu → **Companies** → **Add company**. Only **Company name** is
   required. Click **More details** for legal name, size, revenue, address
   and description.
2. Click **Add company**.

A company page has tabs: **Overview**, **Contacts**, **Deals**,
**Quotations**, **Timeline**. You can add a contact, deal or quotation
straight from its tab.

**Contacts**

1. Menu → **Contacts** → **Add contact** (a pop-up form).
2. Required: **First name \***, **Company \*** and an email or phone.
3. Click the **Company** box: it lists the first 20 companies A–Z straight
   away. Type to narrow the list, then click one (or use the arrow keys
   and **Enter**).
4. Click **Add contact**.

A contact's company can be changed later but not removed. Every company
picker in the app (deals, quotations, converting a lead) and the contact
picker on quotations and deals work the same way.

A contact page has **Overview**, **Deals** and **Timeline** tabs. Click
**Edit** to change it.

Both lists have search, an owner filter, **Archive** / **Restore** and
**Download CSV**. Contacts also has **Import CSV**; every row needs a
company. A company name in the file that doesn't exist yet is created once,
and the preview lists it first.

---

## 7. Deals and the pipeline

A deal is a sales opportunity with a value.

**Add a deal**: Menu → **Deals** → **Add deal**. Enter **Deal name**,
**Company**, **Stage**, **Value**, **Owner** and expected close date. Click
**Add deal**.

**List and Board**

- **List**: a table with search and filters (stage, status, owner, and an
  **Any company** box you can type in) and **Download CSV**.
- **Board**: one column per open stage, with totals. Move a card by
  dragging it, or with its **Move to…** button.

**On a deal page**

- Key facts: Stage, Value, Probability, **Weighted value** (value ×
  probability), Expected close, Owner, Next activity.
- **Move stage**: pick another open stage. Each move is recorded on the
  **Stage history** tab.
- **Contacts** tab: **Add contact**, **Make primary**, remove.
- **Close as Won**: probability becomes 100%.
- **Close as Lost**: you must pick a **Lost reason** (Price, Competitor, No
  budget, No decision, Timing, Not a fit, Unresponsive, Other) and can add
  a note. Probability becomes 0%.
- A closed deal is read-only. **Reopen** sends it back to the first open
  stage.
- **Archive** / **Restore** work on open or closed deals.

The stages and their probabilities are set in Settings → Pipeline stages
(Admin only). There is one pipeline.

---

## 8. Form submissions inbox and the website form

**How the website form feeds the CRM**

The Grow Spark website's contact form is connected (live since 25 November
2026). Every form submission is forwarded to the CRM, using an API key. This is in
addition to the website's own saving, emails and HubSpot flow, which are
unchanged. If the CRM is asleep or down, the website still works.

When a form submission arrives, the CRM:

- stores it exactly as received,
- creates a lead with source **Website**, unless it has no email or phone
  (then it is kept as **Rejected**, with the reason). A website lead does
  not need a company name,
- quietly marks obvious bot submissions as **Spam**,
- ignores a repeat of the same submission, so retries never create
  duplicates,
- notifies every active user.

**Using the inbox**

1. Menu → **Form submissions**. Filter by status (**Received**, **Lead created**,
   **Rejected**, **Spam**), form type or date.
2. Open a submission. **Overview** shows the details and a link to its lead.
   **Raw payload** shows exactly what the website sent.
3. **Mark as spam**: also archives the lead it created.
4. **Archive** hides it. **Restore** brings it back.

There is no read/unread marker; use the status and **Archive** instead.
This was agreed for this version. The old web address `/enquiries` still
works: it forwards to `/form-submissions`, so saved links are not broken.

---

## 9. Quotations

**Create a quotation**

1. Menu → **Quotations** → **New quotation** (or from a company's or deal's
   **Quotations** tab).
2. Choose **Company**, then **Contact** (only that company's people), and
   optionally a **Deal**. Each box lists its options as soon as you click
   it.
3. **Issue date** defaults to today. **Valid until** defaults to 30 days
   later.
4. Add **Line items**: **Description**, **Qty**, **Unit price (₹)**,
   optional **Disc. %** and a **GST %** for each line (default 18; type any
   rate from 0 to 100, for example 0, 5, 12, 18, 28 or 0.25; **0** means no
   GST). Click **Add line** for more. There is no discount or GST for the
   whole quotation any more: discount and GST are set line by line.
5. Next to the totals, choose **Prices are: Tax exclusive** (default: GST is
   added on top of the prices you type) or **Tax inclusive** (the prices you
   type already include GST, and the GST is worked out from them). Add
   **Terms** and **Notes** if needed.
6. The totals box updates as you type: **Subtotal** (before GST), one **GST**
   row for each rate used (for example "GST 5%" and "GST 12.5%"), and
   **Total**. Each line's **Amount** is what that line costs the customer.
   Click **Create quotation**.

Each quotation gets a number like **Q-2026-0001**. The numbers restart
each year.

**PDF**: click **Download PDF**. It shows your organisation's details (from
Settings → Organisation), the customer, the lines (with each line's GST %)
and the totals with one GST row per rate. When prices include GST it says
**"Prices are inclusive of GST"**. Each edit makes a new version (…-v1,
…-v2). PDFs downloaded earlier are not changed.

**Example**: 1 × ₹1,000 at 18%. Tax exclusive: GST ₹180, total ₹1,180. Tax
inclusive: ₹847.46 + GST ₹152.54 = ₹1,000.

Quotations made before this change kept their totals exactly: each line got
its quotation's old GST rate, and an old quotation-wide discount was folded
into every line's discount.

**Statuses**

- The current status is the highlighted button under **Change status**
  (top of the page). Only the allowed next steps appear beside it. While a
  change is saving, a small spinner shows and the buttons are locked so it
  cannot be sent twice; a message "Status changed to …" confirms it.
- **Draft** → click **Mark as sent** → **Sent**. A draft whose Valid until
  date has passed can't be sent until you change the date.
- **Sent** → **Accepted** or **Rejected**. Both are final.
- **Expired**: a Sent quotation past its Valid until date becomes Expired
  automatically.
- When you accept a quotation linked to an open deal, the app asks **"Mark
  the deal as Won?"**. Choose **Mark deal as Won** or **Not now**.

Only drafts can be edited. **Duplicate** makes a new draft copy with a new
number (useful after a rejection). **Archive** / **Restore** as elsewhere.

---

## 10. Notifications

The bell (top right) shows how many unread notifications you have. It
checks about once a minute. Click it to open **Notifications**: **All** or
**Unread**, **Mark read** on one row, or **Mark all as read**. Click a
title to open the record.

You are notified when:

- a lead or deal is assigned to you by someone else,
- a website form submission arrives (everyone is told),
- a quotation you own is accepted or rejected by someone else,
- a task assigned to you is due today or overdue (checked when you open the
  app).

You only see your own notifications. There are no emails.

---

## 11. Reports

Menu → **Reports**. Use the same **Date range** and **All** / **Mine**
controls as Home. Five reports, each with a table, a **Total** row and a
**Download CSV** button:

1. **Pipeline by stage**: open deals right now (ignores the date range).
2. **Lead sources and conversion**: leads created in the range, by source,
   and how many converted.
3. **Sales performance by owner**: deals won (count and value), lost, win
   rate.
4. **Quotations summary**: quotations issued in the range, by status.
5. **Overdue tasks by assignee**: open items due before today with a due
   date inside the range. For all overdue items, pick a wide custom range.

Reports and Home use the same calculations, so their numbers agree.

---

## 12. Global search

The **Search…** box sits in the top bar on every page.

1. Click it, or press **Ctrl+K** (⌘K on Mac) or **/**.
2. Type at least 2 characters. Results appear grouped: Leads, Contacts,
   Companies, Deals, Quotations (up to 5 each).
3. Use the **↑** and **↓** keys and **Enter**, or click a result. If a
   group has more, click **See all matching …**.
4. **Esc** closes the results. Press **Esc** again to clear the box.

Each word must match, so "asha rao" finds Asha Rao. Archived records are
not shown.

---

## 13. Settings, Users, API keys and Audit log

Menu → **Settings**. Staff see only **My profile**. Admins also see an
**Administration** section.

- **Organisation** (Admin only): display name, legal name, GSTIN, address,
  phone (same rules as section 5), email, website. These print on
  quotation PDFs. Currency (INR) and
  time zone (Asia/Kolkata) are shown but cannot be changed.
- **Lead sources** (Admin only): **Add source**, **Rename**,
  **Deactivate** / **Reactivate**, reorder with the arrows. "Website",
  "Manual" and "Import" are **System** sources and cannot be changed. A
  deactivated source stays on old leads but is no longer offered.
- **Pipeline stages** (Admin only): **Add stage**, **Edit** (name and
  probability), reorder open stages, **Delete** (only for a stage no deal
  has ever used). Won (100%) and Lost (0%) are always last. New deals start
  in the first open stage.
- **Users** (Admin only): see section 3.
- **API keys** (Admin only): **New API key** → name → **Create key**. The
  full key is shown **once only**, so copy it then. **Rotate** issues a new
  key and stops the old one. **Revoke** stops it for good.
- **Audit log** (Admin only): a list of important actions (users,
  deactivations, archives, conversions, deal outcomes, quotations,
  settings, imports, API keys) with **When**, **Actor**, **Action**,
  **Record**, **Details**. Filter by action, record type, person and date.
  It shows field names, never passwords or keys.

---

## 14. Good to know

- **The first click can be slow.** The test (staging) setup is deployed:
  the web app on Vercel, the API on Render, the database on Supabase, all
  on free plans. The API sleeps after about 15 minutes without use, and the
  first request afterwards can take up to a minute. After that it runs at
  normal speed. The free database can also pause after a long idle period,
  and someone must un-pause it from its dashboard.
- **Fictional data only** on staging and in demos. Never enter real
  customer details.
- **Nothing is deleted.** Leads, companies, contacts, deals, quotations and
  form submissions are archived and can be restored.
- **Not in this version** (agreed or reported, not forgotten):
  - no "forgot password" email; an Admin resets passwords
  - no emails of any kind (notifications are in-app only)
  - no product or service catalogue; quotation lines are typed in
  - a GST rate per line (any rate, 0–100), but no CGST/SGST/IGST split
  - no Excel (.xlsx) import; save as CSV instead
  - no custom fields, no saved filters (bookmark the filtered web address
    instead)
  - no PDF reports; reports download as CSV
  - no notification settings, and no notifications for deal stage changes
    or Won/Lost
  - no bulk actions on lists, no calendar view, no read/unread on
    form submissions
  - currency and time zone are fixed (INR, India time)

---

## 15. Likely evaluator questions

**How do roles and permissions work?**
There are two roles, Admin and Staff. Each action needs a permission (for
example "leads:write"). The server checks it on every request. Hiding a
button is only for convenience: if Staff tried an Admin action directly,
the server would refuse it.

**Can Staff see each other's records?**
Yes. Sales records are shared across the team. "Owner" records who is
responsible. **Mine** filters let each person focus on their own.

**How does login work?**
Email and password. Passwords are stored only as a scrambled one-way hash.
After sign-in the browser holds a random session code. The server keeps
the session, so it can end it instantly. Deactivating a user or changing a
password signs that person out everywhere.

**What stops password guessing?**
After several failed attempts for the same email, further attempts are
refused for a while ("Too many attempts. Try again later.").

**How does the website form reach the CRM?**
The website's server sends each form submission to a private CRM address, with an
API key created on the API keys page. Browsers never see the key. It has
been live since 25 November 2026.

**What if the CRM is down when someone submits the website form?**
The website still works. It keeps saving, emailing and sending enquiries
to HubSpot as before, so the submission is not lost. If the same submission
reaches the CRM twice, the CRM recognises its submission ID and ignores
the repeat.

**How are quotation totals calculated?**
Each line: quantity × unit price, less the line's discount, then the
line's own GST rate. Tax exclusive: GST is added on top. Tax inclusive: the
entered price already contains the GST, which is split out of it. Subtotal =
sum of the lines before GST; one GST row per rate used; Total = sum of the
lines. Rounding to the paisa (half-up) happens once per line for each amount,
so the printed figures always add up.

**Why are the totals exact?**
Money is calculated with exact decimal arithmetic, not computer
floating-point, which can drift by a paisa. The server always recalculates
the totals itself, and the screen, the list and the PDF show the same
figure.

**How are duplicates handled?**
When you add a lead or company by hand, a matching email, phone or name
shows a warning, but you can still save. CSV imports skip rows whose email
already exists, and list them. A repeated website submission is ignored.
Conversion suggests existing companies and contacts so you can link them
instead of creating copies.

**What happens when a lead is converted?**
In one step, the app links or creates the company and contact, can start a
deal, and marks the lead Converted. If any part fails, nothing is saved.
The lead and its history are kept.

**What is audited?**
Creating, editing, archiving and restoring records; lead status changes
and conversions; deal stage moves and Won/Lost; quotation changes; user,
role and password changes; settings; API keys; imports; and the outcome of
each website enquiry. The log entry is saved together with the change, so a
change can't happen without one.

**Can data be deleted?**
Business records are archived, never deleted. The one exception: an Admin
can delete a pipeline stage that no deal has ever used.

**Do the dashboard numbers match the data?**
Yes. Automated tests compare every dashboard number with an independent
database count, and check that Reports agree with Home.

**Why were some PRD items left out?**
To finish the full core journey reliably in the time available. Each item
left out is recorded with a reason. Some were approved by the project
owner, and some are awaiting a decision (section 17).

**How was it tested?**
841 automated tests run against a real database. Step-by-step manual test
scripts exist for every feature. Running them in a browser is the next
step.

---

## 16. Technical overview

**Three parts**

| Part | What it is | Where it runs (staging) |
| --- | --- | --- |
| Web app | The screens (Next.js, React, TypeScript) | Vercel (free plan) |
| API | Business rules and permissions (Express, TypeScript) | Render (free plan) |
| Database | PostgreSQL 17, in its own separate area | Supabase (free plan) |

The browser talks only to the web app, which passes requests to the API.
Only the API talks to the database. The CRM's data lives in its own
database area with its own login, separate from the website's data. For
local use the whole app also starts with one Docker command.

**Login and sessions**

- Email and password. Passwords are hashed with Argon2.
- On sign-in the server creates a random session token. The browser
  stores it in a cookie that page scripts cannot read; the database stores
  only a hash of it.
- Sessions last 7 days and are extended while the app is in use. Logout,
  deactivation or a password change ends them immediately.
- Two roles (Admin, Staff) map to 19 named permissions, checked by the API
  on every route.

**Security measures**

- Permission check on every API route, and every query is limited to the
  user's organisation.
- Input checked against one shared set of validation rules.
- Rate limits on login and on website intake (per key and per address).
- Same-site request check against cross-site attacks; standard security
  headers.
- API keys stored only as hashes and shown once. They can be revoked or
  rotated.
- Website intake: idempotency (no duplicates on retry), a hidden bot trap,
  and size and type limits.
- CSV exports are protected against spreadsheet formula injection.
- Errors give a reference ID, never internal details. The audit log shows
  only approved fields.
- Related changes are saved together in one database transaction,
  including their audit row.

**Free-tier hosting**

Everything runs on free plans with no paid dependency. The trade-offs: the
API sleeps after about 15 minutes idle (up to a minute to wake), the
database can pause when unused for long, and connections are limited. This
is fine for evaluation, not for production.

---

## 17. PRD coverage

Status of every item in PRD section 5. Key: **Built**, **Built
differently**, **Not built**. "Approved" means the project owner approved
the change (decision number in brackets). "Awaiting decision" means it was
reported and is not yet approved.

| PRD item | Status | Note |
| --- | --- | --- |
| **5.1** Secure login/logout | Built | |
| 5.1 Password reset | Built differently | Admin resets passwords; no self-service email reset (the app sends no email). Listed as not built in the README. |
| 5.1 Roles; create/edit/activate/deactivate users | Built | |
| 5.1 Permission enforcement; multiple Admins | Built | |
| 5.1 Profile and sessions; protect last Admin | Built | Name and email are changed by an Admin. |
| **5.2** KPIs | Built differently | Uses the owner-approved metric set (D53). "Leads created" follows the date range (pick today for "today"). No "total leads" or lost-deal count card; lost counts are in Reports. |
| 5.2 Today's tasks, meetings, overdue, recent | Built differently | On the separate Today page; Home shows Recent activity and Overdue tasks. |
| 5.2 Source/status breakdowns, pipeline, monthly revenue | Built | |
| 5.2 Role-aware data; date filters | Built | All/Mine and date range. |
| **5.3** Manual lead create/edit | Built | |
| 5.3 CSV/Excel import with field mapping | Built differently | CSV only; Excel can save as CSV. Awaiting decision (D95). |
| 5.3 Website form through a secured API | Built | Live since 25 November 2026, alongside the website's own flow. |
| 5.3 Source/detail, status, owner, captured enquiry | Built | |
| 5.3 Search, filters, sorting, duplicate detection | Built | Duplicates warn, never block. |
| 5.3 Bulk operations | Not built | Approved (D96). |
| 5.3 Qualify, convert, notes, history, original submission | Built | |
| **5.4** Company and contact records | Built | Company "notes" is the Description field. |
| 5.4 Many contacts per company; contacts on many deals | Built | |
| 5.4 History, tasks, notes, related deals | Built | Timeline and Deals tabs. |
| **5.5** Deals with value, currency, owner, close date, probability | Built | Currency is INR; probability comes from the stage. |
| 5.5 Deal linked to company and several contacts | Built | |
| 5.5 Configurable stages; Board and List; history; drag | Built | |
| 5.5 Won/Lost with lost reason; pipeline and weighted value | Built | |
| 5.5 One configurable pipeline | Built | |
| **5.6** Tasks, calls, meetings, notes linked to records | Built | |
| 5.6 Reminders | Built differently | Only "task due today" and "overdue" notifications (approved, D91). |
| 5.6 Due date, priority, status, assignee, completion | Built | |
| 5.6 Today, upcoming, overdue | Built | Today page, My Tasks. |
| 5.6 Calendar view | Not built | Approved (D96). My Tasks and Today instead. |
| 5.6 Timeline on lead, contact, company, deal | Built | |
| **5.7** Product/service catalogue | Not built | Approved (D87); future item. |
| 5.7 Items with qty, price, discount, tax | Built differently | Lines typed in; discount and GST % per line, with a tax inclusive/exclusive switch per quotation; on quotations, not deals (approved, D87, D101–D103). |
| 5.7 Number, validity, customer, totals | Built | |
| 5.7 PDF; linked to deal; status tracking | Built | The PDF is generated on demand, not stored (approved, D87). |
| **5.8** Enquiries inbox with filters and lead context | Built | Shown as **Form submissions** in the menu (D104). |
| 5.8 Inbox read/unread | Not built | Approved (D96). Status, archive and spam instead. |
| 5.8 Open or create the lead from an enquiry | Built differently | The lead is created automatically on arrival and linked; there is no manual "create lead" for a Rejected enquiry. |
| 5.8 Notifications: leads, assignments, reminders, overdue | Built differently | A manual lead notifies only its owner; reminders are due-today only (approved, D91). |
| 5.8 Notifications: deal changes, invitations | Not built | Approved (D91). There is no invite flow. |
| 5.8 Inbox separate from notifications | Built | |
| **5.9** Daily workspace (Today) | Built | All seven sections, open record, complete task, add follow-up. |
| **5.10** Reports: leads by source, conversion, Won/Lost, revenue, pipeline | Built | |
| 5.10 Leads by status and date; monthly revenue trend | Built differently | On Home, not Reports. Awaiting decision (D92). |
| 5.10 Salesperson performance; overdue follow-ups | Built | Sales by owner; overdue by assignee. |
| 5.10 Salesperson activity report | Not built | Awaiting decision (D92). |
| 5.10 Date filters, tables, charts, totals | Built | |
| 5.10 CSV/Excel export | Built differently | CSV only (opens in Excel). Awaiting decision (D92). |
| 5.10 PDF reports | Not built | Approved (D87). |
| 5.10 Report access respects permissions | Built | |
| **5.11** Organisation profile, lead sources, pipeline stages | Built | |
| 5.11 Currency/date settings | Built differently | Shown read-only. Awaiting decision (D93). |
| 5.11 Custom fields | Not built | Awaiting decision (D93). |
| 5.11 Global search | Built | Also covers quotations. |
| 5.11 Filters and sorting | Built | |
| 5.11 Saved filters | Not built | Filters live in the web address and can be bookmarked. Awaiting decision (D93). |
| 5.11 Audit logs | Built | |
| 5.11 Notification preferences | Not built | Approved (D91). |
| 5.11 Administrative settings | Built | |

---

## 18. 5-minute demo walkthrough

Before the demo: have sample data loaded, and submit the website's contact
form once with fictional details. It also goes through the website's normal
emails and HubSpot, so tell the team it is a test. Allow a minute for the
first page to wake up.

1. **Form submission arrives.** Sign in as Admin. Notice the bell's red number.
   Open **Form submissions** and open the new submission. Show **Overview** and **Raw
   payload**.
2. **Lead.** On the submission, click the linked lead. Its source is
   **Website** and the original message is under **Original enquiry**.
3. **Work the lead.** Open the **Timeline** tab, add a **Call** ("Intro
   call"), then click **Qualified** under **Change status**.
4. **Convert.** Click **Convert**, keep **Create new** for company and
   contact, leave **Create a deal** on, enter a **Value (₹)**, click
   **Convert lead**.
5. **Deal.** Click the new deal link. Go to **Deals → Board** and drag the
   card (or use **Move to…**) into the next stage.
6. **Quotation.** Open **Quotations → New quotation**. Pick the new company,
   contact and deal. Add two lines and watch the totals update. Click
   **Create quotation**.
7. **PDF.** Click **Download PDF** and open it.
8. **Send and accept.** Click **Mark as sent**, then **Accepted** → **Mark
   accepted**.
9. **Won.** In the "Mark the deal as Won?" box, click **Mark deal as
   Won**. Open the deal: it shows **Won**.
10. **Report.** Open **Reports**: the win appears under **Sales performance
    by owner**. Open **Home**: **Won revenue** matches. Finish with
    **Audit Log** to show every step was recorded.

---

**Recent changes (25 November 2026):** website contact form connected;
staging deployed; leads and contacts now need a first name, a company and
an email or phone; Source optional; company and contact boxes list options
on click; new phone input rules; My Tasks shows your own tasks by default;
bulk actions, calendar view and enquiry read/unread recorded as agreed
omissions.

**Recent changes (27 November 2026):** quotations now have a GST rate on each
line and a Tax exclusive / Tax inclusive switch (the quotation-wide discount
and GST boxes are gone); "Enquiries" is now called **Form submissions**;
status buttons show a spinner, lock while saving and confirm with a message.
