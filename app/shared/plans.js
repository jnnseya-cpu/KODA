// KODA — shared commercial constants: one source of truth for backend,
// frontend, and the Sentinel app. UMD-style: Node require + browser global.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KODA_PLANS = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // the unified plan ladder (spec §10) — one ladder, all five doors.
  //
  // PRICING LAW (4× floor on EVERY verification). Every verification costs the same $0.026
  // (4× cost) whether bought pay-as-you-go (PAYG) or included in a plan — no ACU is ever
  // sold below 4×. Each plan's included quota is therefore sized at usd/$0.026 (rounded
  // DOWN so the effective rate never dips below the floor), and overage is the same flat
  // $0.026. Plans do NOT win on a cheaper rate; they win on QUOTA (one predictable monthly
  // bill), THROUGHPUT (rps), sub-merchants, and support. This removes any rate arbitrage
  // between PAYG and subscriptions (identical unit price either way). CI asserts every
  // included + overage rate is ≥ 4× in tools/margin.js (RULE 4).
  const PLANS = {
    marche:     { label: 'Marché',     usd: 0,    verifs: 10,    overage: null,  rps: 2 },
    boutique:   { label: 'Boutique',   usd: 19,   verifs: 700,   overage: 0.026, rps: 10 },
    commerce:   { label: 'Commerce',   usd: 79,   verifs: 3000,  overage: 0.026, rps: 25 },
    plateforme: { label: 'Plateforme', usd: 399,  verifs: 15000, overage: 0.026, rps: 100 },
    enterprise: { label: 'Enterprise', usd: null, verifs: null,  overage: null,  rps: 1000 },
  };

  // ACU metering (spec §9) — the billable atom is a successful verification.
  // vision = 4 ACU so the pricier vision path ($0.0214 cost) still nets ≥4× ($0.104):
  // the 4× floor binds AI actions on their own path cost, not just the code path.
  const ACU = { code: 1, vision: 4, dispute: 3, trust: 0.5, submerchant: 5 };

  // prepaid top-up packs (spec §11) — paid via mobile money, verified by the engine itself.
  // Rate: $1 = 100 ACU (1 ACU = $0.01).
  // Priced at the ACU pricing law ($0.026/ACU = 300% margin) — every pack clears the
  // enforced 100%-margin floor (see shared/billing PRICE_FLOOR_USD; CI asserts it).
  const TOPUP_PACKS = [
    { usd: 26, acu: 1000 }, { usd: 130, acu: 5000 }, { usd: 520, acu: 20000 },
  ];

  return { PLANS, ACU, TOPUP_PACKS };
});
