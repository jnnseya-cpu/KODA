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

