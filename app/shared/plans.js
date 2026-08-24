// KODA — shared commercial constants: one source of truth for backend,
// frontend, and the Sentinel app. UMD-style: Node require + browser global.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KODA_PLANS = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // the unified plan ladder (spec §10) — one ladder, all five doors
  const PLANS = {
    marche:     { label: 'Marché',     usd: 0,    verifs: 10,    overage: null,  rps: 2 },
    boutique:   { label: 'Boutique',   usd: 19,   verifs: 300,   overage: 0.035, rps: 10 },
    commerce:   { label: 'Commerce',   usd: 79,   verifs: 1750,  overage: 0.028, rps: 25 },
    plateforme: { label: 'Plateforme', usd: 399,  verifs: 12500, overage: 0.020, rps: 100 },
    enterprise: { label: 'Enterprise', usd: null, verifs: null,  overage: null,  rps: 1000 },
  };

  // ACU metering (spec §9) — the billable atom is a successful verification
  const ACU = { code: 1, vision: 3, dispute: 3, trust: 0.5, submerchant: 5 };

  // prepaid top-up packs (spec §11) — paid via mobile money, verified by the engine itself.
  // Rate: $1 = 100 ACU (1 ACU = $0.01).
  const TOPUP_PACKS = [
    { usd: 10, acu: 1000 }, { usd: 50, acu: 5000 }, { usd: 200, acu: 20000 },
  ];

  return { PLANS, ACU, TOPUP_PACKS };
});
