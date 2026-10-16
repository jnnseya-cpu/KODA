# KODA — Product Hunt launch kit

Everything to fire a launch. Fill the PH form with the fields below, upload the
gallery images in `brand/ph-gallery/` (in order), and paste the maker's comment
the moment you go live.

---

## The listing fields

**Name:** KODA

**Tagline (≤60 chars) — pick one:**
1. `Verify mobile-money payments from the operator's SMS` (51) ← recommended
2. `Stop fake payment screenshots — verify from the SMS` (51)
3. `Mobile-money payment verification, no telco API` (47)

**Description (≤260 chars):**
A customer's screenshot proves nothing — it's edited in seconds. KODA verifies any mobile-money payment against the operator's own confirmation SMS (Orange Money, M-Pesa, Airtel + 200 more) — a verdict in ~3s, no telco API. Free to start.

**Topics/tags:** Fintech · Payments · SaaS · Developer Tools · Africa

**Links:** Website `https://kodajnn.com` · Get started `https://kodajnn.com/get-started`

**Pricing:** Free (with paid plans) — say "Free forever tier: 10 verifications/month, no card."

**Launch offer (put it in the maker comment):** e.g. "PH launch: extra free verification credit for anyone who signs up today and replies here." *(Only promise what you'll actually honour.)*

---

## Maker's first comment (paste at go-live)

Hey Product Hunt 👋

I'm building KODA from Kinshasa, DR Congo.

If you've ever sold anything in a mobile-money market, you know this moment: a customer says "I've paid — here's the screenshot," you hand over the goods, and the payment never actually happened. A screenshot is just a picture; it's edited, reused or invented in seconds. Merchants across Africa lose real money to this every single day, and the "proper" fix — a direct telco API — takes 6–18 months of negotiation per operator, per country, and small merchants get turned away.

KODA takes a different route. Every operator already sends a confirmation SMS to the merchant the instant they're paid. **That SMS is the API.** KODA reads the confirmation you already receive, matches the customer's transaction code against it, and gives you a fraud-checked verdict in about three seconds — across Orange Money, M-Pesa, Airtel, MTN MoMo, Wave and 200+ more, with no telco contract and nothing for your customer to install. You can verify by console, WhatsApp, API, USSD or inbound SMS — even on a feature phone with no internet.

One thing I care about being honest on: **KODA never touches your money.** It's a verification service, not a bank, wallet or escrow — funds go straight from customer to merchant on the operator's own network. KODA just tells you, fast and truthfully, whether the payment was real.

It's free to start (10 verifications/month, no card). I'd love your honest feedback — especially from anyone who's dealt with payment fraud or built commerce in emerging markets. What would you want it to do next?

— {Your name}, founder · kodajnn.com

---

## Gallery (upload in this order — files in brand/ph-gallery/)

1. **ph-1-hero.png** — "A screenshot can be faked. The SMS can't."
2. **ph-2-insight.png** — "That SMS is the API."
3. **ph-3-how.png** — How it works, 4 steps
4. **ph-4-doors.png** — One engine, five doors
5. **ph-5-trust.png** — What KODA is — and isn't (we never touch your money)
6. **ph-6-coverage.png** — 235 operators · 95 countries
7. **ph-7-cta.png** — Verify your first payment free

*(First image is the main thumbnail — the hero. 7 is plenty; you can trim to 5.)*

---

## Launch-day playbook

**Timing:** Product Hunt days start at **12:01 AM Pacific Time**. That's about **9:00 AM in Kinshasa (CAT)** — convenient. Launch **Tue–Thu** (Mon/Fri are weaker). Avoid US holidays.

**Before the day:**
- Complete your PH profile + the KODA profile (logo, all gallery images, description).
- Line up 15–30 people who'll genuinely engage (network, early users, communities). Ask them to **comment**, not just upvote.
- Draft 3–4 replies you can post fast (see below).

**On the day:**
- Post the maker's comment immediately at go-live.
- **Reply to every single comment within minutes** — engagement velocity is what PH ranks on.
- Share the PH link on LinkedIn (use the posts in `koda-distribution-linkedin.md`), WhatsApp/Telegram groups, and by DM to your list.
- Post progress updates in the thread through the day ("we just hit #X, thank you 🙏").

**Rules — don't get penalised:**
- **Never ask for upvotes** (PH bans it). Ask for **feedback** and **comments**.
- Don't buy votes or use vote rings.
- Disclose you're the maker (you already do in the comment).

**After:**
- Add the "Featured on Product Hunt" badge to kodajnn.com (a real backlink).
- The listing itself is a permanent high-authority backlink — worth the day on its own.
- Follow up with everyone who commented.

---

## Prepared answers to likely questions

- **"How is this different from a payment gateway (Stripe/Flutterwave)?"** — KODA doesn't move money at all. Gateways *process* payments; KODA *verifies* payments that already happened on the operator's network. No funds ever touch us.
- **"Do you have access to the telco/operator systems?"** — No, and that's the point. We read the confirmation SMS the merchant already receives, so there's no operator integration, contract or API to license.
- **"Which operators/countries?"** — 235 operators across 95 countries, with 6 hand-tuned "live" parsers today and the rest template-ready; full map at kodajnn.com/coverage. No operator API required for any of them.
- **"How does it actually stop fakes?"** — It verifies against the operator's own message (not the customer's screenshot), locks every code to single-use so receipts can't be recycled, and runs anti-forgery + fraud checks.
- **"Is it really free?"** — Yes: 10 verifications/month free forever, no card. Paid plans start at $5/mo for higher volume.
- **"iPhone / feature phone?"** — Merchants forward or paste the SMS, or use WhatsApp/USSD/inbound SMS — it works on any phone, including feature phones with no internet.
- **"What are the limits?"** — Honest: verification is fraud-scored and replay-protected, but it doesn't guarantee against an operator-side reversal or constitute proof of settlement. It makes you *first to know*, in seconds.

---

## FR note
For francophone reach, cross-post the launch to your DRC/African networks with the
FR LinkedIn posts in `koda-distribution-linkedin.md`, and point French visitors to
the FR blog + deck. PH itself is English-first, so keep the listing in English.
