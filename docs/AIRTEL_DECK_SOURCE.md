# KODA — Deck Source for the Airtel Money Management Meeting

> Paste this whole document into Claude chat and ask it to build a PowerPoint.
> It is a complete, accurate inventory of what KODA is and does, plus the Airtel-specific
> business case and the ask. Everything here reflects the real, built-and-tested system.

---

## 0. HOW TO USE THIS
Suggested prompt to Claude: *"Turn this into a 16-slide investor/partner PowerPoint for a meeting with Airtel Money's management team. Audience: telecom Mobile-Money, Partnerships and Commercial leadership. Tone: confident, partnership-first, benefits-to-Airtel weighted ~60%. Include a title slide, an ask slide, and speaker notes per slide."*

---

## 1. ONE-LINER
**KODA turns the mobile-money confirmation SMS a merchant already receives into structured, verified, fraud-checked proof of payment — in ~3 seconds, with no code to paste and no per-transaction fee.**

It is payment **verification infrastructure**, not a wallet, bank, or gateway.

## 2. THE PROBLEM
Millions of African merchants still prefer cash because they cannot trust a mobile-money payment claim. They fear:
- Fake confirmation SMS and edited screenshots
- Payments sent to the wrong number or the wrong amount
- Reused/old references passed off as new payments
- Employee error and no reconciliation between orders and payments
- No simple tool for small businesses; API integrations are too costly/complex

This mistrust directly suppresses mobile-money acceptance.

## 3. MARKET TIMING
- Merchant payments reached ~**USD 155 billion in 2025** — the fastest-growing mobile-money segment (GSMA).
- Fraud, spoofing, social engineering and fake receipts keep eroding merchant and user trust.
- The moment to convert cash-dependent merchants is now.

## 4. WHAT KODA IS — AND IS NOT
**KODA is NOT:** a bank, an e-money issuer, a wallet, an aggregator, a payment gateway, or a settlement/clearing system.
**KODA never holds, receives, transfers, or settles funds.** Money flows only from the customer to the merchant's own mobile-money account/SIM, on the operator's rails.
KODA operates **after** payment initiation as a verification, reconciliation and fraud-prevention layer for the merchant. It provides no payment service; its regulatory status can be confirmed with the operator and the competent authorities (e.g. BCC Instruction n°24 in DRC).

## 5. HOW IT WORKS (the engine)
When a customer pays the merchant on mobile money, KODA analyses the operator's confirmation SMS (with the merchant's consent) and verifies:
- Amount paid · transaction reference · sender identity/partial number · recipient merchant number · date & time
- Duplicates and replay attempts · mismatch between expected and received payment · transaction risk level

**Deterministic verification engine** (not a black box):
- SMS parsing across operator formats → structured fields
- **Fraud scoring bands:** `< 0.15 = confirm · 0.15–0.60 = needs review · > 0.60 = reject`
- **Replay lock:** a reference used once is dead forever
- **Balance-chain check:** detects tampered/injected SMS
- **Audit-grade decision trace** on every verdict

## 6. THE FIVE DOORS (one engine, five ways in)
A market trader and a 400-merchant platform use the **exact same truth** — identical matching, fraud scoring, replay protection and audit trail; only the interface differs. One account, one ledger, zero migration when a merchant graduates.
1. **Manual Console** — paste the code or snap a screenshot → telco-anchored verdict in ~3s. No code, no app change.
2. **WhatsApp** — the customer drops the code in chat; KODA replies "✅ Paiement confirmé" in-thread. FR · EN · Lingala · Swahili · Wolof · Twi.
3. **API** — intents, code submission, HMAC-signed webhooks, idempotency. 3 core endpoints, integrate in an afternoon. Sub-merchant API to onboard whole merchant bases. Wholesale from $0.010/verification.
4. **USSD** — dial a shortcode on any handset (no smartphone, no data) → verdict on-screen and by SMS. (Needs an operator shortcode — a natural partnership point.)
5. **Inbound SMS (Sentinel)** — forward/auto-forward the operator SMS; KODA reads and verifies automatically. Works even on iPhone. Hands-free.

## 7. AI AGENT MESH (deterministic where money is involved)
- **K-01 ParserAgent** — regenerates operator SMS templates over-the-air when a format drifts.
- **K-03 TrustAgent / FraudSentinel** — deterministic trust score from the merchant's own ledger.
- **K-04 VisionAgent** — screenshot forensics; honest cross-check against the operator SMS.
- **K-05 ReconcilerAgent** — matches orders ↔ payments; finds unmatched money and duplicates.
- **K-06 DisputeAgent** — assembles dispute evidence automatically.
- **K-07 LinguaAgent** — auto-detects device language (6 languages).
- **K-10 SEO Autopilot / K-11 Growth** — merchant growth tools.
- **SecurityAgent** — human-verification gate + anti-abuse (below).
Every AI action is metered and gated by prepaid credit (ACU); nothing runs for free or unmetered.

## 8. NETWORK INTELLIGENCE LAYER
Merchants connect the mobile-money accounts customers pay them on, then **prove ownership** (a tiny test payment carrying a one-time reference) before the account goes live. KODA's resolver shows customers only the merchant's **active, verified, healthy** payment methods per country/currency/door. Auto-doors require a healthy Sentinel; Tier-C bank/app-push rails are flagged as not SMS-verifiable.

## 9. SENTINEL DEVICES (the edge fleet)
A lightweight Android app on the merchant's phone captures the operator SMS with consent. Features: Play-Integrity attestation, durable delivery + back-fill when offline, heartbeat/health, battery + parse-health monitoring, per-device enrolment/revocation. Each SIM is a verification endpoint. **KODA holds no SIMs** — merchants use their own numbers.

## 10. DISPUTES
Merchant-facing dispute workflow with DisputeAgent-assembled evidence; accept / reject / escalate to KODA. Structured, timestamped, order-linked records reduce "fake payment", wrong-amount and reused-reference support cases.

## 11. HOW KODA GETS PAID (System B — never touches merchant customer money)
Server-authoritative pricing, idempotent settlement, **double-entry ledger that reconciles to zero**. Two collection rails for plans and ACU top-ups:
- **Mobile money (KODA's own engine, "Door 3"):** the buyer pays a KODA number; KODA's own Sentinel auto-verifies and activates — no third party, no fee, no paste.
- **Card (Visa/Mastercard) via Stripe.**
(Paystack/Flutterwave are built but switched off for now.) Revenue model = **plan subscriptions + prepaid ACU consumption** — KODA takes **no commission** on operator transaction revenue.

## 12. PLANS & PRICING (one ladder, all five doors)
| Plan | Price | Verifications/mo | Throughput | For |
|---|---|---|---|---|
| **Marché** | Free forever | 10 | 2 req/s | Market traders |
| **Boutique** | $19/mo | 700 (+$0.0325 over) | 10 req/s | Small shops |
| **Commerce** | $79/mo | 3,000 (+$0.0325 over) | 25 req/s | Growing businesses |
| **Plateforme** | $399/mo | 15,000 (+$0.0325 over) | 100 req/s | Platforms/marketplaces |
| **Enterprise / Gov** | Custom | Committed volume | 1,000 req/s | In-country residency, SLA, white-label |
Verifications within quota are **free** (no per-use cost). ACU (prepaid credit, $0.0325/unit) is drawn only by AI features and over-quota verifications; a plan's included rate ($0.026/verif) always beats pay-as-you-go. Prepaid **ACU vouchers** and a **distributor/agent float** model let field agents resell credit and keep a 15–20% margin.

## 13. COMMUNICATION EVENT ARCHITECTURE
One event engine — **158 events across 18 categories** fan out over **5 channels** (email · in-app · WhatsApp · push · SMS). 40 mandatory notices (security/fraud/legal) always deliver. Branded, templated, multilingual; per-merchant channel preferences.

## 14. SECURITY & ANTI-FRAUD (built-in, zero-dependency)
- **Human gate on signup/login:** honeypot + signed proof-of-work challenge (imperceptible to a person, expensive at bot scale) — "only humans can sign up and log in."
- **Abuse monitor + auto-block:** records pow-fails, injection attempts, bad logins; auto-blocks an IP that trips the threshold.
- **Edge injection scanning**, HMAC-signed webhooks, idempotency, replay protection, balance-chain integrity.

## 15. STRATEGIC ADD-ONS
- **Operator-API dual-confirm (cross-check):** when an operator API is available, a receipt can be enriched from `sms_anchored` to `dual_confirmed` — the SMS verdict is never changed, only a stronger trust label added. *(Direct Airtel collaboration point.)*
- **Cross-merchant trust/fraud network:** privacy-preserving (salted hashes only) — a merchant reads an aggregate risk signal about a payer/reference, never another merchant's data.

## 16. COVERAGE
Recognition/routing metadata for **235 operators across 95 countries**. Already supports the main DRC formats: **Orange Money, M-Pesa, Airtel Money, Afrimoney**. Precise "packed" templates for key operators; generic handling elsewhere; OTA template updates when formats drift.

## 17. INTEGRATIONS & REACH
- **WooCommerce plugin** (WC gateway, HPOS, Blocks, OAuth connect, Dokan/WCFM marketplace support, zero-decimal-currency handling).
- **Public API + signed webhooks** (Door 3) for platforms; **sub-merchant API** for onboarding whole bases.
- **6 launch languages:** French · English · Swahili · Lingala · Wolof · Twi (auto-detected).
- Hosted checkout + drop-in widget.

## 18. TECHNOLOGY & STATUS
- **Zero-dependency** Node.js core (no third-party runtime packages), SQLite ledger, HMAC/Ed25519 crypto.
- One-container deploy (Docker + Caddy TLS), automated backups, disaster-recovery drill, rollback, auto-deploy.
- **Quality gate:** full automated audit — unit, doors, billing mesh, real-rails, whole-OS functional, adversarial security, real-browser — all green. Live at **kodajnn.com**.

---

## 19. THE AIRTEL BUSINESS CASE (weight this ~60% of the deck)
Present KODA as a **merchant-payment growth programme for Airtel**, not an integration request.

**What Airtel Money gains:**
1. **New merchant accounts/SIMs** — every merchant KODA recruits needs an active Airtel Money merchant account to receive payments → KODA becomes an acquisition channel.
2. **More volume on Airtel's rails** — merchants who trust confirmations accept mobile money instead of cash → more transactions, more cash-in/out, more e-money circulation, more eligible-service commissions.
3. **Higher merchant retention/stickiness** — daily KODA use makes the Airtel Money account the operational centre of the business.
4. **Less fraud & fewer disputes** — duplicate detection, replay protection, and screenshot-vs-real-SMS distinction reduce fake-payment support load.
5. **A new product for Airtel's agent/distribution network** — with Airtel's agreement, agents sell KODA subscriptions and prepaid ACU vouchers and earn a margin **funded by KODA, not by Airtel's revenue**.
6. **Total reach** — five doors incl. USSD/SMS means even basic-phone merchants (no smartphone/internet) are recruitable; agents can address the whole market.
7. **Brand visibility** — receipts/interfaces can state "Payment made directly on Airtel Money — verification by KODA," keeping a clean separation.
8. **Multi-market potential** — a successful DRC pilot can extend across Airtel's African footprint (subject to per-market validation).
9. **Faster onboarding** — a **separate sister company** offers an **AI-agent-powered KYC & onboarding platform** that enrols a merchant in minutes, cutting Airtel's onboarding cost/abandonment (evaluated independently of KODA).

**Commercial alignment:** KODA asks **no commission** on Airtel's mobile-money transaction revenue. Airtel keeps its customers, accounts, funds and transaction revenue; agents earn extra; merchants get trust; KODA earns only from its technology (subscriptions + ACU).

## 20. THE ASK — "KODA Merchant Growth Programme"
- A focal point in Mobile Money / Partnerships / Merchant teams.
- A **letter of interest for experimentation** (not a definitive homologation).
- A controlled **90-day Kinshasa pilot** (100–500 merchants, officially registered merchant accounts), with a tracking dashboard and joint review.
- Framed access to the agent/distribution network to recruit, train and support pilot merchants.
- Optional: preferential/0% collection terms **on the KODA-sales accounts only** (an acquisition lever, not a commission to KODA); official transactional-SMS templates + a format-change notification channel to keep recognition accurate.

**Pilot metrics:** new merchants recruited · merchant accounts activated · verified transactions (count & value) · active-use at 30/60/90 days · merchant-payment volume lift · fraud attempts detected · agent participation · subscription/voucher sales · merchant satisfaction.

---

## 21. SUGGESTED SLIDE ORDER (16)
1. Title — KODA × Airtel Money: a merchant-payment growth programme
2. The opportunity (155B, fastest-growing, trust gap)
3. The problem merchants face (cash stickiness)
4. What KODA is / is NOT (never touches funds)
5. How it works (SMS → verified proof in 3s)
6. One engine · five doors
7. Fraud, replay & audit engine
8. Coverage & the AI agent mesh
9. What Airtel gains (the 9 benefits) — 2 slides
10. New revenue for Airtel's agent network
11. Reach: even basic phones (USSD/SMS)
12. Faster onboarding (AI KYC sister platform)
13. Commercial model & alignment (no commission on Airtel revenue)
14. The 90-day Kinshasa pilot + metrics
15. The ask (letter of interest, focal point, agent access)
16. Close — first operator to evaluate this Congolese innovation

---
*Founder: Justin Nseya — KODA · Groupe Nseya Digital / JNN Global Ltd · kodajnn.com*
