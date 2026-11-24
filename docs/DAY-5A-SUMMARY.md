# Day 5a Summary — Sales & CRM

Written at the end of Day 5a (2026-11-24) for anyone who wants a plain read
of what exists and how it was checked, without digging through
`decisions.md`'s full technical log. For the *next* session's starting
point, read `docs/NEXT-SESSION-START.md` instead — this file is a look
back, not a plan forward.

Day 5a started and paused mid-build earlier the same day (the plan
approved, a migration applied, two unused shared-package files on disk) and
was resumed and finished in a later session the same day, once the user
confirmed `crm_test` had the day's migration applied.

## What was built

**A pre-existing bug, fixed first at the user's own request.**
`pnpm db:verify-fresh` (and `pnpm db:reset`) failed on Windows with
`spawnSync pnpm ENOENT` — the exact `.cmd`-shim problem a previous day
(D63) had already diagnosed and fixed for `staging-migrate.ts`, but
explicitly left unfixed in these two scripts at the time. Both now use the
same already-tested `runPrismaCli()` helper that fix built.

**API keys.** A key is a long random value with a recognisable prefix
(`gsk_live_` + 32 random bytes, base64url) — only its SHA-256 hash is ever
stored, looked up by an exact indexed match plus a `crypto.timingSafeEqual`
comparison on top. An Admin-only screen (`/settings/api-keys`, the first
`/settings` route in this app) can create, list, revoke, and rotate keys;
create and rotate both show the raw key exactly once, in a dialog with a
copy button and a clear "you will not see this again" warning — list rows
only ever show a short `keyPrefix`.

**The website intake endpoint.** `POST /api/v1/intake/website-enquiries`
authenticates by API key, not a session — a new kind of route for this app,
which needed its own middleware (`attachApiKeyContext`), its own CSRF
exemption (conditioned on a verified key, never on the URL path alone — a
session cookie with no key is still rejected), and its own rate limits
(60/minute per key, the real protection; a much looser 120/minute per IP,
honestly documented as weak on this app's current deployment). A website
form's exact field names aren't confirmed yet (the website repository is
off limits), so the field mapping is deliberately lenient: it tries a
handful of reasonable aliases per target field and keeps everything else
instead of rejecting an unrecognised one. A repeated submission (same
`Idempotency-Key`) always returns the original result, even if the retried
body is different and would itself fail validation. A honeypot field, if
filled in, stores the submission as spam and creates no Lead — but the
response looks exactly like a real success, so a bot is never told it was
caught. A submission that genuinely has no usable email or phone after
mapping is stored as rejected, with the reason, and nothing is lost
silently. A successful submission creates a Lead (source "Website") and
surfaces a warning, never a block, if it looks like a duplicate of an
existing one.

**The Enquiries inbox.** A screen (`/enquiries`, visible to both Admin and
Staff, same as Leads) listing every website submission — filterable by
status, form type, a received-date range, and archived — with a detail page
showing the raw submitted payload, the Lead it created (if any), and
actions to mark it as spam by hand (which also archives the Lead it
created), archive, or restore.

## How it was verified

**Automated.** `pnpm typecheck` and `pnpm lint` were clean at every stage.
Test count: 359 (start of this session) → 402 (once the intake endpoint
itself was built and tested) → 409 (end of the first build pass) → **427
`apps/api` + 91 `apps/web` = 518 total**, all passing, after a follow-up
pass closed every gap a user audit found in the first pass's coverage (see
"What is tested vs. reasoning only" below). New coverage includes: API-key
generation/hashing/verification as pure functions, plus hashing, rotation,
and revocation through the real middleware (a revoked or rotated key stops
working on its very next request); the three authentication/Origin-
exemption scenarios named in the design (a cookie with no key is rejected,
a key with no Origin header still succeeds, a key with the wrong
Content-Type is still refused); idempotency, including the specific
required case of a replayed key with a deliberately invalid second body;
the honeypot behaviour; audit-row content for every intake outcome; log
redaction; per-key and per-IP rate limiting; and cross-organisation
isolation throughout.

### What is tested vs. reasoning only

The user asked, after the first build pass, for an explicit accounting of
which of D71's eight binding refinements were actually proven by a test
versus only implemented and reasoned about. The answer at the time exposed
two real gaps, both closed in the same follow-up pass — stated here plainly,
not just in `docs/decisions.md`:

| # | Refinement | Status | Proof |
|---|---|---|---|
| 1 | Honeypot → success-shaped response, no Lead | **Tested** | `tests/intake/honeypot.test.ts` |
| 2 | SHA-256 hash + constant-time compare | **Tested** (closed a gap) | `tests/lib/api-key.test.ts` — `hashApiKey`/`verifyApiKeyHash` unit-tested directly (deterministic, never equals the raw key, true/false/mismatched-length cases); end-to-end behaviour also in `tests/middleware/api-key-auth.test.ts` |
| 3 | Origin exemption only with a valid key | **Tested** | `tests/middleware/csrf.test.ts` (unit) + `tests/intake/auth-and-rate-limit.test.ts` (end to end) |
| 4 | Per-key and per-IP limits, and what per-IP really proves on Render | **Tested** (closed a gap), **with an honest limit stated in the test itself** | `tests/intake/auth-and-rate-limit.test.ts` — per-key: a real 61-request test; per-IP: `createIntakeIpRateLimiter`'s ceiling mechanism proven with a low test ceiling (3), not the real 120. **This proves the rate-limiting code works as written. It cannot prove, and does not claim, that `req.ip` is a genuine distinct value per real caller once deployed on Render — that remains reasoning only (D60/D71/D72), not testable from this environment.** |
| 5 | No secrets/personal data in logs or audit | **Tested** (closed a gap) | `tests/intake/audit.test.ts` — reads back the real `auditEvent` row after a success, a spam hit, and a rejection; asserts `actorId` is null, `metadata` is exactly `{ submissionId, apiKeyPrefix }`, and the raw key/Idempotency-Key value/name/email/phone/message appear nowhere in the row. `tests/logger.test.ts` — asserts the exported redact-path list names both headers, and proves a pino instance built from that exact config actually censors them while leaving an unrelated field untouched. |
| 6 | Same Idempotency-Key, different body, returns the original | **Tested** | `tests/intake/idempotency.test.ts`, the test literally named for this requirement |
| 7 | Retention note | **Reasoning only, by design** | A recorded decision not to build a retention policy (D71) — there is no behaviour to test |
| 8 | Migration name / schema change | **Tested** | `tests/schema/website-submissions.test.ts` (the unique constraint) plus every intake/enquiries test that exercises `archivedAt`/`SPAM` |

**Manual — not yet done by anyone.** This environment has no
browser-automation tool, so neither new screen has actually been clicked
through. What *was* checked: both dev servers were started, the new and
existing pages all returned a plain `200` through the Next.js proxy (no
server crash in the new routes), and the two new API routes correctly
returned `401` unauthenticated through that same proxy — then both servers
were shut down cleanly. `docs/MANUAL-TEST-DAY5A.md` has real, runnable
steps now (including `curl` commands matching the real contract) but every
box is unchecked, honestly, because none of it has been run by a human in
a real browser yet.

## Judgment calls worth knowing about

Full detail, with reasoning, in `docs/decisions.md` D72 (backend) and D73
(frontend):

- A replay of a submission that was originally rejected re-throws the same
  error, rather than being re-processed — read as "a repeated key always
  wins" applying to every outcome a submission could have had, not only a
  successful one.
- The Enquiries list endpoint supports sorting even though the plan's text
  for this item didn't name it explicitly — every other list endpoint in
  this app already has one, so this was treated as a baseline convention,
  not scope creep. Flagged to the user, who confirmed keeping it.
- Audit rows for intake (success, honeypot, or rejection) are written
  directly, bypassing this app's shared audit-writing helper — that helper
  assumes a logged-in human actor, which doesn't exist on this no-session
  path.

## Docs and a replay script

`docs/intake-contract.md` is the full written contract (headers, body
shape, the field-mapping table, every response code, idempotency and
honeypot behaviour). `apps/api/scripts/replay-intake.sh` is a small,
human-run `curl` script that walks through a successful submission, a
replay with an invalid second body, a honeypot hit, and a rejection —
against a local copy of the API only, never the real website. Its syntax
was checked and its four scenarios mirror cases the automated test suite
already exercises, but it was not run live against a real server and a real
key, to avoid creating demo data in the shared local development database
without asking first.

## How to run and test it

Same setup as earlier days (`docs/DAY-1-SUMMARY.md` has the full first-time
steps).

- Create an API key for your organisation via the new **API Keys** nav
  item (Admin only), then run `API_KEY=<your key> apps/api/scripts/replay-intake.sh`
  against a locally running API to see the contract in action.
- The sidebar now has an **Enquiries** entry (visible to both roles) and an
  **API Keys** entry (Admin only, under the same section as Users).
- To re-run the full automated check from a clean state:
  ```
  pnpm typecheck && pnpm lint && pnpm --filter api test && pnpm --filter web test && pnpm build
  ```
  Expect 518 tests passing (427 `apps/api`, 91 `apps/web`).
- To re-run the manual browser script, follow `docs/MANUAL-TEST-DAY5A.md`
  top to bottom — nothing in it has been checked off yet.
