# Manual test script — Day 5a (website intake, API keys, Enquiries)

Written for someone who has never used this app before. Follow the steps in
order; each one names the exact page, the exact button or field label, and
what you should see happen. This environment has no browser-automation
tool, so none of this has been run by the person who wrote it — if a step
doesn't match reality, that's a real bug to report, not a typo in this
script.

Run this after `docs/MANUAL-TEST-DAY4.md` has already passed. Day 1's
design-system checks (dark theme, focus rings, no pure white/black,
console-clean) apply to the two new screens below too.

Do not check any box below until it has actually been clicked through or
run in a real terminal.

## 0. Before you start

- [ ] Confirm `crm_test` has migration `20261123194049_add_submission_spam_and_archive`
      applied (`pnpm db:verify-fresh` if you haven't already this session).
- [ ] Start the app: `pnpm dev` from the repo root.
- [ ] Open `http://localhost:3000/login` and sign in as the seeded Admin
      (`admin@growspark.test`).
- [ ] Look at the left sidebar. You should now see a new **Enquiries** entry
      (between Deals and Users) and, further down in the Admin-only
      section, a new **API Keys** entry (next to Users). If either is
      missing, stop — that's a bug.
- [ ] Open your browser's DevTools and keep the **Console** tab visible for
      the rest of this script.

---

## 1. API keys: create, see once, list, revoke, rotate

1. [ ] Click **API Keys** in the sidebar. URL: `http://localhost:3000/settings/api-keys`.
   **Expected**: an empty table (or your organisation's existing keys) and
   a **New API key** button.
2. [ ] Click **New API key**, type **Name**: `Manual test key`, click
   **Create key**.
   **Expected**: the dialog switches to show the full key value
   (starting `gsk_live_`) in a read-only field, a copy button next to it,
   and a warning that you will not see it again. **Copy this value now** —
   you'll need it in section 2.
3. [ ] Click **Done**.
   **Expected**: the table now lists "Manual test key" with an **Active**
   badge, a short prefix (e.g. `gsk_live_AbCdEf…`), "Never" under Last
   used, and **Rotate**/**Revoke** buttons — the full key is not shown
   anywhere here.
4. [ ] Sign out and back in as the seeded Staff user
   (`staff@growspark.test`), then try to open `/settings/api-keys`
   directly by URL.
   **Expected**: redirected to the Forbidden page (the API Keys nav item
   should also be absent from Staff's sidebar).
5. [ ] Back as Admin, click **Rotate** on "Manual test key".
   **Expected**: a confirmation naming the key and warning the old one
   stops working immediately; confirming shows the **same** "shown once"
   reveal UI as creation, with a brand-new key value. Copy this new value
   — the one from step 2 is now dead (see section 2, step 6).
6. [ ] Click **Revoke** on the key, confirm.
   **Expected**: the badge changes to **Revoked**, and the Rotate/Revoke
   buttons disappear for that row.

---

## 2. Website intake: the curl contract (acceptance items)

Create a fresh key for this section (repeat section 1, steps 1–3) and
export it in your terminal: `export API_KEY=gsk_live_...` (or set it on each
command below). All requests go to `http://localhost:4000` directly — the
intake endpoint is called server-to-server, never through the Next.js proxy.

1. [ ] **A valid submission creates a Lead** (acceptance item):
   ```
   curl -s -X POST http://localhost:4000/api/v1/intake/website-enquiries \
     -H "Authorization: Bearer $API_KEY" \
     -H "Idempotency-Key: manual-test-1" \
     -H "Content-Type: application/json" \
     -d '{"formType":"contact","fields":{"name":"Manual Tester","email":"manual-test@example.com","challenge":"Testing the intake endpoint."}}'
   ```
   **Expected**: `201`, body shape
   `{"data":{"submissionId":"...","leadId":"...","duplicate":false,"possibleDuplicateLeadIds":[]}}`.
   Go to **Leads** in the browser — "Manual Tester" should appear with
   source **Website**, requirement "Testing the intake endpoint."
2. [ ] **The exact same request sent again returns the original result**
   (acceptance item — same command as step 1, unchanged): expect `200`
   this time, `"duplicate":true`, the *same* `submissionId`/`leadId` as
   step 1. Confirm no second Lead was created.
3. [ ] **A honeypot hit looks like success but is spam**:
   ```
   curl -s -X POST http://localhost:4000/api/v1/intake/website-enquiries \
     -H "Authorization: Bearer $API_KEY" \
     -H "Idempotency-Key: manual-test-spam" \
     -H "Content-Type: application/json" \
     -d '{"formType":"contact","fields":{"name":"Bot","email":"bot@example.com"},"hp":"filled in by a bot"}'
   ```
   **Expected**: `201`, `"leadId":null`, `"duplicate":false` — the same
   shape as a real success. Confirm no "Bot" Lead was created, then check
   the Enquiries screen (section 3) shows this submission with status
   **Spam**.
4. [ ] **No API key, or a bad one, is refused**:
   ```
   curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:4000/api/v1/intake/website-enquiries \
     -H "Idempotency-Key: manual-test-no-key" -H "Content-Type: application/json" -d '{}'
   curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:4000/api/v1/intake/website-enquiries \
     -H "Authorization: Bearer gsk_live_not_a_real_key" \
     -H "Idempotency-Key: manual-test-bad-key" -H "Content-Type: application/json" -d '{}'
   ```
   **Expected**: `401` both times.
5. [ ] **A session cookie alone is not enough** (acceptance item): while
   signed in as Admin in the browser, open DevTools → Application/Storage →
   Cookies, copy the `crm_session` cookie value, then:
   ```
   curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:4000/api/v1/intake/website-enquiries \
     -H "Cookie: crm_session=<paste the value>" \
     -H "Idempotency-Key: manual-test-cookie" -H "Content-Type: application/json" -d '{}'
   ```
   **Expected**: `401` — a signed-in browser session is never accepted here,
   only a verified API key.
6. [ ] **A revoked (or just-rotated-away) key stops working immediately**:
   repeat step 1's command (any new `Idempotency-Key`) using section 1's
   revoked/rotated-out key. **Expected**: `401`.
7. [ ] **A mapping failure is rejected, not silently dropped**:
   ```
   curl -s -X POST http://localhost:4000/api/v1/intake/website-enquiries \
     -H "Authorization: Bearer $API_KEY" \
     -H "Idempotency-Key: manual-test-rejected" \
     -H "Content-Type: application/json" \
     -d '{"formType":"contact","fields":{"name":"No Contact Info"}}'
   ```
   **Expected**: `422`. Check the Enquiries screen (section 3) — this
   submission should appear with status **Rejected** and a visible error
   message, not be missing.

Alternatively, with `API_KEY` already exported as above, run
`apps/api/scripts/replay-intake.sh` from `apps/api/` for steps 1, 2, 3, and
7 in one go (it uses fresh, timestamped Idempotency-Keys each run, so it's
safe to re-run).

---

## 3. The Enquiries screen (acceptance items)

1. [ ] Click **Enquiries** in the sidebar. URL: `http://localhost:3000/enquiries`.
   **Expected**: a table including the submissions created in section 2 —
   "contact" rows with statuses **Lead created**, **Spam**, and
   **Rejected**.
2. [ ] Filter by **Status** = Spam. **Expected**: only the honeypot
   submission from section 2 step 3 remains.
3. [ ] Clear the status filter, filter by **Form type** = `contact`.
   **Expected**: all of this script's submissions still show (they're all
   `contact`).
4. [ ] Click into the **Lead created** row from section 2 step 1.
   **Expected**: an **Overview** tab showing the external id, submission
   id, and the linked Lead's email/phone/company/status; a **Raw payload**
   tab showing the exact JSON body you sent, pretty-printed.
5. [ ] Go back, open the **Rejected** row. **Expected**: the Overview tab
   shows the stored error message; there is no linked Lead.
6. [ ] Open the **Lead created** row again and click **Mark as spam**,
   confirm.
   **Expected (acceptance item)**: status becomes **Spam**; go to **Leads**
   and confirm "Manual Tester" is now archived (filter by Archived, or
   check its detail page shows an Archived badge).
7. [ ] On the same enquiry, click **Archive**, confirm.
   **Expected**: it disappears from the default Enquiries list; switching
   the **Archived** filter to "Archived" shows it again.
8. [ ] Click **Restore**. **Expected**: it reappears in the default list.
9. [ ] Sign out and back in as Staff. **Expected**: Staff can see and use
   Enquiries exactly the same as Admin (list, detail, mark-spam, archive,
   restore all work) — this screen has no role restriction.

---

## 4. Spot-checks

- [ ] Toggle dark mode (user menu, top right) on both `/settings/api-keys`
      and `/enquiries`/`/enquiries/:id`. **Expected**: readable in both
      themes, no pure white/black panels, badges keep their colour meaning.
- [ ] Tab through the **New API key** dialog and an Enquiry detail page's
      action buttons using only the keyboard. **Expected**: a visible focus
      ring at every stop, no keyboard trap.
- [ ] Check the DevTools Console on every page visited above for red
      errors or hydration warnings.
