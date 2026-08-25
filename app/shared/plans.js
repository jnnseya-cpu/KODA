// KODA — shared commercial constants: one source of truth for backend,
// frontend, and the Sentinel app. UMD-style: Node require + browser global.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KODA_PLANS = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // the unified plan ladder (spec §10) — one ladder, all five doors.
  //
  // PRICING LAW (subscription ≻ pay-as-you-go). Raw ACU top-up is the pay-as-you-go (PAYG)
  // escape hatch at $0.026/verif. To stop merchants dodging subscriptions by living on free
  // Marché + ACU top-ups (a revenue-cannibalisation inversion), every paid tier is priced
  // so that BOTH its included rate (usd/verifs) AND its overage are strictly CHEAPER than
  // PAYG, get cheaper up the ladder, and never drop below the $0.013/ACU margin floor.
  // (CI asserts all of this in tools/margin.js.) Overage is billed in ACU at the tier's
  // rate (engine.overageAcu), so a higher plan literally spends fewer ACU per overage verif.
  const PLANS = {
    marche:     { label: 'Marché',     usd: 0,    verifs: 10,    overage: null,  rps: 2 },
    boutique:   { label: 'Boutique',   usd: 19,   verifs: 800,   overage: 0.023, rps: 10 },
    commerce:   { label: 'Commerce',   usd: 79,   verifs: 3800,  overage: 0.019, rps: 25 },
    plateforme: { label: 'Plateforme', usd: 399,  verifs: 22000, overage: 0.016, rps: 100 },
    enterprise: { label: 'Enterprise', usd: null, verifs: null,  overage: null,  rps: 1000 },
  };

  // ACU metering (spec §9) — the billable atom is a successful verification
  const ACU = { code: 1, vision: 3, dispute: 3, trust: 0.5, submerchant: 5 };

  // prepaid top-up packs (spec §11) — paid via mobile money, verified by the engine itself.
  // Rate: $1 = 100 ACU (1 ACU = $0.01).
  // Priced at the ACU pricing law ($0.026/ACU = 300% margin) — every pack clears the
  // enforced 100%-margin floor (see shared/billing PRICE_FLOOR_USD; CI asserts it).
  const TOPUP_PACKS = [
    { usd: 26, acu: 1000 }, { usd: 130, acu: 5000 }, { usd: 520, acu: 20000 },
  ];

  return { PLANS, ACU, TOPUP_PACKS };
});
