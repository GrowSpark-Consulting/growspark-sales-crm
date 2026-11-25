# Handover prompt after Day 6b (paste into a new session)

You are continuing the Grow Spark Sales & CRM project (pnpm monorepo:
apps/web Next.js, apps/api Express + Prisma, packages/shared). Start by
reading, in this order: docs/NEXT-SESSION-START.md, docs/PROJECT-STATE.md
(§1's latest entries, §13, §14's first items, and §15's latest session log),
docs/decisions.md D96–D100, README.md, and the PRD if attached. Do not rely
on memory of earlier sessions.

## Where things stand

**Day 6b is complete** (2026-11-25): four refinements the user asked for.

1. **D96 — approved deviations** (docs only): bulk operations on lists (PRD
   5.3), calendar view (5.6), enquiry read/unread (5.8).
2. **D97 — pickers list options on open.** One shared
   `components/pickers/record-combobox.tsx` behind CompanySelect,
   ContactSelect and a new CompanyFilter: the first 20 records A–Z as soon
   as it is opened, typing narrows via `?q=`, Loading / Searching / "type to
   search more" states, keyboard + `aria-activedescendant`. The Deals and
   Quotations company filters now reach every company.
3. **D98 — required fields.** Lead: first name + company name + email or
   phone. Contact: first name + company + email or phone. Company: name.
   Deal and quotation unchanged. Forms, API (shared Zod) and CSV import;
   website intake exempt; no database constraint added or removed. Source is
   optional everywhere ("Not specified (saved as Manual)" on New lead). Two
   pre-existing bugs fixed: a new lead without a source could not be saved;
   the company box blanked right after a pick.
4. **D99 — one phone input everywhere** (lead, contact, company,
   organisation settings; users have no phone). Per-country digit table in
   `packages/shared/src/phone.ts` (India exactly 10 digits, not starting with
   0 — landlines allowed); digits only; an extra digit past the limit cannot
   be typed; "7/10" counter; pastes cleaned up (too-long ones refused, never
   truncated); the same messages from the shared rule the server applies.
   The CSV import uses the same clean-up; intake stays lenient.
5. **D100 — My Tasks** defaults to the signed-in user's tasks; an "Assigned
   to" dropdown (Me / Everyone / each user) lives in the page address.

No migration, no new dependency, no permission-table change. Counts:
**apps/api 658/658, apps/web 183/183 (841)**. Nothing committed by the tool
(the user commits); nothing run against staging or crm_dev.

## Waiting on the user

- Review and commit Day 6b.
- Decide: should deal list responses carry the company name, so the Deals
  list's Company column and the pipeline cards work beyond the first 100
  companies (D97, reported, not changed)? And the older Day 6a candidates
  (PROJECT-STATE §13).
- Browser passes: docs/MANUAL-TEST-DAY6B.md §1–§4, docs/MANUAL-TEST-DAY6A.md
  §1–§5 (its §5 was updated for D98) and docs/MANUAL-TEST-DAY5C.md §1–§9 —
  none has been clicked through.
- Staging: pnpm staging:migrate (the two Day 5c migrations; Days 6a/6b add
  none).

## Next work

The rest of Day 6 (testing and stabilisation) — confirm its scope with the
user before starting. Fix anything the browser passes surface first.

## Hard rules (same as every session)

- NEVER commit or push — the user does that.
- NEVER read or edit real env files. NEVER run anything against staging.
  NEVER run db:seed or db:migrate against crm_dev. Test database (crm_test)
  and existing test tooling only.
- Fictional data only. No secrets in code, docs, logs or chat.
- No new dependency without asking. Organisation-scoped queries; existing
  permission strings.
- Run typecheck, lint, all tests and the web build after each change set
  (run the API and web suites one after the other).
- Windows: no sh scripts; spawn via process.execPath. When editing files
  from Python, write with `newline='\n'` (the repo is `eol=lf`).
- Record each new decision in docs/decisions.md (continue from D101); update
  PROJECT-STATE.md, NEXT-SESSION-START.md and the relevant MANUAL-TEST file.
