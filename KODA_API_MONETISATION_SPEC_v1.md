# KODA API — Developer Platform & Monetisation Specification v1.0

**Groupe Nseya Digital / BitriPay Ecosystem — Confidential**
**Companion to:** KODA Verify Engine Master Spec v1.0 (`KODA_VERIFY_ENGINE_SPEC_v1.md`)
**Scope of this document:** the API *as the product* — what third parties integrate, how every call is metered, and how the money is collected.

> **Status note:** This v1.0 document is preserved for historical and reference purposes. It is **superseded by `KODA_UNIFIED_SPEC_v2.md`** (Unified Master Specification v2.0), which fully consolidates it with the Verify Engine Master Spec v1.0.

> **Business model in one line:** KODA sells payment certainty by the unit. Every `payment.verified` webhook is a billable event, prepaid in mobile money — collected and verified by KODA itself.

---

## 1. THE PRODUCT IS THE API

KODA is sold **API-first**. The dashboard, WhatsApp Chat Mode, and web widget are all clients of the same public API that external developers use — no private endpoints, no second-class citizens. This forces API quality and makes every internal portfolio deployment (Tunakula, Scan & Go, StudYear, TicketRoyality) a paying reference integration from day one.

**Three customer classes, one API:**

| Class | Who | What they integrate | How they pay |
|---|---|---|---|
| **Direct Merchant** | A shop, restaurant, school, SaaS with its own checkout | Intents + Verify + Webhooks | Prepaid credit wallet or monthly plan |
| **Platform** (the big prize) | Marketplaces, WhatsApp bot builders (Wati/360dialog resellers), e-commerce SaaS, delivery apps, school-fee platforms | Sub-merchant API: onboard *their* merchants under one master key | Platform pays wholesale per-verification; marks up or absorbs |
| **Enterprise/Gov** | Banks, MFIs, utilities, tax/fee collection, NGOs cash programmes | Dedicated corridors, residency, SLA, bulk reconciliation | Annual contract + committed volume |

The Platform class is where the curve bends: one integration with a bot-builder serving 4,000 merchants = 4,000 merchants acquired at the cost of one sales cycle.

---

## 2. API SURFACE — COMPLETE v1 REFERENCE

**Base URL:** `https://api.koda.africa/v1`
**Sandbox:** `https://sandbox.koda.africa/v1` (full simulator — see §5)
**Auth:** `Authorization: Bearer {key}` · TLS 1.3 only

### 2.1 Key architecture

| Key | Prefix | Purpose |
|---|---|---|
| Live secret | `sk_live_` | Server-side, full account scope |
| Live publishable | `pk_live_` | Widget/browser: create intents + submit codes only. Cannot read ledger, cannot list receipts |
| Test secret / publishable | `sk_test_` / `pk_test_` | Sandbox universe, unlimited, free |
| Sub-merchant scoped | `sk_live_sub_` | Platform-issued, locked to one sub-merchant's data |
| Restricted | `rk_live_` | Custom scopes (e.g. read-only reconciliation for an accountant) |

Rotation via API, instant revocation, per-key IP allowlists, per-key rate limits. All server-side writes accept an `Idempotency-Key` header (24 h replay window) — non-negotiable for payment infrastructure on flaky African connectivity.

### 2.2 Endpoint catalogue

**Core verification (the money path)**

```
POST   /intents                          Create payment intent
GET    /intents/{id}                     Poll status
POST   /intents/{id}/verify             Submit reference code or screenshot
POST   /intents/{id}/cancel             Cancel/expire early
GET    /receipts                         List verified receipts (filter: date, operator, amount, metadata)
GET    /receipts/{id}                    Full receipt + decision trace (audit-grade)
```

**Disputes**

```
GET    /disputes                         Open/closed disputes
GET    /disputes/{id}                    Evidence file assembled by DisputeAgent
POST   /disputes/{id}/resolve           accept | reject | escalate
```

**Sentinel fleet**

```
GET    /devices                          Fleet + heartbeat status
POST   /devices/enroll                  Generate enrolment QR for a new merchant phone
POST   /devices/{id}/revoke            Instant kill of a device
```

**Reconciliation & intelligence**

```
GET    /reconciliation/reports           Nightly three-way reports
GET    /reconciliation/unmatched         Payments received with no intent ("money you forgot")
GET    /trust/{merchant_or_payer_id}     Trust score (Plateforme tier+) — marketplace risk API
```

**Platform / sub-merchant (Plateforme tier+)**

```
POST   /submerchants                     Onboard a merchant under master account (KYB-light: name, msisdn, operator, ID ref)
GET    /submerchants                     List + status + volume
POST   /submerchants/{id}/keys          Issue scoped keys
GET    /submerchants/{id}/usage         Their metered consumption (for the platform's own re-billing)
POST   /submerchants/{id}/suspend       Cut off a bad actor instantly
```

**Billing & metering (self-serve, machine-readable — §4)**

```
GET    /billing/balance                  Prepaid ACU credit balance
POST   /billing/topup                   Create a top-up intent (paid via mobile money, verified by KODA itself)
GET    /billing/usage?granularity=day    Metered usage: verifications, vision ops, dispute ops, ACU burned
GET    /billing/invoices                 PDF + JSON invoices
POST   /billing/alerts                  Low-balance webhooks at custom thresholds
```

### 2.3 Errors — one format, always

```json
{
  "error": {
    "type": "verification_error",
    "code": "code_already_used",
    "message": "This reference was already used on 2026-07-12 for intent int_88x.",
    "doc_url": "https://docs.koda.africa/errors/code_already_used",
    "request_id": "req_7fa2c9"
  }
}
```

Canonical codes developers will actually hit: `code_already_used` · `code_not_found_yet` · `amount_mismatch` · `intent_expired` · `msisdn_suffix_mismatch` · `sentinel_offline` · `insufficient_credit` · `rate_limited` · `idempotency_conflict`. Every error has a doc page with the exact customer-facing French/English copy we recommend showing.

### 2.4 Rate limits (per key, headers on every response)

| Tier | Sustained | Burst |
|---|---|---|
| Free/Test | 2 rps | 10 |
| Boutique | 10 rps | 50 |
| Commerce | 25 rps | 120 |
| Plateforme | 100 rps | 500 |
| Enterprise | Custom | Custom |

`429` returns `Retry-After`. Verification submissions are additionally velocity-limited **per customer msisdn** (fraud control, not billing).

---

## 3. DEVELOPER EXPERIENCE — THE ADOPTION WEAPON

African integration reality: solo developers, PHP + Node heavy, mid-range laptops, expensive data, WhatsApp-first support. DX is built for that, not for Silicon Valley:

1. **SDKs at GA:** Node/TypeScript, PHP (Laravel package), Python, Flutter/Dart. Community: Go, Java. Each SDK ships webhook signature verification + idempotency built in.
2. **Copy-paste recipes, not just docs:** "WhatsApp bot in 40 lines (Node + Meta Cloud API)", "WooCommerce plugin", "Laravel checkout", "Google Sheets order tracker via Apps Script" — because a huge share of real African SMEs run commerce on Sheets + WhatsApp.
3. **Docs in French and English, same depth.** French is not the translation; it's a first language of the product.
4. **Postman/Insomnia collections + OpenAPI 3.1 spec** published and versioned.
5. **Support where developers live:** WhatsApp developer channel + Discord; paid tiers get response-time SLAs on WhatsApp, not email.
6. **Status page + per-operator parse-health dashboard** (public): radical transparency about telco SMS drift builds more trust than pretending outages don't happen.

---

## 4. METERING & BILLING ENGINE — HOW WE ACTUALLY CHARGE

### 4.1 The billable atom

The unit is a **successful verification** (`payment.verified` or `payment.verified.late`). Failed matches, rejections, expired intents: **free**. This pricing is the moral centre of the product — *we only earn when the merchant gets paid*. It removes all integration hesitancy and is the line every competitor selling per-API-call will hate.

Metered add-ons (ACU model, portfolio 3× multiplier law for agent-heavy ops):

| Operation | ACU cost | Notes |
|---|---|---|
| Verification (code path) | 1 ACU | The atom |
| Verification (screenshot/Vision path) | 3 ACU | VisionAgent forensics |
| Dispute evidence file (DisputeAgent) | 3 ACU | On dispute open |
| Reconciliation report | 0 (bundled) / 1 ACU on-demand re-run | |
| Trust-score lookup | 0.5 ACU | Plateforme+ |
| Sub-merchant onboarding | 5 ACU one-time | KYB-light checks |

**1 ACU retail anchor ≈ $0.03**, degressive with volume (§4.3).

### 4.2 Prepaid-first: the African billing architecture

Card-on-file monthly billing fails in these markets (card penetration, FX, chargeback exposure). KODA is **prepaid credit wallet first**:

- Merchant tops up their ACU wallet **via mobile money** — M-Pesa, Orange, Airtel, Africell, MoMo, Wave — or BitriPay balance, card, or bank transfer (enterprise).
- **The top-up is verified by KODA's own engine.** `POST /billing/topup` creates a KODA intent on KODA's own merchant account; the customer pays, submits the code, ACUs land in seconds. The product bills itself with itself — the strongest possible demo, run at every single top-up.
- Auto-top-up rules ("when balance < 200 ACU, create a 2,000 ACU top-up intent and WhatsApp me the pay-to number").
- Balance exhaustion behaviour is merchant-protective: verifications **never hard-fail mid-checkout**. At zero balance, KODA continues verifying for a 72 h / 100-verification grace buffer (negative balance), then pauses new *intents* (not in-flight ones). We never strand a paying customer at the till.
- Postpaid monthly invoicing reserved for Plateforme/Enterprise with contracts.

### 4.3 Price card (what the sales page shows)

**Pay-as-you-go (no subscription — the on-ramp)**

Pay-as-you-go ACU is priced at **5× cost ($0.0325/ACU)** — deliberately above the 4× plan rate so a plan always saves.

| Top-up | Effective per verification |
|---|---|
| $33 → 1,000 ACU | $0.0325 |
| $165 → 5,000 ACU | $0.0325 |
| $650 → 20,000 ACU | $0.0325 |

**Plans (subscription = the 4× rate + features)** — Marché $0 (10/mo) · Boutique $19 (700) · Commerce $79 (3,000) · Plateforme $399 (15,000) · Enterprise custom. Included quota sells at the **4× plan rate ($0.026/verif)** — the only place a merchant gets 4×; overage draws from the prepaid wallet at the 5× ad-hoc rate ($0.0325).

**Partner wholesale (buy float/inventory, resell at the 5× retail, keep the spread)**

| Partner | Buys at | KODA nets | Partner margin |
|---|---|---|---|
| Distributor | 85% of retail = $0.0276/ACU | 4.25× | 15% |
| Reseller | 80% of retail = $0.0260/ACU | 4.0× (floor) | 20% |

Below 80% (which would breach the **4× floor**) is rejected in code + CI. Platforms may mark up to their merchants freely, absorb it as a feature, or use KODA's **re-billing API** (`/submerchants/{id}/usage`). White-label ("Powered by KODA" removable) at Plateforme+ for +20% on wholesale rate.

### 4.4 Revenue share & partner programme

- **BSP/bot-builder partners** (Wati-class): 15% recurring rev-share on referred volume for 24 months, or wholesale resale — their choice.
- **Agencies/integrators:** certified-partner directory, 10% referral, co-sell for Enterprise.
- **Telco posture:** none needed — but if an operator ever *wants* to partner (white-label KODA as their official SME verification tool), that's a licensing deal at enterprise pricing, from a position of strength: we grew without them.

### 4.5 Anti-abuse of free tier

Marché tier: 20 verifications/mo, 1 device, device-attestation required, one free account per attested device + KYB msisdn. FraudSentinel velocity rules apply identically. Free tier is a funnel, not a leak: conversion trigger messages fire from usage data ("You verified 48 payments this month — Boutique would have cost you $0.63 per day").

### 4.6 Unit economics (investor page)

Per verification, at scale, DRC corridor (**internal only — never shown publicly**):

| Line | $ |
|---|---|
| Fully-loaded cost (code path) | 0.0065 |
| Plan verification (4× rate) | 0.026 → **gross ~0.0195 (300% profit)** |
| Ad-hoc ACU: top-up / overage / AI (5× rate) | 0.0325 → **gross ~0.026 (400% profit)** |
| Partner-channel ACU (KODA net) | 0.026–0.0276 → **4×–4.25×** (partner keeps 15–20%) |

The **4× floor is enforced in code and CI** (`tools/margin.js`): no pack, plan rate, overage, or wholesale rate can ever sell below 4× cost. Vision is metered at 3 ACU so the pricier vision path ($0.0213 cost) still clears 4× ($0.0975 = 4.6×). Margin expands as code-path share rises (it does, as customers learn the flow).

---

## 5. SANDBOX — WHERE INTEGRATION HAPPENS IN AN AFTERNOON

The sandbox ships a **full telco simulator**, because developers can't send themselves real mobile money all day:

- `sk_test_` universe with simulated operators (`mpesa_cd_test`, `orange_cd_test`, ...).
- **Magic references** produce deterministic outcomes: `TEST-OK-{amount}` → instant verify · `TEST-LATE-90` → verifies after 90 s (`payment.verified.late`) · `TEST-REPLAY` → `code_already_used` · `TEST-SUFFIX` → `msisdn_suffix_mismatch` → DisputeAgent challenge flow · `TEST-REVERSAL` → verify then `payment.reversed` (v1.1).
- Simulated Sentinel: `POST /sandbox/sms` lets a developer inject a raw operator-formatted SMS and watch ParserAgent structure it — this single endpoint teaches the whole mental model.
- Webhook test console with signed replay.
- Sandbox is free, unlimited, and never expires. Time-to-first-verified-payment target: **under 10 minutes from signup** — measured, on the growth dashboard, as the north-star activation metric.

---

## 6. GO-LIVE & TRUST MACHINERY

1. **Self-serve go-live gate:** attested Sentinel enrolled + KYB-light (business name, operator msisdn ownership check via a $0.10 self-verification — the merchant's first KODA verification is verifying themselves) + webhook endpoint passing signed test event.
2. **SLA (Commerce+):** 99.9% API availability; KODA-side verification processing p95 < 5 s (explicitly excludes telco SMS delivery time — the two-clock language from Master Spec §10.1 is contractual).
3. **Money-back rule:** any month API availability < 99.9%, that month's subscription is credited. Simple, public, rare enough to afford.
4. **Changelog discipline:** versioned API (`/v1`), 12-month deprecation windows, breaking changes never inside a version. Telco template-pack updates are invisible to integrators by design — that's the whole point of the abstraction.

---

## 7. LAUNCH SEQUENCE FOR THE API BUSINESS (90 DAYS)

| Week | Milestone |
|---|---|
| 0–2 | OpenAPI spec frozen; sandbox simulator live; Node + PHP SDKs |
| 2–4 | Tunakula + Scan & Go migrated onto public API keys as first *paying* accounts (internal transfer pricing — real invoices, real metering, real bugs) |
| 4–6 | Docs FR/EN live; WhatsApp dev channel; 10 pilot external merchants in Kinshasa on Boutique |
| 6–10 | First Platform deal (target: one WhatsApp bot-builder serving DRC/CI merchants) on wholesale; sub-merchant API hardened by their onboarding |
| 10–13 | Public launch: pay-as-you-go self-serve open; case study content from pilots ("0 telco meetings, 11 minutes to first verified payment"); referral programme on |

Exit criteria for calling the API business "real": **100 external accounts, ≥ 30% on paid tiers, ≥ 1 Platform, first month of pure API revenue clearing infra COGS.**

---

## 8. THE COMMERCIAL PITCH, COMPRESSED

> Stripe charges you when a payment succeeds. So do we — except we made it work in markets Stripe never will, on rails that never needed a telco's permission.
>
> Integrate in an afternoon. Pay only when your merchant actually gets paid. Top up your account with the same mobile money your customers use — verified by the very engine you're buying. And if you're a platform, bring your whole merchant base: wholesale units, sub-merchant API, your brand on the front.
>
> **KODA API: on gagne seulement quand tu es payé.**

---
*© 2026 Groupe Nseya Digital / JNN Global Ltd. KODA API & Monetisation Specification v1.0.*
