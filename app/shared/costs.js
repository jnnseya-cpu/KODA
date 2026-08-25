// KODA — fully-loaded cost model. One source of truth for the 100%-profit rule:
// every retail price must be ≥ 2× the fully-loaded cost (100% markup minimum).
// All unit costs are editable assumptions — re-run `npm run margin` after any change.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KODA_COSTS = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ── variable cost per verification (USD, blended, conservative) ──
  const UNIT = {
    // deterministic-first pipeline: only ~5% of code-path verifications ever
    // reach an external LLM (unknown formats, ambiguity) at ~$0.003/call
    ai_code_path: 0.05 * 0.003,            // 0.00015
    ai_vision_path: 0.015,                  // vision model per screenshot
    cloud_compute: 0.0005,                  // Cloud Run + DB + egress per verification
    firebase_push: 0.0000,                  // FCM is free
    whatsapp_msgs: 0.0020,                  // Meta conversation fees, digest-first policy
    email: 0.0002,                          // Brevo blended per verification
    sms_mandatory: 0.0001,                  // rare mandatory-notice SMS blended
    gateway_sweep: 0.0006,                  // ~2% mobile-money fees on ~$0.03 revenue collected
    support_ops: 0.0030,                    // human support / dispute ops blended (spec §12)
  };

  // fully-loaded variable cost per path
  const COST = {
    code: round(UNIT.ai_code_path + UNIT.cloud_compute + UNIT.whatsapp_msgs + UNIT.email + UNIT.sms_mandatory + UNIT.gateway_sweep + UNIT.support_ops),                    // ≈ 0.0065
    vision: round(UNIT.ai_vision_path + UNIT.cloud_compute + UNIT.whatsapp_msgs + UNIT.email + UNIT.sms_mandatory + UNIT.gateway_sweep + UNIT.support_ops),                 // ≈ 0.0214
  };

  // ── fixed monthly overhead (USD, pilot → growth scale) ──
  const FIXED_MONTHLY = {
    cloud_run_db_redis: 220,   // Cloud Run + Cloud SQL small + Memorystore
    firebase_blaze: 25,
    brevo_tier: 45,
    domain_cdn: 20,
    monitoring: 26,            // Sentry team
    accounting_legal_amortized: 400,
    devices_sims_airtime: 60,  // company Sentinel phones + SIMs
  };
  const FIXED_TOTAL = Object.values(FIXED_MONTHLY).reduce((a, b) => a + b, 0); // ≈ 796/mo

  // THE RULE: retail ≥ MARKUP_MIN × fully-loaded cost (100% profit floor)
  const MARKUP_MIN = 2.0;

  // retail price points to police (USD per verification)
  const PRICE_POINTS = [
    { label: 'PAYG $10 pack', usd: 0.033, path: 'code' },
    { label: 'PAYG $200 pack', usd: 0.025, path: 'code' },
    { label: 'Boutique overage', usd: 0.023, path: 'code' },
    { label: 'Commerce overage', usd: 0.019, path: 'code' },
    { label: 'Plateforme overage', usd: 0.016, path: 'code' },
    { label: 'Wholesale 25k+', usd: 0.018, path: 'code' },
    { label: 'Wholesale 100k+', usd: 0.014, path: 'code' },
    { label: 'Wholesale 500k+ (floor)', usd: 0.014, path: 'code' },   // raised from 0.010
    { label: 'Vision path (3 ACU @ $0.03)', usd: 0.090, path: 'vision' },
    { label: 'Growth: social post (1 ACU)', usd: 0.030, path: 'code' },
    { label: 'Growth: landing page (3 ACU)', usd: 0.090, path: 'vision' },
    { label: 'Growth: hashtags (0.5 ACU)', usd: 0.015, path: 'code' },
    { label: 'Wholesale absolute floor', usd: 0.014, path: 'code' },  // raised from ~0.007
  ];

  // Model structure: SUBSCRIPTIONS cover fixed overhead; USAGE prices clear
  // MARKUP_MIN × variable cost. The scenario check below proves the whole
  // P&L is ≥100% profit at modest scale.
  const SCENARIO = {
    label: 'Modest scale: 120 merchants',
    subs: { boutique: 60, commerce: 40, plateforme: 4 },   // monthly subscriptions
    verifications: 60000,                                  // code-path, blended $0.024
    blended_usage_usd: 0.024,
    vision_share: 0.06,                                    // 6% arrive via screenshot
  };

  function round(n) { return Math.round(n * 10000) / 10000; }
  function amortized(volumePerMonth) { return FIXED_TOTAL / Math.max(1, volumePerMonth); }
  function totalCost(path, volumePerMonth) { return round(COST[path] + amortized(volumePerMonth)); }

  return { UNIT, COST, FIXED_MONTHLY, FIXED_TOTAL, MARKUP_MIN, PRICE_POINTS, SCENARIO, totalCost, amortized };
});
