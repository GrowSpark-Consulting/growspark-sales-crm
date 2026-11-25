# Day 5c handover prompt — paste everything below the line into a fresh session

Last updated: 2026-11-25, after Notifications was finished (D90).

---

We are in the middle of Day 5c of the Grow Spark Sales & CRM: three missing
PRD features, built one at a time, each ending with a short plain-language
report and a wait for my "continue": (1) Quotations — DONE, (2) Notifications
— DONE, (3) Reports — not started. The PRD is the source of truth; where
it differs from my brief, the PRD wins unless a recorded decision says
otherwise, and you tell me about the difference.

## Read first, in this order (no code until you have)

1. `CLAUDE.md`
2. `docs/NEXT-SESSION-START.md`
3. `docs/PROJECT-STATE.md` (skim the headings; read §1's last update, §10
   gotchas, §12 conventions, the end of §15 session log)
4. `docs/decisions.md` — D76/D82 (CSV export and its Excel fix) and all of
   **D83–D90** (Day 5c)
5. `docs/DAY-5C-SUMMARY.md`, `docs/MANUAL-TEST-DAY5C.md`
6. Code to copy patterns from: `apps/api/src/modules/workspace/
   workspace.service.ts` (the Home dashboard queries — reuse for Reports),
   `apps/api/src/modules/quotations/quotations.service.ts`
   (`quotationStatusWhere`, `expireLapsedQuotations`),
   `apps/api/src/modules/leads/leads.routes.ts` (a CSV export route),
   `apps/api/src/lib/{csv,org-time,route-registry}.ts`,
   `packages/shared/src/permissions.ts`,
   `apps/web/components/dashboard/` (charts + screen-reader tables, the
   date-range and All/Mine controls), `apps/web/lib/export.ts`,
   `apps/web/components/app-shell.tsx`.

Then run the read-only checks (git status/log, node/pnpm/docker versions,
`netstat -ano | findstr ":3000 :4000"`), and wait for my first prompt.

## Done and tested

- **Quotations (D83–D88)** — see DAY-5C-SUMMARY §1.
- **Notifications (D90)** — bell (60 s polling, paused while hidden),
  `/notifications`, mark read / read all; events for lead/deal assignment,
  new website enquiry, quotation accepted/rejected, task due today/overdue
  generated on load. PRD 5.8/5.11 gaps reported, not built: deal-change and
  invitation notifications, notification preferences.
- Migrations `20261124181711_add_quotations` and
  `20261124191130_add_notifications` are applied to `crm_test` and `crm_dev`
  (by me); **not yet to staging**.
- Last verified state: `pnpm typecheck` clean; `pnpm lint` 0 errors (3
  older web warnings); `pnpm test` **apps/api 572/572, apps/web 121/121
  (693)**; web production build compiles every route.
- Nothing from Day 5c has been clicked through in a browser yet; that's my
  job (`docs/MANUAL-TEST-DAY5C.md` §1–§8).

## Reports — not started (approved plan, do not re-ask)

- New permission `reports:read` (Admin + Staff; add to PERMISSIONS — the
  only permission-table change approved); CSV uses the existing
  `reports:export`.
- `/reports` page: date-range filter and an **All / Mine** toggle like Home
  (both roles see organisation-wide data, as Leads/Deals already allow).
- Five reports, each with a CSV export through the safe helper (`rowsToCsv`:
  formula escaping, BOM, never a bare "ID" first header):
  1. Pipeline by stage (count and value) — current open snapshot, as Home
  2. Lead sources and conversion — leads created in range, converted among them
  3. Sales performance by owner — deals won in range (closed_at), count and value
  4. Quotations summary — issued in range, count and value by status; must
     use `quotationStatusWhere()` (D86) so Expired is counted correctly
  5. Overdue tasks by owner — currently overdue; date range filters by due date
- Reuse Home's dashboard queries where they overlap and add a
  **reconciliation test** proving Reports and `GET /dashboard` agree.
- Tables plus simple charts; no PDF reports (D87).
- Docs on completion: decisions D91+, PROJECT-STATE, NEXT-SESSION-START,
  DAY-5C-SUMMARY §3, MANUAL-TEST-DAY5C §Reports with exact clicks.

## Approved PRD deviations (D87) and future items

No product catalogue; no CGST/SGST/IGST split; no PDF reports; owner added
to quotations; the PDF is regenerated, never stored. Future items: **GST
split**, **product catalogue**.

## Guardrails

- Never read or edit a real `.env` file (`.env`, `.env.staging.local`).
- Never run anything against staging; never write to `crm_dev` (no
  `db:seed`, no `db:migrate`, no scripts that write); this tool may not
  apply migrations to `crm_test` either — ask me to run `pnpm db:verify-fresh`.
- **Never commit or push** — I commit and push myself.
- No `sh` scripts; Windows/cmd-friendly commands in anything you give me.
- Don't stop or restart my running dev servers; prove ports by PID. (A
  `pnpm --filter web build` is safe alongside `next dev`: Next 16 keeps dev
  output in `.next/dev`.)
- Ask before any new dependency or any permission-table change beyond
  `reports:read` (already approved).

## Steps I still have to do myself

1. Organisation PDF details: copy `apps\api\org-details.example.json`,
   fill it in, `pnpm org:set-details --file <file>`, then again with
   `--confirm`.
2. Click through `docs\MANUAL-TEST-DAY5C.md` (Quotations, Notifications).
3. At the very end of Day 5c: from `apps\api`, `pnpm staging:migrate`, then
   `pnpm staging:set-org-details --file <file>` (dry run, then `--confirm`).

## First thing to do in the new session

After reading and the checks above, wait for my "continue", then build
Reports as planned above, starting with the `reports:read` permission and
the API service.
