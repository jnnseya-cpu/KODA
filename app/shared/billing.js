// KODA — Global Billing Mesh: collection rails, pricing law, and routing.
// System B (how KODA collects its OWN revenue) — never touches merchant customer money.
// Isomorphic (browser + node) like plans.js/costs.js.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KODA_BILLING = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ── PRICING LAW (binding) ────────────────────────────────────────────────
  // 1. ACU retail = 4× the underlying unit cost  → 300% markup, always ≥100% profit.
  // 2. The rail's collection fee is PASSED THROUGH to the merchant as a transparent
  //    line item — KODA never absorbs it, so margin holds on every rail.
  const ACU_MARKUP = 4;                 // ACU price = 4 × provider/unit cost
  const UNIT_COST_USD = 0.0065;         // fully-loaded code-path cost (mirrors costs.js COST.code)
  const ACU_PRICE_USD = round(ACU_MARKUP * UNIT_COST_USD); // ≈ 0.026 / ACU

  // ── COLLECTION RAILS (the "provider cost" that is passed through) ─────────
  // fee_pct is the rail's take; flow drives the merchant UX; live=false hides it.
  const RAILS = {
    paddle_mor:    { label: 'Card / global (Merchant of Record)', fee_pct: 0.050, flow: 'HOSTED_CHECKOUT',    recurring: true,  tax: 'MOR',  live: true,  rank: 2 },
    stripe:        { label: 'Card',                               fee_pct: 0.029, flow: 'HOSTED_CHECKOUT',    recurring: true,  tax: null,   live: true,  rank: 2 },
    paystack:      { label: 'Card / bank / MoMo (Paystack)',      fee_pct: 0.039, flow: 'HOSTED_CHECKOUT',    recurring: true,  tax: null,   live: false, rank: 2 },
    flutterwave:   { label: 'Card / mobile money (Flutterwave)',  fee_pct: 0.038, flow: 'HOSTED_CHECKOUT',    recurring: false, tax: null,   live: false, rank: 3 },
    dlocal:        { label: 'Mobile money / local',               fee_pct: 0.055, flow: 'MOBILE_MONEY_PUSH',  recurring: false, tax: 'MOR',  live: true,  rank: 3 },
    bitripay:      { label: 'BitriPay',                           fee_pct: 0.020, flow: 'MOBILE_MONEY_PUSH',  recurring: true,  tax: null,   live: false, rank: 4 },
    distributor:   { label: 'Pay an agent near you',              fee_pct: 0.150, flow: 'AGENT',             recurring: false, tax: null,   live: true,  rank: 5 },
    voucher:       { label: 'Redeem a voucher / PIN',             fee_pct: 0.120, flow: 'CODE_REDEMPTION',    recurring: false, tax: null,   live: true,  rank: 5 },
    bank_transfer: { label: 'Bank transfer (invoice)',            fee_pct: 0.010, flow: 'INVOICE',           recurring: false, tax: null,   live: true,  rank: 6 },
  };

  // Which rails to try, by market. Africa/emerging → MM aggregators + agent/voucher;
  // everywhere → card + invoice. This is the ranked routing table (§4 hierarchy).
  const CARD_RAILS = ['stripe', 'paddle_mor'];
  const MM_MARKETS = new Set(['CD', 'KE', 'TZ', 'UG', 'GH', 'CI', 'SN', 'BF', 'CM', 'RW', 'ZM', 'NG', 'BD', 'PK', 'PH', 'ID', 'ML', 'BJ', 'TG', 'CG', 'ZW', 'MW', 'MZ']);

  // ── PRICE QUOTE (the pricing law, executed) ──────────────────────────────
  // total = subtotal(4× cost) + collection_fee(rail %, passed through) [+ tax]
  function quote(acuAmount, railCode, opts = {}) {
    const rail = RAILS[railCode];
    if (!rail) throw new Error('unknown rail: ' + railCode);
    const acu = Math.max(0, Math.round(Number(acuAmount) || 0));
    const subtotal = round(acu * ACU_PRICE_USD);        // KODA's net — priced at 4× cost
    const collection_fee = round(subtotal * rail.fee_pct); // passed through, NOT absorbed
    const tax = round(Number(opts.tax_usd) || 0);        // MoR-calculated where applicable
    const total = round(subtotal + collection_fee + tax);
    return {
      acu, rail: railCode, currency: opts.currency || 'USD',
      unit_cost_usd: UNIT_COST_USD, acu_price_usd: ACU_PRICE_USD, acu_markup: ACU_MARKUP,
      subtotal_usd: subtotal,          // what KODA nets (≥100% margin)
      collection_fee_usd: collection_fee, collection_fee_pct: rail.fee_pct,
      tax_usd: tax, total_usd: total,  // what the merchant pays
      margin_pct: Math.round((subtotal / (acu * UNIT_COST_USD || 1) - 1) * 100),
      flow: rail.flow, recurring_supported: rail.recurring,
    };
  }

  // ── ROUTING (score, then hard-exclude) ───────────────────────────────────
  // Returns ranked live rails for a context. Lower `order` = try first.
  function routeProviders(ctx = {}) {
    const country = (ctx.country || '').toUpperCase();
    const amountAcu = Number(ctx.amount_acu) || 0;
    const recurring = !!ctx.recurring;
    const isMM = MM_MARKETS.has(country);
    const out = [];
    for (const [code, r] of Object.entries(RAILS)) {
      if (!r.live) continue;                                   // hard exclude: not live (BitriPay)
      if (recurring && !r.recurring && r.flow !== 'HOSTED_CHECKOUT') continue; // recurring needs a mandate rail
      if (r.flow === 'MOBILE_MONEY_PUSH' && !isMM) continue;   // MM rails only in MM markets
      // score: availability + recurring fit − cost (cheaper ranks earlier within tier)
      let score = 100 - r.rank * 10 - Math.round(r.fee_pct * 100);
      if (recurring && r.recurring) score += 8;
      out.push({ rail: code, label: r.label, flow: r.flow, fee_pct: r.fee_pct, recurring: r.recurring, score });
    }
    out.sort((a, b) => b.score - a.score);
    return out.map((x, i) => ({ ...x, order: i + 1 }));
  }

  function round(n) { return Math.round(n * 1e6) / 1e6; }

  return { ACU_MARKUP, UNIT_COST_USD, ACU_PRICE_USD, RAILS, quote, routeProviders, MM_MARKETS };
});
