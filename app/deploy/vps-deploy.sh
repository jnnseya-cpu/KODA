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

# Deploy-finished email — OPT-IN ONLY. Auto-deploy runs on every push, so mailing
# on each one floods the inbox. It is therefore sent solely when DEPLOY_NOTIFY_EMAIL
# is explicitly set in .env (no KODA_ADMIN_EMAIL fallback). Unset = no deploy emails,
# which is the default.
if [ -n "${DEPLOY_NOTIFY_EMAIL:-}" ]; then
  docker compose exec -T koda node -e '
    const to = process.env.DEPLOY_NOTIFY_EMAIL;
    require("./backend/comms/senders").sendEmail(to, "✅ KODA deployed — live & healthy",
      "<p>A new KODA release was built, restarted and passed the health check on your VPS.</p>")
      .then(r => console.log("deploy email:", JSON.stringify(r)))
      .catch(e => console.log("deploy email failed (non-fatal):", e.message));
  ' || true
else
  echo "deploy email: DEPLOY_NOTIFY_EMAIL not set — skipping (no inbox spam)."
fi
