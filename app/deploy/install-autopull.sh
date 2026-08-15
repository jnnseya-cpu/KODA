#!/usr/bin/env bash
# KODA — ONE-TIME installer for hands-off deployment. Run this ONCE on the VPS and
# the server auto-deploys every push to the deploy branch, forever. No GitHub
# secrets, no SSH keys, survives reboots. Re-running it is safe (idempotent).
#
#   bash /root/koda/app/deploy/install-autopull.sh
#
# Order matters (root-cause fix for the git ref-lock race): we STOP any existing
# timer, take the shared deploy lock, catch the site up + deploy NOW, and only
# then arm the timer — so the timer can never fetch concurrently with this script.
set -uo pipefail

APP_DIR="${KODA_APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
BR="${KODA_DEPLOY_BRANCH:-claude/koda-unified-spec-v2-vh5xtx}"
CHECK="$APP_DIR/deploy/autopull-check.sh"

[ -f "$CHECK" ] || { echo "✗ $CHECK not found — run this from the KODA clone."; exit 1; }
chmod +x "$CHECK" "$APP_DIR/deploy/vps-deploy.sh" 2>/dev/null || true

# 1) Stop any existing timer so it can't race our git ops during (re)install.
command -v systemctl >/dev/null 2>&1 && systemctl stop koda-deploy.timer 2>/dev/null || true

# 2) Hold the shared deploy lock (the one autopull-check uses); wait up to 60s for
#    an in-flight tick to finish, so nothing touches git underneath us.
exec 9>/tmp/koda-deploy.lock
flock -w 60 9 || { echo "✗ a deploy is currently running — wait a minute and re-run."; exit 1; }

# 3) Sanity: the server must be able to fetch (same git auth as your manual pull).
if ! git -C "$APP_DIR" fetch --quiet origin "$BR"; then
  echo "✗ 'git fetch origin $BR' failed in $APP_DIR — fix the clone's git auth, then re-run."
  exit 1
fi

# 4) Catch the live site up to the latest commit and deploy it NOW.
echo "→ catching the live site up to the latest commit…"
git -C "$APP_DIR" checkout -q "$BR" 2>/dev/null || true
git -C "$APP_DIR" merge --ff-only "origin/$BR" 2>/dev/null || true
if ! bash "$APP_DIR/deploy/vps-deploy.sh"; then
  echo "✗ initial deploy failed — see the logs above, fix, and re-run."; exit 1
fi
echo "✓ Live site is now on $(git -C "$APP_DIR" rev-parse --short HEAD)."

# 5) Arm auto-deploy LAST (after the deploy completes).
if command -v systemctl >/dev/null 2>&1; then
  cat > /etc/systemd/system/koda-deploy.service <<EOF
[Unit]
Description=KODA self-deploy (poll deploy branch, redeploy on change)
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=oneshot
Environment=KODA_APP_DIR=$APP_DIR
Environment=KODA_DEPLOY_BRANCH=$BR
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/env bash $CHECK
EOF

  cat > /etc/systemd/system/koda-deploy.timer <<EOF
[Unit]
Description=Run KODA self-deploy every 2 minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=2min
Unit=koda-deploy.service

[Install]
WantedBy=timers.target
EOF

  systemctl daemon-reload
  systemctl enable --now koda-deploy.timer
  echo "✓ Auto-deploy armed (systemd, every ~2 min). No more manual updates."
  echo "  Status: systemctl status koda-deploy.timer"
  echo "  Logs:   journalctl -u koda-deploy.service -f"
  echo "  Stop:   systemctl disable --now koda-deploy.timer"
else
  MARK="# koda-autopull"
  LINE="*/2 * * * * KODA_APP_DIR=$APP_DIR KODA_DEPLOY_BRANCH=$BR bash $CHECK >> /var/log/koda-deploy.log 2>&1 $MARK"
  ( crontab -l 2>/dev/null | grep -v "$MARK" ; echo "$LINE" ) | crontab -
  echo "✓ Auto-deploy armed (cron, every 2 min). No more manual updates."
  echo "  Logs: tail -f /var/log/koda-deploy.log"
  echo "  Stop: crontab -e  (delete the line ending in '$MARK')"
fi
