# KODA — Aggregator Pay-In Integration Brief (Rail 2)

**Audience:** an emerging-market pay-in aggregator (pawaPay / Onafriq / Flutterwave /
dLocal / EBANX-class) evaluating KODA as a merchant, and KODA's own engineers wiring
the adapter. **Scope:** System B only — how KODA *collects its own subscription/ACU
revenue*. KODA never routes merchants' customer payments through you.

---

## 1. What KODA is (and is not) as your merchant
- **Merchant:** JNN Global Ltd (UK), selling **prepaid digital services** (ACU credit +
  SaaS plans) to businesses worldwide.
- KODA is **not** a payment processor and does **not** pool third-party funds. Every
  pay-in is a **purchase of KODA's own digital goods** by the paying business.
- Settlement is to **JNN Global Ltd in GBP/EUR/USD**. No local KODA entity per market.

## 2. What KODA needs from you (commercial gate)
1. Accept KODA as a **UK cross-border digital-services merchant** (no local entity per country).
2. **Mobile-money + local** pay-in across your supported markets (M-Pesa, MTN MoMo,
   Orange, Airtel, Wave, bKash, GCash, JazzCash, local bank/USSD/QR where available).
3. **Server-to-server webhooks** with raw-body **signature** and a stable event schema.
4. **Refunds/reversals** endpoint.
5. **Hard-currency settlement** (GBP/EUR/USD) with a documented FX + fee schedule.
6. Per-method **recurring capability** flag (many MM methods are push-only — KODA does
   not assume auto-debit).
7. **Country/method/limit matrix** and sandbox credentials.

## 3. How KODA integrates you — one adapter, one shape
KODA's Billing Orchestrator talks only to a provider contract; you become one adapter.
No provider is ever hard-coded into KODA's billing domain.

```js
// KODA-side adapter KODA implements against your API (illustrative)
const adapter = {
  providerCode: 'pawapay',                    // your code
  listAvailableMethods(ctx),                  // country+currency -> [{ method_code, flow, recurring }]
  createCheckout(req),                        // -> initiate STK push / hosted page; returns your ref
  getPaymentStatus(externalId),               // polling fallback
  createRefund(req),
  verifyWebhook(headers, rawBody),            // raw-body signature -> verified event
  supportsRecurring(country, currency, method),
};
```

## 4. The flow (mobile-money push — the common case)
```
1. Merchant taps "Top up" in KODA -> KODA quotes server-side (ACU @ 4× cost + your fee
   passed through to the merchant as a transparent line) and creates a `topup` (idempotent).
2. KODA -> your API: initiate collection { amount, currency, method, payer_msisdn, ref }.
3. You send the STK push / USSD prompt to the payer's own phone. (You can INITIATE —
   the one thing KODA's SMS model can't; here it works for us on the billing side.)
4. Payer approves with their PIN.
5. You -> KODA webhook (raw-body signed): payment.settled { external_id, ref, amount, ... }.
6. KODA verifies the signature, normalises to a canonical billing event, and settles the
   `topup`: double-entry ledger (Σ=0, balance_after chained) + ACU credited in seconds.
7. You settle to JNN Global Ltd in GBP/EUR/USD, net of fees, on your cycle.
```

**KODA never activates a plan from a browser success screen** — only a **verified
server-to-server webhook** grants entitlement. A customer-reported reference is
`PAYMENT_REPORTED_BY_CUSTOMER`, never `PAYMENT_CONFIRMED`.

## 5. Webhook contract KODA enforces on your events
- **Raw-body signature** validation (KODA stores the raw body; no re-serialisation).
- **Timestamp** + **replay** window; **idempotency** on `external_id` (duplicate/replayed
  webhooks are safe — settlement is idempotent on KODA's side too).
- **Amount + currency + merchant** validation against the originating `topup` (server-side
  price authority — KODA never trusts a client-supplied amount).
- **State-transition** validation; unknown/forged events → **dead-letter queue** + manual
  reconciliation. Endpoint: `POST /webhooks/billing/{provider}`.

## 6. Pricing & settlement (KODA-side, for your reconciliation)
- ACU retail is fixed by KODA at **4× unit cost**; **your fee is passed through** to the
  merchant as a line item — it raises the merchant's total, not KODA's net. This keeps
  KODA's margin ≥100% on your rail and means **your fee schedule is transparent to us**.
- Daily **reconciliation**: KODA's `topups` + `billing_ledger` vs. your settlement report;
  the reconciliation difference must be **zero**.
- **Refunds/chargebacks:** KODA posts a **negative entitlement adjustment** (never silently
  deletes consumed ACU), freezes usage where appropriate, and opens a case.

## 7. Tax
Where you act as **Merchant of Record** (dLocal-class), you handle local VAT/GST/DST calc
+ remittance and KODA prices `MOR_CALCULATED`. Where you are a pure PSP, KODA applies its
country price book and handles tax per its UK obligations + per-market memos.

## 8. Redundancy
KODA runs **≥2 providers per priority market** in a routing table (score + hard exclusions:
country/currency/limit/KYC/sanctions/degraded-service). Your outage degrades gracefully to
the next rail or to the distributor/voucher rail — **no single point of collection failure.**

## 9. What KODA needs to go live in a market
`sandbox creds` · `country/method/limit matrix` · `webhook signing scheme` · `settlement +
FX + fee schedule` · `refund flow` · `recurring-capability per method` · `KYB onboarding for
JNN Global Ltd`. First integration target is a **single MM-specialist** (pawaPay-class) in
1–2 W1 markets, then breadth (Flutterwave) and the tax/stretch rail (dLocal MoR).

---
*Companion: `KODA_GLOBAL_BILLING_MESH.md` (full System-B architecture). Provider names,
coverage and fees are directional and contract-dependent; final selection and per-market
legal/tax sign-off are integration-time gates.*
