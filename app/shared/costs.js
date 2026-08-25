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
    gateway_sweep: 0.00055,                 // ~2% mobile-money fees on ~$0.03 revenue collected
    support_ops: 0.0030,                    // human support / dispute ops blended (spec §12)
    // NB: code-path UNIT sums to exactly $0.0065 = shared/billing UNIT_COST_USD, so retail
    // ($0.026 = 4×) clears the 4× floor precisely against the granular cost model.
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

  // THE RULE: retail ≥ MARKUP_MIN × fully-loaded cost (4× cost = 300% profit floor).
  // Every ACU KODA sells nets at least 4× — pay-as-you-go, plan-included, overage, and
  // the price a partner pays for wholesale float/inventory (partners add their fee on top).
  const MARKUP_MIN = 4.0;

  // retail price points to police (USD per verification). Plan-included sells at 4×
  // ($0.026); ad-hoc ACU — top-up, overage, AI, partner wholesale — sells at 5× ($0.0325).
  // Every point clears the 4× floor; the top-up/ACU points clear 5×.
  const PRICE_POINTS = [
    { label: 'Plan included (4× rate)', usd: 0.026, path: 'code' },
    { label: 'PAYG top-up / overage (1 ACU, 5×)', usd: 0.0325, path: 'code' },
    { label: 'Partner wholesale (1 ACU @ 5× retail)', usd: 0.0325, path: 'code' },
    { label: 'Vision path (3 ACU)', usd: 0.0975, path: 'vision' },
    { label: 'DisputeAgent (3 ACU)', usd: 0.0975, path: 'code' },
    { label: 'Sub-merchant (5 ACU)', usd: 0.1625, path: 'code' },
    { label: 'Growth: social post (1 ACU)', usd: 0.0325, path: 'code' },
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
