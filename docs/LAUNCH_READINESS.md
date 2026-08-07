# KODA — Launch Readiness

**Verdict: CONDITIONAL GO → cleared for a controlled/pilot launch.**
Reproduce the whole verdict any time:

```bash
bash app/backend/tools/launch-audit.sh
```

## Gate scoreboard (evidence-backed)

| Gate | Status | Evidence |
|---|---|---|
| 1 Build integrity | ✅ PASS | Deterministic zero-dep build, syntax-guarded, traceable to commit |
| 2 Critical functionality | ✅ PASS | All five doors + auto-verify; functional sweep 79/79 |
| 3 Security | ✅ PASS | Adversarial audit 21/21 attacks blocked (IDOR, replay, injection, auth, secrets, CSP/frame) |
| 4 Data integrity / DR | ✅ PASS | `test-backup-restore.js` — VACUUM INTO backup restores, integrity ok, counts match, ledger Σ=0 |
| 5 Financial integrity | ✅ PASS | Server-side price authority, idempotent webhooks, ledger balances |
| 6 Performance | ✅ PASS | Soak 20k reqs, 2169 req/s, p95 ~50ms, 0% errors, RSS bounded |
| 7 Reliability | ✅ PASS (core) | Graceful degradation; WooCommerce dual-path (webhook + 2-min reconciler + lazy intent expiry) |
| 8 Observability | ✅ PASS | `/metrics` live counters + ledger status; boot-time ledger self-monitor; route-500/readiness alerts → `KODA_ALERT_WEBHOOK` |
| 9 Privacy | ⚠️ PARTIAL | Export + delete endpoints exist & tested; full deletion-propagation not audited |
| 10 Operational readiness | ⚠️ CONFIRM | Set `KODA_ALERT_WEBHOOK`, confirm backups cron + HSTS on the VPS |

## The permanent gates (all green)
- `test.js` — full unit suite (61)
- `test-agents.js` — deterministic AI agents (13)
- `test-doors.js` — five doors end-to-end (16)
- `test-backup-restore.js` — DR drill (6)
- `test-full-os.js` — whole-OS functional sweep, incl. link integrity, detection, metrics, rates (79)
- `test-adversarial.js` — launch-gate security audit (21 attacks blocked)
- `test-load.js` — load/soak with p50/p95/p99 + RSS

## Remaining before UNRESTRICTED public launch (not blockers for a watched pilot)
1. **Rotate the admin/SMTP password** that appeared in chat history — your action.
2. **Set `KODA_ALERT_WEBHOOK`** (Slack/Discord) so alerts page a human; confirm the backup cron and (prod) HSTS on the VPS.
3. **Load at production scale** behind Caddy + replicas (local numbers are single-process).
4. **Live browser matrix + real payment-provider webhook** signature test (needs infra).
5. **WooCommerce full spec** (OAuth install flow, `/payment-methods/resolve` tokens, marketplace) — deferred; the current key-based plugin is the spec's supported "manual key" mode and is production-functional.

## Configuration for the pilot
- Enable: invite-only Kinshasa merchants, Android till-phones (Sentinel), Doors 1/3/5, manual-verify fallback visible.
- Watch: admin Collections / Fraud / `/metrics` daily.
- Hold: unrestricted signup, high volume, non-Android SMS-forward at scale (needs an aggregator number).
