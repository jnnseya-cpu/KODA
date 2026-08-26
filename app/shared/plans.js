// KODA — shared commercial constants: one source of truth for backend,
// frontend, and the Sentinel app. UMD-style: Node require + browser global.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KODA_PLANS = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // the unified plan ladder (spec §10) — one ladder, all five doors.
  //
  // PRICING LAW (two-book · hard 4× floor). Each paid plan carries TWO prices:
  //   · usd  = DIRECT price a merchant pays KODA — the 4× rate ($0.026/verif), so a plan
  //            genuinely BEATS pay-as-you-go (5×). This is the headline price. KODA nets 4×.
  //   · list_usd = the price a PARTNER (reseller/distributor) charges a merchant — the 5×
  //            rate, = usd / 0.80. A partner buys the plan's inventory at 80% of list (= the
  //            direct price), resells at list, and keeps 20% (reseller) / 15% (distributor);
  //            KODA still nets ≥4× (it always receives ~80% of list). The merchant who buys
  //            through a cash agent pays list — the agent's convenience premium.
  // Ad-hoc ACU / top-ups / overage stay at 5× ($0.0325). CI asserts: direct plan rate ≥4× AND
  // < the 5× ACU rate (RULE 4); partner resale of list nets ≥4× (RULE 5); ACU ≥5× (RULE 3).
  // verifs = usd/$0.026 (rounded down). Marché is the free acquisition tier (10 on us).
  // ONE-RATE MODEL (partner-resellable, 4× floor everywhere). Every unit — a pay-as-you-go
  // ACU, a plan-included verification, and an overage verification — carries the SAME retail
  // rate: 5× cost = $0.0325/verif. Partners buy at a fixed wholesale: reseller 80% ($0.026 =
  // the 4× floor, keeps 20%), distributor 85% ($0.02762 = 4.25×, keeps 15%). Because the
  // retail rate is 5×, reselling ANY unit — ACU or a whole plan — still nets KODA ≥4×. This
  // is why plans are priced at the 5× rate (verifs = usd/$0.0325, rounded down): a 4×-priced
  // plan would net KODA below 4× once a partner takes their cut. A plan's value is its
  // committed monthly quota + features + throughput + agent-resale reach — not a unit
  // discount. Prices: Boutique $5/150 · Commerce $20/600 · Plateforme $100/3000 · Scale
  // $399/12000 (all $0.033/verif ≈ 5.1×; resold at 80% = 4.1×, at 85% = 4.36×). Platform
  // capabilities (sub-merchant API, trust-score, re-billing, distributor access) live at
  // SCALE ($399); Plateforme ($100) is a throughput/scale tier only.
  //
  // *_legacy entries are NOT shown on the pricing ladder and are never resold (partner
  // resale always mints a CURRENT-ladder plan). They preserve the OLD economics for merchants
  // already subscribed when the new ladder shipped (grandfathering — v5 migration in db.js),
  // so a live subscriber's bucket never shrinks. Old Plateforme (399/15000, platform) maps to
  // the new SCALE tier, so it needs no legacy row.
  const PLANS = {
    marche:     { label: 'Marché',     usd: 0,    list_usd: 0,   verifs: 10,    overage: null,   rps: 2 },
    boutique:   { label: 'Boutique',   usd: 5,    list_usd: 6.25,  verifs: 190,   overage: 0.0325, rps: 10 },
    commerce:   { label: 'Commerce',   usd: 20,   list_usd: 25,    verifs: 760,   overage: 0.0325, rps: 25 },
    plateforme: { label: 'Plateforme', usd: 100,  list_usd: 125,   verifs: 3800,  overage: 0.0325, rps: 100 },
    scale:      { label: 'Scale',      usd: 399,  list_usd: 499,   verifs: 15200, overage: 0.0325, rps: 250 },
    enterprise: { label: 'Enterprise', usd: null, list_usd: null,  verifs: null,  overage: null,   rps: 1000 },
    // grandfathered (hidden, direct-only — never resold): keep original price + bucket
    boutique_legacy: { label: 'Boutique',  usd: 19, list_usd: 19, verifs: 700,  overage: 0.0325, rps: 10, legacy: true },
    commerce_legacy: { label: 'Commerce',  usd: 79, list_usd: 79, verifs: 3000, overage: 0.0325, rps: 25, legacy: true },
  };

  // ACU metering (spec §9) — the billable atom is a successful verification. ACU is
  // priced at 5× cost ($0.0325), so at 3 ACU the pricier vision path ($0.0214 cost) still
  // nets ≥4× ($0.0975 = 4.6×) — the 4× floor binds AI actions on their own path cost.
  const ACU = { code: 1, vision: 3, dispute: 3, trust: 0.5, submerchant: 5 };

  // prepaid top-up packs (spec §11) — paid via mobile money, verified by the engine itself.
  // Pay-as-you-go ACU is priced at 5× cost ($0.0325/ACU) — the same retail rate as a plan's
  // included verification. Every pack clears the 5× retail rate (CI asserts ≥5× in
  // tools/margin.js RULE 3), so partner resale at 80%/85% still nets KODA ≥4×.
  const TOPUP_PACKS = [
    { usd: 33, acu: 1000 }, { usd: 165, acu: 5000 }, { usd: 650, acu: 20000 },
  ];

  return { PLANS, ACU, TOPUP_PACKS };
});
