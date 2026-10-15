// KODA — Global Billing Mesh: collection rails, pricing law, and routing.
// System B (how KODA collects its OWN revenue) — never touches merchant customer money.
// Isomorphic (browser + node) like plans.js/costs.js.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KODA_BILLING = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ── PRICING LAW (binding) — balanced so EVERYONE wins ─────────────────────
  // TWO-BOOK pricing over one hard floor. KODA nets ≥4× on every sale, direct or resold.
  //  · DIRECT (merchant → KODA) = $0.05/verif. A merchant paying KODA directly (card, or
  //    mobile money to KODA's own number via Door 3) gets the plan at $0.05 — cheaper than
  //    pay-as-you-go ACU ($0.0625). This is the headline plan price.
  //  · LIST (merchant → agent) = $0.0625/verif = direct / 0.80. A partner buys the plan's
  //    inventory at 80% of list (= the direct price), resells at list, and keeps 20% (reseller)
  //    / 15% (distributor). KODA still nets far above the 4× floor — it receives ~80% of list.
  //    A merchant who buys through a cash agent pays list: the agent's convenience premium.
  //  · AD-HOC ACU / top-ups / overage / AI = $0.0625. Same as the partner list rate.
  // So a direct plan is the cheapest way to verify; pay-as-you-go and the agent channel both
  // sit at 5×; and nothing — direct or resold — ever nets KODA below the 4× floor.
  // The rail's collection fee is PASSED THROUGH to the merchant, so KODA's net never dips.
  const UNIT_COST_USD = 0.0065;         // fully-loaded code-path cost (mirrors costs.js COST.code)
  // Retail is anchored on Boutique = $0.05/verif (DIRECT). PAYG / overage / partner LIST sit
  // above at $0.0625 (= direct / 0.80), so a plan still beats pay-as-you-go by 20%. The real
  // cost is unchanged, so margins are now ~7.7× (direct) and ~9.6× (ACU) — far above the
  // enforced 4× floor, which stays the absolute minimum any resold unit may net.
  const PLAN_PRICE_USD = 0.05;          // DIRECT plan rate ($/verif) — the headline price
  const ACU_PRICE_USD  = 0.0625;        // ACU / top-up / overage / partner LIST (= direct / 0.80)
  const PLAN_MARKUP = PLAN_PRICE_USD / UNIT_COST_USD;  // ≈ 7.69× (display)
  const ACU_MARKUP  = ACU_PRICE_USD / UNIT_COST_USD;   // ≈ 9.62× (display; top-ups must clear this)

  // ── 4× MARGIN FLOOR (ENFORCED) ───────────────────────────────────────────
  // No unit may ever NET KODA below 4× cost (300% profit) — the hard floor. Direct plans now
  // sit well above it (~7.7× at $0.05); ad-hoc ACU and the partner LIST price sit higher still
  // (~9.6× at $0.0625). A partner buys at 80% of list (= the $0.05 direct price = ~7.7×), so
  // KODA nets far above the 4× floor on any resold plan.
  const MARGIN_FLOOR = 3.0;                                  // 300% profit = 4× cost
  const PRICE_FLOOR_USD = round(UNIT_COST_USD * (1 + MARGIN_FLOOR)); // $0.026 = the 4× floor (direct ~7.7×, ACU ~9.6×)
  const clearsFloor = (usdPerAcu) => Number(usdPerAcu) + 1e-9 >= PRICE_FLOOR_USD;
  // Distributors default to 8500 (partner margin 15%), resellers to 8000 (partner margin 20%).
  // At the $0.0625 list rate, 80% = $0.05 (~7.7×) and 85% = $0.0531 (~8.2×) — both far above the
  // 4× floor, so the defaults give KODA ample headroom. An admin may set any rate in [8000, 10000];
  // the computed minimum that still clears the 4× floor is far lower, but 8000 remains the policy floor.
  const minWholesaleBps = () => Math.ceil((PRICE_FLOOR_USD / ACU_PRICE_USD) * 10000);
  // throws if a $/ACU price breaks the rule — call at any point ACU is priced for sale.
  function assertFloor(usdPerAcu, label) {
    if (!clearsFloor(usdPerAcu))
      throw new Error(`4x_margin_rule: ${label || 'price'} = $${Number(usdPerAcu).toFixed(4)}/ACU is below the $${PRICE_FLOOR_USD}/ACU floor (4× the $${UNIT_COST_USD} cost)`);
    return true;
  }

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

  return { ACU_MARKUP, PLAN_MARKUP, UNIT_COST_USD, ACU_PRICE_USD, PLAN_PRICE_USD, RAILS, quote, routeProviders, MM_MARKETS,
    MARGIN_FLOOR, PRICE_FLOOR_USD, clearsFloor, minWholesaleBps, assertFloor };
});
