#!/usr/bin/env bash
# KODA — external uptime check. Runs from cron on the VPS (belt-and-suspenders,
# independent of the app process): if /readyz isn't healthy, POST an alert to the
# webhook. Complements the app's in-process self-monitor (which can't fire if the
# process is down). Deduped by a state file so you get one page, not one per minute.
#
#   SETUP (as root on the VPS):
#     export KODA_ALERT_WEBHOOK='https://hooks.slack.com/services/XXX'   # in the crontab or a sourced env
#     ( crontab -l 2>/dev/null; echo '* * * * * KODA_ALERT_WEBHOOK=... /root/koda/deploy/healthcheck-cron.sh' ) | crontab -
set -euo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${PATH:-}"

URL="${KODA_HEALTH_URL:-https://kodajnn.com/readyz}"
HOOK="${KODA_ALERT_WEBHOOK:-}"
STATE="/tmp/koda-health.state"     # 'up' or 'down' — so we alert only on transitions

now_state="down"
if curl -fsS -m 10 "$URL" | grep -q '"ok":true'; then now_state="up"; fi
prev_state="$(cat "$STATE" 2>/dev/null || echo up)"
echo "$now_state" > "$STATE"

# alert on any DOWN, and on the UP transition (recovery), deduped by state change
if [ "$now_state" = "down" ] && [ -n "$HOOK" ]; then
  curl -fsS -m 10 -X POST -H 'content-type: application/json' \
    -d "{\"text\":\"🔴 KODA CRITICAL: $URL is DOWN\"}" "$HOOK" >/dev/null 2>&1 || true
elif [ "$now_state" = "up" ] && [ "$prev_state" = "down" ] && [ -n "$HOOK" ]; then
  curl -fsS -m 10 -X POST -H 'content-type: application/json' \
    -d "{\"text\":\"🟢 KODA recovered: $URL is UP\"}" "$HOOK" >/dev/null 2>&1 || true
fi
