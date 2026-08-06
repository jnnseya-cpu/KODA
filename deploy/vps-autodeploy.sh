#!/usr/bin/env bash
# KODA — VPS auto-deploy. Polls the tracked branch; when new commits land, it
# pulls, rebuilds the containers, and health-checks the result. Idempotent and
# safe to run from cron every couple of minutes: it does nothing when there is
# nothing new, and a lock stops overlapping runs.
#
#   ONE-TIME SETUP (on the VPS, as the deploy user):
#     chmod +x ~/KODA/deploy/vps-autodeploy.sh
#     ( crontab -l 2>/dev/null; echo '*/2 * * * * /home/koda/KODA/deploy/vps-autodeploy.sh' ) | crontab -
#
#   Watch it work:   tail -f ~/koda-deploy.log
#   Deploy on demand: ~/KODA/deploy/vps-autodeploy.sh
#
# Config via env (defaults suit the standard Hostinger layout):
#   KODA_REPO_DIR      repo checkout        (default: $HOME/KODA)
#   KODA_DEPLOY_BRANCH branch to track      (default: the branch below)
#   KODA_DEPLOY_LOG    log file             (default: $HOME/koda-deploy.log)
set -euo pipefail

# cron runs with a minimal PATH — make sure git + docker are findable.
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${PATH:-}"

REPO_DIR="${KODA_REPO_DIR:-$HOME/KODA}"
APP_DIR="$REPO_DIR/app"
BRANCH="${KODA_DEPLOY_BRANCH:-claude/koda-unified-spec-v2-vh5xtx}"
LOG="${KODA_DEPLOY_LOG:-$HOME/koda-deploy.log}"
LOCK="/tmp/koda-autodeploy.lock"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" >> "$LOG"; }

# single-flight: if a previous run is still building, skip this tick.
exec 9>"$LOCK" || exit 0
flock -n 9 || exit 0

cd "$REPO_DIR" 2>/dev/null || { log "repo not found at $REPO_DIR"; exit 0; }

# fetch just the tracked branch; network hiccups are non-fatal (next tick retries).
if ! git fetch --quiet origin "$BRANCH" 2>>"$LOG"; then
  log "fetch failed for origin/$BRANCH — will retry next tick"; exit 0
fi

LOCAL="$(git rev-parse HEAD 2>/dev/null || echo none)"
REMOTE="$(git rev-parse "origin/$BRANCH" 2>/dev/null || echo none)"
[ "$REMOTE" = "none" ] && { log "no such remote branch origin/$BRANCH"; exit 0; }
[ "$LOCAL" = "$REMOTE" ] && exit 0   # up to date — the quiet, common path

log "new commit $REMOTE (was $LOCAL) — deploying $BRANCH"

# match the remote exactly. .env and the koda_data volume are gitignored / external,
# so nothing you configured on the box is touched by this reset.
git checkout -q "$BRANCH" 2>>"$LOG" || git checkout -qB "$BRANCH" "origin/$BRANCH" 2>>"$LOG"
git reset --hard "origin/$BRANCH" >>"$LOG" 2>&1

cd "$APP_DIR"
# stamp the build so /version reports the live SHA, and never leave the date as
# 'unknown' (which the SEO builder rejects as an invalid Date).
export KODA_BUILD_SHA="$(git rev-parse --short HEAD)"
export KODA_BUILD_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

if docker compose up -d --build >>"$LOG" 2>&1; then
  # health-check through the container (8080 is internal-only, not host-published).
  sleep 6
  if docker compose exec -T koda wget -qO- http://127.0.0.1:8080/healthz >/dev/null 2>&1; then
    log "deploy OK @ $KODA_BUILD_SHA"
  else
    log "WARN deploy finished but /healthz did not answer yet @ $KODA_BUILD_SHA"
  fi
  # drop dangling images so the disk allowance doesn't fill over time.
  docker image prune -f >/dev/null 2>&1 || true
else
  log "ERROR docker compose build/up failed @ $KODA_BUILD_SHA — site still on previous build"
  exit 1
fi
