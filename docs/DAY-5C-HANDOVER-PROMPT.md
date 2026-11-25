# Day 5c handover prompt — paste everything below the line into a fresh session

Last updated: 2026-11-25, after Reports was finished (D92). **Day 5c is
complete**; this prompt is for follow-up work on it (fixes from my browser
pass, staging) before Day 6.

---

Day 5c of the Grow Spark Sales & CRM is complete: (1) Quotations, (2)
Notifications, (3) Reports — all built and automatically tested, none yet
clicked through in a browser. I am running `docs/MANUAL-TEST-DAY5C.md` and
may bring back bugs. The PRD is the source of truth; where it differs from
my brief, the PRD wins unless a recorded decision says otherwise, and you
tell me about the difference.

## Read first, in this order (no code until you have)

1. `CLAUDE.md`
2. `docs/NEXT-SESSION-START.md`
3. `docs/PROJECT-STATE.md` (skim the headings; read §1's last updates, §10
   gotchas, §12 conventions, the end of §15 session log)
4. `docs/decisions.md` — all of **D83–D92** (Day 5c)
5. `docs/DAY-5C-SUMMARY.md`, `docs/MANUAL-TEST-DAY5C.md`
6. The code for whichever feature a bug report is about:
   `apps/api/src/modules/{quotations,notifications,reports}/`,
   `apps/api/src/modules/workspace/workspace.service.ts` (shared range rule
   and the Home queries Reports reuses), `apps/web/components/{quotations,
   notifications,reports,dashboard}/`, `apps/web/hooks/use-{quotations,
   notifications,reports}.ts`.

Then run the read-only checks (git status/log, node/pnpm/docker versions,
`netstat -ano | findstr ":3000 :4000"`), and wait for my first prompt.

## State at handover

- Migrations `20261124181711_add_quotations` and
  `20261124191130_add_notifications` are applied to `crm_test` and `crm_dev`
  (by me); **not yet to staging**. Reports needed no migration.
- Permissions added in Day 5c: `quotations:read`, `quotations:write`,
  `reports:read` (Admin + Staff). Dependency added: `pdfkit@0.20.2` (+ dev
  `@types/pdfkit@0.17.7`).
- Last verified: `pnpm typecheck` clean; `pnpm lint` 0 errors (3 older web
  warnings); `pnpm test` **apps/api 593/593, apps/web 126/126 (719)**; web
  production build compiles every route.

## Approved PRD deviations and future items

- Quotations (D87): no product catalogue; no CGST/SGST/IGST split; no PDF
  reports; owner added to quotations; the PDF is regenerated, never stored.
- Notifications (D91): no deal-change notifications; no invitation
  notifications (no invite flow); no notification preferences; "reminders"
  = task due today only; a manual lead notifies only its owner.
- Reports (D92) — reported, **not yet decided by me**: leads by status/date
  and the revenue trend are on Home only; no per-person activity report;
  CSV only (no .xlsx).
- Future items: **GST split**, **product catalogue**, **notification
  preferences**, **deal-change notifications**.

## Guardrails

- Never read or edit a real `.env` file (`.env`, `.env.staging.local`).
- Never run anything against staging; never write to `crm_dev` (no
  `db:seed`, no `db:migrate`, no scripts that write); this tool may not
  apply migrations to `crm_test` either — ask me to run `pnpm db:verify-fresh`.
- **Never commit or push** — I commit and push myself.
- No `sh` scripts; Windows/cmd-friendly commands in anything you give me.
- Don't stop or restart my running dev servers; prove ports by PID. (A
  `pnpm --filter web build` is safe alongside `next dev`: Next 16 keeps dev
  output in `.next/dev`. `tsx watch` restarts its own child process when API
  files change, so the API's PID can change without anyone stopping it.)
- Ask before any new dependency or any permission-table change.

## Steps I still have to do myself

1. Organisation PDF details: copy `apps\api\org-details.example.json`,
   fill it in, `pnpm org:set-details --file <file>`, then again with
   `--confirm`.
2. Click through `docs\MANUAL-TEST-DAY5C.md` §1–§9.
3. From `apps\api`: `pnpm staging:migrate`, then
   `pnpm staging:set-org-details --file <file>` (dry run, then `--confirm`).

## First thing to do in the new session

After reading and the checks above, wait for my first prompt (bug reports
from the browser pass, a decision on the D92 Reports differences, or Day 6
scope).
