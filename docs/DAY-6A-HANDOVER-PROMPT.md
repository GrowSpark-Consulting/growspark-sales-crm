# Handover prompt after Day 6a (paste into a new session)

You are continuing the Grow Spark Sales & CRM project (pnpm monorepo:
apps/web Next.js, apps/api Express + Prisma, packages/shared). Start by
reading, in this order: docs/NEXT-SESSION-START.md, docs/PROJECT-STATE.md
(§1's latest entries, §13, and §15's latest session log), docs/decisions.md
D93–D95, README.md, and the PRD if attached. Do not rely on memory of
earlier sessions.

## Where things stand

**Day 6a is complete** (2026-11-25): the last three PRD core features.

1. **Settings (D93)** — /settings hub (both roles; Staff see only My
   profile); organisation profile (the quotation PDF header), lead sources
   (add/rename/deactivate/reorder; Website, Manual and Import locked),
   pipeline stages (rename, probability, reorder, add, delete only if never
   used), My profile with change password (a wrong current password is now
   a 422 field error, not a 401 that signed the user out). Leads/deals can
   no longer be set to an inactive source.
2. **Global search (D94)** — top-bar box (Ctrl+K or /), GET /api/v1/search,
   per-word matching across leads, contacts, companies, deals and
   quotations, 5 per group, archived and other-organisation records
   excluded, each group gated by its read permission.
3. **CSV import (D95)** — /leads/import and /contacts/import: map columns,
   row-by-row preview, duplicate emails skipped (archived count), unknown
   companies created on a contacts import, one import.completed audit row
   with origin and counts, an errors file to download, 1 MB / 1,000 rows.

No migration, no new dependency, no permission-table change in Day 6a.
Counts: **apps/api 644/644, apps/web 147/147 (791)**. Nothing committed by
the tool (the user commits); nothing run against staging or crm_dev.

## Waiting on the user

- Review and commit Day 6a.
- Decide the approved-deviation candidates (PROJECT-STATE §13): custom
  fields; editable currency/date format/time zone; saved filters; Excel
  .xlsx import; semicolon files; importing companies/deals; undo of an
  import; updating records from a file; phone/company duplicate matching on
  import.
- Decide whether to fix the pre-existing list-search wildcard quirk (D94:
  % and _ over-match in every list page's ?q= search).
- Browser passes: docs/MANUAL-TEST-DAY6A.md §1–§5 and
  docs/MANUAL-TEST-DAY5C.md §1–§9 (neither has been clicked through).
- Staging: pnpm staging:migrate (the two Day 5c migrations; Day 6a adds
  none) and organisation details — now editable in Settings once deployed.

## Next work

The rest of Day 6 (testing and stabilisation) — confirm its scope with the
user before starting. Fix anything the browser passes surface first.

## Hard rules (same as every session)

- NEVER commit or push — the user does that.
- NEVER read or edit real env files. NEVER run anything against staging.
  NEVER run db:seed or db:migrate against crm_dev. Test database (crm_test)
  and existing test tooling only.
- Fictional data only. No secrets in code, docs, logs or chat.
- Organisation-scoped queries; existing permission strings; a new
  permission only if needed, and say so.
- Run typecheck, lint, all tests and the web build after each change set
  (run the API and web suites one after the other; running them together
  once caused a load-related timeout in an unchanged quotation test).
- Windows: no sh scripts; spawn via process.execPath.
- Record each new decision in docs/decisions.md (continue from D96); update
  PROJECT-STATE.md, NEXT-SESSION-START.md and the relevant MANUAL-TEST file.
