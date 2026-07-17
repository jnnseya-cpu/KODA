# KODA — UNIFIED MASTER SPECIFICATION v2.0

**Groupe Nseya Digital / BitriPay Ecosystem — Confidential**
**Supersedes:** Verify Engine Master Spec v1.0 + API & Monetisation Spec v1.0 (fully consolidated here)
**New in v2.0:** ① No-code Manual Verification mode — full product for merchants without developers · ② Worldwide mobile money scope · ③ Single unified pricing ladder across all modes

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


