# KODA billing rails — how KODA collects its own plan & top-up revenue

This is **System B**: how KODA charges merchants for plans and ACU top-ups. It never
touches a merchant's *customer* money (that is System A — the verification engine).
Prices are server-authoritative (`shared/billing.js`), every settlement is a chained,
idempotent double-entry, and a provider webhook can only settle after its **raw-body
signature** is verified (fail-closed).

## The rails

| Rail | Who it's for | Flow | Goes live when you set |
|---|---|---|---|
| **KODA Mobile Money** | DRC pilot — pay to KODA's own Orange/M-Pesa/Airtel number | Pay-to-SIM, auto-settled by KODA's own verify engine | `KODA_COLLECT_MSISDN` (+ `KODA_COLLECT_MERCHANT`, `KODA_USD_TO_LOCAL`) |
| **Stripe** | Global cards (Visa/Mastercard) | Hosted Checkout | `STRIPE_KEY`, `STRIPE_WEBHOOK_SECRET` |
| **Paystack** | Nigeria/Ghana/Kenya/SA — cards, bank, mobile money | Hosted checkout (`authorization_url`) | `PAYSTACK_KEY` (+ `PAYSTACK_CURRENCY`, `PAYSTACK_FX`) |
| **Flutterwave** | Pan-African cards + mobile money | Hosted payment link | `FLUTTERWAVE_KEY`, `FLUTTERWAVE_WEBHOOK_HASH` (+ `FLUTTERWAVE_CURRENCY`) |
| Distributor / Voucher / Bank transfer | Agents, resellers, invoices | escrow / PIN / invoice | already live (no external key) |

A rail is only shown as **clickable** in the app when its key is configured; otherwise it
renders greyed as "coming soon" — never a broken sandbox checkout. With **no** provider
keys set, every card rail falls back to the sandbox flow, exactly as before.

## The two example journeys

**Kinshasa merchant paying with Airtel Money.** They pick a plan → choose *KODA Mobile
Money* → the app shows KODA's number and an exact local amount → they pay it from Airtel
Money → KODA's own Sentinel sees the confirmation SMS → `matchKodaCollection()` settles the
matching pending order → the plan activates automatically. No third party. Requires
`KODA_COLLECT_MSISDN` (the KODA receiving number) + a Sentinel on that SIM.

**Nigeria merchant paying with a Visa card.** They pick a plan → choose *Paystack* (or
*Stripe*) → the app opens `/billing/go/<order>` → KODA calls the provider's REST API and
302-redirects to the real hosted checkout → they pay by card → the provider fires a signed
webhook to `POST /webhooks/billing/<provider>` → KODA verifies the signature, confirms the
event is a success, and `settleTopup()` activates the plan / credits ACU exactly once.

## Wiring (flow)

```
choose plan ─▶ POST /app/billing/plan            → paid? returns { payment_required, methods[] }
choose rail ─▶ POST /app/billing/subscribe       → { session } (koda: pay-to instructions · card: checkout_url)
  card ─────▶ GET  /billing/go/:id               → mints the real provider session, 302 → provider
  paid ─────▶ POST /webhooks/billing/:provider   → verify signature → settleTopup() (idempotent)
```

Top-ups use the same shape via `POST /app/billing/collect`.

## Webhook signatures (each provider verified natively)

- **Stripe** — `Stripe-Signature: t=…,v1=…`; HMAC-SHA256 of `t.rawBody` with `STRIPE_WEBHOOK_SECRET`; settles on `checkout.session.completed` (payment_status `paid`).
- **Paystack** — `x-paystack-signature`; HMAC-SHA512 of the raw body with `PAYSTACK_KEY`; settles on `charge.success`.
- **Flutterwave** — `verif-hash` equals `FLUTTERWAVE_WEBHOOK_HASH`; settles when `data.status` is `successful`.
- **Sandbox / tools** — the generic `x-koda-signature` HMAC-SHA256 with `KODA_WEBHOOK_SECRET` (fail-closed when unset).

Each provider scheme activates **only** when that provider's own secret is present, so the
generic scheme (used by the test-suite) is never shadowed.

## Register the webhook URLs in each dashboard

- Stripe → `https://kodajnn.com/webhooks/billing/stripe` (event `checkout.session.completed`)
- Paystack → `https://kodajnn.com/webhooks/billing/paystack`
- Flutterwave → `https://kodajnn.com/webhooks/billing/flutterwave`

Set `KODA_PUBLIC_URL` / `KODA_APP_URL` to your live origin so redirect + success URLs are correct.

## Tests

- `node app/backend/tools/test-billing.js` — pricing law, idempotency, double-entry, distributor/voucher rails, webhook fail-closed.
- `node app/backend/tools/test-rails.js` — Paystack rail, key-gated plan methods, real-vs-sandbox checkout, and each provider's native webhook signature (accept genuine, reject forged, don't settle non-paid events).

Both run in the launch audit (`launch-audit.sh`).
