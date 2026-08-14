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

echo "→ building + restarting KODA…"
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
