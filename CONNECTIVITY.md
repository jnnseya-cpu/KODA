# KODA — verifying payments in low/no-internet and feature-phone zones

Not every merchant has a smartphone or reliable data. KODA is built so a payment
can still be verified with **no internet and no smartphone** — because the one
thing that always works is the cellular network the operator already uses to send
the confirmation SMS.

## The key insight
The payment-confirmation SMS travels over the **cellular network**, not the
internet. So the phone holding the SIM receives it even with zero data. KODA's job
is to turn that SMS into a verification through whatever channel the merchant *can*
reach. Four doors, from most to least connectivity:

| Door | Needs | For whom |
|---|---|---|
| **Checkout page / app (PWA)** | smartphone + data | online shops, marketplaces |
| **WhatsApp** | smartphone + data | anyone on WhatsApp |
| **Inbound SMS** | **any phone, no internet** | feature phones, dead-zones |
| **USSD** | **any phone, no internet** | feature phones, dead-zones |

The bottom two are the ones that make KODA work where the others can't.

## USSD — the universal, no-internet, any-phone door
The merchant dials a shortcode (e.g. `*XXX#`) from their **registered phone** and
types the code the customer received. KODA replies on the same USSD session:

```
*384#          →  CON KODA — verifier un paiement
                   Entrez le code recu par SMS:
25000ABC       →  END Paiement confirme: 25 000 CDF. Merci!
```

- Works on the cheapest feature phone, with no data and no app.
- KODA routes by the dialing number → the merchant's account (no login needed).
- Endpoint: `POST /webhooks/ussd` (aggregator-agnostic; Africa's Talking-style
  `CON`/`END` text protocol). **Already built and tested.**

## Inbound SMS — text the code to a shortcode
The merchant texts the transaction code to KODA's number; KODA verifies and
SMS-replies. Also any-phone, no-internet.

- Endpoint: `POST /webhooks/sms` (body `{from, to, text}`; extracts the code —
  which always contains digits, so a greeting isn't mistaken for one).
- Reply goes out via the SMS gateway when `SMS_GATEWAY_KEY` is set; otherwise it
  logs. **Already built and tested.**

## Offline-first on the Sentinel side
The merchant's Sentinel phone reads the operator SMS **locally, offline**, and
queues it. When any connectivity returns (even a brief GPRS window), it forwards
the batch. So payments in a dead-zone are captured and verified **late** rather
than lost — KODA emits `payment.verified.late` for these. (Sentinel P1 in
`SENTINEL_APP_SPEC.md` covers the durable outbox + retry.)

## What you need to switch these on (providers)
Both doors are **built**; they light up once you connect a telco channel:

| Need | Provider options | Env / config |
|---|---|---|
| **USSD shortcode** | Africa's Talking, an MNO/aggregator, Hubtel (GH), Beem (EA) | point the shortcode's callback at `POST /webhooks/ussd` |
| **SMS shortcode / long code** | Africa's Talking, Twilio, MNO, Termii | callback → `POST /webhooks/sms`; set `SMS_GATEWAY_KEY` for replies |

USSD and shared shortcodes are provisioned per-country through a mobile-network
operator or an aggregator — that is the one external step. No code changes needed;
the endpoints and routing already exist.

## Where this matters most
- **Rural DRC / Sahel / low-data corridors** — merchants on feature phones verify
  by USSD.
- **Marketplaces reaching informal sellers** — a seller with any phone can confirm
  a payout.
- **Network outages** — offline Sentinel + USSD keep verification working when data
  is down.

## Bottom line
KODA does **not** assume a smartphone or the internet. A merchant with a $15
feature phone and no data plan can still verify a real mobile-money payment by
USSD. The software for it is done and tested (16 door checks green); the only
remaining step is provisioning a USSD/SMS shortcode with a telco or aggregator in
each launch country.
