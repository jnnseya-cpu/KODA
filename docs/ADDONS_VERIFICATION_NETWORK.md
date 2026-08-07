# Add-ons: dual-confirm + cross-merchant trust network

Two strategic add-ons, layered **on top of** the existing engine with **zero change**
to how verification already works. KODA stays SMS-anchored and custody-free; these
turn KODA into the neutral *"did this payment really happen?"* utility that merchants,
aggregators, and telcos can all plug into — flipping competitors into distribution.

Both are **strictly additive** and proven so: the full launch audit (unit 61, doors 16,
functional 95, adversarial 24-held, DR/webhook) is byte-identical, plus a new
`test-addons.js` (14 checks).

---

## Add-on A — operator-API cross-verification ("dual-confirmed")

**What it does.** Every receipt is `sms_anchored` by default — exactly today's
behaviour, and the SMS-anchored verdict is *never* changed. When an operator API
adapter is configured, a receipt can be **independently confirmed** against the
operator's own API and upgraded to `confirmation_level: "dual_confirmed"`. This lifts
trust from "the merchant's SMS says so" to "the merchant's SMS *and* the operator's API
agree" — without KODA ever requiring a telco contract by default.

**Design (why it's a pure add-on).**
- The money path (`verify()` / auto-match) is untouched. Cross-check is an **opt-in
  enrichment** you invoke per receipt — it can never block or downgrade a verification.
- Adapters are **per-operator, env-configured**, so KODA's "no telco deal needed"
  default holds. No adapter → the call is a no-op and the receipt stays `sms_anchored`.
- Never blocks: a down/unknown/unconfigured operator API just leaves the SMS-anchored
  label in place.

**Config.**
```
KODA_OPAPI_<OPERATOR>       = https://partner.example/confirm   # POST endpoint
KODA_OPAPI_<OPERATOR>_KEY   = <bearer token>                    # optional
# e.g. KODA_OPAPI_ORANGE_CD, KODA_OPAPI_MPESA_CD, ...
# test adapters (no network): mock://confirm , mock://deny
```
The adapter receives `{operator, reference, amount, msisdn}` and returns
`{confirmed:true|false}` (also accepts `status:"confirmed"` / `exists:true`).

**API.** `POST /v1/receipts/:id/crosscheck` → `{ confirmation_level, operator_api:{…} }`.
`confirmation_level` is also included on verified webhook payloads and receipt reads.

**Files.** `app/backend/lib/crosscheck.js`; `receipts.confirmation_level` column.

---

## Add-on B — cross-merchant trust / fraud network

**What it does.** As merchants verify (and quarantine, and dispute) payments, KODA
accretes a **network-wide aggregate** per counterparty — the moat no single-country
processor can replicate. A merchant can then read a **network trust signal** for a
payer: *"N verified payments and D disputes across the KODA network."*

**Privacy (why it's safe to share across tenants).**
- Keyed on a **salted HMAC hash** of the payer's trailing digits — never a raw number,
  name, or which merchant contributed it.
- A merchant only ever reads the **aggregate** (counts + a derived score), never another
  merchant's rows. No PII crosses tenants.

**Design (why it's a pure add-on).**
- **Recording** is passive and wrapped so it can never break the money path.
- The **Trust API** is new surface (see below).
- The **fraud-scoring feed is OFF by default** (`KODA_TRUST_NETWORK_SCORING=1` to enable).
  With it off, `scoreMatch` is byte-identical to before — the network can only ever add
  a small positive risk delta from *proven* network-wide adverse history, never lower
  risk or override the deterministic bands (`<0.15 confirm · 0.15–0.6 review · >0.6 reject`).

**Config.**
```
KODA_TRUST_NETWORK          = 1     # default on (recording + API); set 0 to disable
KODA_TRUST_NETWORK_SCORING  = 0     # default off (feed into fraud score); 1 to enable
KODA_TRUST_NETWORK_SALT     = <secret>   # falls back to KODA_JWT_SECRET
```

**API.**
- `GET  /v1/trust/:subject` → merchant-local history **plus** a `network` block
  (`network_trust_score`, `verified_across_network`, `disputes_across_network`, …).
- `POST /v1/trust/flag` `{subject|reference, reason}` → contribute an explicit fraud
  flag (chargeback / confirmed scam) that other merchants inherit as a signal.
- Opening a dispute auto-contributes the payer + reference to the network.
- The existing K-03 trust agent now returns the `network` block too.

**Files.** `app/backend/lib/trust_network.js`; `network_trust`, `network_flags` tables;
optional `networkDelta` param in `app/backend/lib/fraud.js` (defaults to 0).

---

## The strategic point

- **Dual-confirm** lets KODA sell *assurance levels* — SMS-anchored for the long tail
  where no API exists, dual-confirmed where it does — the same product, upgraded.
- **The trust network** becomes the shared anti-fraud layer. Even an aggregate that a
  competitor can't build makes KODA the natural *verification standard* others integrate
  — turning rivals into distribution channels rather than head-on competitors.

Neither changes what KODA already is. They sit on top.
