#!/usr/bin/env bash
# KODA — one-command launch audit. Boots the server on a throwaway DB and runs every
# gate: unit suites, DR backup-restore drill, whole-OS functional sweep, adversarial
# security audit, and a load/soak test. Prints a pass/fail summary and exits non-zero
# if any gate fails. Usage:  bash app/backend/tools/launch-audit.sh
set -uo pipefail
cd "$(dirname "$0")/../../.." || exit 2
export KODA_DATA_DIR="$(mktemp -d)" KODA_ALLOW_DEV_SECRET=1 KODA_QUIET=1 KODA_ALLOW_SANDBOX_REFS=1
# ADD-ON A: a mock operator-API adapter so the dual-confirm path is exercised end-to-end.
export KODA_OPAPI_ORANGE_CD="mock://confirm"
PORT="${PORT:-4720}"; export PORT
B="http://localhost:$PORT"
FAILED=0
line() { printf '%-26s %s\n' "$1" "$2"; }

node app/frontend/build-site.js >/dev/null 2>&1
node app/backend/server.js > /tmp/koda-launch-audit.log 2>&1 &
SRV=$!
for i in $(seq 1 40); do curl -sf "$B/healthz" >/dev/null 2>&1 && break; sleep 0.25; done

echo "═══════════ KODA LAUNCH AUDIT ($B) ═══════════"
run() { # name, command...
  local name="$1"; shift
  local out; out="$("$@" 2>&1)"
  if echo "$out" | grep -qiE "0 failed|0 breached|PASSED|ALL GREEN|ALL ATTACKS BLOCKED|LOAD GATE PASSED"; then
    line "$name" "✅ $(echo "$out" | grep -oiE '[0-9]+ (passed|held)[^.]*' | tail -1)"
  else
    line "$name" "❌ FAIL"; FAILED=1; echo "$out" | tail -4
  fi
}
run "unit: full suite"        node app/backend/tools/test.js
run "unit: agents"            node app/backend/tools/test-agents.js
run "unit: doors"             env KODA_BASE="$B" node app/backend/tools/test-doors.js
run "DR: backup-restore"      node app/backend/tools/test-backup-restore.js
run "financial: webhook"      node app/backend/tools/test-billing-webhook.js
run "financial: billing mesh" node app/backend/tools/test-billing.js
run "financial: real rails"   node app/backend/tools/test-rails.js
run "growth: referrals"       node app/backend/tools/test-referrals.js
run "functional: whole-OS"    env KODA_BASE="$B" node app/backend/tools/test-full-os.js
run "add-ons: dual+network"   env KODA_BASE="$B" node app/backend/tools/test-addons.js
run "security: adversarial"   env KODA_BASE="$B" node app/backend/tools/test-adversarial.js
run "security: human+block"   env KODA_BASE="$B" node app/backend/tools/test-security.js
run "security: sandbox gate"  node app/backend/tools/test-sandbox-gate.js
run "perf: load/soak"         env KODA_BASE="$B" LOAD_PID="$SRV" LOAD_TOTAL=8000 LOAD_CONCURRENCY=64 node app/backend/tools/test-load.js
if [ -x "${CHROME:-/opt/pw-browsers/chromium-1194/chrome-linux/chrome}" ]; then
  run "browser: real Chromium"  env KODA_BASE="$B" node app/backend/tools/test-browser.js
else
  line "browser: real Chromium" "⏭  skipped (no chromium binary)"
fi

kill "$SRV" 2>/dev/null
echo "═══════════════════════════════════════════════"
if [ "$FAILED" -eq 0 ]; then echo "✅ ALL GATES PASSED"; else echo "❌ ONE OR MORE GATES FAILED"; fi
exit "$FAILED"
