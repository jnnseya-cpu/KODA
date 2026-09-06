#!/usr/bin/env bash
# KODA — ONE-TIME installer for automatic, offsite-capable backups. Run ONCE on the
# VPS and the ledger is snapshotted daily (consistent VACUUM INTO, zero downtime),
# written to a HOST directory that survives container loss, pruned to the last N, and
# optionally shipped offsite. Re-running is safe (idempotent).
#
#   bash /root/koda/app/deploy/install-backups.sh
#
# Offsite (strongly recommended — a backup on the same box dies with the box):
#   put a ship command in app/.env, e.g.
#     KODA_BACKUP_SHIP_CMD='rclone copy "$KODA_BACKUP_FILE" remote:koda-backups'
#     KODA_BACKUP_KEEP=14
#   (backup.js reads these from the container env via env_file: .env)
set -uo pipefail

APP_DIR="${KODA_APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
CONTAINER="${KODA_KODA_CONTAINER:-app-koda-1}"
HOST_DIR="${KODA_BACKUP_DIR_HOST:-/root/koda-backups}"
HOUR="${KODA_BACKUP_HOUR:-03:17}"          # daily local time HH:MM
NODE_UID=1000                               # the 'node' user inside the image

command -v docker >/dev/null 2>&1 || { echo "✗ docker not found"; exit 1; }

# 1) Host backup directory, writable by the container's non-root 'node' user.
mkdir -p "$HOST_DIR"
chown -R "$NODE_UID:$NODE_UID" "$HOST_DIR" 2>/dev/null || true
echo "→ backups will be written to $HOST_DIR (host, survives container rebuild)"

# 2) Ensure the koda container has the /backups bind mount (added to docker-compose.yml).
#    Recreate it so the new mount + KODA_BACKUP_DIR env take effect. No image rebuild.
if ! docker inspect "$CONTAINER" --format '{{range .Mounts}}{{.Destination}}{{"\n"}}{{end}}' 2>/dev/null | grep -qx '/backups'; then
  echo "→ recreating $CONTAINER to attach the /backups mount…"
  ( cd "$APP_DIR" && docker compose up -d ) || { echo "✗ 'docker compose up -d' failed — run it in $APP_DIR, then re-run."; exit 1; }
else
  echo "✓ /backups mount already present on $CONTAINER"
fi

# 3) Prove a backup works right now (fail loudly if it doesn't).
echo "→ running a first backup to verify the path end-to-end…"
if ! docker exec "$CONTAINER" node --no-warnings backend/tools/backup.js; then
  echo "✗ first backup failed — see the error above. Nothing scheduled."; exit 1
fi

# 4) Schedule daily.
if command -v systemctl >/dev/null 2>&1; then
  cat > /etc/systemd/system/koda-backup.service <<EOF
[Unit]
Description=KODA ledger backup (consistent SQLite snapshot + offsite ship)
After=docker.service
Wants=docker.service

[Service]
Type=oneshot
ExecStart=/usr/bin/docker exec $CONTAINER node --no-warnings backend/tools/backup.js
EOF

  cat > /etc/systemd/system/koda-backup.timer <<EOF
[Unit]
Description=Run KODA ledger backup daily at $HOUR

[Timer]
OnCalendar=*-*-* $HOUR:00
Persistent=true
Unit=koda-backup.service

[Install]
WantedBy=timers.target
EOF

  systemctl daemon-reload
  systemctl enable --now koda-backup.timer
  echo "✓ Daily backup armed (systemd, $HOUR). "
  echo "  Status:  systemctl status koda-backup.timer"
  echo "  Run now: systemctl start koda-backup.service"
  echo "  Logs:    journalctl -u koda-backup.service -f"
  echo "  Stop:    systemctl disable --now koda-backup.timer"
else
  MARK="# koda-backup"
  MIN="${HOUR#*:}"; HR="${HOUR%:*}"
  LINE="$MIN $HR * * * docker exec $CONTAINER node --no-warnings backend/tools/backup.js >> /var/log/koda-backup.log 2>&1 $MARK"
  ( crontab -l 2>/dev/null | grep -v "$MARK" ; echo "$LINE" ) | crontab -
  echo "✓ Daily backup armed (cron, $HOUR)."
  echo "  Logs: tail -f /var/log/koda-backup.log"
  echo "  Stop: crontab -e  (delete the line ending in '$MARK')"
fi

echo
echo "⚠ Offsite: set KODA_BACKUP_SHIP_CMD in $APP_DIR/.env for true disaster recovery."
echo "  A backup that lives only on this VPS is lost if the VPS is lost."
