# Website intake contract

`POST /api/v1/intake/website-enquiries` — server-to-server only, authenticated
by an API key, never a browser session. This is the one route in this API
that uses `auth: 'apiKey'` (see `docs/decisions.md` D71/D72 for the full
design reasoning).

## Headers

| Header | Value |
|---|---|
| `Authorization` | `Bearer <api key>` — created via the Admin-only API Keys screen (`/settings/api-keys`) or `POST /api/v1/api-keys` |
| `Idempotency-Key` | **Required.** The website's own stable submission id (its own generated UUID is a good choice). Stored as `website_submissions.external_id`, unique per organisation. |
| `Content-Type` | `application/json`. Body capped at 100 KB (the same global limit every route uses — D71 kept this instead of a separate 64 KB intake-only limit). |

A request missing any of the above is rejected before anything is stored:
missing/invalid/revoked key → `401`; missing `Idempotency-Key` → `422`; wrong
`Content-Type` → `415`; oversized body → `413`.

**Note on CORS/CSRF**: this route is exempt from the usual same-origin
`Origin` check, but only once a valid API key has already been verified — a
request carrying a session cookie but no key is still rejected with `401`
before that exemption is ever reached. The `Content-Type` check is never
exempted.

## Request body

```json
{
  "formType": "contact",
  "submittedAt": "2026-11-18T09:12:44Z",
  "sourcePage": "https://www.growsparkconsulting.com/contact/",
  "fields": {
    "name": "Asha Rao",
    "email": "asha@example.com",
    "company": "Example Foods Pvt Ltd",
    "team_size": "51-200",
    "challenge": "Manual order tracking is slowing our plants.",
    "website": "https://example.com",
    "revenue": "2cr-10cr",
    "context": ""
  }
}
```

- `formType` (required, string) — any value is accepted; it is stored as-is
  and mapped to a human-readable `sourceDetail` on the created Lead (see the
  table below; an unrecognised `formType` falls back to `Website / <formType>`
  rather than being rejected).
- `submittedAt` (optional, ISO datetime with offset) — when the visitor
  actually submitted the form, if the website tracks it separately from
  `receivedAt` (when this API received it).
- `sourcePage` (optional, string, max 2000 chars) — the page the form was on.
- `fields` (required, object, at most 50 keys) — **deliberately a loose,
  open record, not a strict per-`formType` shape.** The real Grow Spark
  website form is not connected yet and its exact field names are not
  confirmed (`CLAUDE.md` — that repository is off limits until a separate,
  explicitly-approved patch), so this API is intentionally lenient: it tries
  a handful of reasonable aliases per target field (see the mapping table)
  and never rejects a submission just because of an unrecognised field name.
  Everything not consumed by the mapping lands in the created Lead's
  `capturedFields`, so nothing is silently dropped.
- `hp` (optional, string, max 500 chars) — **the honeypot.** A hidden field a
  real visitor never sees or fills, included here deliberately so the eventual
  website form can set it up. See "Honeypot" below.

## Field mapping (lenient, best-effort)

| Target | Field-name aliases tried, in order |
|---|---|
| Name (split into first/last on the first space) | `name`, `full_name`, `fullName` |
| Email | `email` |
| Phone | `phone`, `phone_number`, `phoneNumber`, `mobile` |
| Company name | `company`, `company_name`, `companyName` |
| Website | `website` |
| Requirement (the Lead's `requirement` field) | `challenge`, `message`, `requirement` |
| Industry | `industry` |

Every other key in `fields` is copied into the created Lead's
`capturedFields` unchanged — nothing recognised by none of the aliases above
is ever discarded.

`formType` → `sourceDetail` on the created Lead:

| `formType` | `sourceDetail` |
|---|---|
| `contact` | `Website / Contact Form` |
| `engagement_application` | `Website / Engagement Application` |
| `strategy_session` | `Website / Strategy Session` |
| `growth_intensive` | `Website / Growth Intensive` |
| anything else | `Website / <formType>` |

**A submission needs an email or a phone after mapping, or it is rejected.**
A name alone, or only unmapped fields, is not enough.

## Responses

| Status | Meaning |
|---|---|
| `201` `{ "data": { "submissionId", "leadId", "duplicate": false, "possibleDuplicateLeadIds": [] } }` | A new Lead was created, source "Website". `possibleDuplicateLeadIds` lists any existing Lead(s) in the same organisation that share a normalised email, phone, or company name — a warning, never a block. |
| `200` same shape, `"duplicate": true` | A replay of an already-seen `Idempotency-Key`. Returns the **original** result untouched — see "Idempotency" below. |
| `422` `VALIDATION_FAILED` | The envelope failed validation, or mapping produced no usable email or phone. The raw payload is still stored (status `REJECTED`, with the error message), so nothing is lost silently — visible in the Enquiries screen. |
| `401` `UNAUTHENTICATED` | Missing, unknown, malformed, or revoked API key. |
| `413` | Body over 100 KB. |
| `415` | `Content-Type` is not `application/json`. |
| `429` `RATE_LIMITED` | Per-key limit (60/minute — the real protection) or the secondary per-IP limit (120/minute, honestly weak on this deployment; see D71/D72) exceeded. |

## Idempotency

The `(organizationId, externalId)` pair is unique. A repeat `Idempotency-Key`
**always returns the original result**, even if the replayed body is
different — and even if the replayed body would itself fail validation. This
is checked before the request body is validated at all, a deliberate
exception to this codebase's usual "validate first" convention (see D71's
"idempotency must win over body validation" bullet). A replay of a
previously-`REJECTED` submission replays the same `422` with the same stored
message; nothing about a replay ever creates a new row or a new Lead.

## Honeypot

A non-empty `hp` value stores the submission as **`SPAM`** (not `REJECTED` —
that status is reserved for a genuine mapping failure) and creates no Lead.
The HTTP response is **byte-for-byte the same shape as a real success** (same
envelope, `leadId: null`, `duplicate: false`) — a prober is never told it was
caught. Staff can later mark any enquiry as spam by hand from the Enquiries
screen too (which also archives the Lead it created, if any), independent of
this automatic path.

## Demonstrating the contract

`apps/api/scripts/replay-intake.sh` is a small, human-run `curl`-based script
that exercises this contract end to end (success, a replay, the honeypot,
and a rejection) against a running local API — see that file's own header
comment for how to run it. It never touches the real Grow Spark website.
