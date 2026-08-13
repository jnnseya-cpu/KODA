#!/usr/bin/env bash
# KODA — enable auto-deploy. Run this ONCE on the VPS and you never manually
# deploy again: every push to the tracked branch goes live within ~2 minutes.
#
#   bash <repo>/deploy/enable-autodeploy.sh
#
# It (1) lets git fetch unattended from cron (saves the token you cloned with),
# (2) installs the every-2-minutes auto-deploy cron, and (3) deploys immediately.
set -euo pipefail

BRANCH="${KODA_DEPLOY_BRANCH:-claude/koda-unified-spec-v2-vh5xtx}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
LOG="${KODA_DEPLOY_LOG:-$HOME/koda-deploy.log}"

echo "──────────────────────────────────────────────────────────────"
echo " KODA auto-deploy setup"
echo "   repo   : $REPO_DIR"
echo "   branch : $BRANCH"
echo "──────────────────────────────────────────────────────────────"

# 1. Persist git credentials so cron's `git fetch` never blocks on a prompt.
#    (If your token isn't saved yet, git will ask ONCE below, then remember it.)
git -C "$REPO_DIR" config credential.helper store
echo "→ verifying git can fetch unattended (enter your GitHub token ONCE if asked)…"
if ! git -C "$REPO_DIR" fetch origin "$BRANCH"; then
  echo "✗ git fetch failed. If it asked for a password, that's a GitHub TOKEN, not your"
  echo "  account password. Create one (repo: read) at github.com → Settings → Developer"
  echo "  settings → Personal access tokens, then re-run this script."
  exit 1
fi
echo "✓ git fetch works without prompting."

# 2. Install the cron (idempotent — replaces any previous KODA auto-deploy line).
chmod +x "$SCRIPT_DIR/vps-autodeploy.sh"
CRON_LINE="*/2 * * * * KODA_REPO_DIR=$REPO_DIR KODA_DEPLOY_BRANCH=$BRANCH $SCRIPT_DIR/vps-autodeploy.sh"
( crontab -l 2>/dev/null | grep -v 'vps-autodeploy.sh'; echo "$CRON_LINE" ) | crontab -
echo "✓ cron installed (runs every 2 minutes):"
crontab -l | grep 'vps-autodeploy.sh' | sed 's/^/    /'

# 3. Deploy right now so the box is current immediately.
echo "→ deploying the latest commit now…"
KODA_REPO_DIR="$REPO_DIR" KODA_DEPLOY_BRANCH="$BRANCH" "$SCRIPT_DIR/vps-autodeploy.sh" || true

echo "──────────────────────────────────────────────────────────────"
echo " ✅ AUTO-DEPLOY IS ON."
echo "    Every push to $BRANCH is live within ~2 minutes — no manual steps."
echo "    Watch deploys:      tail -f $LOG"
echo "    Force one now:      KODA_REPO_DIR=$REPO_DIR $SCRIPT_DIR/vps-autodeploy.sh"
echo "    Turn it off:        crontab -e   (delete the vps-autodeploy.sh line)"
echo "──────────────────────────────────────────────────────────────"
