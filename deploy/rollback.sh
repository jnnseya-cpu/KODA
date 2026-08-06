#!/usr/bin/env bash
# KODA — one-command rollback. Redeploys a previous commit (the last deployed one
# by default) and health-checks it. The koda_data ledger volume is untouched, so
# rolling back CODE never rolls back DATA. Pair with backend/tools/restore.js only
# if you also need to restore the database.
#
#   ./deploy/rollback.sh            # roll back to the previous commit (HEAD~1)
#   ./deploy/rollback.sh <sha>      # roll back to a specific commit
#
# Config (same defaults as vps-autodeploy.sh):
#   KODA_REPO_DIR (default $HOME/KODA) · KODA_HEALTH_URL (default https://kodajnn.com/healthz)
set -euo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${PATH:-}"

REPO_DIR="${KODA_REPO_DIR:-$HOME/KODA}"
APP_DIR="$REPO_DIR/app"
HEALTH="${KODA_HEALTH_URL:-https://kodajnn.com/healthz}"
TARGET="${1:-}"

cd "$REPO_DIR"
CURRENT="$(git rev-parse --short HEAD)"
[ -z "$TARGET" ] && TARGET="$(git rev-parse --short HEAD~1)"
echo "rolling back:  $CURRENT  →  $TARGET"

# pin to the target commit (detached HEAD is fine for a deploy box)
git fetch --quiet origin || true
git checkout -q "$TARGET"

cd "$APP_DIR"
export KODA_BUILD_SHA="$(git rev-parse --short HEAD)"
export KODA_BUILD_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
docker compose up -d --build

# verify the rolled-back build is actually healthy
sleep 6
if docker compose exec -T koda wget -qO- http://127.0.0.1:8080/healthz 2>/dev/null | grep -q '"ok":true'; then
  echo "✓ rollback healthy @ $KODA_BUILD_SHA"
  echo "  (to return to latest:  git checkout <branch> && docker compose up -d --build)"
else
  echo "✗ rolled-back build did NOT pass health check — investigate: docker compose logs --tail=40 koda"
  exit 1
fi
