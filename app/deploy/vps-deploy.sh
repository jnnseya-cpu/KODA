#!/usr/bin/env bash
# KODA — VPS release step. Run from the app/ directory (where docker-compose.yml
# lives). Rebuilds + restarts the stack, waits for the health check, and fails
# LOUDLY if health never comes up (so a bad release is visible, old container
# keeps serving until this returns). The IndexNow re-announce happens on the new
# container's own boot — change-gated, so only URLs a release ADDED go out.
#
# Used by the GitHub auto-deploy workflow (.github/workflows/ci.yml → deploy job)
# and safe to run by hand: cd /root/koda/app && bash deploy/vps-deploy.sh
set -euo pipefail

# Stamp the real commit + build time so /version reports what's actually running
# (compose passes these as build args → baked into the image). Without this the
# image defaults to KODA_BUILD_SHA=dev and you can't tell what's deployed.
export KODA_BUILD_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo dev)"
export KODA_BUILD_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

echo "→ building + restarting KODA ($KODA_BUILD_SHA)…"
docker compose up -d --build

echo "→ waiting for health…"
ok=0
for i in $(seq 1 30); do
  if docker compose exec -T koda wget -qO- http://127.0.0.1:8080/healthz >/dev/null 2>&1; then ok=1; break; fi
  sleep 2
done

if [ "$ok" != 1 ]; then
  echo "✗ healthz never came up after ~60s — recent koda logs:"
  docker compose logs --tail=60 koda || true
  exit 1
fi

echo "✓ KODA healthy. IndexNow re-announce ran on container boot (new URLs only)."
docker compose ps

# Deploy-finished email — sent BY the server through KODA's own email transport
# (your existing KODA_SMTP_* config). No CI secrets, no Brevo. Recipient defaults
# to KODA_ADMIN_EMAIL; set DEPLOY_NOTIFY_EMAIL in .env to send it elsewhere.
docker compose exec -T koda node -e '
  const to = process.env.DEPLOY_NOTIFY_EMAIL || process.env.KODA_ADMIN_EMAIL;
  if (!to) { console.log("deploy email: no recipient set — skip"); process.exit(0); }
  require("./backend/comms/senders").sendEmail(to, "✅ KODA deployed — live & healthy",
    "<p>A new KODA release was built, restarted and passed the health check on your VPS.</p>")
    .then(r => console.log("deploy email:", JSON.stringify(r)))
    .catch(e => console.log("deploy email failed (non-fatal):", e.message));
' || true
