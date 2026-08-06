# KODA — Telco (MNO) Go-to-Market Playbook (DRC)

Purpose: approach the mobile-money operators in Kinshasa (Orange RDC / Orange Money,
Vodacom Congo / M-Pesa, Airtel RDC / Airtel Money, Africell / Afrimoney) as a
**partner that grows their transaction volume for free** — not a competitor.

KODA already has **precise parsers for all four** DRC operators, so we can support
whichever partners first, immediately.

---

## 1. The positioning (memorise this)

- **We are a payment *verification* service — not a bank, wallet, processor,
  aggregator, escrow, or money transmitter.** We never hold, move, or settle funds.
  Money travels directly customer → merchant on the operator's own rails. We only
  *confirm* a payment happened, using the operator's own confirmation SMS.
- Therefore we are **not a competitor** to their mobile money and **not a PSP** to
  the regulator (BCC / ARPTC). We are a *merchant trust layer* on top of their
  network — like a receipt printer, not a rival till.
- **The barrier we remove:** merchant distrust ("did I really get paid?", fake SMS,
  fake screenshots) — the reason cautious merchants stay on cash. Remove it → more
  merchants accept *their* mobile money → more SIMs, more transactions, more float.

## 2. What the telco gets (their benefits — lead with these)

**Growth**
- More merchants accept mobile money *with confidence* → more merchant SIMs opened.
- Higher transaction frequency & value per merchant (verified merchants transact more).
- Merchant acquisition & activation at **near-zero cost** to the operator — we bring
  and activate them; **we ask for no commission**.
- Stickiness: a merchant who verifies with KODA stays on that operator's rails.

**Risk & reputation**
- Fewer fraud incidents and disputes at the point of sale → lower support burden.
- Our fraud engine flags SMS-spoofing / replay patterns → intelligence they can use.
- Advances the national cash-digitisation narrative (regulator-friendly).

**Brand & data**
- Every KODA customer receipt carries the operator's payment as the proof → free
  brand impressions at every till.
- Aggregate, anonymised merchant-adoption & volume insights (with consent).
- Cross-sell surface: KODA can steer verified merchants toward the operator's other
  products (loans, savings, insurance, airtime).

## 3. What KODA asks for (the full list — tiered)

### Tier 1 — ask now (low cost, high goodwill)
1. **0% / waived merchant fees on KODA's own collection SIM(s).** Symbolic, aligns
   incentives — we generate volume for them, so our collection number rides free.
2. **A letter of non-objection / letter of interest** recognising KODA as a
   complementary *verification* tool (not a PSP). Useful for trust, and for the
   Google Play SMS-permission review.
3. **Stable, documented confirmation-SMS format + sender-ID whitelisting** so our
   parser stays precise and their SMS are never filtered/blocked.

### Tier 2 — the real prize (distribution & marketing)
4. **Promote KODA to their merchant base** — SMS campaigns, in-app, merchant
   onboarding kits: "accept mobile money with confidence, verified by KODA."
5. **Access to their agent / distributor network** to distribute the Sentinel app,
   sell prepaid ACU vouchers, and recruit merchants.
6. **Feature KODA in the operator's merchant-onboarding flow** (the upsell moment).
7. **Co-branded marketing** materials and joint presence at merchant fairs/events.

### Tier 3 — deeper (technical, future)
8. **A payment-notification API / webhook** so verification doesn't depend on SMS
   alone — enables auto-reconciliation and higher reliability.
9. **A USSD shortcode + SMS long-code** so feature-phone merchants can verify
   (KODA Doors 4 & 5) — also drives more billable USSD/SMS events for the operator.
10. **Preferential / zero merchant tariff** for a "KODA-verified merchant" category.
11. **Bulk SMS/comms rates** for KODA's merchant notifications.
12. **Subsidised pilot SIMs** for the first cohort of merchants.
13. **Aggregate data / insight exchange**; sandbox access to their MoMo APIs.
14. **Regulatory introductions** (BCC / ARPTC) confirming KODA's non-PSP status.
15. **A named technical + partnership contact** and priority support channel.

## 4. Which operator first & tone
- All four are already precisely supported. Approach the **market leader for scale**
  and the **most innovation-friendly** in parallel; tailor the operator name.
- Tone: humble, volume-for-free, "we're Congolese, building for Congo." Ask for a
  30-minute call + live demo, not a signature.

## 5. Follow-up
- If no reply in 5 business days: short nudge + a 60-second demo video link.
- Bring to the meeting: live demo (a real verified payment), the disclaimer one-pager,
  the coverage page (kodajnn.com/coverage), and a one-page pilot proposal.

---

## 6. THE EMAIL — French (ready to send)

> **Objet : Partenariat — plus de commerçants et plus de volume sur [Opérateur] Money, sans coût ni commission**
>
> À l'attention de la Direction Mobile Money & Partenariats,
>
> Je me permets de vous écrire au sujet d'une opportunité qui augmente directement le
> volume de transactions sur [Opérateur] Money — sans aucun coût ni commission de notre part.
>
> **Qui nous sommes.** KODA (Groupe Nseya Digital / JNN Global Ltd) est une solution
> **congolaise** de *vérification* de paiements mobile money. Notre principe : « le SMS
> est l'API ». KODA lit le SMS de confirmation que [Opérateur] Money envoie **déjà** au
> commerçant et confirme le paiement de façon déterministe en ~3 secondes — avec
> détection de fraude, protection anti-rejeu et un reçu clair pour le client.
>
> **Le problème que nous levons.** La première barrière à l'adoption du mobile money par
> les commerçants n'est pas la technologie — c'est la **confiance** : « ai-je vraiment reçu
> le paiement ? ». Les faux SMS et les captures d'écran truquées poussent de nombreux
> commerçants à refuser le mobile money et à rester au cash. Cela freine directement votre
> volume. KODA supprime cette peur — et donc débloque les commerçants que vous laissez au cash.
>
> **Ce que KODA n'est PAS (essentiel).** KODA est un service de **vérification** — **pas**
> une banque, **pas** un portefeuille, **pas** un processeur, **pas** un agrégateur, **pas**
> un service de transfert d'argent. **KODA ne détient, ne déplace et ne règle jamais les
> fonds.** L'argent circule **directement du client au commerçant, sur votre réseau
> [Opérateur] Money.** Nous ne sommes pas un concurrent : nous rendons vos rails plus
> fiables au comptoir.
>
> **Ce que vous y gagnez (sans nous verser de commission) :**
> • Plus de commerçants acceptent [Opérateur] Money **en confiance** → plus de SIM
>   marchandes ouvertes → plus de transactions, de cash-in/cash-out et de float pour vous.
> • Moins de fraude et de litiges au point de vente → meilleure réputation, moins de support.
> • Fidélisation : un commerçant qui vérifie avec KODA reste sur votre réseau.
> • Chaque reçu client porte votre paiement comme preuve → visibilité de votre marque à chaque vente.
>
> **Notre demande, simple pour commencer :**
> 1. **0 % de frais** sur la ou les **SIM marchandes de collecte de KODA** — un geste
>    symbolique qui aligne nos intérêts, puisque nous générons du volume pour vous.
> 2. **Votre soutien marketing** : présenter KODA à votre base de commerçants
>    (« acceptez le mobile money en toute confiance ») — c'est là que la valeur est la
>    plus grande pour nous deux.
> 3. Une **lettre de non-objection / d'intérêt** reconnaissant KODA comme outil
>    complémentaire de vérification.
>
> Nous supportons **déjà** précisément Orange Money, M-Pesa (Vodacom), Airtel Money et
> Afrimoney en RDC, et nous lançons un **pilote à Kinshasa** — que nous aimerions mener
> **avec vous**.
>
> Pourrions-nous échanger **30 minutes** cette semaine ? Je vous ferai une démonstration
> d'un paiement réel vérifié en direct.
>
> Avec mes salutations distinguées,
> **[Votre nom]** — Fondateur, KODA
> [téléphone] · koda@kodajnn.com · kodajnn.com

---

## 7. THE EMAIL — English (alternate)

> **Subject: Partnership — more merchants and more volume on [Operator] Money, at no cost or commission**
>
> To the Mobile Money & Partnerships team,
>
> I'm writing about an opportunity that directly grows transaction volume on [Operator]
> Money — at no cost and no commission to us.
>
> **Who we are.** KODA (Groupe Nseya Digital / JNN Global Ltd) is a **Congolese** payment
> *verification* service. Our principle: "the SMS is the API." KODA reads the confirmation
> SMS [Operator] Money **already** sends the merchant and confirms the payment
> deterministically in ~3 seconds — with fraud scoring, replay protection, and a clean
> customer receipt.
>
> **The barrier we remove.** The biggest barrier to merchant adoption isn't technology —
> it's **trust**: "did I really get paid?" Fake SMS and edited screenshots keep cautious
> merchants on cash, which throttles your volume. KODA removes that fear — unlocking the
> merchants you're leaving on cash.
>
> **What KODA is NOT (important).** KODA is a **verification** service — **not** a bank,
> wallet, processor, aggregator, or money transmitter. **We never hold, move, or settle
> funds.** Money flows **directly customer → merchant on your [Operator] Money network.**
> We are not a competitor — we make your rails trustworthy at the counter.
>
> **What you gain (with no commission to us):** more merchants accepting with confidence →
> more merchant SIMs, transactions, cash-in/out and float; less fraud and fewer disputes;
> merchant stickiness; and your brand on every KODA receipt.
>
> **Our ask, simple to start:** (1) **0% fees on KODA's own collection SIM(s)** — symbolic,
> since we drive volume to you; (2) **your marketing support** to introduce KODA to your
> merchant base; (3) a **letter of non-objection / interest** recognising KODA as a
> complementary verification tool.
>
> We already precisely support Orange Money, M-Pesa (Vodacom), Airtel Money and Afrimoney
> in DRC, and we're launching a **Kinshasa pilot** we'd love to run **with you**.
>
> Could we speak for **30 minutes** this week? I'll demo a real verified payment live.
>
> Best regards,
> **[Your name]** — Founder, KODA
> [phone] · koda@kodajnn.com · kodajnn.com
