#!/usr/bin/env bash
# KODA — self-deploy check. Run by the koda-deploy systemd timer (or cron) every
# couple of minutes ON THE VPS. If the deploy branch on GitHub moved, fast-forward
# and redeploy; otherwise do nothing. Idempotent and safe to run by hand.
#
# Robustness (root-cause fixes, not patches):
#  - flock: only ONE check runs at a time, so a timer tick can never race a manual
#    run or an overlapping tick on the same git refs (the "cannot lock ref" error).
#  - transient git/network failures exit 0 (retry next tick) — they must NOT mark
#    the service failed. Only a real BUILD/deploy failure exits non-zero (visible).
# Deliberately NOT using `set -e`: every failure mode is handled explicitly below.
set -uo pipefail

BR="${KODA_DEPLOY_BRANCH:-claude/koda-unified-spec-v2-vh5xtx}"
cd "${KODA_APP_DIR:-/root/koda/app}" || { echo "app dir missing"; exit 0; }

# serialize all deploy activity on this host
exec 9>/tmp/koda-deploy.lock
flock -n 9 || { echo "$(date -Is) another deploy/check in progress — skip"; exit 0; }

# transient fetch failure (network blip, concurrent ref update) → retry next tick
if ! git fetch --quiet origin "$BR" 2>/dev/null; then
  echo "$(date -Is) git fetch failed (transient) — will retry next tick"; exit 0
fi
git checkout -q "$BR" 2>/dev/null || true

if [ "$(git rev-parse HEAD)" = "$(git rev-parse "origin/$BR")" ]; then
  echo "$(date -Is) up-to-date ($(git rev-parse --short HEAD))"; exit 0
fi

echo "$(date -Is) new commit origin/$BR=$(git rev-parse --short "origin/$BR") — deploying"
if ! git merge --ff-only "origin/$BR"; then
  echo "$(date -Is) not a fast-forward (history diverged) — NOT deploying"; exit 0
fi

# a genuine build/health failure SHOULD surface (systemd marks the unit failed)
if ! bash deploy/vps-deploy.sh; then
  echo "$(date -Is) DEPLOY FAILED — see logs above"; exit 1
fi
echo "$(date -Is) deploy complete ($(git rev-parse --short HEAD))"
