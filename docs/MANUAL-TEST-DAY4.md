# Manual test script — Day 4 (Activities, Today, My Tasks, Dashboard)

Written for someone who has never used this app before. Follow the steps in
order; each one names the exact page, the exact button or field label, and
what you should see happen. This environment has no browser-automation tool,
so none of this has been run by the person who wrote it — if a step doesn't
match reality, that's a real bug to report, not a typo in this script.

Run this after `docs/MANUAL-TEST-DAY3.md` has already passed. Day 1's
design-system checks (dark theme, focus rings, no pure white/black,
console-clean) apply to every new screen below too — re-check a sample of
them in §6, not just on Day 1's three pages.

## 0. Before you start

1. Start the app: `pnpm dev` from the repo root (same as earlier days).
2. Seed fictional sample data so every section below has something to look
   at: `pnpm db:seed:sample` from the repo root. It prints `Sample CRM data
   is ready (3 companies, 3 contacts, 5 leads, 4 deals, 14 activities).` —
   it's safe to run again later; it never creates duplicates.
3. Open `http://localhost:3000/login` and sign in as the seeded Admin
   (`admin@growspark.test`).
4. Look at the left sidebar. You should now see, top to bottom: **Home**,
   **Today**, **My Tasks**, **Leads**, **Companies**, **Contacts**, **Deals**,
   and (because you're Admin) **Users**. If **Today** or **My Tasks** is
   missing, stop — that's a bug.
5. Open your browser's DevTools and keep the **Console** tab visible for the
   rest of this script — report anything red that appears on any page below.

---

## 1. Activities on a deal, and its timelines (acceptance item)

1. Go to **Deals** and open **Sample CRM Open Deal**.
2. Scroll to the **Add activity** composer. Click the **Call** tab, type
   **Subject**: `Discussed renewal terms`, leave the due date blank, click
   **Save activity**.
   **Expected**: a new entry reading "Discussed renewal terms" appears at
   the top of the Timeline below the composer.
3. Click the **Meeting** tab, type **Subject**: `Kickoff call`, set a
   **Start date and time** and **End date and time** (any time today or
   later), click **Save activity**.
   **Expected**: "Kickoff call" also appears in the Timeline.
4. Note this deal's **Company** (shown in the key-facts strip at the top —
   it should be **Sample CRM Company 1**). Open that company's page and
   click its **Timeline** tab (alongside Overview, Contacts, and Deals).
   **Expected**: both "Discussed renewal terms" and "Kickoff call" appear
   here too — the same two activities, not copies.
5. Click the **Contacts** tab back on the deal. It should already list
   **Asha Sample** as the primary contact (seeded). Open Asha's contact page
   and click her **Timeline** tab.
   **Expected**: both activities appear here as well.
6. Back on the deal's Timeline, click **Complete** next to "Discussed
   renewal terms".
   **Expected**: a success toast, the entry shows "Completed by Admin User"
   (or whichever name you're signed in as) with a timestamp, and the
   **Complete**/**Cancel** buttons disappear from that row.

---

## 2. The Today workspace (acceptance items)

1. Click **Today** in the sidebar. URL: `http://localhost:3000/today`.
2. **Expected**: a **Mine | All** toggle (Mine selected by default) and
   seven cards: **Overdue**, **Tasks due today**, **Meetings this week**,
   **New leads**, **Deals closing soon**, **Deals with no next activity**,
   **Recently updated deals** — each showing a count.
3. Click **All** (the sample data was seeded without a specific owner for
   most rows, so **Mine** alone may show fewer or none of it).
4. **Expected (acceptance item — an overdue task appears on Today)**: the
   **Overdue** card lists at least `Sample CRM TASK 1`, `Sample CRM TASK 2`,
   and `Sample CRM TASK 3`, each with a **Complete** button and an
   **Add follow-up** button, each linking to a real record when clicked.
5. **Expected (acceptance item — a deal with no next activity)**: the
   **Deals with no next activity** card lists `Sample CRM Closing Soon`.
   The same deal should also appear in **Deals closing soon** (its expected
   close date is 7 days out, inside the 14-day window) — a deal can
   legitimately appear in both lists at once.
6. Click **Add follow-up** on any row. **Expected**: a dialog titled "Add
   follow-up for …" opens with the same composer from §1; save a quick Task
   and confirm the dialog closes itself and the row's section total updates.
7. Click **Complete** on one of the three overdue tasks.
   **Expected**: a success toast, and that row disappears from **Overdue**
   (the section's count also drops by one).

---

## 3. My Tasks (`/tasks`)

1. Click **My Tasks** in the sidebar. URL: `http://localhost:3000/tasks`.
2. **Expected**: three tabs — **Open**, **Overdue**, **Done** (Open selected
   by default) — and filters for **Type**, **Priority**, **Due from**,
   **Due to**.
3. Click the **Overdue** tab.
   **Expected**: the URL gains `?status=OPEN&overdue=true`, and the table
   shows the same overdue tasks as Today's Overdue card (now minus whichever
   one you completed in §2.7).
4. Click the **Done** tab.
   **Expected**: the URL changes to `?status=DONE`, and "Discussed renewal
   terms" (completed in §1.6) and the task you completed in §2.7 both
   appear here, each showing a **Done** badge instead of Complete/Cancel
   buttons.
5. Go back to **Open**, and set **Type** to **Call**.
   **Expected**: the URL gains `&type=CALL` and the table narrows to calls
   only (check the Network tab: the request to `/api/v1/activities` should
   carry `type=CALL`).

---

## 4. Dashboard on Home (acceptance item — reconciliation)

1. Click **Home** in the sidebar. URL: `http://localhost:3000/`.
2. **Expected**: a **Date range** control (showing **This month**), an
   **All | Mine** toggle (All selected by default), a line reading
   "Showing `<date>` – `<date>`", nine KPI cards (**Leads created**,
   **Qualified leads**, **Active leads**, **Open deals**, **Open pipeline
   value**, **Weighted value**, **Won revenue**, **Win rate**, **Overdue
   tasks**), four charts (**Leads by source**, **Leads by status**,
   **Pipeline by stage**, **Monthly won revenue**), and a **Recent
   activity** list.
3. Write down the two dates from the "Showing …" line — you'll need them
   for the SQL check below.
4. Ask whoever has database access to run this (replace the two dates in
   the first line with what you wrote down in step 3, and the organisation
   id with the result of `SELECT id FROM organizations LIMIT 1;` if there's
   more than one organisation in this database):

   ```sql
   -- Connect first, e.g.:
   -- docker exec -it growspark-sales-crm-postgres psql -U growspark_dev -d crm_dev
   SET timezone = 'Asia/Kolkata';

   WITH bounds AS (
     SELECT '2026-11-01'::date AS from_date, '2026-11-30'::date AS to_date
   ), org AS (
     SELECT id FROM organizations LIMIT 1
   )
   SELECT
     (SELECT COUNT(*) FROM leads, bounds WHERE organization_id = (SELECT id FROM org)
       AND archived_at IS NULL AND created_at >= from_date AND created_at < to_date + 1) AS leads_created,
     (SELECT COUNT(*) FROM leads WHERE organization_id = (SELECT id FROM org)
       AND archived_at IS NULL AND status = 'QUALIFIED') AS qualified_leads,
     (SELECT COUNT(*) FROM leads WHERE organization_id = (SELECT id FROM org)
       AND archived_at IS NULL AND status IN ('NEW','CONTACTED','QUALIFIED')) AS active_leads,
     (SELECT COUNT(*) FROM deals WHERE organization_id = (SELECT id FROM org)
       AND archived_at IS NULL AND status = 'OPEN') AS open_deals,
     (SELECT COALESCE(SUM(value),0) FROM deals WHERE organization_id = (SELECT id FROM org)
       AND archived_at IS NULL AND status = 'OPEN') AS open_pipeline_value,
     (SELECT COALESCE(SUM(value * probability / 100.0),0) FROM deals WHERE organization_id = (SELECT id FROM org)
       AND archived_at IS NULL AND status = 'OPEN') AS weighted_value,
     (SELECT COALESCE(SUM(value),0) FROM deals, bounds WHERE organization_id = (SELECT id FROM org)
       AND archived_at IS NULL AND status = 'WON' AND closed_at >= from_date AND closed_at < to_date + 1) AS won_revenue,
     (SELECT COALESCE(100.0 * COUNT(*) FILTER (WHERE status = 'WON') / NULLIF(COUNT(*),0), 0)
       FROM deals, bounds WHERE organization_id = (SELECT id FROM org) AND archived_at IS NULL
       AND status IN ('WON','LOST') AND closed_at >= from_date AND closed_at < to_date + 1) AS win_rate,
     (SELECT COUNT(*) FROM activities WHERE organization_id = (SELECT id FROM org)
       AND status = 'OPEN' AND type IN ('TASK','CALL','MEETING')
       AND due_at < date_trunc('day', now())) AS overdue_tasks;
   ```

5. **Expected**: every number this query returns matches the corresponding
   KPI card on screen exactly (`open_pipeline_value`/`weighted_value`/
   `won_revenue` as rupee amounts — the card shows a compact ₹ L/Cr form,
   so compare the underlying number, not the formatting).
6. Switch the scope toggle to **Mine** and confirm the KPI cards change
   (fewer or equal counts, since the sample data mostly has no specific
   owner — if nothing changes at all with real owned data present later,
   that would be worth re-checking).
7. Switch **Date range** to **Last 30 days**, then to **Custom range** and
   pick any two dates. **Expected**: the "Showing …" line and the KPI
   numbers update each time (check the Network tab: the request to
   `/api/v1/dashboard` should carry matching `from`/`to` query parameters).
8. Hover over a bar in any of the four charts. **Expected**: a tooltip
   shows that bar's exact value.
9. **Expected**: `Sample CRM Won Deal` revenue (₹1,25,000) is counted in
   **Won revenue** only if its close date falls inside the selected range
   (the seed sets `closedAt` to "now", so it should count for **This
   month**).

---

## 5. "Today" is correct around midnight India time

This is hard to test live without waiting for actual midnight, so instead
confirm the automated proof and do one manual sanity check:

1. The automated test suite already proves this with a fixed clock — see
   `apps/api/tests/workspace/workspace.test.ts`'s "uses organisation month
   boundaries…" test and `apps/api/tests/activities/activities.test.ts`'s
   "filters due ranges and overdue activities…" test, both of which freeze
   the clock at 23:30 and 00:30 **Asia/Kolkata** and check the boundary
   falls in the right place. These passed as part of this session's
   verification (296/296 `apps/api` tests).
2. For a live sanity check without waiting for real midnight: ask whoever
   has database access to temporarily insert one task due a few minutes
   from now, then change your computer's clock forward to just past local
   midnight India time (or, simpler, just confirm today's date shown
   anywhere timestamped on screen — e.g. a newly created activity's "Due"
   column on `/tasks` — reads as today's actual calendar date in India, not
   shifted by a day either direction.
3. **Expected**: nothing on `/today`, `/tasks`, or the dashboard ever shows
   a date that's off by one day from the real calendar date in India.

---

## 6. Design-system spot-check (re-run from Day 1–3, on these new screens)

Pick three of the new pages (e.g. Today, My Tasks, and the Home dashboard)
and confirm, same as earlier days:

- [ ] Switch Light/Dark/System in the user menu — all three render
      correctly in both themes; no pure white or pure black anywhere,
      including inside the dashboard's charts (bars, tooltips, axis labels).
- [ ] Tab through My Tasks' filter bar and the Today page's Mine/All toggle
      with the keyboard only — every control gets a visible focus ring, in
      a sensible order.
- [ ] Tab to a pipeline-chart bar area on the dashboard — it's decorative
      (not a real focus stop), but every surrounding interactive control
      (date range, scope toggle, "Add follow-up") is reachable and visibly
      focused.
- [ ] No warnings or errors in the browser console on any of these pages.
- [ ] Status badges (priority, Done/Cancelled) always show a coloured dot
      *and* a word — never colour alone.

---

## 7. Acceptance items — quick checklist

These are the roadmap's own named Day 4 acceptance items:

- [ ] **§1**: a logged call and a scheduled meeting on a deal both show on
      that deal's, its company's, and its contact's timelines.
- [ ] **§2.4**: an overdue task appears on Today (and, per the dashboard's
      **Overdue tasks** KPI in §4, is counted there too).
- [ ] **§2.5**: an open deal with no open activity is listed under "Deals
      with no next activity".
- [ ] **§4.5**: every dashboard number matches the independent SQL check,
      including for **Mine**.
- [ ] **§5**: "Today" is correct around midnight India time (automated
      proof plus the manual sanity check).
