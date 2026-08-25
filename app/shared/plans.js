// KODA — shared commercial constants: one source of truth for backend,
// frontend, and the Sentinel app. UMD-style: Node require + browser global.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KODA_PLANS = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // the unified plan ladder (spec §10) — one ladder, all five doors.
  //
  // PRICING LAW (plan 4× · ad-hoc ACU 5× · hard 4× floor). A plan's INCLUDED quota is the
  // only place you get the 4× rate ($0.026/verif) — the committed, cheaper price. Every
  // ad-hoc ACU (pay-as-you-go top-up, plan OVERAGE, AI action) is 5× ($0.0325). So buying
  // ACU without a plan, or spilling past a plan's quota, always costs MORE than the plan
  // rate — there is no way to get 4× except inside a plan, and nothing is ever sold below
  // 4×. Included quota is sized at usd/$0.026 (rounded DOWN so the rate never dips below
  // the floor); plans win on quota + throughput (rps) + sub-merchants + support. CI asserts
  // plan rates ≥ 4× and top-up/ACU ≥ 5× in tools/margin.js (RULES 3-4).
  // Included quota is priced at the PLAN rate (4× = $0.026/verif); overage falls back to
  // the ad-hoc ACU rate (5× = $0.0325 = 1 ACU), so exceeding quota costs more than a
  // right-sized plan — differentiate on quota + throughput + features, never a rate
  // below 4×. Marché is the free acquisition tier (10 on us).
  const PLANS = {
    marche:     { label: 'Marché',     usd: 0,    verifs: 10,    overage: null,   rps: 2 },
    boutique:   { label: 'Boutique',   usd: 19,   verifs: 700,   overage: 0.0325, rps: 10 },
    commerce:   { label: 'Commerce',   usd: 79,   verifs: 3000,  overage: 0.0325, rps: 25 },
    plateforme: { label: 'Plateforme', usd: 399,  verifs: 15000, overage: 0.0325, rps: 100 },
    enterprise: { label: 'Enterprise', usd: null, verifs: null,  overage: null,   rps: 1000 },
  };

  // ACU metering (spec §9) — the billable atom is a successful verification. ACU is
  // priced at 5× cost ($0.0325), so at 3 ACU the pricier vision path ($0.0214 cost) still
  // nets ≥4× ($0.0975 = 4.6×) — the 4× floor binds AI actions on their own path cost.
  const ACU = { code: 1, vision: 3, dispute: 3, trust: 0.5, submerchant: 5 };

  // prepaid top-up packs (spec §11) — paid via mobile money, verified by the engine itself.
  // Pay-as-you-go ACU is priced at 5× cost ($0.0325/ACU) — deliberately ABOVE the 4× plan
  // rate so ad-hoc top-ups always cost more than committing to a plan. Every pack clears
  // the 4× floor with room to spare (see shared/billing; CI asserts ≥5× in tools/margin.js).
  const TOPUP_PACKS = [
    { usd: 33, acu: 1000 }, { usd: 165, acu: 5000 }, { usd: 650, acu: 20000 },
  ];

  return { PLANS, ACU, TOPUP_PACKS };
});
