# Day 5a handover prompt — ready to paste into a fresh session

This file exists because Day 5a (website intake, API keys, the Enquiries
inbox) was stopped mid-build at a checkpoint on 2026-11-24. Paste everything
in the fenced block below as the first message of a new Claude Code session
to resume exactly where this one left off. The rest of this file (outside
the fence) is context for a human reading it before pasting, not part of the
prompt itself.

---

```
We are resuming Day 5 part (a) of the Grow Spark Sales & CRM project —
website intake, API keys, and the Enquiries inbox. A previous session
designed this fully and built a small amount of groundwork, then stopped at
a checkpoint. Nothing user-facing exists yet. Get your bearings before
writing any code.

STEP 0: READ FIRST, IN THIS ORDER
1. CLAUDE.md
2. docs/NEXT-SESSION-START.md
3. docs/PROJECT-STATE.md (skim the table of contents; read its Day 5a
   session-log entry at the end in full)
4. docs/decisions.md — specifically D71 (Day 5a), which has the complete
   design and reasoning for everything listed below. Read it in full before
   writing any code; do not re-derive these decisions from scratch.
5. docs/DAY-5A-SUMMARY.md (what's actually built vs. only designed)
6. apps/api/prisma/SCHEMA-SUMMARY.md — the website_submissions and api_keys
   rows, already updated for this day's schema change

Do not read or edit any real .env file (apps/api/.env,
apps/api/.env.staging.local, or their siblings) — blocked by this project's
deny rules, and off limits by instruction regardless. Do not run any command
against staging — the user runs `pnpm staging:migrate` themselves, against
migration `20261123194049_add_submission_spam_and_archive`. Do not commit or
push.

WHAT IS ALREADY DONE (do not redo it)
- Migration `20261123194049_add_submission_spam_and_archive`: adds
  `website_submissions.archived_at` (nullable) and a `SPAM` value to the
  submission-status list. Applied to `crm_dev` only.
- `apps/api/prisma/SCHEMA-SUMMARY.md` updated to match.
- `apps/api/src/lib/scoped.ts` and `apps/api/src/lib/duplicates.ts`: the
  `ctx` parameter on `scoped()` and the three `findDuplicate*` functions now
  accepts `{ orgId: string }` instead of the full `RequestContext` — a
  deliberate, backward-compatible widening (every real RequestContext
  already has orgId) so the intake code path (an API key, not a logged-in
  user) can call them without a fabricated fake session context.
- `packages/shared/src/api-keys.ts` and `packages/shared/src/intake.ts`:
  written, but NOT YET exported from `packages/shared/src/index.ts` and not
  imported anywhere yet. Read them before writing the enquiries.ts shared
  file or any API module, so you don't redefine the same shapes.

IMPORTANT: before step 0's docs tell you otherwise, assume the crm_test
database does NOT have today's migration yet. The one known failing test
(`tests/schema/website-submissions.test.ts`) confirms this. The very first
thing to do, before building anything else, is:

  a. Ask the user to apply migration `20261123194049_add_submission_spam_and_archive`
     to crm_test themselves (e.g. `pnpm db:verify-fresh`, which resets and
     fully re-migrates crm_test from zero and will prompt Prisma's own
     one-time human consent — or any other way they prefer). Do not attempt
     to work around this yourself by reading .env files or shelling out to
     swap DATABASE_URL — that was tried and explicitly blocked in the
     previous session; ask the user directly instead.
  b. Once confirmed, re-run `pnpm test` and confirm that one test now passes
     before building anything new on top of it.

WHAT IS LEFT, IN ORDER

1. packages/shared/src/enquiries.ts — SubmissionStatus-aware list/detail
   schemas for the Enquiries inbox (status now includes SPAM). Export
   everything new from packages/shared/src/index.ts (api-keys.ts, intake.ts,
   enquiries.ts all still need exporting).

2. apps/api/src/lib/api-key.ts — generateApiKey() (a long random value with
   a recognisable literal prefix, e.g. `gsk_live_` + 32 random bytes,
   base64url) and hashApiKey() (SHA-256, same pattern as
   apps/api/src/lib/session.ts's hashSessionToken). The verification step
   that uses these (in the middleware below) must do an exact hash lookup
   PLUS a crypto.timingSafeEqual comparison before trusting a match — see
   D71's "API key format and verification" bullet for the exact reasoning
   and its honest limits.

3. apps/api/src/middleware/api-key-auth.ts — attachApiKeyContext. Mounted
   GLOBALLY but scoped to the intake path only
   (`app.use('/api/v1/intake', attachApiKeyContext)`), in apps/api/src/app.ts
   BEFORE enforceOriginAndContentType. On a missing/invalid/revoked key,
   rejects with 401 immediately (never reaches the Origin check). On
   success, attaches `req.apiKeyCtx = { organizationId, apiKeyId, keyPrefix }`
   (add this type to apps/api/src/types/express.d.ts). Read D71's "Origin
   exemption" bullet carefully — this is a correction of the first draft,
   not the obvious first design, and the reasoning matters.

4. apps/api/src/middleware/csrf.ts — add the exemption: skip the Origin
   check (Content-Type check still applies) when `req.apiKeyCtx` is already
   set. Write the test this enables: a request to the intake route with a
   session cookie but no Authorization header must still be rejected (401,
   from step 3, before csrf.ts's logic is even reached); a request with a
   valid key and no Origin header must succeed; a valid key with the wrong
   Content-Type must still be 415.

5. apps/api/src/lib/route-registry.ts — add `'apiKey'` to the `RouteAuth`
   union. In `defineRoute`, an `'apiKey'` route should NOT get
   `attachSessionContext` or `requirePermission` (auth is already handled by
   step 3's global middleware by the time the route's own chain runs).
   Update apps/api/tests/lib/route-registry.test.ts: the existing test that
   every route is `'public'`/`'authenticated'`/a real permission must also
   allow `'apiKey'`; add a new test asserting the apiKey-auth routes are
   exactly the expected allow-list (just the one intake route, today).

6. apps/api/src/lib/rate-limit.ts (or a new sibling file, your call) — two
   limiters for the intake route: per-key and per-IP, both much stricter
   than anything else in the app (recommend 60/minute per key, matching the
   original roadmap's own number; pick a looser per-IP number, e.g. 120/min,
   as a secondary layer). Read D71's "per-IP rate limiting" bullet before
   writing the comment that explains these — the per-IP one is honestly
   expected to do little on the real Render deployment given
   `TRUST_PROXY=false` (D60), which you must NOT change without asking
   first. The per-key limiter is the one that actually protects anything in
   production; say so plainly in the code comment, not just here.

7. apps/api/src/logger.ts — add an explicit redact path for the
   `Idempotency-Key` request header (bracket syntax for the hyphenated key:
   `req.headers['idempotency-key']`), consistent with the file's existing
   comment style ("in case a future change does"). `req.headers.authorization`
   (the API key itself) is already redacted — confirm this, don't re-add it.

8. apps/api/src/modules/api-keys/ — api-keys.service.ts (createApiKey,
   listApiKeys, revokeApiKey, rotateApiKey — rotate = revoke old + create
   new in one transaction) and api-keys.routes.ts. Admin only — use the
   existing `PERMISSIONS.SETTINGS_MANAGE` permission (matches the original
   roadmap's own role table: "manage settings and API keys" is Admin-only).
   `GET /api/v1/api-keys` never returns a hash or the raw key, only
   `keyPrefix`. `POST /api/v1/api-keys` and the rotate endpoint return the
   raw key value exactly once, in a response shape distinct from the list
   shape (`apiKeyCreatedResponseSchema` in the shared package already has
   this).

9. apps/api/src/modules/intake/ — the field-mapping helper (lenient,
   best-effort — the real website form's exact field names are not
   confirmed yet, per CLAUDE.md's website-repo rule; see the original
   roadmap PDF's mapping table in the conversation history this session
   doesn't have, or just build a reasonable lenient mapper that extracts
   name/email/phone/company/website/challenge/industry and puts everything
   else into capturedFields — requires an email or phone after mapping, or
   the submission is REJECTED), intake.service.ts, and intake.routes.ts.

   Read D71's "idempotency must win over body validation" bullet before
   writing this — it is a real, deliberate deviation from this codebase's
   normal `defineRoute({ validate: { body: schema } })` convention. The
   (organizationId, externalId) lookup must run first, against the raw
   body, before `websiteEnquiryIntakeSchema.parse()` is ever called. Write
   the required test: the same Idempotency-Key sent twice, the second time
   with a different (and, in the test, invalid) body, must return the
   original result untouched.

   Honeypot (`hp` field): a non-empty value stores the submission as
   **`SPAM`** (not REJECTED) with no Lead created, and the HTTP response
   must be byte-for-byte the same shape as a real success (201, same
   envelope, `leadId: null`, `duplicate: false`) — never tell the sender it
   was caught.

   On a genuine mapping failure (no email or phone after mapping), store
   the submission as REJECTED with the error message, respond 422.

   On success: create the Lead (source "Website", looked up by name like
   the existing "Manual" lookup in leads.service.ts's createLead), create
   the WebsiteSubmission row already as LEAD_CREATED with leadId set (one
   insert, not create-then-update), write an audit event with
   `actorId: null` and `metadata: { submissionId, apiKeyPrefix }` ONLY —
   never the raw key, the Idempotency-Key value, or any enquiry field. Then
   call findDuplicateLeads({ orgId: organizationId }, ...) — note it no
   longer needs a full RequestContext, per item 2 of "already done" above —
   and return `possibleDuplicateLeadIds`.

10. apps/api/src/modules/enquiries/ — list (status/formType/date-range/
    archived filters, same visibility as Leads — PERMISSIONS.LEADS_READ),
    detail (includes the raw payload and a linked-lead summary), mark-spam
    (PERMISSIONS.LEADS_WRITE — also archives the linked Lead, if one exists,
    in the same transaction), archive/restore
    (PERMISSIONS.RECORDS_ARCHIVE, same convention as every other archivable
    resource).

11. Wire everything into apps/api/src/app.ts: the new global
    attachApiKeyContext mount (before enforceOriginAndContentType), and the
    three new route-registration calls (api-keys, intake, enquiries).

12. Tests throughout — don't batch them all to the end. Specifically needed,
    beyond the ones named above: API-key hashing/rotation/revocation
    (revoked key stops working on its very next request); honeypot behaviour
    (SPAM status, no Lead, success-shaped response); duplicate-email/phone
    warning on a successful intake; cross-organisation isolation (an API key
    from one org can never see or affect another org's data); the RBAC
    sweep (Staff vs Admin on every new route).

13. Frontend: an Admin-only API Keys screen (reasonable location:
    apps/web/app/(protected)/settings/api-keys/ — there is no existing
    /settings route, this would be the first; gate its nav item in
    app-shell.tsx the same way the existing Users nav item is gated on
    `isAdmin`) with create (show the full key once, in a dialog, with a
    copy button and a clear "you will not see this again" warning),
    list, revoke, rotate. An Enquiries screen (list + detail, linked from
    the main nav the same way Leads/Deals are, visible to both roles) with
    the filters above, a raw-payload viewer, and mark-spam/archive/restore
    actions.

14. Docs: once the above is actually built and tested, update
    docs/decisions.md (continuing from D72), docs/PROJECT-STATE.md,
    docs/NEXT-SESSION-START.md, replace docs/DAY-5A-SUMMARY.md's
    "mid-build" framing with a real finished-day summary (same style as
    DAY-1 through DAY-4), and fill in docs/MANUAL-TEST-DAY5A.md's checklist
    for real (it's currently a placeholder with nothing checked off). Write
    a curl-based replay script/`.http` file demonstrating the intake
    contract, per the original brief's ask for "a documented curl example
    and a small test script" instead of touching the real website.

GUARDRAILS (same as every session on this repo, restated because they
matter specifically here)
- Never read or edit a real .env file. Never run anything against staging —
  the user runs `pnpm staging:migrate` themselves, against migration
  `20261123194049_add_submission_spam_and_archive`.
- Never commit or push. Report what was built and wait.
- Do not touch the Grow Spark website repository, or assume/build toward
  its real field names — the intake field mapping in this work is
  deliberately lenient and best-effort for exactly this reason.
- Any change to the role-permission table needs explicit approval — this
  work should not need one (it reuses SETTINGS_MANAGE, LEADS_READ,
  LEADS_WRITE, RECORDS_ARCHIVE, all of which already exist with the right
  role shape); flag it and ask first if you find yourself wanting a new
  permission string.
- Run pnpm typecheck && pnpm lint && pnpm test before reporting anything
  done, and report the actual output, not a summary of what should pass.

FIRST THING TO DO
Read the files in STEP 0, then ask the user to confirm crm_test has today's
migration applied (don't attempt to apply it yourself) before writing any
new code. Report back in plain language before proceeding past that point.
```
