# KODA — Production Launch Hard-Reality Audit

## 1. Executive Verdict

- **Final verdict:** **CONDITIONAL GO** — controlled/limited launch only.
- **Launch confidence score:** **~80 / 100** (below the 92 full-GO bar; the drag is *untested* areas — load, DR-restore, rollback, alerting — not *failed* ones).
- **Release candidate:** `dc84065` (post-fix). Pre-audit baseline: `6cda99a`.
- **Tested environment:** isolated instance (own port + fresh `node:sqlite` DB), Node v22.22.2, plus 3 static review lanes over the repo. **Not** tested against the live VPS.
- **Overall risk level:** Medium — core (auth, financial integrity, tenant isolation) is proven; operational maturity (backups, monitoring, load) is not.
- **Hard-reality conclusion:** The audit found and **fixed** the launch-blockers — a P0 free-ACU webhook, a P1 money-atomicity double-credit across every settle path, and a P1 privacy promise (export/deletion) that didn't exist — each re-verified live. What remains are **operational-readiness gaps that were never tested** (performance/load, disaster-recovery restore, deploy rollback, alerting) and one **unwired channel** (email/SMS/push dispatch). None are unresolved P0/P1, so the platform is safe for a **tightly-controlled pilot** (invite-only, few merchants, low real-money exposure, operator actively watching). A **broad public GO is not yet supportable** until the conditions in §15 are closed.

---

## 2. Immediate Launch Blockers — all RESOLVED

| ID | Sev | Area | Defect | Impact | Evidence | Correction | Status |
|---|---|---|---|---|---|---|---|
| B-1 | **P0** | Payments | `/webhooks/billing/:provider` settled a top-up with **no signature check** | Any caller who knew a `topup_id` minted free ACU (platform currency) | Live probe WH-2: `200 {acu_credited:100}` on an unauthenticated call | `verifyWebhook()` HMAC over raw body; **fail-closed** (no secret/bad sig → 401) | ✅ Fixed — reprobe: `401 webhook_unverified` |
| B-2 | **P1** | Financial integrity | Non-atomic settlement: `creditAcu`/float-debit outside the idempotency guard, status-flip last → retry/crash **double-credits** | Wallet/ledger divergence; KD float double-debit; voucher consumed-but-uncredited | Static lanes (security+DR) converged; code at `billing.js`/`vouchers.js` | `tx()` (BEGIN IMMEDIATE) + **CAS-first** status flip on all 4 settle paths | ✅ Fixed — reprobe: signed replay → `already:true`, no double credit |
| B-3 | **P1** | Privacy | Privacy page promised self-serve **export + deletion**; neither existed; `privacy.*` events unwired | Published GDPR/erasure commitment with no mechanism | grep of routes: no delete/export | `GET /app/me/export` + `POST /app/me/delete` (erase PII, retain financial/audit); events wired | ✅ Fixed — reprobe: export `200`, delete `200 erased:true` |

---

## 3. Mandatory Launch-Gate Results

| Gate | Status | Evidence | Remaining risk |
|---|---|---|---|
| 1 Build integrity | **PASS** | Zero-dep build; RC traceable to `dc84065`; full gate 196 checks green | `/version build.commit` is `dev` on non-CI builds until `KODA_BUILD_SHA` is set (auto-deploy stamps it) |
| 2 Critical functionality | **PASS** | Automated suites cover signup/login/verify/checkout/doors/billing; no false-success, no data-loss found | Email confirmations don't send (see F-2) |
| 3 Security | **PASS (post-fix)** | No unresolved P0/P1; IDOR clean (probe IDOR-1/2/3 all 404/0); JWT HS256 timing-safe; fail-closed dev secret | P3s open: CSP absent, CORS `*` on `/app/*`, USSD/SMS webhooks unauthenticated |
| 4 Data integrity | **CONDITIONAL** | Money paths now transactional + CAS; tenant isolation verified clean; UNIQUE constraints present | **Backup is not automated, on-volume, restore-untested** — DR unproven |
| 5 Financial integrity | **PASS** | Server-side price authority; idempotent; double-entry Σ=0; webhook signed; 39 billing checks | — |
| 6 Performance | **NOT TESTED** | No load/soak run this pass | Behaviour under launch/peak/spike load is unknown |
| 7 Reliability | **PARTIAL** | Graceful SIGTERM checkpoint; bounded webhook retries; single-instance | Rollback not exercised; no chaos/failure-injection run |
| 8 Observability | **PARTIAL** | `/healthz` `/readyz` `/version` + per-request `x-request-id` | **No error-monitoring/alerting sink** — failures can pass unnoticed |
| 9 Privacy & compliance | **PASS (post-fix)** | Export/deletion implemented; payer masking in receipts/resolver; honest disclaimer, no false absolutes | `/app/feed` returns merchant's own raw SMS (in-boundary); no refund-policy page |
| 10 Operational readiness | **CONDITIONAL** | Deploy + auto-deploy script; runbook docs | Backup/restore + monitoring + on-call not established |

---

## 4. Testing Coverage

- **Automated checks:** 196 green — 61 unit · 21 operators · margin law · 16 network-resolver · 39 billing (incl. 4 webhook-auth regressions) · 35 adversarial · 19 checkout · 16 doors · 11 AI-gating · 13 growth · 50 busy-merchant concurrency.
- **Live adversarial probes:** ~30 (auth, IDOR/cross-tenant, API fuzz, injection, webhook, error-leak, headers, rate-limit) + 6 post-fix reprobes.
- **Static review lanes:** 3 (security, data-integrity/DR, privacy/observability/ops).
- **Critical journey coverage:** signup→verify→receipt, checkout→verify→redirect, top-up (card/distributor/voucher)→credit, dispute, device enroll. **Covered.**
- **API coverage:** broad (all `/app` + `/v1` money/auth/network/billing routes probed). **Role coverage:** owner/manager/cashier/admin/platform.
- **Browser/device coverage:** **NOT TESTED** (no headless-browser run this pass). **Load/perf:** **NOT TESTED.**

---

## 5. Architecture & Dependency Findings

- **Summary:** single Node process (`node:http` + `node:sqlite`, zero npm deps) behind Caddy (auto-TLS) in Docker Compose; SQLite ledger in a named volume. Sentinel (Android) is the phone-edge. Billing Mesh = System B collection.
- **Critical dependencies:** the SQLite file (single writer), Caddy (TLS/proxy), optional providers (Meta/Brevo/FCM/aggregators) — all sandbox-degrade when keys absent.
- **Single points of failure:** the single SQLite DB + single app instance (no HA); the VPS host.
- **SPOF mitigation today:** volume persistence + `restart: unless-stopped`; **no** multi-node/replica, **no** tested failover.

---

## 6. Security Findings (post-fix)

- **P0 (fixed):** unauthenticated settle webhook — see B-1.
- **P2 (fixed):** dev JWT secret usable if `NODE_ENV` unset → now fail-closed before DB/seed. Login/voucher brute-force → now throttled (login 10/60s → `429` reprobed; voucher 15/60s).
- **P3 (open, non-blocking):** no `Content-Security-Policy`; `Access-Control-Allow-Origin: *` on authenticated `/app/*` (bounded — bearer tokens, no cookies/credentials); `/webhooks/ussd` + `/webhooks/sms` unauthenticated (bounded — cannot fabricate a receipt without a real ledger SMS); WhatsApp signature skipped when `META_APP_SECRET` unset; JWT accepted from `?token=` query (SSE endpoint).
- **Verified clean:** no secrets in source (all tokens generated); no SQL injection (prepared statements throughout); JWT ignores header alg (no alg-confusion); scrypt+timing-safe passwords; IDOR/tenant isolation clean; 2 MB body cap; stable `{error:{code}}` schema, no stack/path leakage.

---

## 7. Functional & UX Findings

- Core flows pass. **F-1:** legacy `/app/billing/topup` shadowed the new System-B route → **fixed** (namespaced `/app/billing/collect`). Public site + PWA now carry full nav (prior fix). No white-screens/false-success found in probed flows. Cross-browser/a11y **not tested** this pass.

---

## 8. Data & Database Findings

- **Fixed:** all money mutations now `tx()`-wrapped + CAS-guarded (B-2). `wholesalePurchase` idempotency keyed on payment ref.
- **Clean:** tenant isolation (every scoped query filters `merchant_id`); UNIQUE on `topups.idempotency_key`, `vouchers.pin_hash`, PK on `replay_index(reference,merchant_id)`; data survives `docker compose up --build` (named volume).
- **Open (P2/P3):** **backup** = `VACUUM INTO` exists but is **not scheduled, writes to the same volume, has no offsite copy, and has never been restored** → RPO unbounded, RTO unknown. Migrations use `try/catch` that swallows all errors (silent schema-drift risk). WAL `synchronous=NORMAL` can lose last-checkpoint ledger rows on power loss.

---

## 9. Payment & Financial Findings

- Server-authoritative pricing (ACU 4× cost; collection fee passed through; ≥100% margin — asserted). Idempotent top-ups; append-only double-entry ledger, **Σ=0 invariant** proven; KD float floor enforced; **webhook signature required** (post-fix). No entitlement before payment; no double credit on retry (reprobed). Reconciliation difference: **0**.

---

## 10. AI & Agent Findings

- All AI/agent actions are **ACU-gated** (no free action; 402 on empty balance); deterministic-first parser (LLM only on ambiguity). **Not run this pass:** a prompt-injection / eval-set / hallucination-rate suite. Agents are read/report-shaped (no autonomous money movement or irreversible actions), which caps risk.

---

## 11. Performance Findings

**NOT TESTED this pass.** No p50/p95/p99, throughput, soak, or breaking-point data. `node:sqlite` is a single writer — the most likely first bottleneck under write-heavy load. Must run a baseline load test before broad launch (§15).

---

## 12. Observability & Incident-Response Findings

- **Present:** `/healthz` (liveness), `/readyz` (DB probe, 503 on failure), `/version`, per-request `x-request-id`, line access logs (no secrets/PII, no query string).
- **Missing:** error-monitoring/alerting sink (no Sentry-class), structured logs, request-ID propagation into audit/comms, on-call. **Currently a critical failure can pass unnoticed** — the main reason this is CONDITIONAL, not GO.

---

## 13. Fixes Implemented (this audit)

| ID | Root cause | Change | Tests added | Retest |
|---|---|---|---|---|
| B-1 | Webhook trusted client `topup_id` | `billing.verifyWebhook()` HMAC, fail-closed; route gated | +4 billing (fail-closed/signed/forged/missing) | Live 401/200/replay ✓ |
| B-2 | Non-idempotent mutation outside guard; status-flip last | `db.tx()` + CAS-first flip on `settleTopup`/`settleDistributorTopup`/`vouchers.redeem`/`wholesalePurchase` | existing double-settle checks now exercise CAS path | Reprobe replay → `already:true` ✓ |
| B-3 | Privacy promise unimplemented | export + erasure endpoints; `privacy.*` events wired | live reprobe | 200 / erased:true ✓ |
| P2-secret | Guard gated on `NODE_ENV` | fail-closed before DB/seed; `KODA_ALLOW_DEV_SECRET=1` opt-in | boot test | FATAL+exit1 ✓ |
| P2-brute | No auth throttle | `bruteLimited()` on login + voucher | reprobe | `429` after ~10 ✓ |
| F-1 | Duplicate route registration | namespaced `/app/billing/collect` | gate | green |

---

## 14. Unresolved Risks

- **Accepted (for a controlled pilot):** wildcard CORS on `/app` (bearer-token, no cookies); USSD/SMS webhook auth (can't fabricate receipts); WAL `NORMAL` durability.
- **Deferred (before broad launch):** CSP header; USSD/SMS webhook signing; `/app/feed` PII masking + `sms_ledger` retention; refund-policy page; migration error handling.
- **Blocked / NOT TESTED:** performance/load/soak; DR backup-restore drill; deploy rollback drill; cross-browser + accessibility; AI red-team/eval.
- **External dependency risk:** provider onboarding (aggregators/MoR/Brevo/Meta) is contractual and unproven in prod.

---

## 15. Required Pre-Launch Action Plan

**Before ANY launch (done):** ✅ P0 webhook, ✅ P1 money atomicity, ✅ P1 export/deletion, ✅ fail-closed secret, ✅ brute-force throttle.

**Before limited/pilot launch (operator to complete on the VPS):**
1. Set real `KODA_JWT_SECRET`, `KODA_WEBHOOK_SECRET[_<PROVIDER>]`, provider keys (or keep channels sandboxed) — *owner, P0, low effort.*
2. Wire one **error-monitor + uptime check** (even a cron hitting `/readyz` → alert) — *owner/SRE, P1, low.*
3. **Automated offsite backup** (cron `backup.js` → object storage, off-volume) **+ one restore drill** — *SRE, P1, medium; evidence: restored row counts match.*
4. Keep real-money exposure low; invite-only; operator watching. — *owner.*

**Before full public launch:**
5. Baseline **load test** on critical endpoints (verify, checkout, top-up) + publish p95/error targets — *P1, medium.*
6. **Rollback drill** (deploy previous SHA, validate, redeploy) — *P1, low.*
7. Add **CSP**, scope CORS on `/app`, sign USSD/SMS webhooks, mask `/app/feed`, add retention purge — *P2/P3, medium.*
8. Wire **email/SMS/push dispatch** (Brevo/gateway/FCM) or formally descope email at launch — *P2, medium.*
9. AI red-team + eval set — *P2, medium.*

---

## 16. Launch Configuration (recommended for the pilot)

- **Enabled:** verification (all 3 doors + USSD/SMS), checkout, billing top-up (card/distributor/voucher), AI agents (ACU-gated).
- **Disabled/limited:** BitriPay rail (not live by design); email/push/SMS = sandbox until adapters wired; keep aggregator rails behind real provider keys.
- **Limits:** invite-only merchants; low daily top-up ceiling; login 10/60s, voucher 15/60s, API per-plan rps.
- **Alert thresholds:** `/readyz` != 200; error-rate spike; webhook_unverified surge; ACU ledger `reconcile()` != 0.
- **Rollback trigger:** any money-path anomaly or `reconcile()` imbalance → redeploy previous SHA. **Kill switch:** revoke provider webhook secret (halts settlement) + device float-freeze.

---

## 17. Final Launch Decision

**This release is approved only for a restricted launch under the conditions listed above** — a controlled, invite-only pilot with low real-money exposure and an operator actively watching, contingent on completing the "before limited/pilot launch" items (real secrets, an error/uptime monitor, and an automated + restore-tested backup). **It is not yet approved for unrestricted public launch**, pending performance, disaster-recovery, rollback, and alerting proof.

---
*Audit method: live adversarial probing of a spun-up instance + full automated gate + three parallel static review lanes (security, data/DR, privacy/observability). All P0/P1 findings were fixed and re-verified within this pass. RC `dc84065`. No production data was touched; all tests ran against isolated temp databases.*
