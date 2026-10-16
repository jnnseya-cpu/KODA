// KODA — shared commercial constants: one source of truth for backend,
// frontend, and the Sentinel app. UMD-style: Node require + browser global.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KODA_PLANS = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // the unified plan ladder (spec §10) — one ladder, all five doors.
  //
  // PRICING LAW (two-book · hard 4× floor · VOLUME DISCOUNT). The per-verification price
  // FALLS as the plan grows: Boutique $0.0588 → Commerce $0.0556 → Plateforme $0.0526 → Scale
  // $0.05 (the floor / best rate). Monthly prices are round ($5/$20/$100/$400); the discount
  // comes from the verification quota. Each paid plan carries TWO prices:
  //   · usd  = DIRECT price a merchant pays KODA = verifs × that tier's per-verif rate. Every
  //            tier beats pay-as-you-go ($0.0625), so a plan always saves. Headline price.
  //   · list_usd = the price a PARTNER (reseller/distributor) charges a merchant = usd / 0.80.
  //            A partner buys the plan's inventory at 80% of list (= the direct price), resells
  //            at list, and keeps 20% (reseller) / 15% (distributor); KODA still nets far above
  //            the 4× floor (it always receives ~80% of list). Cash-agent buyers pay list.
  // Ad-hoc ACU / top-ups sit at $0.0625 (above every plan); a plan's overage is its OWN tier
  // rate (so the card reconciles: verifs × rate = usd). CI asserts: each plan rate ≥4× floor
  // AND < the ACU rate (RULE 4); partner resale of list nets ≥4× (RULE 5); top-ups ≥ ACU (RULE 3).
  // Each verif = its tier's rate. Marché is the free acquisition tier (10 on us, Door 1 only).
  // Prices: Boutique $5/85 ($0.0588) · Commerce $20/360 ($0.0556) · Plateforme $100/1900 ($0.0526)
  //  · Scale $400/8000 ($0.05). agent list = usd/0.8. Platform capabilities
  // (sub-merchant API, trust-score, re-billing, distributor access) live at SCALE ($400);
  // Plateforme ($100) is a throughput/scale tier only.
  //
  // *_legacy entries are NOT shown on the pricing ladder and are never resold (partner
  // resale always mints a CURRENT-ladder plan). They preserve the OLD economics for merchants
  // already subscribed when the new ladder shipped (grandfathering — v5 migration in db.js),
  // so a live subscriber's bucket never shrinks. Old Plateforme (399/15000, platform) maps to
  // the new SCALE tier, so it needs no legacy row.
  const PLANS = {
    marche:     { label: 'Marché',     usd: 0,    list_usd: 0,   verifs: 10,    overage: null,   rps: 2 },
    boutique:   { label: 'Boutique',   usd: 5,    list_usd: 6.25,  verifs: 85,    overage: 0.058824, rps: 10 },
    commerce:   { label: 'Commerce',   usd: 20,   list_usd: 25,    verifs: 360,   overage: 0.055556, rps: 25 },
    plateforme: { label: 'Plateforme', usd: 100,  list_usd: 125,   verifs: 1900,  overage: 0.052632, rps: 100 },
    scale:      { label: 'Scale',      usd: 400,  list_usd: 500,   verifs: 8000,  overage: 0.05,     rps: 250 },
    enterprise: { label: 'Enterprise', usd: null, list_usd: null,  verifs: null,  overage: null,   rps: 1000 },
    // grandfathered (hidden, direct-only — never resold): keep original price + bucket
    boutique_legacy: { label: 'Boutique',  usd: 19, list_usd: 19, verifs: 700,  overage: 0.0325, rps: 10, legacy: true },
    commerce_legacy: { label: 'Commerce',  usd: 79, list_usd: 79, verifs: 3000, overage: 0.0325, rps: 25, legacy: true },
  };

  // ACU metering (spec §9) — the billable atom is a successful verification. ACU is
  // priced at $0.0625, so at 3 ACU the pricier vision path ($0.0214 cost) nets
  // $0.1875 ≈ 8.8× — comfortably above the 4× floor that binds AI actions on path cost.
  const ACU = { code: 1, vision: 3, dispute: 3, trust: 0.5, submerchant: 5 };

  // prepaid top-up packs (spec §11) — paid via mobile money, verified by the engine itself.
  // Pay-as-you-go ACU is priced at $0.0625/ACU — ABOVE a plan's $0.05 direct rate, so
  // committing to a plan (paid direct) always saves ~20%. Every pack clears the ACU rate
  // (CI asserts in tools/margin.js RULE 3), matching the partner LIST rate.
  const TOPUP_PACKS = [
    { usd: 62.5, acu: 1000 }, { usd: 312.5, acu: 5000 }, { usd: 1250, acu: 20000 },
  ];

  return { PLANS, ACU, TOPUP_PACKS };
});
