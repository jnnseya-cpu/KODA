#!/usr/bin/env bash
# KODA — one-command launch audit. Boots the server on a throwaway DB and runs every
# gate: unit suites, DR backup-restore drill, whole-OS functional sweep, adversarial
# security audit, and a load/soak test. Prints a pass/fail summary and exits non-zero
# if any gate fails. Usage:  bash app/backend/tools/launch-audit.sh
set -uo pipefail
cd "$(dirname "$0")/../../.." || exit 2
export KODA_DATA_DIR="$(mktemp -d)" KODA_ALLOW_DEV_SECRET=1 KODA_QUIET=1
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
run "functional: whole-OS"    env KODA_BASE="$B" node app/backend/tools/test-full-os.js
run "security: adversarial"   env KODA_BASE="$B" node app/backend/tools/test-adversarial.js
run "perf: load/soak"         env KODA_BASE="$B" LOAD_PID="$SRV" LOAD_TOTAL=8000 LOAD_CONCURRENCY=64 node app/backend/tools/test-load.js

kill "$SRV" 2>/dev/null
echo "═══════════════════════════════════════════════"
if [ "$FAILED" -eq 0 ]; then echo "✅ ALL GATES PASSED"; else echo "❌ ONE OR MORE GATES FAILED"; fi
exit "$FAILED"
