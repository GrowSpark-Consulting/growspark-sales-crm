#!/usr/bin/env bash
# Human-run, curl-based demonstration of the website intake contract
# (docs/intake-contract.md). Never touches the real Grow Spark website —
# every request here goes to a locally running copy of this API.
#
# Usage:
#   1. Start the API locally (pnpm --filter api dev) and create an API key
#      for your organisation — either via the Admin-only API Keys screen
#      (/settings/api-keys) or `POST /api/v1/api-keys`, and copy the raw key
#      value (shown exactly once).
#   2. Run:
#        API_KEY=gsk_live_... ./scripts/replay-intake.sh
#      Optionally override the target:
#        BASE_URL=http://localhost:4000 API_KEY=gsk_live_... ./scripts/replay-intake.sh
#
# This walks through four of the contract's named behaviours in order:
# a successful submission, a replay of the same Idempotency-Key (duplicate:
# true, nothing new created), a honeypot hit (stored as SPAM, but a
# success-shaped response), and a genuine mapping failure (stored REJECTED,
# 422 returned).

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:4000}"
API_KEY="${API_KEY:?Set API_KEY to a valid key created via /settings/api-keys or POST /api/v1/api-keys}"
ENDPOINT="$BASE_URL/api/v1/intake/website-enquiries"

random_id() {
  # A UUID-shaped idempotency key is what the real website would send; any
  # unique string works, this just avoids colliding with a previous run.
  date +%s%N
}

post() {
  local idempotency_key="$1"
  local body="$2"
  curl -sS -X POST "$ENDPOINT" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Idempotency-Key: $idempotency_key" \
    -H "Content-Type: application/json" \
    -d "$body" \
    -w '\nHTTP %{http_code}\n'
}

echo '=== 1. A successful submission (the roadmap'"'"'s own sample "contact" payload) ==='
SUCCESS_KEY="replay-demo-$(random_id)"
post "$SUCCESS_KEY" '{
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
}'
echo

echo '=== 2. Replaying the same Idempotency-Key, with a DIFFERENT (and deliberately invalid) body ==='
echo '    Expect the ORIGINAL result back (same submissionId/leadId, "duplicate": true) — the'
echo '    new, invalid body below is never processed. 200, not 422.'
post "$SUCCESS_KEY" '{ "formType": "contact" }'
echo

echo '=== 3. A honeypot hit — expect a 201 that looks exactly like a real success ==='
echo '    (leadId: null, duplicate: false — but check the Enquiries screen: status is SPAM,'
echo '    no Lead was created, and the sender is never told it was caught)'
post "spam-demo-$(random_id)" '{
  "formType": "contact",
  "fields": { "name": "Bot", "email": "bot@example.com" },
  "hp": "a bot filled this in"
}'
echo

echo '=== 4. A genuine mapping failure — no email or phone after mapping ==='
echo '    Expect 422, and the submission stored as REJECTED (visible in the Enquiries screen)'
post "rejected-demo-$(random_id)" '{
  "formType": "contact",
  "fields": { "name": "No Contact Info", "company": "Acme" }
}'
