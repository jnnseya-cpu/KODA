# KODA — Market & Competitive Analysis (August 2026)

**Groupe Nseya Digital / BitriPay Ecosystem — Confidential**
Interactive version: see the published artifact. This is the cited source-of-record.

## The market
- **$1.4 trillion** flowed through sub-Saharan African mobile money in 2025 (+27% YoY) — GSMA State of the Industry 2026.
- Africa = **~66%** of global mobile-money value and **~74%** of transactions (~92B of 125B).
- **~1.2 billion** mobile-money accounts in Africa; East Africa $806B, West Africa $498B, Central Africa $105B.

## The category distinction (the whole thesis)
KODA is **not** a payment gateway. Gateways/aggregators **collect and settle** money for a **percentage of every transaction**. KODA **verifies** a payment the customer already made directly to the merchant's own mobile-money number, for a **flat per-check fee**, and never touches funds.

| Player | Category | What it does | Charges |
|---|---|---|---|
| Flutterwave, Paystack | Gateway | Collect + settle | % per txn |
| Tingg (Cellulant), DPO, Chipper for Business | Aggregator | One integration, many operators; collect & route | % per txn |
| M-Pesa Daraja API | Telco API | Direct M-Pesa (Kenya only) | % till + dev + paybill |
| Kopokopo | Reconcile | M-Pesa collection + reconciliation + payouts | % + payout fee |
| "Send me a screenshot" | Status quo | Manual eyeballing | free / broken |
| **KODA** | **Verification** | Confirms against the merchant's own operator SMS; never moves money | **flat per verify** |

## Pricing gap — cost to verify one $50 payment
| Option | Cost | Source |
|---|---|---|
| Paystack — 1.5% + ₦100 | ≈ $0.81 | Kudi Compass / AfroTools |
| Flutterwave — 1.4% (cap ₦2,000) | ≈ $0.70 | Kudi Compass |
| Kopokopo — 0.55% + KSh 50 payout | ≈ $0.67 | Kopo Kopo support |
| Tingg / Chipper — ~1% mobile money | ≈ $0.50 | Tingg pricing / Chipper |
| M-Pesa Daraja — 0.55% till (+ KSh 30k–150k one-time dev) | ≈ $0.28+ | Truehost / Blackshepherd |
| **KODA — flat per verification** | **$0.03** | KODA pricing |

**Result:** 17×–27× cheaper on a $50 payment. Because rivals charge a percentage, the gap widens with size — on a $500 payment KODA is still $0.03 vs $5–$7.50 uncapped (160×–250×).

## Value added to the merchant
1. **90–98% lower cost to verify** — 3 cents vs $0.50–$7.50; on 1,000 payments/mo ≈ $470–$7,470 saved.
2. **Minutes not 6–18 months** — no paybill, no telco B2B, no KSh 30k–150k dev bill.
3. **Fraud eliminated** — replay lock + balance-chain defence stop screenshot and fake-SMS scams no gateway protects on direct payments.
4. **Every operator, one tool** — M-Pesa, Orange, Airtel, MTN, Wave, bKash… vs M-Pesa-only Daraja/Kopokopo.
5. **Found revenue** — unmatched-payment recovery.
6. **Growth built in** — 10 AI marketing tools + SEO engine on the same prepaid balance.

## Where KODA wins / where it doesn't
**Wins:** merchant paid directly; need is "did they pay + fraud?"; meaningful payment sizes where % hurts; no developer/telco relationship; multi-operator.
**Gateway is better:** needs a third party to collect & settle; card acceptance / cross-border; payment initiation (STK push) today.
**Strategic read:** KODA doesn't fight gateways for collection — it takes the underserved layer *beneath* them (every directly-paid merchant needing certainty + fraud protection), priced so low a percentage-taking rival can't follow, and can sit *alongside* a gateway.

## Sources
- GSMA / Connecting Africa: https://www.connectingafrica.com/mobile-money/-1-4t-flowed-through-mobile-money-in-sub-saharan-africa-in-2025-gsma
- Ecofin Agency: https://www.ecofinagency.com/news/2603-54111-africa-accounts-for-two-thirds-of-global-mobile-money-flows-in-2025
- Forbes Africa: https://www.forbesafrica.com/current-affairs/2025/04/09/sub-saharan-africa-dominates-global-mobile-money-landscape-with-1-1-billion-accounts-new-report-finds
- Kudi Compass (Paystack/Flutterwave): https://kudicompass.com/paystack-vs-flutterwave-nigeria-payment-gateway-comparison-2026/
- AfroTools Paystack calculator: https://afrotools.com/tools/paystack-calculator/
- Truehost (Daraja): https://truehost.co.ke/m-pesa-api/
- Blackshepherd (M-Pesa integration cost): https://blackshepherd.co.ke/m-pesa-integration-on-your-website-whats-the-cost/
- Kopo Kopo support (fees): https://kopokopoinc.zendesk.com/hc/en-us/articles/19266603539730-Transaction-limits-and-fees
- Tingg pricing: https://tingg.africa/pricing/
- Chipper for Business: https://enterprise.chippercash.com/
- WorldFirst (Chipper review): https://www.worldfirst.com/af/blog/business-banking-insights/chipper-cash-review/
- FSD Africa (Onafriq/MFS): https://fsdafrica.org/investment/mfs-africa-now-onafriq/

*Competitor figures are publicly listed rates as of August 2026; vary by market/volume/negotiated terms; USD conversions approximate. Gateway/aggregator fees cover collection & settlement; KODA's fee covers verification only — complementary, not identical, services. KODA does not move, hold, or settle funds.*
