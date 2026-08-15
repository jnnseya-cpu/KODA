#!/usr/bin/env bash
# KODA — ONE-TIME installer for hands-off deployment. Run this ONCE on the VPS and
# the server will auto-deploy every push to the deploy branch, forever. No GitHub
# secrets, no SSH keys, survives reboots. Re-running it is safe (idempotent).
#
#   bash /root/koda/app/deploy/install-autopull.sh
#
# It installs a systemd timer that runs deploy/autopull-check.sh every 2 minutes
# (falls back to cron if systemd isn't present).
set -euo pipefail

# resolve the app dir from this script's own location (app/deploy/ -> app/)
APP_DIR="${KODA_APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
BR="${KODA_DEPLOY_BRANCH:-claude/koda-unified-spec-v2-vh5xtx}"
CHECK="$APP_DIR/deploy/autopull-check.sh"

[ -f "$CHECK" ] || { echo "✗ $CHECK not found — run this from the KODA clone."; exit 1; }
chmod +x "$CHECK" "$APP_DIR/deploy/vps-deploy.sh" 2>/dev/null || true

# sanity: the server must be able to fetch (it already does for manual pulls)
if ! git -C "$APP_DIR" fetch --quiet origin "$BR" 2>/dev/null; then
  echo "✗ 'git fetch origin $BR' failed in $APP_DIR."
  echo "  Fix the clone's git auth first (the same token you used to clone), then re-run."
  exit 1
fi

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
  echo "✓ Installed. This VPS now auto-deploys '$BR' within ~2 min of every push."
  echo "  Status: systemctl status koda-deploy.timer"
  echo "  Logs:   journalctl -u koda-deploy.service -f"
  echo "  Stop:   systemctl disable --now koda-deploy.timer"
else
  # cron fallback (no systemd)
  MARK="# koda-autopull"
  LINE="*/2 * * * * KODA_APP_DIR=$APP_DIR KODA_DEPLOY_BRANCH=$BR bash $CHECK >> /var/log/koda-deploy.log 2>&1 $MARK"
  ( crontab -l 2>/dev/null | grep -v "$MARK" ; echo "$LINE" ) | crontab -
  echo "✓ Installed via cron (every 2 min). This VPS now auto-deploys '$BR'."
  echo "  Logs: tail -f /var/log/koda-deploy.log"
  echo "  Stop: crontab -e  (delete the line ending in '$MARK')"
fi

# Initial catch-up: fast-forward to the very latest and deploy it NOW, so turning
# auto-deploy ON also brings the live site fully up to date in the same step
# (the timer alone would only act on the NEXT push).
echo "→ catching the live site up to the latest commit…"
git -C "$APP_DIR" checkout -q "$BR" 2>/dev/null || true
git -C "$APP_DIR" merge --ff-only "origin/$BR" 2>/dev/null || true
bash "$APP_DIR/deploy/vps-deploy.sh"
echo "✓ Live site is now on $(git -C "$APP_DIR" rev-parse --short HEAD). Auto-deploy armed — no more manual updates."
