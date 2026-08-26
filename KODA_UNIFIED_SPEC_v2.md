# KODA — UNIFIED MASTER SPECIFICATION v2.0

**Groupe Nseya Digital / BitriPay Ecosystem — Confidential**
**Supersedes:** Verify Engine Master Spec v1.0 + API & Monetisation Spec v1.0 (fully consolidated here)
**New in v2.0:** ① No-code Manual Verification mode — full product for merchants without developers · ② Worldwide mobile money scope · ③ Single unified pricing ladder across all modes
**Branding:** Regardless of any other name used historically or internally (e.g. "Verify Engine"), **KODA is the sole and permanent brand name** — across all modes, markets, surfaces, and documents. Sub-products (KODA Sentinel, KODA Lite, Verify Console) are features of KODA, never standalone brands. **White-label remains possible** under Enterprise licensing (§10: +20% wholesale): a licensee may front the product under their own brand, but the underlying platform, engine, and internal naming stay KODA.

> **One line:** KODA turns the confirmation SMS every mobile money operator on Earth already sends to merchants into structured payment truth — verified **manually in a KODA account**, **conversationally in WhatsApp**, or **automatically by API**. Same engine. Three doors. Any operator, any country.

---

# PART I — THE THESIS

## 1. The brutal truth this product is built on

Every mobile money merchant on the planet already has a payment API installed. It arrived pre-loaded on their SIM card.

When a customer pays via M-Pesa, Orange Money, Airtel Money, MTN MoMo, Wave, Africell Money — or GCash in Manila, bKash in Dhaka, JazzCash in Karachi, Tigo Money in Asunción, EVC Plus in Mogadishu — **two artifacts are generated instantly, without anyone signing anything:**

1. The **customer** receives a confirmation carrying a transaction reference.
2. The **merchant** receives a confirmation SMS on their registered SIM: reference, amount, sender name, partial sender number, timestamp, **new balance**.

That merchant-side SMS is **ground truth issued by the operator itself**. The customer cannot generate it. It is the fact of the payment.

Every conventional "integration" ignores this and negotiates B2B API access with each operator: 6–18 months per telco, per country, contracts, paybill registration, revenue extraction — and frequent flat rejection for SMEs. Which is why most mobile-money commerce worldwide still ends with *"send me a screenshot."*

**KODA doesn't integrate with operators. KODA reads what the operator already sends the merchant, structures it, and turns it into verifiable truth.** Because the mechanism is the SMS — not any operator's API — KODA is **operator-agnostic and border-agnostic by construction**: coverage is a parsing template, not a contract.

## 2. What KODA is / is not

| KODA IS | KODA IS NOT |
|---|---|
| Payment **Verification**-as-a-Service | A wallet, aggregator, or payout rail |
| A truth layer between "customer says paid" and "merchant knows paid" | An escrow or settlement system |
| Manual, conversational, **and** API — same engine | A payments initiator (no STK push in v1; roadmap §18) |
| Global: any operator that sends merchant confirmation SMS | Dependent on any telco contract, anywhere |

Funds move operator → merchant exactly as today. KODA never touches money, which keeps the verification layer outside EME/PSP licensing scope (§16) and lets it deploy in any country at template-pack speed.

---

# PART II — THE THREE DOORS (one engine, three verification modes)

This is the v2.0 structural upgrade: **the same verification engine, exposed at three levels of technical capacity.** A market-stall trader and a 400-merchant marketplace use identical matching, fraud scoring, and audit trails — only the interface differs. Merchants graduate between doors without migration: it's one account, one ledger, one history.

## DOOR 1 — MANUAL MODE (no code, no bot, no developer) 🆕

**Who:** the enormous majority. Merchants already verifying payments by hand today — scrolling SMS, squinting at screenshots, calling customers. They will never "install an API." They don't have to.

**Setup (one-time, ~7 minutes, phone only):**
1. Sign up at koda.africa on any phone → KODA account created.
2. Install **KODA Sentinel** (6 MB) on the Android that receives payment SMS — scan a QR, done. (No Android? KODA Lite: forward confirmation SMS to KODA's WhatsApp ingestion number.)
3. Self-verify ownership: merchant sends themselves a $0.10-equivalent payment and verifies it — their first KODA verification is verifying themselves.

**Daily flow — "Verify Console":**

```
Customer:  "J'ai payé. Ref: OM.260717.1432.A88213"  (WhatsApp / in person / phone call)

Merchant opens KODA (app or web, phone-first):
┌────────────────────────────────────────────┐
│  VERIFY A PAYMENT                          │
│  [ paste or type the reference code ]      │
│  [ 📷 or snap the customer's screenshot ]  │
│                                            │
│  → ✅ CONFIRMED · 25 000 FC · Orange Money │
│     from J*** N. (+243 89•···4521) · 14:32 │
│     risk 0.02 · code now locked (replay ✗) │
│                                            │
│  [ Mark order fulfilled ]  [ Send receipt ]│
└────────────────────────────────────────────┘
```

The merchant does exactly what they did manually before — but the answer comes from the telco-anchored ledger with full fraud screening in ~3 seconds, instead of from scrolling and hoping. **Manual mode = human clicks "verify"; the machine does the verifying. Human validation, machine truth.**

**What Manual mode merchants get (no code ever written):**
- **Verify Console** — type/paste a code or snap a screenshot → instant verdict with the exact SMS match shown.
- **Live Payments Feed** — every payment landing on their SIM appears structured in real time: who, how much, when, which operator, matched-to-order or **unmatched** ("you were paid 3× today with no order attached").
- **Tap-to-send customer receipt** — branded WhatsApp/SMS receipt with KODA verification stamp; kills the "I paid, trust me" argument in both directions.
- **Replay protection** — a code a merchant verified once can never be used on them again, even months later. This alone ends the most common street-level fraud.
- **Daily digest** — end-of-day WhatsApp summary: total verified, per operator, unmatched payments, flagged attempts.
- **Dispute assistant** — a failed verify opens a guided flow: DisputeAgent interviews the customer in-channel and hands the merchant an evidence file with a recommendation. Merchant decides; KODA documents.
- **Team seats (Boutique+)** — cashiers verify; owner sees everything; per-seat audit trail of who validated what.

**The graduation path (built-in growth engine):** Manual → sees "unmatched payments" value → turns on Chat Mode → volume grows → hires a dev or joins a platform → flips on the API. **Same account, same ledger, zero migration.** Manual mode is not a lesser product; it is the top of the funnel and, in most markets, the majority of revenue.

## DOOR 2 — WHATSAPP CHAT MODE (conversational, still no code)

For merchants who live in WhatsApp: add KODA's number to the customer chat (or forward the customer's message). LinguaAgent handles the dialogue — collects the code or screenshot, verifies, posts "✅ Paiement confirmé — 25 000 FC reçus" into the chat, logs it to the merchant's ledger. Verification becomes a participant in the conversation where the sale is already happening. Zero code, zero console, zero behaviour change for the customer.

## DOOR 3 — API MODE (automated, the developer product)

Full automation: intents, code submission, signed webhooks — order confirmed, ticket issued, course unlocked, driver dispatched, with no human in the loop. Complete reference in Part V. Platforms onboard entire merchant bases under one master key via the sub-merchant API.

**One truth across all doors:** a payment verified manually and a payment verified by webhook produce the *same* receipt object, the same replay lock, the same audit trace, the same reconciliation entry. Mode is presentation; verification is one.

---

# PART III — HOW IT WORKS (canonical flow)

**Actors:** Customer (any phone) · Merchant SIM phone (Sentinel) · KODA Cloud · Merchant surface (Console / WhatsApp / their system)

```
[1] A payment obligation exists
      API mode: system creates an Intent (amount, operators, expiry)
      Manual/Chat mode: no intent needed — the ledger itself is the reference

[2] Customer pays the normal way they already know
      USSD (*150#, #144#, *501#…) or operator app → merchant's number

[3] Operator fires confirmation SMS to the MERCHANT's SIM
      Sentinel captures, parses on-device, pushes a signed structured
      record to KODA Cloud (~2–4 s after SMS arrival; offline → queued)

[4] The reference code travels to KODA
      API: customer types it in checkout/bot
      Chat: customer drops it in WhatsApp
      Manual: merchant pastes it / snaps the screenshot in Verify Console

[5] MatchMaker verifies: code ↔ ledger ↔ (intent) amount ↔ time window
      ↔ sender-suffix ↔ global replay index (typos auto-repaired, ≤2 edits)

[6] FraudSentinel scores (~40 features). Low → confirm. Mid → challenge.
      High → reject + flag.

[7] The verdict lands where the merchant lives:
      API → signed payment.verified webhook
      Chat → ✅ message in the conversation
      Manual → green confirmation card + one-tap customer receipt

[8] Elapsed: customer-side ~30–60 s total; KODA's share < 10 s.
```

*The magic sentence:* **"Your customer pays exactly the way they paid yesterday. The only thing that changes is that you finally know — instantly, provably, in your language."**

---

# PART IV — ARCHITECTURE & GLOBAL COVERAGE

## 3. System architecture

```
┌────────────────────────────── EDGE ──────────────────────────────┐
│ KODA SENTINEL (Android, Kotlin, ~6 MB)                            │
│ • SMS BroadcastReceiver scoped to operator sender-IDs only        │
│ • On-device parser: per-operator/country template pack, OTA        │
│ • Encrypted local ledger (SQLCipher) — offline-first, back-fills  │
│ • Play Integrity attestation + hardware-backed device keypair     │
│ • Dual-SIM aware · <1% daily battery on an $80 Android            │
│ • KODA Lite fallback: merchant forwards SMS to WhatsApp ingestion │
└───────────────────────────────┬──────────────────────────────────┘
                                │ signed SMS records (mTLS)
┌───────────────────────────────▼──────────────────────────────────┐
│ KODA CLOUD (GCP · NestJS · PostgreSQL · Kafka · Redis)            │
│ Ingestion → Kafka `sms.raw` → LangGraph AGENT MESH (§6)           │
│ CQRS append-only event store → every decision replayable          │
│ Global Replay Index: every code ever seen, single-use, forever    │
│ Webhook Dispatcher: HMAC-SHA256, 5× retry, DLQ                    │
│ ACU metering · multi-region residency (per-market, §16)           │
└───────────────────────────────┬──────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────┐
│ THREE DOORS                                                       │
│ ① Verify Console + Live Feed + Dashboard (Next.js 14, phone-1st)  │
│ ② WhatsApp Chat Mode (Business Cloud API, LinguaAgent)            │
│ ③ Public REST API + widget + SDKs (Part V)                        │
└──────────────────────────────────────────────────────────────────┘
```

**Why the phone-edge is the moat:** the merchant's SIM is the only place on Earth where the operator's ground-truth confirmation lands without a contract. Competitors who "solve" this with telco APIs inherit each telco's timeline, borders, and rent. KODA's coverage grows one Android install and one template pack at a time — permissionless, worldwide.

## 4. Worldwide operator coverage — the Template Pack doctrine

KODA's global claim is precise, not hand-wavy: **KODA works wherever the operator sends the merchant a confirmation SMS containing a reference and amount** — which is the standard behaviour of GSMA-model mobile money across Africa, South Asia, Southeast Asia, the Middle East, the Pacific, and Latin America.

Coverage = a **template pack**: a versioned parsing grammar per operator/country/language, OTA-shipped to Sentinels, drift-monitored and auto-regenerated by ParserAgent (canary-tested on live traffic before rollout, human sign-off on field-mapping changes). Extracted canonical fields are constant everywhere:

`{ref_code, amount, currency, counterparty_name, counterparty_msisdn_masked, timestamp, balance_after, operator, direction}`

**Coverage waves (calibration targets — exact SMS grammar validated in-market, never assumed):**

| Wave | Corridor | Operators (illustrative) |
|---|---|---|
| **W1 — Home** | DRC | M-Pesa (Vodacom), Orange Money, Airtel Money, Africell Money |
| **W2 — Africa core** | KE, TZ, UG, GH, CI, SN, CM, NG, RW | M-Pesa, MTN MoMo, Airtel, Orange, Wave, Moov |
| **W3 — South Asia** | BD, PK, NP | bKash, Nagad, Rocket · JazzCash, Easypaisa · eSewa, Khalti |
| **W4 — SE Asia & Pacific** | PH, ID, MM, PG, FJ | GCash, Maya · DANA, OVO, GoPay · Wave Money · MiCash, M-PAiSA |
| **W5 — MENA & Horn** | SO, EG, JO, YE | EVC Plus, Zaad, Sahal · Vodafone Cash · Orange Money |
| **W6 — LatAm & Caribbean** | PY, SV, HT, HN | Tigo Money, MonCash, Billetera |
| **W-open** | Anywhere | **Community Template Program**: any merchant can submit 5 sample confirmation SMS from an unsupported operator → ParserAgent drafts the pack → canary → live, typically within days. Coverage requests become coverage. |

**Honest exclusions, stated in the docs:** app-only/push-notification wallets with no SMS leg, and bank-rail systems like UPI/PIX, are different mechanisms — roadmap adapters (notification-listener capture where OS-permitted), not v2 claims. KODA's promise is exact, which is why it's credible.

**Currency layer:** multi-currency native (CDF, KES, GHS, XOF, NGN, BDT, PKR, PHP, USD…); amounts stored in minor units with operator-declared currency; FX display only — KODA never converts funds because KODA never holds funds.

## 5. Sentinel engineering decisions (unchanged from v1, hardened)

| Concern | Decision |
|---|---|
| SMS scope | Operator sender-IDs only; non-payment SMS never read or transmitted — enforced in code, stated in the privacy policy |
| Play policy risk | Real, mitigated: direct APK + managed-Play private channel + KODA-certified preloaded devices; public listing pursued under transactional-SMS core-functionality declaration, never depended on |
| Integrity | Attestation at enrol + rolling; per-device signing keys; unattested records quarantined; instant revocation |
| Offline reality | Store-and-forward; late SMS matched retroactively → `payment.verified.late`, never lost |
| Parsing drift | Template packs OTA; ParserAgent regenerates from drift; public per-operator parse-health page |

---

# PART V — THE AGENT MESH & THE API

## 6. Nine-agent registry (LangGraph, NSEYA X-EXECUTE convention)

| ID | Agent | Mission | Autonomy |
|---|---|---|---|
| K-01 | **ParserAgent** | Structure SMS; detect operator format drift; regenerate + canary + OTA-ship template packs worldwide | Auto-deploy on canary pass; human sign-off on field-map changes |
| K-02 | **MatchMaker** | Code↔ledger↔intent↔amount↔window↔suffix matching; fuzzy typo repair (edit distance ≤2) | Full auto within threshold |
| K-03 | **FraudSentinel** | ~40-feature risk score per match; Global Replay Index; velocity + device + payer-graph signals; per-corridor retraining | Auto-block high; challenge mid |
| K-04 | **VisionAgent** | Extract ref/amount from screenshots (Manual mode's camera button and Chat uploads); forgery forensics (ELA, font metrics, status-bar coherence). Assistive, never sole proof | Extraction auto |
| K-05 | **ReconcilerAgent** | Three-way reconciliation; surfaces unmatched payments ("money you forgot") in the Live Feed and daily digest | Reports auto; corrections merchant-approved |
| K-06 | **DisputeAgent** | Guided resolution on failed verifies; in-channel customer interview; evidence file + recommendation | Recommends; merchant decides |
| K-07 | **LinguaAgent** | All customer/merchant dialogue: FR, EN, Lingala, Swahili, Wolof, Twi at launch; Bengali, Urdu, Tagalog, Somali, Arabic, Spanish per wave | Full auto |
| K-08 | **OpsPilot** | Fleet heartbeats, parse rates per operator, webhook health, offline-merchant alerts; auto-remediates known classes | Auto-alert/remediate |
| K-09 | **COSA-K** | Chief-of-staff orchestration, policy, escalation, weekly merchant intelligence brief | Supervisory |

**Agent law:** every autonomous confirmation writes its full decision trace (inputs, scores, template + model versions) to the append-only store. *A verification you cannot audit is a verification you cannot defend.*

## 7. API reference (the developer door — deliberately tiny)

**Base** `https://api.koda.africa/v1` · **Sandbox** `https://sandbox.koda.africa/v1` · Bearer auth · TLS 1.3 · `Idempotency-Key` on all writes (24 h window)

**Keys:** `sk_live_` (server) · `pk_live_` (widget: create+verify only) · `sk_test_`/`pk_test_` (free, unlimited) · `sk_live_sub_` (platform-scoped) · `rk_live_` (restricted scopes). Rotation, revocation, IP allowlists per key.

**Core (the money path)**

```
POST /intents                    → int_… (amount, currency, operators[], customer_msisdn?, metadata, expires_in)
GET  /intents/{id}
POST /intents/{id}/verify        { "reference": "OM.260717.1432.A88213" }  or  { "screenshot": "<base64>" }
POST /intents/{id}/cancel
GET  /receipts                    filterable ledger of verified payments
GET  /receipts/{id}               full receipt + audit-grade decision trace
```

`verify` statuses: `verified · pending_review · rejected · not_found_yet` (SMS lag → KODA watches the window and converts to webhook-on-arrival; customer told in their language: *"Ton paiement est en route — on te confirme dès que le réseau nous le montre."*)

**Disputes** `GET /disputes · GET /disputes/{id} · POST /disputes/{id}/resolve`
**Fleet** `GET /devices · POST /devices/enroll · POST /devices/{id}/revoke`
**Intelligence** `GET /reconciliation/reports · GET /reconciliation/unmatched · GET /trust/{id}` (Plateforme+)
**Platform / sub-merchants (Plateforme+)** `POST/GET /submerchants · POST /submerchants/{id}/keys · GET /submerchants/{id}/usage · POST /submerchants/{id}/suspend`
**Billing (self-serve, §11)** `GET /billing/balance · POST /billing/topup · GET /billing/usage · GET /billing/invoices · POST /billing/alerts`

**Webhooks** — HMAC-SHA256 `X-Koda-Signature`, ±300 s replay tolerance, 5× exponential retry, DLQ:
`payment.verified · payment.verified.late · payment.rejected · payment.pending_review · payment.reversed (v2.1) · intent.expired · dispute.opened · dispute.resolved · sentinel.offline · reconciliation.report · billing.low_balance`

**Errors** — one format, every error a doc page with recommended FR/EN customer copy:
`code_already_used · code_not_found_yet · amount_mismatch · intent_expired · msisdn_suffix_mismatch · sentinel_offline · insufficient_credit · rate_limited · idempotency_conflict`

**Rate limits (per key):** Free 2 rps · Boutique 10 · Commerce 25 · Plateforme 100 · Enterprise custom. Verification submissions additionally velocity-limited per customer msisdn (fraud, not billing).

**Web widget — one line:**

```html
<script src="https://js.koda.africa/v1/koda.js" data-key="pk_live_..."></script>
```

```javascript
Koda.pay({amount: 25000, currency: "CDF", orderId: "TNK-88213"})
    .on("verified", r => unlockOrder(r.receipt_id));
```

**Sandbox with a telco simulator:** magic references (`TEST-OK-{amt}`, `TEST-LATE-90`, `TEST-REPLAY`, `TEST-SUFFIX`, `TEST-REVERSAL`) + `POST /sandbox/sms` to inject any operator-formatted SMS and watch ParserAgent structure it. Free, unlimited, never expires. North-star activation metric: **first verified payment < 10 minutes from signup** — measured.

**DX built for where the world's mobile money developers actually are:** Node, PHP/Laravel, Python, Flutter SDKs (webhook verification + idempotency built in); WooCommerce plugin; 40-line WhatsApp-bot recipe; Google-Sheets order tracker via Apps Script; docs equally deep in French and English (Bengali, Tagalog, Spanish per wave); support on WhatsApp with SLAs, not email; public status + parse-health pages; OpenAPI 3.1 + Postman published.

---

# PART VI — FRAUD ENGINE

## 8. Built to be lied to

Screenshot fraud exists because merchants verify against **customer-side** artifacts. KODA's truth is **merchant-side**, operator-issued, device-attested — a fraudster must forge an SMS into the merchant's own phone. Residual surface and answers:

| Attack | Countermeasure |
|---|---|
| **Code replay** | Global Replay Index — single-use per merchant, forever, across all three doors (a code verified in Manual mode is dead to the API too). Second use → reject + flag |
| **Stolen code** (real payment, wrong claimant) | Suffix ↔ checkout/WhatsApp identity, exact amount, tight window; mismatch → DisputeAgent challenge ("confirm the last 3 digits of the paying number") |
| **Forged screenshot** | Never sufficient; Vision forensics feed risk; truth = ledger |
| **Spoofed SMS into merchant phone** | Sender-ID allowlist + grammar validation + **balance-chain defence**: every genuine operator SMS carries `balance_after`; a spoof breaks the running arithmetic → quarantine + merchant alert. The operator's own bookkeeping is the firewall — and it works identically for bKash in Dhaka and Orange in Kinshasa |
| **Compromised Sentinel** | Attestation, signed records, per-device anomaly baseline, instant revocation |
| **Merchant self-fraud** (fake receipts to game a platform) | Balance-chain + cross-merchant collision detection + trust-score API exposed to platforms |
| **Pay-then-reverse** | Reversal SMS parsed too → `payment.reversed` (v2.1). Honest limit: KODA can't prevent operator-side reversal; it makes the merchant first to know |

Risk bands: `<0.15` auto-confirm · `0.15–0.6` challenge · `>0.6` reject. Models retrained per corridor — Kinshasa fraud ≠ Dhaka fraud, and the features know it.

---

# PART VII — MONETISATION (one ladder, three doors)

## 9. The moral centre of the pricing

**The billable atom is a successful verification** (`payment.verified` / `.late`) — identical whether a human clicked Verify in the Console or a webhook fired. Failed matches, rejections, expired intents: **free**. *We only earn when the merchant gets paid.* Metered in ACU (portfolio convention; 3× multiplier law on agent-heavy ops):

| Operation | ACU |
|---|---|
| Verification — code path (any door) | 1 |
| Verification — screenshot/Vision path | 3 |
| Dispute evidence file | 3 |
| Trust-score lookup | 0.5 |
| Sub-merchant onboarding | 5 (one-time) |
| Reconciliation | bundled / 1 on-demand |

Retail anchor ≈ **$0.03/ACU**, degressive. Local-currency price cards per market (a Kinshasa boutique thinks in FC, a Dhaka shop in BDT) — pinned monthly, absorbed FX.

**AI metering policy (absolute):** every AI action on the platform — verification, Vision extraction, dispute-evidence generation, on-demand agent runs, and all AI Growth Engine tools — is **metered in ACU and gated by available balance**. No AI action is free (enforced minimum 0.25 ACU) and none executes when the balance cannot cover it (HTTP 402). Enforced centrally by one gate (`engine.gateAI`) that every AI endpoint passes through, and regression-tested (`npm run test:gating`). The sole money-path nuance: code-path *verification* retains a bounded, repayable grace overdraft (spec §11) so a paying customer is never stranded at the till — that is deferred billing, not free usage.

**Margin protection law (v2.1 — fully-loaded):** every usage price retails at **≥2× the fully-loaded variable cost** (AI inference + cloud/Firebase + WhatsApp/Meta conversation fees + email/SMS + mobile-money gateway fees + support ops) — the 100%-profit floor — and AI-heavy operations additionally at 3×–10× raw AI cost. **Subscriptions are sized to carry fixed overhead** (cloud baseline, Firebase, email tier, monitoring, domain, devices, legal/accounting amortization), so per-unit margins never subsidize infrastructure. Enforced in code: `app/shared/costs.js` + `npm run margin` fail CI if any price point drops below the floor. Re-run after any provider price change; ACU weights — not the retail anchor — adjust first.

## 10. The unified plan ladder

**Pricing law (binding):** the billable atom is one verification = 1 ACU. Two retail rates over a single hard floor of **4× fully-loaded cost ($0.026/verif)** — nothing is ever sold below 4×:
- **Plan rate = 4× ($0.026/verif)** — the committed, cheaper rate you get *only* inside a plan's included quota.
- **Ad-hoc ACU = 5× ($0.0325/ACU)** — pay-as-you-go top-ups, plan overage, and AI actions. So ad-hoc always costs more than a plan; there is no way to get the 4× rate without a plan.

| Plan | Price | Door(s) | Includes | Overage |
|---|---|---|---|---|
| **Marché** | $0 | Manual + Chat | 10 verifications/mo, 1 Sentinel, Verify Console, Live Feed, replay protection, daily digest | — (top up) |
| **Boutique** | $5/mo | Manual + Chat + API | 160 verifications, 2 devices, 3 team seats, customer receipts, web widget, webhooks, reconciliation | $0.0325 |
| **Commerce** | $20/mo | All | 750 verifications, 5 devices, 10 seats, Vision + forensics, DisputeAgent, priority parsing, WhatsApp SLA | $0.0325 |
| **Plateforme** | $100/mo | All | 3,750 verifications, unlimited devices, highest throughput (100 req/s), SLA-backed response times | $0.0325 |
| **Scale** | $399/mo | All + sub-merchants | 15,000 verifications, sub-merchant API + scoped keys, trust-score API, re-billing endpoints, distributor / reseller access | $0.0325 |
| **Enterprise/Gov** | Custom | All | Volume, in-country residency, dedicated corridor models, white-label (+20% wholesale), SLA | Custom |

**Pay-as-you-go (no subscription, 5×):** $33→1,000 ACU · $165→5,000 · $650→20,000 (all $0.0325/ACU). Deliberately above the 4× plan rate so committing to a plan always saves.
**Partner wholesale (buy float/inventory, resell at the 5× retail, keep the spread):** distributor 85% of retail = $0.0276/ACU (KODA nets 4.25×, partner keeps 15%); reseller 80% = $0.026/ACU (KODA nets the 4× floor, partner keeps 20%). Below 80% (which would breach the 4× floor) is rejected. Because retail is 5×, the whole partner margin lives above the floor — everyone wins: merchant, partner, and KODA (≥4× on every ACU).
**Partners:** BSP/bot-builders 15% rev-share 24 mo or wholesale resale; agencies 10% referral + certified directory. Telco posture: none needed — if an operator wants to white-label KODA as their SME tool, that's enterprise licensing from a position of strength.

## 11. Prepaid-first billing — the product bills itself with itself

Card-on-file fails in these markets. KODA is **prepaid ACU wallet first**: merchants top up **via mobile money** (or BitriPay, card, bank transfer) — and **the top-up is verified by KODA's own engine**. `POST /billing/topup` creates a KODA intent on KODA's own account; the merchant pays, drops the code, credits land in seconds. Every top-up is a live demo of the product being paid for. Auto-top-up rules; low-balance WhatsApp alerts; a small **goodwill credit buffer** (a bounded ACU overdraft, `KODA_GRACE_ACU`, default 50) so a live checkout is never cut off the instant the balance hits zero; beyond the buffer, chargeable verification is refused (atomically) rather than run into unbounded negative. Postpaid invoicing for Plateforme/Enterprise contracts only.

**Free-tier anti-abuse:** one Marché account per attested device + KYB msisdn; per-IP signup cap that escalates to a SecurityAgent auto-block; FraudSentinel velocity applies identically; conversion nudges from real usage ("You verified 48 payments this month — Boutique costs $0.16/day").

## 12. Unit economics (per verification, scale, blended) — INTERNAL ONLY, never shown publicly

Fully-loaded cost ≈ **$0.0065** (code path) / **$0.0213** (vision). The pricing law fixes the floor at **4× that cost**:
- **Plan verification** sells at $0.026 → **4× (300% profit, ~$0.0195 gross)**.
- **Ad-hoc ACU** (top-up / overage / AI) sells at $0.0325 → **5× (400% profit, ~$0.026 gross)**.
- **Partner-channel ACU**: KODA nets 4×–4.25× (partner keeps the 15–20% spread out of the 5× retail).

CI (`tools/margin.js`) fails the build the moment any pack, plan rate, overage, or wholesale rate would sell below 4×, so the floor can never silently erode. Screenshot-heavy corridors are covered by the vision path being metered at 3 ACU (≥4× on its own higher cost). **These cost/margin figures are internal only** — public surfaces show price, verifications, and RPS, never cost or markup.

**P4 prize (unchanged, now global):** a merchant's verified KODA ledger is the cleanest SME cash-flow dataset in every market it touches — the underwriting substrate for merchant lending across the portfolio.

---

# PART VIII — TRUST, COMPLIANCE, LIMITS

## 13. Go-live machinery
Self-serve gate: attested Sentinel + KYB-light (name, operator msisdn ownership via $0.10 self-verification) + (API mode) webhook passing a signed test event. **SLA (Commerce+):** 99.9% API availability; KODA-side p95 < 5 s — contract language explicitly separates KODA's clock from the operator's SMS-delivery clock. Miss the SLA → that month's subscription credited, automatically.

## 14. Compliance posture
No fund transmission, no float, no payment execution → outside EME/établissement-de-paiement scope (BCC/DRC and analogous regimes); **formal legal opinion per market is a launch gate for every wave**, not an afterthought. Where BitriPay's EME licence lands, KODA slots under it as the verification layer. Data: payment-SMS-only capture enforced in code; per-market residency options; masked msisdn outside the fraud pipeline; DPIA published; consent copy written by humans, local language first. CQRS append-only store = every verification replayable for disputes and regulators.

## 15. Honest limitations (in the public docs, on purpose)
1. **Latency floor is the operator's, not ours** — congested networks delay the SMS; SLA language separates the clocks.
2. **No payment initiation in v2** — customer still dials USSD (assisted deep-links now; optional aggregator STK-push later as premium, never a dependency).
3. **Funds sit on the merchant SIM** — treasury/sweep is BitriPay's job downstream, cleanly separated for licensing.
4. **Google Play SMS policy is a live risk** — mitigated by distribution strategy, never assumed away.
5. **App-only wallets and bank rails (UPI/PIX) are out of scope in v2** — different mechanism, roadmap adapters.
6. **Operator format drift will break parsing periodically** — which is why drift-detection + OTA packs is a core competence, with a public parse-health page.
7. **Manual mode verifies payments, not business ethics** — a merchant-side insider with the merchant's phone creates *real* entries, because they're real payments.

---

# PART IX — EXECUTION

## 16. Roadmap

| Phase | Window | Exit gate |
|---|---|---|
| **P0 — Forge** | | Sentinel + W1 packs ≥99% parse on live Tunakula/Scan & Go traffic; **Verify Console GA** (Manual mode ships in P0 — it's the fastest door to build and the widest to sell); core API; MatchMaker + FraudSentinel v1 |
| **P1 — Proof** | | 250 Kinshasa merchants, ≥70% Manual-mode; Chat Mode GA; DisputeAgent; fraud loss <0.1% of verified volume; first prepaid top-ups verified by KODA itself |
| **P2 — Corridor** | | W2 packs (MTN, Wave: CI/SN/GH/KE); widget + Reconciler GA; first Platform deal on wholesale; sub-merchant API hardened |
| **P3 — Worldwide** | | (bKash, JazzCash, GCash corridors) via Community Template Program; localised price cards + LinguaAgent languages; `payment.reversed`; assisted-USSD |
| **P4 — OS** | M14+ | KODA = the portfolio's Payment Truth Layer in X-EXECUTE; verified-cash-flow credit scoring; W5–W6; optional operator white-label deals |

**90-day API-business launch sequence:** spec freeze + simulator (W0–2) → Tunakula & Scan & Go as first *paying* accounts on real invoices (W2–4) → FR/EN docs + 10 external pilots (W4–6) → first bot-builder Platform deal (W6–10) → public self-serve launch + case studies ("0 telco meetings, 11 minutes to first verified payment") (W10–13). "Real" = 100 external accounts, ≥30% paid, ≥1 Platform, API revenue clearing infra COGS.

## 17. The pitch, 90 seconds

> Mobile money moves over a trillion dollars a year across Africa and Asia — and most merchants still verify payments by squinting at screenshots. Not because the payments fail. Because the **integrations** do: telco APIs take a year, cost a contract, and stop at every border.
>
> KODA flips it. Every operator on Earth already sends the merchant a confirmation SMS, instantly, free. That SMS *is* the API — it just wasn't structured. A 6 MB app on the merchant's own phone turns their SIM into a verification endpoint. An agent mesh matches the customer's code against it, fights fraud with the operator's own balance arithmetic, and delivers the verdict wherever the merchant lives: a **tap in their KODA account** for the trader who'll never write code, a **✅ inside WhatsApp** for the seller who lives there, a **signed webhook** for the platform automating thousands of merchants.
>
> Same engine. Three doors. Any operator that sends an SMS — which is nearly all of them, on every continent. No telco contract. No licence exposure. Free until the merchant actually gets paid. And every verified payment builds the cash-flow ledger that becomes merchant credit at scale.
>
> **KODA: le code confirme le cash. Anywhere the code exists.**

---

# PART X — POSITIONING STATEMENT

**Mobile Money Verification Without Telco API Integration**

A plug-and-play verification and automation layer for WhatsApp commerce, websites, ticketing, food delivery, schools, marketplaces and field sales.

KODA does not move money and does not pretend to replace mobile-money operators.

It verifies that a customer's payment appears in the merchant's trusted payment-confirmation channel, matches it against an expected transaction, scores the fraud risk, and automatically releases the connected product or service.

**Customer pays normally. Merchant receives confirmation. KODA verifies. The business system acts.**

## 1. The real problem

African businesses regularly face four barriers:

* Mobile-money API approval can take months or years.
* Some operators provide no reliable merchant API.
* Different countries and operators use different formats.
* Customers still need instant confirmation after paying.

Today, merchants manually:

1. Ask customers for screenshots.
2. Check transaction messages.
3. Compare names, numbers and amounts.
4. Confirm orders manually.
5. Send tickets or activate services.

This is slow, easy to manipulate and impossible to scale.
KODA converts that manual confirmation process into a controlled verification engine.

## 2. The non-negotiable truth

A customer-supplied confirmation code alone must never be treated as definitive proof of payment.

A fraudster can:

* reuse an old code;
* invent a reference;
* edit a screenshot;
* send another customer's transaction;
* pay the wrong merchant;
* reverse the payment later;
* submit the same payment for several orders.

Therefore, KODA requires at least one merchant-controlled confirmation source.

**Trusted verification sources**

The platform can verify payments from:

1. Merchant payment-confirmation SMS.
2. Merchant phone notification.
3. Merchant WhatsApp payment-confirmation inbox.
4. Merchant email alerts.
5. Merchant web portal entry.
6. Agent-assisted USSD confirmation.
7. End-of-day mobile-money statement upload.
8. Approved payment-terminal receipt.
9. Manual confirmation by an authorised cashier.

No direct operator API is required for the core workflow.

## 3. The operating model

**Step 1 — Create a payment intent**

The merchant system creates an expected payment before the customer pays.

Example:

```json
{
  "payment_intent_id": "KVI-KIN-847291",
  "merchant_id": "MER-1048",
  "order_id": "ORD-78541",
  "amount": 45000,
  "currency": "CDF",
  "payment_network": "ORANGE_MONEY",
  "merchant_number": "+243XXXXXXXXX",
  "customer_number": "+243XXXXXXXXX",
  "expires_at": "2026-07-17T18:30:00Z",
  "action_after_payment": "ISSUE_TICKET"
}
```

KODA returns:

* payment reference;
* merchant number;
* exact amount;
* expiry time;
* customer instructions;
* verification link;
* WhatsApp payment button.

**Step 2 — Customer pays through the normal mobile-money channel**

The customer uses:

* USSD;
* mobile-money app;
* SIM toolkit;
* agent;
* merchant till;
* QR payment;
* phone-to-phone transfer.

The payment remains entirely within the existing mobile-money network.
KODA never asks the customer for a PIN or wallet password.

**Step 3 — Customer submits the transaction reference**

The customer sends:

* transaction ID;
* payer phone number;
* payment amount;
* optional screenshot;
* optional last four digits of the payer number.

Submission channels:

* WhatsApp;
* merchant website;
* checkout page;
* USSD-assisted agent portal;
* cashier application;
* QR payment-status page.

Example WhatsApp message:

```
I have paid 45,000 CDF.
Transaction code: PP26071784729
Number used: 0812345678
```

**Step 4 — Merchant-side confirmation is captured**

KODA waits for a trusted merchant-side signal.

**Option A — Merchant Verification Phone**

The merchant installs the lightweight KODA Bridge Android application on the phone receiving mobile-money confirmations.

The application:

* reads only authorised SMS or notification formats;
* extracts the amount, sender number, reference and date;
* encrypts the extracted data;
* sends the transaction fingerprint to KODA;
* works with intermittent internet;
* queues verification events offline;
* does not require the operator's API.

The merchant controls which senders and notification applications the bridge may read.

**Option B — WhatsApp confirmation forwarding**

A merchant forwards the payment-confirmation message to a dedicated KODA WhatsApp number.

The system extracts:

* payment amount;
* transaction reference;
* sender;
* recipient;
* date and time;
* network;
* available balance, where present.

This option is less automatic than the Android bridge but works with almost any merchant phone.

**Option C — Merchant portal confirmation**

A cashier enters or scans the transaction details in the merchant dashboard.

This is suitable for:

* small businesses;
* event venues;
* schools;
* field agents;
* restaurants;
* merchants using feature phones.

**Option D — Statement reconciliation**

The merchant uploads:

* CSV;
* Excel;
* PDF statement;
* exported transaction history;
* photographed transaction report.

KODA reconciles pending orders against the statement.
This is primarily a fallback and settlement-control mechanism, not an instant verification method.

## 4. The verification engine

KODA matches the customer's claim against the merchant-side confirmation.

**Core matching fields**

* merchant wallet or till number;
* transaction reference;
* amount;
* currency;
* payer number;
* payer name;
* receiving number;
* transaction timestamp;
* network;
* payment-intent expiry;
* order reference;
* previous use of the transaction code.

**Verification levels**

**Level 0 — Unverified claim**
The customer submitted a reference, but no merchant-side confirmation exists.
*Action:* Hold the order.

**Level 1 — Partial match**
The amount and approximate time match, but the payer or reference is incomplete.
*Action:* Request one additional verification field or send to merchant review.

**Level 2 — Strong match**
The reference, amount and merchant destination match.
*Action:* Approve low-risk transactions.

**Level 3 — Verified and reconciled**
The transaction matches the merchant confirmation and later appears in the merchant statement.
*Action:* Mark as settled and audit-complete.

**Level 4 — Reversal or dispute detected**
The merchant reports a reversal, refund or balance discrepancy.
*Action:* Freeze the related entitlement and open a recovery case according to merchant policy.

## 5. The Verification Fingerprint

Every payment receives a unique immutable fingerprint:

```
SHA-256(
  network
  + merchant_wallet
  + transaction_reference
  + amount
  + currency
  + payer_number_hash
  + transaction_date
)
```

This prevents one payment from being used for:

* two food orders;
* multiple tickets;
* several school-fee invoices;
* repeated account top-ups;
* duplicate marketplace purchases.

Once a fingerprint is consumed, the system rejects future attempts unless an authorised refund or reassignment workflow is completed.

## 6. Agentic OS architecture

The AI agents do not "invent" payment confirmation. They process evidence, identify anomalies and orchestrate business actions.

### 6.1 Payment Intent Agent

Creates the payment request and selects:

* merchant wallet;
* network;
* currency;
* reference format;
* expiry;
* expected amount;
* post-payment action.

It can route customers to the most suitable available merchant wallet based on capacity, network and transaction limits.

### 6.2 Confirmation Extraction Agent

Reads structured and unstructured confirmation messages.

Example inputs:

```
Vous avez reçu 45 000 CDF de 0812345678.
Référence: PP26071784729
Date: 17/07/2026 16:42
```

```
You have received USD 20 from JOHN K.
Transaction ID: MP26071799821
```

It normalises them into one internal schema:

```json
{
  "network": "MOBILE_MONEY_NETWORK",
  "amount": 45000,
  "currency": "CDF",
  "payer_number": "HASHED_VALUE",
  "transaction_reference": "PP26071784729",
  "transaction_time": "2026-07-17T16:42:00+01:00",
  "source_trust": "MERCHANT_DEVICE_NOTIFICATION"
}
```

### 6.3 Matching Agent

Links the payment to the correct:

* order;
* invoice;
* ticket;
* customer;
* subscription;
* delivery;
* school account;
* marketplace transaction.

Matching must remain deterministic where possible. AI is used for inconsistent text and ambiguous cases, not for overriding financial controls.

### 6.4 Fraud Detection Agent

Flags:

* reused transaction references;
* edited screenshots;
* payer-number mismatch;
* unusual payment timing;
* repeated failed claims;
* one payer funding many unrelated accounts;
* one screenshot used across several orders;
* merchant-device manipulation;
* impossible timestamp sequences;
* confirmation formats inconsistent with the network;
* high-frequency manual overrides;
* suspicious cashier behaviour.

Output:

```json
{
  "risk_score": 82,
  "risk_level": "HIGH",
  "reasons": [
    "TRANSACTION_REFERENCE_PREVIOUSLY_USED",
    "CUSTOMER_SCREENSHOT_METADATA_MISMATCH",
    "NO_MERCHANT_SIDE_CONFIRMATION"
  ],
  "recommended_action": "BLOCK_AND_REVIEW"
}
```

### 6.5 Reconciliation Agent

At the end of each day, it compares:

* verified transactions;
* mobile-money statements;
* issued tickets;
* completed deliveries;
* activated subscriptions;
* refunds;
* reversals;
* manual overrides;
* merchant balances.

It produces:

* matched transactions;
* unmatched customer claims;
* unmatched merchant receipts;
* duplicate payments;
* underpayments;
* overpayments;
* possible reversals;
* cashier exceptions.

### 6.6 Action Orchestration Agent

After verification, it triggers the merchant's system.

Examples:

* issue a QR ticket;
* confirm a food order;
* assign a delivery rider;
* activate a subscription;
* credit a wallet;
* unlock course access;
* reserve a hotel room;
* generate a receipt;
* update an invoice;
* notify warehouse staff;
* confirm school-fee payment;
* send a customer WhatsApp confirmation.

### 6.7 Dispute Agent

Handles:

* customer claims that payment was made;
* wrong amount;
* payment to the wrong number;
* duplicated payment;
* delayed confirmation;
* reversal;
* refund;
* customer-number mismatch;
* transaction not found.

It gathers evidence and routes only unresolved cases to a human operator.

## 7. WhatsApp payment journey

**Customer message**

```
I want two VIP tickets.
```

**KODA response**

```
Your total is 90,000 CDF.
Pay to Orange Money: +243 XXX XXX XXX
Payment reference: VIP-7421
Complete payment within 15 minutes.
Never send your PIN.
```

Buttons:

* I have paid
* Change network
* Payment help
* Cancel order

**After "I have paid"**

The bot asks:

```
Enter the transaction code shown in your payment confirmation.
```

The customer enters:

```
PP26071784729
```

**Verification response**

*Pending*

```
We received your payment claim. We are checking it against the merchant's payment confirmation. Your order remains reserved for 10 minutes.
```

*Verified*

```
Payment verified: 90,000 CDF.
Your two VIP tickets have been issued.
```

*Unable to verify*

```
We could not match this transaction. Check the transaction code, payment amount and receiving number. Your money has not been taken by KODA.
```

## 8. Website plug-and-play integration

**Option 1 — Hosted payment-verification page**

The merchant adds one button:

```html
<a href="https://pay.koda.africa/i/KVI-KIN-847291">
  Pay with Mobile Money
</a>
```

No complex payment API is required.

**Option 2 — JavaScript widget**

```html
<script
  src="https://cdn.koda.africa/widget.js"
  data-merchant-id="MER-1048">
</script>
```

```javascript
Koda.open({
  orderId: "ORD-78541",
  amount: 45000,
  currency: "CDF",
  customerPhone: "+243810000000",
  onVerified: function (payment) {
    window.location.href = "/payment-success";
  }
});
```

**Option 3 — REST API**

Create payment intent:

```http
POST /v1/payment-intents
Authorization: Bearer sk_live_xxxxx
Content-Type: application/json
```

```json
{
  "order_id": "ORD-78541",
  "amount": 45000,
  "currency": "CDF",
  "country": "CD",
  "customer_phone": "+243810000000",
  "allowed_networks": [
    "ORANGE_MONEY",
    "MPESA",
    "AIRTEL_MONEY",
    "AFRIMONEY"
  ],
  "expires_in_minutes": 15,
  "success_action": "CONFIRM_ORDER"
}
```

Response:

```json
{
  "payment_intent_id": "KVI-KIN-847291",
  "status": "AWAITING_PAYMENT",
  "payment_url": "https://pay.koda.africa/i/KVI-KIN-847291",
  "reference": "KV-847291",
  "expires_at": "2026-07-17T18:30:00Z"
}
```

## 9. Merchant webhooks

```http
POST https://merchant.com/webhooks/koda
```

```json
{
  "event": "payment.verified",
  "payment_intent_id": "KVI-KIN-847291",
  "order_id": "ORD-78541",
  "amount": 45000,
  "currency": "CDF",
  "network": "ORANGE_MONEY",
  "verification_level": 2,
  "risk_score": 8,
  "verified_at": "2026-07-17T17:42:18Z"
}
```

Other webhook events:

```
payment.claimed
payment.pending
payment.partially_matched
payment.verified
payment.rejected
payment.expired
payment.duplicate_detected
payment.reconciled
payment.reversal_reported
payment.refund_requested
payment.refunded
payment.manual_review_required
```

Every webhook must be cryptographically signed.

## 10. Automatic post-payment actions

Merchants create rules without coding.

**Rule example**

```
WHEN:
Payment status = VERIFIED
AND risk score < 30
AND amount = expected amount
AND transaction reference is unique

THEN:
Confirm order
Issue QR ticket
Send WhatsApp receipt
Notify event organiser
Record accounting entry
```

**High-risk rule**

```
WHEN:
Payment amount > 500 USD
OR risk score > 70
OR verification source = manual only

THEN:
Hold fulfilment
Request supervisor approval
Do not issue transferable asset
```

## 11. Merchant installation models

**Micro-merchant**

Suitable for a restaurant, salon or small shop.

Needs:

* WhatsApp Business;
* one merchant mobile-money number;
* KODA merchant account;
* manual or forwarded confirmation messages.

No developer is required.

**Growing merchant**

Suitable for ticketing, delivery, schools and ecommerce.

Needs:

* KODA Bridge on the payment phone;
* website or WhatsApp integration;
* automated webhooks;
* merchant dashboard;
* daily reconciliation.

**Enterprise merchant**

Suitable for marketplaces, transport, utilities and national platforms.

Needs:

* multiple merchant wallets;
* branch-level permissions;
* cashier devices;
* wallet routing;
* advanced fraud controls;
* enterprise webhooks;
* audit logs;
* statement reconciliation;
* maker-checker approvals;
* financial reporting.

## 12. Offline-first operations

KODA must work in low-connectivity environments.

The Merchant Bridge:

* stores encrypted confirmation fingerprints locally;
* timestamps each event;
* signs it with the registered device key;
* queues uploads;
* synchronises automatically when internet returns;
* prevents local editing of captured events;
* displays pending and synchronised status;
* can confirm local orders within merchant-defined risk limits.

Example:
A ticket scanner at a venue can receive a locally approved ticket list through Bluetooth, Wi-Fi Direct or periodic sync, without requiring continuous internet.

## 13. Security controls

**Merchant-device security**

* device registration;
* SIM and phone-number association;
* device public/private key pair;
* remote revocation;
* biometric access;
* root and tamper detection;
* encrypted local storage;
* merchant employee roles;
* device activity logs.

**Transaction security**

* transaction fingerprint;
* one-time consumption;
* amount and currency validation;
* merchant-destination validation;
* replay protection;
* webhook signature;
* idempotency keys;
* immutable audit trail;
* duplicate reference blocking.

**Human controls**

* maker-checker approval;
* manual override reason;
* supervisor approval;
* override limits;
* cashier-level reporting;
* unusual-override alerts;
* branch-level restrictions.

## 14. What the system must never do

KODA must never:

* request the customer's mobile-money PIN;
* store wallet passwords;
* simulate a mobile-money operator;
* claim that a payment is settled using only a screenshot;
* use AI confidence as the sole approval mechanism;
* automatically approve an untrusted customer reference;
* bypass operator terms or local financial regulations;
* describe itself as a bank or payment institution unless licensed;
* hide from merchants that verification is confirmation-based rather than operator-API-based.

## 15. Recommended payment states

```
CREATED
AWAITING_PAYMENT
CUSTOMER_CLAIMED
AWAITING_MERCHANT_SIGNAL
PARTIAL_MATCH
VERIFIED
MANUAL_REVIEW
REJECTED
EXPIRED
FULFILLED
RECONCILED
REVERSAL_REPORTED
REFUNDED
CLOSED
```

The system must separate:

* **Claimed** — customer says they paid.
* **Verified** — trusted merchant evidence matches.
* **Reconciled** — payment appears in the merchant's financial record.
* **Settled** — only used where the underlying provider or licensed partner confirms settlement.

## 16. Merchant dashboard

The merchant sees one operational command centre.

**Live payment queue**

* awaiting confirmation;
* verified;
* partial match;
* suspicious;
* expired;
* duplicated;
* manual review;
* reversal reported.

**Transaction view**

Each transaction displays:

* order;
* expected amount;
* received amount;
* payer information;
* merchant destination;
* transaction reference;
* evidence source;
* verification level;
* risk score;
* action history;
* staff involvement;
* reconciliation status.

**Wallet control**

* wallet balance entered or imported;
* wallet capacity;
* daily transaction volume;
* payment network;
* branch assignment;
* device connection;
* last synchronisation;
* confirmation delay;
* exception rate.

## 17. Business model

KODA should not charge the customer.

**Merchant pricing options**

**Verification fee**

A fixed fee per successfully verified payment.

Example:

* CDF transaction: $0.03–$0.10 equivalent
* USD transaction: $0.05–$0.20

**Monthly subscription**

* Starter: low-volume merchants
* Growth: WhatsApp and website automation
* Business: multiple numbers and staff
* Enterprise: branches, wallets and advanced reconciliation

**Hybrid pricing**

* monthly platform fee;
* included verification allowance;
* fee for additional successful verifications;
* premium fee for statement reconciliation;
* enterprise fraud-monitoring fee.

The merchant pays for verified business outcomes, not for every customer message or every AI interaction.

## 18. AI cost-control model

To remain profitable, KODA should use AI selectively.

**Do not use AI for**

* exact amount comparisons;
* duplicate-code detection;
* cryptographic fingerprinting;
* state transitions;
* expiry rules;
* webhook execution;
* basic known-message formats.

These should use deterministic software.

**Use AI for**

* unknown SMS formats;
* multilingual message extraction;
* screenshot analysis;
* ambiguous transaction matching;
* anomaly explanation;
* reconciliation exceptions;
* dispute summarisation;
* new operator-template discovery.

**Cost-control pipeline**

```
Rules engine
→ Template parser
→ Regex and deterministic matching
→ Lightweight local model
→ External AI model only for exceptions
→ Human review for unresolved high-risk cases
```

This can keep most verifications outside expensive AI-model calls.

## 19. Minimum viable product

**Phase 1 — Operational MVP**

Build:

* payment-intent creation;
* WhatsApp customer flow;
* merchant confirmation forwarding;
* manual merchant portal;
* transaction reference matching;
* duplicate prevention;
* payment-status webhooks;
* order-release rules;
* audit logs;
* basic merchant dashboard.

**Phase 2 — Merchant Bridge**

Add:

* Android notification listener;
* SMS template extraction;
* offline queue;
* registered-device signatures;
* multi-wallet routing;
* automatic verification.

**Phase 3 — Intelligence and reconciliation**

Add:

* fraud scoring;
* screenshot forensics;
* statement upload;
* automated reconciliation;
* cashier anomaly detection;
* reversal workflow;
* enterprise reporting.

## 20. The product positioning

**One-line proposition**

Verify African mobile-money payments and trigger business actions without waiting years for operator APIs.

**Merchant proposition**

Keep your existing mobile-money numbers. KODA turns merchant confirmation messages into controlled, automated payment verification.

**Technical proposition**

One integration for WhatsApp, websites and business systems—regardless of the mobile-money network used by the customer.

**Trust proposition**

No customer PIN. No wallet custody. No fake API promise. Every approval is tied to merchant-controlled evidence and a permanent audit trail.

## Final concept

KODA should be built as a **Payment Evidence and Fulfilment OS**, not as an unlicensed payment gateway.

Its competitive advantage is not moving the money. Its advantage is connecting four things that are currently disconnected:

```
Customer payment
+
Merchant confirmation
+
Fraud-controlled verification
+
Automatic business fulfilment
```

That makes it realistic, scalable and deployable even where mobile-money APIs are delayed, restricted or unavailable.

---

# ANNEX — v1.0 ENGINE SUMMARY (historical context, superseded by this v2.0 spec)

KODA Verify Engine v1.0, full master spec, built on a mechanism that actually exists in the market rather than fantasy telco access.

The core insight that makes it real: the merchant's confirmation SMS is the telco's ground-truth API — it just arrives unstructured. So instead of chasing telco integrations, a 6 MB Android app (KODA Sentinel) on the merchant's own SIM phone captures and parses those SMS on-device, and a 9-agent LangGraph mesh (MatchMaker, FraudSentinel, VisionAgent, ReconcilerAgent, etc.) matches the customer's reference code against that ledger and fires a webhook in under 10 seconds. No aggregator, no paybill, no licence exposure — KODA never touches funds, which keeps the verification layer outside EME scope while BitriPay handles anything rail-side downstream.

Three deliberate sharp edges:

1. **The balance-chain defence** — every genuine telco SMS carries the running balance; a spoofed SMS breaks the chain. That's the anti-fraud mechanism competitors won't have thought of, and it's checkable with zero external dependency.
2. **The honest limitations section** — Google Play SMS-policy risk, telco format drift, no payment initiation in v1. Stating these in the docs is what makes it read as engineering, not AI fantasy — and each one has a mitigation, not a hand-wave.
3. **Phase 4 is the real business** — every verified payment builds the cleanest SME cash-flow ledger in these markets, which becomes the underwriting substrate for merchant lending across the portfolio.

It's wired for day-one volume through Tunakula, Scan & Go, StudYear and TicketRoyality, priced on the ACU model with the 3× multiplier law, DRC's four operators as the P0 calibration ground.


