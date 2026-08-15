#!/usr/bin/env bash
# KODA — self-deploy check. Run by the koda-deploy systemd timer (or cron) every
# couple of minutes ON THE VPS. If the deploy branch on GitHub moved, fast-forward
# and redeploy; otherwise do nothing. Idempotent and safe to run by hand.
#
# Reuses deploy/vps-deploy.sh for the actual build + health-check + email.
# No secrets, no inbound access — the server pulls itself over its existing git auth.
set -euo pipefail

BR="${KODA_DEPLOY_BRANCH:-claude/koda-unified-spec-v2-vh5xtx}"
cd "${KODA_APP_DIR:-/root/koda/app}"

git fetch --quiet origin "$BR"
git checkout -q "$BR" 2>/dev/null || true

if [ "$(git rev-parse HEAD)" = "$(git rev-parse "origin/$BR")" ]; then
  echo "$(date -Is) up-to-date ($(git rev-parse --short HEAD))"
  exit 0
fi

echo "$(date -Is) new commit origin/$BR=$(git rev-parse --short "origin/$BR") — deploying"
git merge --ff-only "origin/$BR"          # fails loudly if history diverged (safe: no deploy)
bash deploy/vps-deploy.sh
echo "$(date -Is) deploy complete ($(git rev-parse --short HEAD))"
