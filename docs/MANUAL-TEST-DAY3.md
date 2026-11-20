# Manual test script — Day 3 (Lead conversion, Deals, Pipeline)

Written for someone who has never used this app before. Follow the steps in
order; each one names the exact page, the exact button or field label, and
what you should see happen. This environment has no browser-automation tool,
so none of this has been run by the person who wrote it — if a step doesn't
match reality, that's a real bug to report, not a typo in this script.

Run this after `docs/MANUAL-TEST-DAY2.md` has already passed (you need
working Leads, Companies, and Contacts). Day 1's design-system checks (dark
theme, focus rings, no pure white/black, console-clean) apply to every new
screen below too — re-check a sample of them in §7, not just on Day 1's
three pages.

## 0. Before you start

1. Start the app: `pnpm dev` from the repo root (same as Day 1/2).
2. Open `http://localhost:3000/login` in a real browser.
3. Sign in as the seeded Admin (`admin@growspark.test`).
4. Look at the left sidebar. You should now see, top to bottom: **Home**,
   **Leads**, **Companies**, **Contacts**, **Deals**, and (because you're
   Admin) **Users**. If **Deals** is missing, stop — that's a bug.
5. Open your browser's DevTools and keep the **Network** tab visible for the
   rest of this script.

---

## 1. Converting a lead

### 1.1 Create and qualify a lead to convert

1. Go to **Leads** → **Add lead**. Fill in **First name**: `Rohan`,
   **Company name**: `Horizon Textiles`, **Email**:
   `rohan@horizontextiles.test`, leave **Source** at its default. Save.
2. On the lead's detail page, click **Qualified** under "Change status".
   **Expected**: the status badge changes to **Qualified**.

### 1.2 The Convert button only appears where it makes sense

1. While still on this now-**Qualified** lead, look at the page header
   actions (next to Edit/Archive). **Expected**: a **Convert** button is
   present and clickable (not greyed out).
2. Open a *different*, still-**New** lead (or create one). **Expected**: a
   **Convert** button is still shown, but greyed out/disabled. Hovering over
   it should show a tooltip reading "Qualify the lead first".
3. Archive a **Qualified** lead (use the Archive action), then look at its
   actions again. **Expected**: **Convert** is gone entirely — not even
   shown disabled.

### 1.3 Convert into a new company and contact, with a deal (acceptance item)

1. Go back to Rohan's (Qualified) lead page and click **Convert**.
2. A dialog titled **"Convert lead"** opens with three sections: **Company**,
   **Contact**, **Deal**.
3. **Company section**: since "Horizon Textiles" doesn't exist yet, it
   should default to **Create new**, with the name field already filled in
   as "Horizon Textiles" (editable).
4. **Contact section**: should default to **Create new** (no existing
   contact matches Rohan's email), with a short note explaining a new
   contact will be created from the lead's details.
5. **Deal section**: the **"Create a deal"** toggle should be on by default.
   A deal name should already be filled in (something like "Horizon
   Textiles - Rohan"), editable. The **Stage** shown should be plain text
   naming the pipeline's first stage (e.g. "Qualification") — not a
   dropdown; you cannot change it here.
6. Click **Convert lead**.
7. **Expected**: a success panel appears inside the same dialog, with links
   reading "View the new company", "View the new contact", and "View the
   new deal". Click **Done**.
8. **Expected (acceptance item — no duplicate company created)**: back on
   the lead's page, its status is now **Converted**, and a new **Converted**
   panel appears at the top of the Overview tab showing the conversion date
   and the same three links. Click "View company" and confirm a company
   named exactly "Horizon Textiles" exists — only one, not two.

### 1.4 The lead keeps its history, and shows what it became (acceptance item)

1. Still on Rohan's lead page, click the **History** tab.
2. **Expected**: you see every status change, in order (New → Qualified,
   Qualified → Converted), each naming who made the change — nothing is
   lost or replaced by the conversion.
3. **Expected**: the "Change status" buttons and the Convert button are both
   gone now that the lead is Converted — only the Converted panel and
   History remain as ways to see what happened.

### 1.5 Converting by linking to an existing company and contact

1. Create a second lead: **First name**: `Priya`, **Company name**:
   `Horizon Textiles` (the same company name as before), **Email**:
   `priya@horizontextiles.test`. Qualify it.
2. Click **Convert**.
3. **Expected**: the Company section now defaults to **Link existing**,
   pre-selected to "Horizon Textiles" (the one you just created) — not
   "Create new".
4. Leave it linked, finish the Contact section (Create new, since Priya is a
   different person), turn **off** "Create a deal" this time (click the
   toggle), and confirm the deal fields (name, value, close date, stage) all
   disappear.
5. Click **Convert lead**. **Expected**: success panel shows "View the
   linked company" (not "new") and "View the new contact"; no deal link,
   since you didn't create one.
6. Open the company "Horizon Textiles" and confirm it now has **two**
   contacts (Rohan and Priya) — still only one company.

---

## 2. Deals: list, create, edit, detail

### 2.1 The Deals list

1. Click **Deals** in the sidebar. URL: `http://localhost:3000/deals`.
2. **Expected**: a **List | Board** toggle near the top (List selected by
   default), an **Add deal** button, and a table with columns Deal name,
   Company, Stage, Value, Probability, Expected close, Owner, Status. The
   deal created in §1.3 should already be listed.

### 2.2 Search, filter, sort — all server-side (Network-tab check)

1. Clear the Network tab log.
2. Type part of a deal's name into the search box and press Enter.
   **Expected**: a request to `/api/v1/deals?...q=...` appears, and the URL
   bar gains `?q=...`.
3. Use the **Any stage**, **Any status**, **Any owner**, and **Any company**
   dropdowns one at a time. **Expected**: each produces its own
   `stageId=`/`status=`/`ownerId=`/`companyId=` request parameter and
   narrows the table.
4. Click the **Deal name**, **Value**, **Probability**, or **Expected
   close** column headers to sort. **Expected**: `sort=value:asc` (etc.) in
   the request and the URL; clicking again flips to `:desc`. Try clicking
   **Company**, **Owner**, or **Status** — nothing should happen (not
   sortable).
5. Switch the **Active deals / Archived** filter and confirm the request
   gains `archived=true` and the table changes accordingly.

### 2.3 Create a deal

1. Click **Add deal**. Fill in **Deal name**: `Horizon Expansion`,
   **Company**: search for and pick "Horizon Textiles", leave **Stage** at
   its default (first open stage), **Value**: `750000`, **Owner**: leave as
   you (the default). Save.
2. **Expected**: you land on the new deal's detail page, with **Stage**
   showing the pipeline's first stage and **Probability** matching that
   stage's seeded percentage.

### 2.4 Deal detail: key facts, tabs, and actions

1. On this deal's page, confirm the key-facts strip shows **Company**
   (a link), **Stage**, **Value**, **Probability**, **Weighted value**
   (should equal Value × Probability ÷ 100), **Expected close**, **Owner**.
2. Click the **Stage history** tab. **Expected**: one row showing the
   deal's creation into its first stage, naming who created it.
3. Click the **Contacts** tab. **Expected**: "No contacts linked to this
   deal yet." with an **Add contact** button.
4. Click **Add contact**, search for and pick "Rohan", click **Add**.
   **Expected**: Rohan now appears in the table, marked **Primary**
   automatically (the only contact).
5. Add a second contact the same way, then click **Make primary** next to
   it. **Expected**: the primary badge moves to the new contact.
6. Click the **X** next to a contact to remove it. **Expected**: it
   disappears from the list immediately.

### 2.5 Moving a deal between stages (dropdown)

1. On the deal's **Move stage** button (near Edit, in the page header),
   click it. **Expected**: a dropdown lists the pipeline's other open
   stages (not the current one, not Won/Lost).
2. Pick a different stage. **Expected**: a success toast, the **Stage** and
   **Probability** in the key-facts strip update immediately to match the
   new stage, and a new row appears in the **Stage history** tab.

### 2.6 Closing a deal — Lost requires a reason (acceptance item)

1. On an open deal's page, click **Close as Lost**.
2. A dialog opens. **Expected**: the **Close as Lost** button inside the
   dialog is disabled until you pick a reason from the **Reason** dropdown.
3. Pick a reason (e.g. "Price"), optionally add a note, click **Close as
   Lost**.
4. **Expected**: the deal's status badge becomes **Lost**, Probability
   becomes 0%, and the Overview tab now shows the Lost reason (and note, if
   you added one).
5. **Expected (closed deal is read-only)**: **Edit**, **Move stage**, and
   the Contacts tab's add/remove controls are all gone now; only **Reopen**
   and **Archive**/**Restore** remain.

### 2.7 Reopening a deal

1. On the now-Lost deal, click **Reopen**. Confirm in the dialog (it should
   say the deal will return to the pipeline's first open stage).
2. **Expected**: the deal's status becomes **Open** again, Stage returns to
   the pipeline's first stage, and Edit/Move stage/Contacts controls
   reappear.

### 2.8 Closing a deal — Won

1. On a different open deal, click **Close as Won** and confirm.
2. **Expected**: status becomes **Won**, Probability becomes 100%, and
   (same as Lost) Edit/Move stage/Contacts disappear, replaced by Reopen.

### 2.9 Archive and restore (works even while closed)

1. On a **closed** (Won or Lost) deal, confirm **Archive** is still present
   and clickable. Archive it.
2. Switch the Deals list's filter to **Archived** and confirm it appears
   there, still showing its Won/Lost status.
3. Restore it from the list or its own page. **Expected**: it reappears in
   the Active list, still closed (archiving/restoring never changes a
   deal's open/closed status).

---

## 3. The pipeline board

### 3.1 Switching to Board view

1. On the Deals page, click **Board**. **Expected**: the URL gains
   `?view=board`, the list and its filter bar disappear, and you see one
   column per open pipeline stage (e.g. Qualification, Needs Analysis,
   Proposal, Negotiation) — **no Won or Lost column**.
2. **Expected**: a small "Open pipeline" summary bar above the columns
   shows a total count, total value, and weighted value across all open
   deals.
3. **Expected**: each column's header shows that stage's own count, total
   value, and weighted value.

### 3.2 Moving a deal via the dropdown (acceptance item)

1. Find a card for one of your open deals. **Expected**: every card shows
   the deal name (a link), company, value, expected close date, owner, and
   a **Move to…** dropdown button.
2. Click **Move to…** and pick a different open stage.
3. **Expected (acceptance item)**: the card disappears from its original
   column and appears in the target column almost immediately; the deal's
   own detail page (and its Stage history tab) reflects the move too.

### 3.3 Moving a deal via drag-and-drop (acceptance item, best effort)

1. Try dragging a card by clicking and holding on it, then dropping it onto
   a different column.
2. **Expected**: the card moves to the new column, the same as the dropdown
   does. Try this both with a mouse and, if convenient, using Tab to focus a
   card and the keyboard (Space to pick up, arrow keys to move, Space again
   to drop, Escape to cancel).
3. **If dragging does not work smoothly**: this is a known, explicitly
   accepted gap — the dropdown in §3.2 is the required, always-present way
   to move a deal, and drag was never guaranteed to be fully polished (see
   `docs/decisions.md` D49). Please report exactly what happened (nothing
   moved, it moved to the wrong place, a console error, etc.) so it can be
   looked at, but it is not a blocker for the rest of this script.

### 3.4 Pipeline totals match the database (acceptance item)

1. Note the "Open pipeline" total value shown in the summary bar.
2. Ask whoever has database access to run:
   ```sql
   SELECT COUNT(*), SUM(value), SUM(value * probability / 100.0)
   FROM deals
   WHERE organization_id = (SELECT id FROM organizations LIMIT 1)
     AND archived_at IS NULL AND status = 'OPEN';
   ```
3. **Expected**: the count and total value match what's shown on screen
   exactly. (This mirrors the automated test that already checks this the
   same way — see `docs/decisions.md` D47 — this step is to confirm it with
   your own eyes against real data too.)

---

## 4. Company and Contact Deals tabs

1. Open the "Horizon Textiles" company page. Click its **Deals** tab.
2. **Expected**: every deal linked to this company is listed (Deal name,
   Stage, Value, Status), and an **Add deal** button is present.
3. Click **Add deal**. **Expected**: you land on `/deals/new` with
   **Company** already set to "Horizon Textiles" (still editable if you
   change your mind).
4. Go to Rohan's contact page and click its **Deals** tab.
5. **Expected**: deals Rohan is linked to (via the Contacts tab work in
   §2.4) are listed the same way, but **no Add deal button** here — this
   tab is read-only for contacts.

---

## 5. Design-system spot-check (re-run from Day 1/2, on these new screens)

Pick two of the new pages (e.g. the Deals list and a deal detail page) and
confirm, same as earlier days:

- [ ] Switch Light/Dark/System in the user menu — both themes render
      correctly on the Deals list, a deal detail page, and the Board view;
      no pure white or pure black anywhere.
- [ ] Tab through the **Add deal** form with the keyboard only — every
      field and button gets a visible focus ring, in a sensible order.
- [ ] Tab to a card on the pipeline Board and confirm it gets a visible
      focus ring too (it's a real keyboard-focusable element, not just a
      mouse target).
- [ ] No warnings or errors in the browser console on any of these pages.
- [ ] Status badges (deal status, lead status) always show a coloured dot
      *and* a word — never colour alone.

---

## 6. Acceptance items — quick checklist

These are the roadmap's own named Day 3 acceptance items:

- [ ] **§1.3**: qualify a lead and convert it, linking an existing company
      where one exists, with no duplicate company created.
- [ ] **§1.4**: the lead remains viewable with its full history and shows
      exactly what it became (the Converted panel's links).
- [ ] **§3.1 / §2.3**: a converted (or newly created) deal appears on the
      board in the first open stage.
- [ ] **§2.5 / §3.2 / §3.3**: both the dropdown and drag (where it works)
      move a deal and record the move in its Stage history.
- [ ] **§2.6**: a deal cannot be marked Lost without a reason.
- [ ] **§3.4**: pipeline totals shown on screen match an independent SQL
      check against the database.
