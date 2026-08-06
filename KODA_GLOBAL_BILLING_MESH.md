# KODA — Global Billing Mesh (spec-of-record)

> **Synthesis of two source documents:** *Global Billing Mesh* (System A/B split,
> orchestrator, four rails, two ledgers, Ed25519 vouchers, routing engine, state
> machine) and *Global Collections Architecture v1.0* (three rails, the
> engine-verified distributor loop, `balance_after`-chained ledger). Both describe
> **how KODA collects its own revenue** — not how merchants get paid. This is the
> authoritative, reconciled version.

> **Stack reconciliation (binding).** The source docs specify NestJS + PostgreSQL +
> TypeScript. KODA's foundation is **zero-dependency `node:sqlite` + plain JS +
> `node:crypto`**, one process, one Docker image — the basis of the whole test gate
> and deploy. This spec therefore lands every interface in KODA's native stack:
> the `CollectionProvider`/`BillingProviderAdapter` becomes a JS contract; the
> "immutable double-entry ledger with `balance_after` chaining" is the exact
> `acu_transactions` pattern already hardened in `engine.js` (relative updates +
> `rowid` ordering + tamper-evident chaining); Ed25519 voucher signing uses
> `crypto.sign/verify` (native). No Postgres, no TypeScript, no new runtime deps.

---

## 1. The one decision everything rests on: two separate systems

| | **System A — Verification Network** | **System B — Billing Network** |
|---|---|---|
| What it is | The **product** sold to merchants | How **KODA collects its own revenue** |
| Uses | Merchant's own SIM, phone, wallet, SMS, operator relationship | Aggregators, resellers, cards, vouchers — **never** a KODA-held SIM per operator |
| Money flow | Customer → merchant, directly (KODA never touches it) | Merchant → KODA, for plans / ACU / licences / add-ons |
| Trust anchor | The confirmation SMS (Sentinel + engine) | Licensed providers + prepaid resellers + the engine (for the distributor loop) |

**Collection is not verification.** KODA refuses telco contracts for the *product*
because merchants can't wait 18 months. But KODA billing is a different shape —
**one payee (us), low tickets ($10–$400), prepaid, non-urgent by seconds** — which
licensed aggregators already solve and the airtime-distributor tree has solved for
25 years. We never receive mobile money ourselves; we route through rails that do.

---

## 2. The four rails

Behind one **Billing Orchestrator**, each rail is a pluggable provider. The
orchestrator picks the best live rail per checkout; the merchant only ever sees
"top up with M-Pesa / Orange / card / voucher / agent near you."

### Rail 1 — Merchant of Record (global tax + card rail)
Paddle / Stripe-Managed / approved MoR. The MoR becomes the **legal seller** and
owns: collection, VAT/GST/sales-tax calc + remittance, compliant invoices,
disputes, chargebacks, fraud screening, currency localisation — then pays KODA net.
Use for cards, Apple/Google Pay, PayPal, bank transfer, Pix, UPI, Alipay/WeChat,
EU local methods, **automatic recurring subscriptions**, tax-compliant invoices.
*Global selling coverage, but does not solve every African mobile-money/USSD
market — so it is the primary global tax+card rail, never the only rail.*

### Rail 2 — Emerging-market pay-in aggregators
Onafriq / pawaPay / Flutterwave / dLocal / EBANX / Thunes-TerraPay / regional
specialists (Xendit, SSLCommerz, Coda, Cellulant). One API each; they hold the
operator contracts and local licences; they **settle to JNN Global Ltd in
GBP/EUR/USD**. Use for M-Pesa, Orange, MTN MoMo, Airtel, Wave, bKash, GCash,
JazzCash, local bank, USSD, QR, cash/OTC. Integrate **3–4, not all** — coverage
overlap is our redundancy. dLocal-as-MoR additionally **absorbs digital-services
VAT/DST** in taxed markets (Kenya/Nigeria/Ghana-class).
**Commercial gate:** the aggregator must accept KODA as a UK digital-services
merchant, process cross-border pay-ins with **no local entity required**, settle in
hard currency, provide webhooks + refunds, and confirm per-method recurring
availability.

### Rail 3 — BitriPay (future in-house rail)
The group's own regulated infrastructure — **preferred rail portfolio-wide once
payment/safeguarding/AML/settlement licensing is operational**. Until then it is a
future adapter behind the same interface. Until BitriPay is licensed, KODA must
**not**: receive customer funds into unlicensed personal wallets, collect through
private SIMs, call itself a payment processor, pool third-party funds, promise
cross-border settlement, or hold cash-redeemable merchant balances.

### Rail 4 — KODA prepaid reseller / distributor network (the unfair rail)
For USSD-only, no-card, unstable-connectivity, or aggregator-unsupported markets.
Modelled on the airtime tree — **ACU is airtime for payment verification** — with
the compliant legal shape and one upgrade nobody else has: *our own engine verifies
the payments.* Two complementary forms:

**(a) Signed vouchers (fully offline).** A reseller signs a contract, **prepurchases
KODA service inventory**, and issues **single-use, Ed25519-signed, product- and
country-locked, non-cash vouchers** (plan codes / ACU PINs). Sold as printed cards
or WhatsApp codes; redeemed in app / web / WhatsApp / USSD-SMS. Reseller is an
authorised reseller of a **prepaid SaaS digital good** (airtime-resale legal shape).

**(b) Engine-verified distributor loop.** A Country Distributor (KD) is prepaid
(zero KODA credit risk). A merchant pays the KD by ordinary **P2P mobile money to
the KD's own number**; the KD's **Sentinel captures the confirmation SMS**, KODA's
engine verifies it through the full K-02/K-03 pipeline (amount ↔ window ↔ suffix ↔
replay index ↔ balance-chain), and the merchant's ACU wallet is **auto-credited in
seconds, debited from the KD's float**. *The engine is the escrow — nobody trusts
anybody.* Every top-up is simultaneously a revenue event, a fraud-model training
example, and a live product demo.

> **Compliance note on 4(b):** credit is minted **only** on a verified payment into
> the KD's own attested Sentinel ledger, debited from **prepaid** float — KODA never
> holds or pools customer funds, and the KD collects into their **own** account under
> a reseller contract, not on KODA's behalf into an unlicensed wallet. This is what
> keeps 4(b) on the right side of the "must-not-build" list in §11.

---

## 3. Three billing models (no universal recurring mandate)

Many mobile-money journeys are **customer-authorised push payments** (enter number →
operator prompt → PIN → confirm). KODA must not assume auto-debit everywhere.

- **Model A — Automatic recurring.** Cards, direct debit, selected wallets, approved
  MM mandates, app-store subs.
- **Model B — Merchant-confirmed renewal.** T-7 "pay now" link; merchant picks a
  method, gets the operator prompt, approves.
- **Model C — Prepaid service balance.** Merchant tops up a KODA **Billing Balance**;
  each cycle KODA deducts the fee. This balance is **service-only, non-transferable,
  non-cash, non-withdrawable, non-interest-bearing, not a payment account** — to
  avoid stored-value classification (final call is jurisdictional).

---

## 4. Billing hierarchy (routing order)

```
1. Existing valid automatic mandate
2. Merchant-of-Record local method
3. Emerging-market aggregator mobile money
4. BitriPay, when live
5. KODA-authorised reseller voucher
6. Pro-forma invoice / bank transfer
```

Chosen by: country · currency · merchant type · KYC · available methods · amount ·
plan-vs-ACU · recurring capability · provider availability · expected fees ·
settlement delay · failure rate · tax treatment · fraud risk.

---

## 5. The Billing Orchestrator (never hard-code a provider into the domain)

One internal service between KODA products and every external provider. The
subscription/ACU domain talks to **the contract**, never to Paddle/Stripe/Flutterwave/
dLocal/BitriPay directly.

```js
// KODA-native JS contract (was a TS interface in the source doc)
const BillingProviderAdapter = {
  providerCode,                        // 'paddle_mor' | 'stripe' | 'dlocal'
                                       // | 'flutterwave' | 'bitripay'
                                       // | 'bank_transfer' | 'voucher' | 'distributor'
  listAvailableMethods(ctx),           // -> [{ method_code, flow, recurring_supported }]
  createCheckout(req),                 // -> { billing_checkout_id, amount, methods, expires_at }
  getPaymentStatus(externalId),        // -> canonical status
  createRefund(req),                   // -> refund result
  verifyWebhook(headers, rawBody),     // -> verified provider event (raw-body signature)
  supportsRecurring(country, currency, method), // -> bool
};
```

**Initial adapters:** `paddle_mor · stripe · dlocal · flutterwave · bitripay ·
bank_transfer · voucher · distributor · google_play`.
**Future (post approval):** `ebanx · paystack · pesapal · paymob · cinetpay ·
regional_psp · usdt`.

### Routing engine — score then hard-exclude
Score (100): availability 30 · settlement certainty 20 · conversion 15 · recurring
10 · tax handling 10 · cost 5 · settlement speed 5 · dispute 3 · redundancy 2.
**Hard exclusions:** country/currency/business-type unsupported · settlement to KODA
unavailable · MM operator unavailable · provider degraded · amount out of limits ·
KYC incomplete · tax treatment unresolvable · sanctions block.

---

## 6. Two ledgers (separate access from usage)

- **Subscription ledger** — *can the merchant access KODA?* States: `TRIAL · ACTIVE ·
  PAST_DUE · GRACE · SUSPENDED · CANCELLED · EXPIRED`; billing modes A–C/voucher/invoice.
- **ACU ledger** — *usage capacity.* **Immutable, append-only, double-entry** — never a
  mutable balance field. Entry types: `PURCHASE · PLAN_ALLOCATION · USAGE · REFUND ·
  PROMOTION · EXPIRY · REVERSAL · ADMIN_ADJUSTMENT`; every entry has `debitAccount`,
  `creditAccount`, `idempotencyKey`, and a chained `balance_after`.

**The invariant:** a successful payment **never** directly mutates a balance. The
sequence is always:

```
provider payment confirmed → canonical billing event → reconciled →
entitlement transaction → subscription extended and/or ACU posted →
receipt issued → merchant notified
```

*KODA mapping:* the existing `acu_transactions` table already carries
`delta · kind · ref · balance_after` and now uses relative updates + `rowid`
ordering (the concurrency fix). System B extends it with `account_id`
(merchant wallet | KD float | KODA revenue), `entry_type`, and `idempotency_key`
so the same tamper-evident chain covers billing.

---

## 7. Voucher system (Rail 4a)

Ed25519-signed payload → `base64url(payload) + "." + base64url(signature)`; PIN is
stored **hashed**. Redemption verifies: signature · voucher state · product ·
country/currency lock · reseller status · expiry · merchant eligibility · prior
redemption · fraud flags — under a **row lock**, then atomically: mark redeemed →
post entitlement → create receipt → post reseller commission → commit.
Voucher must be single-use · signed · product+market bound · non-cash ·
non-transferable after redeem · never negative-balance-creating · batch-traceable ·
revocable-if-stolen-before-redeem · expiry-controlled · replay-protected.
Product types: `PLAN_30/90/365 · ACU_TOPUP · DEVICE_LICENCE · BRANCH_ADDON ·
WHATSAPP_PACK · API_PACK`.

*KODA mapping:* `crypto.generateKeyPair('ed25519')` at deploy (private key in env,
public key shipped); `crypto.sign(null, payload, priv)` / `crypto.verify(...)`.

---

## 8. Distributor loop, precisely (Rail 4b)

```
1. Merchant: POST /v1/billing/topup { amount_acu: 600, method: 'agent' }
2. Orchestrator: nearest active KDs (country + float ≥ amount) →
   { kd_name, pay_to_msisdn, local_amount, expires_in: 900 }
   + creates a KODA payment intent ON THE KD's account (metadata: topup_id)
3. Merchant sends ordinary P2P mobile money to the KD's number
4. KD's Sentinel captures the operator SMS → engine verifies against the intent
   (amount ↔ window ↔ suffix ↔ replay index — full K-02/K-03 pipeline)
5. payment.verified fires internally → atomic ledger tx:
      kd_float_debit(-600 ACU) + topup_credit(+600 ACU to merchant)
6. Merchant balance in <10s. KD sees margin. We saw everything. The engine was the escrow.
```

**KD term sheet:** wholesale discount 12–15% (their whole margin); 100% prepaid,
auto-alert at 20% float; qualification = KODA merchant ≥60 days + clean fraud
record + attested Sentinel + KYB-plus; 2–5 KDs/market (no exclusivity); sub-agent
trees allowed (float cascades, all on-ledger); instant float-freeze + device-revoke
kill switch; **settlement to KODA is upfront at wholesale purchase — we sell
inventory, not credit.**

---

## 9. Country pricing engine

Never convert a base price mechanically at live FX. Maintain **country price books**:
`{ productCode, countryCode, currency, amountMinor, taxMode: INCLUSIVE|EXCLUSIVE|
MOR_CALCULATED, purchasingPowerTier: GLOBAL_A|GLOBAL_B|EMERGING_C|ACCESS_D,
allowedBillingMethods, validFrom/To }`. Consider purchasing power, competitor
pricing, MM fees, tax, FX volatility, support cost, fraud loss, reseller margin,
minimum sustainable contribution. FX absorbed within ±2%, repriced beyond.

---

## 10. Lifecycle policies

**Renewal (KODA verifies payments — abrupt cut-off can stop a merchant's business):**
T-14 reminder · T-7 pay-now MM link · T-3 · T-1 · due-date attempt/prompt · days 1–3
active grace · days 4–7 verify continues, config locked · days 8–14 read-only +
export · day 15 suspend · then retain per policy. High-risk/fraud merchants skip
the normal grace.

**ACU exhaustion:** 25% warn · 10% urgent · 5% auto-top-up (if authorised) · 0%
usage-requiring-ACU paused. **Core payment evidence is never deleted for a zero
balance.**

**Auto-top-up:** only where a reusable mandate exists. For push-only MM: low → pending
top-up → notify → merchant approves operator prompt → webhook → credit. **Never
attempt unauthorised wallet debits.**

---

## 11. Webhooks, state machine, and what NOT to build

**Every provider event → one canonical billing payment** (`paymentId, providerCode,
externalPaymentId, billingCheckoutId, merchantId, status, amountMinor, currency,
providerFee, tax, methodType, payerCountry, occurredAt, evidenceHash`). Controls:
raw-body signature · timestamp · replay prevention · idempotency · amount/currency/
merchant validation · state-transition validation · dead-letter queue · retry ·
manual reconciliation queue.

**State machine:** `CREATED → METHOD_SELECTED → AWAITING_CUSTOMER_ACTION → PROCESSING →
{PAID|FAILED|EXPIRED|CANCELLED}`; `PAID → {PARTIALLY_REFUNDED|REFUNDED|REVERSED|
CHARGEBACK}`. **Entitlements granted only on `PAID`.** On reversal/chargeback: don't
auto-delete consumed ACU — post a **negative entitlement adjustment**, freeze usage
where appropriate, move subscription to review, preserve evidence, open a case.
A manual/customer-reported reference is `PAYMENT_REPORTED_BY_CUSTOMER`, **never**
`PAYMENT_CONFIRMED` — it must not independently activate a paid plan.

**KODA must NOT build:** a SIM farm; a central phone farm for subscription payments;
personal-wallet collection per country; activation from screenshots; an internal
unregulated multi-currency cash wallet; P2P ACU transfer; cash withdrawal from ACU;
informal agents without reseller contracts; direct operator integrations before
volume justifies; or a promise that one gateway covers every MM network.

---

## 12. Financial model (blended collection economics)

| Rail | All-in take | Note |
|---|---|---|
| Aggregator MM | 2.5–4.5% (+~0.5–1% FX) | licensed heavy lifters |
| dLocal MoR | 4–6% | includes tax handling |
| Distributor | 12–15% | *wholesale discount* — zero variable fee, zero credit risk, does local marketing free, hands us **prepaid float (negative working capital)** |
| Voucher | 10–15% | print + distribution margin |
| Stripe/card | ~2.9% + $0.30 | |
| USSD/SMS opex | ~$0.01–0.03/session | priority markets only |

### Pricing law (binding — overrides the source docs)
KODA's margin is **held at ≥100% profit on cost, regardless of rail** (the existing
`margin.js` gate). Two rules make that automatic:

1. **ACU is priced at 4× the underlying provider/unit cost.** A 4× retail multiple is
   a **300% markup** — always clears the 100%-profit floor with headroom, on every
   rail and price point.
2. **Collection cost is passed through to the merchant, never absorbed.** The rail's
   fee is added on top as a **transparent line item** in the quote (`collection_fee`),
   so a more expensive rail (distributor 15%, dLocal 6%) raises the *merchant's* total
   and never compresses KODA's margin. *(This reverses the "absorb it / hide the fee"
   framing in the source docs — KODA does not eat collection cost.)*

So a quote is always `total = subtotal(4× cost) + collection_fee(rail %) [+ tax]`, and
KODA nets the subtotal at ≥100% margin whichever rail wins.

**Blended collection cost** still ranges ~5–15% by rail, but it is the **merchant's**
line, not KODA's — it changes the merchant's total, not KODA's margin.

**Reseller margin bands** (the reseller's own cut, inside their wholesale discount):
digital-only 8–12% · local MM 12–18% · cash/field 15–25% · national master =
negotiated volume rebate. Cap or disclose max retail price.

---

## 13. Build sequence (KODA-native, honest)

| Sprint | Ship |
|---|---|
| 1 | Billing domain: products, country price books, subscriptions, checkouts, attempts, canonical payments, tax fields, receipts, entitlements, **ACU double-entry ledger** |
| 2 | Provider adapters (`stripe`, `paddle_mor`, `flutterwave`) + webhook gateway + signature + idempotency + reconciliation |
| 3 | Mobile-money checkout: country-aware methods, operator select, phone validation, push + USSD-instruction states, expiry, notifications, confirmation polling |
| 4 | Prepaid **Billing Balance** (Model C): plan deduction, low-balance alerts, renewal reservation, failed-renewal lifecycle, manual top-up |
| 5 | **Reseller platform**: onboarding + due diligence, inventory orders, batch generation, **Ed25519 voucher sign/redeem**, commission ledger, reconciliation, fraud monitoring |
| 5b | **Distributor loop** on the existing verification engine (mostly wiring — the hard parts already exist) + KD console |
| 6 | `dlocal` MoR for taxed markets + FX repricing job |
| 7 | `bitripay` — replace/supplement per country, not big-bang |

---

## 14. The answer, compressed

> **"How do merchants in 200 countries pay KODA with mobile money when KODA has no
> SIM, no entity, and no telco contract anywhere?"**
>
> Four rails behind one orchestrator, none invented. **MoR** (Paddle/Stripe) for
> cards + global tax; **licensed aggregators** (Onafriq/pawaPay/Flutterwave/dLocal)
> holding the operator contracts and settling to London in GBP; **BitriPay** when
> licensed; and the **prepaid reseller/distributor network** — signed vouchers plus a
> KD tree whose incoming payments are **verified by KODA's own engine on the KD's own
> SIM**: zero credit risk, feature phones served over the counter, negative working
> capital, every top-up a live demo. ACU is priced at **4× cost** and the rail fee is
> **passed through to the merchant as a transparent line** — so KODA holds **≥100%
> margin on every rail** and never eats collection cost. We didn't invent a payment
> method — we routed the proven ones through one orchestrator, and made our own
> product the escrow for the hardest mile.

---
*© 2026 Groupe Nseya Digital / JNN Global Ltd. Provider names, coverage counts and
fee ranges are directional and contract-dependent; final provider selection and
per-market legal/tax sign-off are integration-time gates per the wave discipline in
Master Spec v2.0. Companion: `NETWORK_INTELLIGENCE_LAYER.md` (System A) and this
document (System B).*
