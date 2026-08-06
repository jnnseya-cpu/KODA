#!/usr/bin/env bash
# KODA — Door 3 (API) smoke test.
# Runs the 3 core endpoints against a KODA instance using a sandbox magic
# reference, so you can confirm the API integration end-to-end without a real
# payment. Works with an sk_test_ key (sandbox) or sk_live_ (real).
#
#   KEY=sk_test_xxxxxxxx ./door3-test.sh
#   KEY=sk_test_xxxxxxxx BASE=https://kodajnn.com/v1 ./door3-test.sh
#
# Sandbox magic references you can pass as the code:
#   TEST-OK-25000  → instant verified   ·  TEST-REPLAY → already used
#   TEST-LATE-90   → verifies late       ·  TEST-SUFFIX → challenge/review
set -euo pipefail

BASE="${BASE:-https://kodajnn.com/v1}"
: "${KEY:?Set KEY=sk_test_... (create one in the KODA app: Developers -> Create key)}"
REF="${REF:-TEST-OK-25000}"
AMOUNT="${AMOUNT:-25000}"
CURRENCY="${CURRENCY:-CDF}"
AUTH="authorization: Bearer $KEY"
JSON="content-type: application/json"

say() { printf '\n\033[1;33m%s\033[0m\n' "$*"; }
field() { grep -oE "\"$1\":\"[^\"]*\"" | head -1 | sed -E "s/\"$1\":\"([^\"]*)\"/\1/"; }

# brief pauses keep us under the free plan's 2 req/s rate limit
say "1/3 · Verify the key  (GET $BASE/ping)"
curl -s -H "$AUTH" "$BASE/ping"; echo
sleep 1

say "2/3 · Create a payment intent  (POST $BASE/intents)"
INTENT=$(curl -s -X POST "$BASE/intents" -H "$AUTH" -H "$JSON" \
  -d "{\"amount\":$AMOUNT,\"currency\":\"$CURRENCY\",\"operators\":[\"orange_cd\"],\"metadata\":{\"order_id\":\"DOOR3-TEST\"}}")
echo "$INTENT"
ID=$(echo "$INTENT" | field intent_id)
if [ -z "$ID" ]; then echo "!! could not create intent (check the key). Stopping."; exit 1; fi
echo "   intent_id = $ID"
sleep 1

say "3/3 · Submit the customer's code  (POST $BASE/intents/$ID/verify)  ref=$REF"
RESULT=$(curl -s -X POST "$BASE/intents/$ID/verify" -H "$AUTH" -H "$JSON" -d "{\"reference\":\"$REF\"}")
echo "$RESULT"

STATUS=$(echo "$RESULT" | field status)
say "Result: status = ${STATUS:-unknown}"
case "$STATUS" in
  verified|verified_late) echo "✅ Door 3 works end-to-end. A signed payment.verified webhook also fired to any endpoint you registered." ;;
  pending_review)         echo "◔ Went to review (expected for TEST-SUFFIX)." ;;
  rejected)               echo "✗ Rejected (expected for TEST-REPLAY)." ;;
  *)                      echo "See the response above." ;;
esac
