# Day 5c handover prompt — paste everything below the line into a fresh session

Last updated: 2026-11-25, end of session (stopped at the usage limit).

---

We are in the middle of Day 5c of the Grow Spark Sales & CRM: three missing
PRD features, built one at a time, each ending with a short plain-language
report and a wait for my "continue": (1) Quotations — DONE, (2) Notifications
— STARTED, (3) Reports — not started. The PRD is the source of truth; where
it differs from my brief, the PRD wins unless a recorded decision says
otherwise, and you tell me about the difference.

## Read first, in this order (no code until you have)

1. `CLAUDE.md`
2. `docs/NEXT-SESSION-START.md`
3. `docs/PROJECT-STATE.md` (skim the headings; read §1's last update, §10
   gotchas, §12 conventions, the end of §15 session log)
4. `docs/decisions.md` — D71–D82 (security/intake/export background) and
   all of **D83–D89** (Day 5c)
5. `docs/DAY-5C-SUMMARY.md`, `docs/MANUAL-TEST-DAY5C.md`
6. Code to copy patterns from: `apps/api/src/modules/quotations/`
   (service + routes), `apps/api/src/modules/workspace/workspace.service.ts`
   (Today/dashboard queries — reuse for due/overdue and Reports),
   `apps/api/src/modules/leads/leads.service.ts`, `deals/deals.service.ts`,
   `leads/lead-conversion.service.ts`, `intake/intake.service.ts`,
   `apps/api/src/lib/{audit,audit-metadata,csv,org-time,route-registry}.ts`,
   `apps/web/components/app-shell.tsx`, `apps/web/components/quotations/`.

Then run the read-only checks (git status/log, node/pnpm/docker versions,
`netstat -ano | findstr ":3000 :4000"`), and wait for my first prompt.

## Done and tested — Quotations (D83–D88)

- Migration `20261124181711_add_quotations` (quotations, line items, yearly
  counter, eleven nullable organisation header columns). Applied to
  `crm_test` by me; **not yet to `crm_dev` or staging**.
- Exact-decimal money rule, half-up to 2 dp, three roundings (D85); one
  shared formatter `formatRupees`/`formatIndianDecimal` for API, PDF and
  screen. Yearly `Q-YYYY-NNNN` numbers via an atomic counter upsert.
  Draft → Sent → Accepted/Rejected on the server; Sent auto-expires on read,
  best-effort and audited as System, list filter agrees with detail (D86);
  a Draft past its valid-until date cannot be sent (D88). Edit (Draft only,
  version bump), duplicate, archive/restore. On-demand pdfkit PDF, never
  stored, Noto Sans for ₹ (D84). `POST /quotations/calculate` for live
  totals. Screens: list, new, detail, edit; Quotations tabs on Deal and
  Company; optional "mark the deal Won?" after Accept.
- Permissions `quotations:read`, `quotations:write` (Admin + Staff).
  Dependency `pdfkit@0.20.2` + dev `@types/pdfkit@0.17.7`.
- Last verified state: `pnpm typecheck` clean; `pnpm lint` 0 errors (3
  older web warnings); `pnpm test` **apps/api 540/540, apps/web 109/109
  (649)**; web production build compiles every quotation route.

## Written but NOT verified in a browser

Everything on screen for Quotations (no browser tool here): forms, live
totals, dialogs, PDF download through the proxy, both themes. My job:
`docs/MANUAL-TEST-DAY5C.md`.

## Notifications — STARTED, about 15% done (D89)

Exists:
- `apps/api/prisma/schema.prisma`: enum `NotificationType` and model
  `Notification` (relations added on Organization and User).
- Migration **`20261124191130_add_notifications`** — complete and final
  for the plan below; applied nowhere (`crm_test` needs my
  `pnpm db:verify-fresh`).
- `packages/shared/src/notifications.ts`, exported from `index.ts`.

Not written yet: service, routes, triggers, frontend, tests, docs, and
`'notifications'` in `apps/api/tests/helpers/reset-database.ts` (add it only
after I have run `pnpm db:verify-fresh`, or every API test fails).

Approved plan (do not re-ask):
- In-app only, no email. Bell with unread count in the app-shell header,
  `/notifications` list page, mark one read, mark all read.
- Rows store only type + entity id (no text, no personal data); title and
  link are built at read time from the live record.
- Endpoints (`auth: 'authenticated'`, no new permission): `GET
  /api/v1/notifications` (paged, `unreadOnly`, `meta.unread`), `GET
  /api/v1/notifications/unread-count`, `POST /api/v1/notifications/:id/read`,
  `POST /api/v1/notifications/read-all`. **Every query is scoped by
  organisation AND user**; another user's notification is a 404.
- Events, each written **after the main transaction commits**, best-effort
  (log and swallow errors — PRD §11: a failed notification must not roll
  back a valid lead):
  - lead or deal assigned to someone other than the actor: lead create and
    update (owner changed), deal create and update, deal created by lead
    conversion
  - new website enquiry (successful lead creation in intake): **every
    active user** in the organisation
  - quotation ACCEPTED or REJECTED: the quotation's owner, unless the owner
    made the change (`changeQuotationStatus` already returns `fromStatus`)
- Task due today / overdue, without a background worker: generated when the
  user loads the app (on the list and unread-count requests), for that user
  only, OPEN tasks of type TASK assigned to them, using the organisation's
  time zone (`orgDayBounds`). De-duplication keys: `task-due:<activityId>:
  <org date>` and `task-overdue:<activityId>`; insert with `createMany({
  skipDuplicates: true })`; best-effort, never fails the read; cap the batch.
- Polling: bell refetches every **60 seconds**, **paused while the tab is
  hidden** (TanStack `refetchIntervalInBackground: false`). Tell me in the
  report what this does to the free Render server (a visible tab keeps it
  from spinning down after ~15 minutes idle; a hidden tab lets it sleep).
- Tests: isolation between users and between organisations; each trigger;
  de-duplication; a forced notification failure does not roll back the
  lead; mark read / read all; web tests for the bell and the polling pause.
- Docs on completion: decisions D90+, PROJECT-STATE, NEXT-SESSION-START,
  DAY-5C-SUMMARY §2, MANUAL-TEST-DAY5C §Notifications with exact clicks,
  limits stated plainly.

## Reports — not started (approved plan)

- New permission `reports:read` (Admin + Staff; add to PERMISSIONS);
  CSV uses the existing `reports:export`.
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
- Tables plus simple charts; no PDF reports.

## Approved PRD deviations (D87) and future items

No product catalogue; no CGST/SGST/IGST split; no PDF reports; owner added
to quotations; the PDF is regenerated, never stored ("PDF reference" =
number + version). Future items: **GST split**, **product catalogue**.

## Guardrails

- Never read or edit a real `.env` file (`.env`, `.env.staging.local`).
- Never run anything against staging; never write to `crm_dev` (no
  `db:seed`, no `db:migrate`, no scripts that write); this tool may not
  apply migrations to `crm_test` either — ask me to run `pnpm db:verify-fresh`.
- Never commit or push.
- No `sh` scripts; Windows/cmd-friendly commands in anything you give me.
- Don't stop or restart my running dev servers; prove ports by PID.
- Ask before any new dependency or any permission-table change beyond
  `reports:read` (already approved).

## Steps I still have to do myself

1. `pnpm db:verify-fresh` (puts both new migrations on `crm_test`).
2. `pnpm db:migrate` (applies `20261124181711_add_quotations` and
   `20261124191130_add_notifications` to `crm_dev`; additive only).
3. Organisation PDF details: copy `apps\api\org-details.example.json`,
   fill it in, `pnpm org:set-details --file <file>`, then again with
   `--confirm`.
4. Click through `docs\MANUAL-TEST-DAY5C.md` (Quotations).
5. At the very end of Day 5c: from `apps\api`, `pnpm staging:migrate`, then
   `pnpm staging:set-org-details --file <file>` (dry run, then `--confirm`).

## First thing to do in the new session

After reading and the checks above, ask me whether I have run `pnpm
db:verify-fresh`. Once I confirm, add `'notifications'` to
`apps/api/tests/helpers/reset-database.ts`, run the full API suite to prove
the baseline (540/540), then continue Notifications from the service layer
as planned above.
