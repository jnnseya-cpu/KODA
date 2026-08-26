// KODA — margin guard (npm run margin). Enforces the 4× floor: every ACU KODA sells
// (plan-included, top-up/overage/AI, and partner wholesale) nets ≥4× fully-loaded cost.
// One retail rate (5×) for every unit — ACU and plan-included alike; partner wholesale
// 80%/85% (KODA nets 4×/4.25×) so any unit is resellable. Exits 1 on violation.
'use strict';
const C = require('../../shared/costs');
const VOLUMES = [10000, 50000, 250000, 1000000]; // monthly verifications

console.log(`\nFully-loaded variable cost: code $${C.COST.code} · vision $${C.COST.vision}`);
console.log(`Fixed overhead: $${C.FIXED_TOTAL}/mo → amortized: ` + VOLUMES.map(v => `$${C.amortized(v).toFixed(4)}@${v / 1000}k`).join(' · '));
console.log(`Rule: retail ≥ ${C.MARKUP_MIN}× total cost (100% profit)\n`);

let fails = 0;
// RULE 1 — usage prices clear 2× VARIABLE cost (subscriptions carry the overhead)
console.log('Price point'.padEnd(30), 'Retail'.padEnd(9), 'Cost'.padEnd(9), 'Markup'.padEnd(8), 'Profit%', ' Verdict');
for (const p of C.PRICE_POINTS) {
  const cost = C.COST[p.path];
  const markup = p.usd / cost;
  const okay = markup + 1e-9 >= C.MARKUP_MIN; // epsilon: exact 4.0× must pass despite float
  if (!okay) fails++;
  console.log(p.label.padEnd(30), ('$' + p.usd.toFixed(3)).padEnd(9), ('$' + cost.toFixed(4)).padEnd(9),
    (markup.toFixed(2) + '×').padEnd(8), ((markup - 1) * 100).toFixed(0).padStart(6) + '%', okay ? '  ✓' : '  ✗ BELOW 100% PROFIT');
}
// RULE 2 — the whole P&L is ≥100% profit at the modest-scale scenario
const S = C.SCENARIO;
const PLANS = require('../../shared/plans').PLANS;
const subRev = Object.entries(S.subs).reduce((a, [k, n]) => a + n * PLANS[k].usd, 0);
const usageRev = S.verifications * S.blended_usage_usd;
const varCost = S.verifications * ((1 - S.vision_share) * C.COST.code + S.vision_share * C.COST.vision);
const totalRev = subRev + usageRev, totalCost = C.FIXED_TOTAL + varCost;
const profit = totalRev - totalCost, profitPct = profit / totalCost * 100;
console.log(`\nRULE 2 — scenario "${S.label}":`);
console.log(`  revenue  $${totalRev.toFixed(0)}/mo  (subs $${subRev} + usage $${usageRev.toFixed(0)})`);
console.log(`  cost     $${totalCost.toFixed(0)}/mo  (fixed $${C.FIXED_TOTAL} + variable $${varCost.toFixed(0)})`);
console.log(`  profit   $${profit.toFixed(0)}/mo  →  ${profitPct.toFixed(0)}% profit on total cost ${profitPct >= 100 ? '✓ (≥100%)' : '✗ BELOW 100%'}`);
if (profitPct < 100) fails++;
const BILL = require('../../shared/billing');
const be = Math.ceil(C.FIXED_TOTAL / (BILL.ACU_PRICE_USD - C.COST.code));
console.log(`  overhead break-even without any subscriptions: ~${be.toLocaleString()} verifications/mo`);

// RULE 3 — ad-hoc ACU (top-up packs + partner wholesale) sells at the 5× rate, and every
// point clears the 4× floor. Top-ups MUST be ≥5× (the full retail rate) so partner resale still nets 4×,
// pay-as-you-go always costs more than committing to a plan.
const PACKS = require('../../shared/plans').TOPUP_PACKS;
console.log(`\nRULE 3 — ad-hoc ACU rate ${(BILL.ACU_PRICE_USD / BILL.UNIT_COST_USD).toFixed(0)}× ($${BILL.ACU_PRICE_USD}/ACU) · floor 4× ($${BILL.PRICE_FLOOR_USD}):`);
for (const p of PACKS) {
  const perAcu = p.usd / p.acu, mult = perAcu / BILL.UNIT_COST_USD;
  const ok = mult + 1e-9 >= BILL.ACU_MARKUP; // top-ups must clear the full 5× ACU rate
  if (!ok) fails++;
  console.log(`  top-up $${p.usd} → ${p.acu} ACU = $${perAcu.toFixed(4)}/ACU  ${mult.toFixed(1)}×  ${ok ? '✓' : `✗ BELOW ${BILL.ACU_MARKUP}× TOP-UP RATE`}`);
}
const minBps = BILL.minWholesaleBps(), wholesaleMin = BILL.ACU_PRICE_USD * (minBps / 10000);
if (!BILL.clearsFloor(wholesaleMin)) fails++;
console.log(`  ACU retail $${BILL.ACU_PRICE_USD}/ACU = ${(BILL.ACU_PRICE_USD / BILL.UNIT_COST_USD).toFixed(1)}× (merchant/agent price)`);
for (const [who, bps] of [['distributor', 8500], ['reseller', 8000]]) {
  const cost = BILL.ACU_PRICE_USD * (bps / 10000), ok = BILL.clearsFloor(cost);
  if (!ok) fails++;
  const spread = ((BILL.ACU_PRICE_USD - cost) / BILL.ACU_PRICE_USD * 100).toFixed(0);
  console.log(`  ${who.padEnd(11)} wholesale ${bps / 100}% = $${cost.toFixed(4)} = ${(cost / BILL.UNIT_COST_USD).toFixed(2)}× → KODA nets ≥4×, partner keeps ${spread}% spread ${ok ? '✓' : '✗ BELOW 4× FLOOR'}`);
}

// RULE 4 — ONE-RATE model: every unit (ACU, plan-included, overage) is retail-priced at 5×.
// A CURRENT plan's included rate (usd/verifs) must be ≥ the 5× ACU retail rate, so that when a
// partner RESELLS the plan at 80% (reseller) / 85% (distributor) KODA still nets ≥4×. Legacy
// (grandfathered, never resold — resale always mints a current plan) plans only need the 4× floor.
console.log(`\nRULE 4 — CURRENT plan included rate ≥ 5× retail ($${BILL.ACU_PRICE_USD}) so partner resale still clears 4×:`);
const CURRENT = ['boutique', 'commerce', 'plateforme', 'scale'];
const LEGACY = ['boutique_legacy', 'commerce_legacy'];
for (const key of CURRENT) {
  const p = PLANS[key];
  const incl = p.usd / p.verifs, over = p.overage;
  const inclOk = incl + 1e-9 >= BILL.ACU_PRICE_USD;                 // ≥5× → resells at ≥4×
  const overOk = over != null && BILL.clearsFloor(over);
  if (!inclOk || !overOk) fails++;
  console.log(`  ${p.label.padEnd(11)} incl $${incl.toFixed(4)}/verif (${p.verifs}/mo) ${(incl / BILL.UNIT_COST_USD).toFixed(2)}× ${inclOk ? '✓' : '✗ below 5× — resale would breach 4×'}  ·  overage $${over.toFixed(4)} ${(over / BILL.UNIT_COST_USD).toFixed(1)}× ${overOk ? '✓' : '✗'}`);
}
for (const key of LEGACY) {
  const p = PLANS[key];
  const incl = p.usd / p.verifs, ok = BILL.clearsFloor(incl);       // direct-only: 4× floor is enough
  if (!ok) fails++;
  console.log(`  ${(p.label + ' (legacy)').padEnd(18)} incl $${incl.toFixed(4)}/verif ${(incl / BILL.UNIT_COST_USD).toFixed(2)}× — direct-only, ≥4× ${ok ? '✓' : '✗'}`);
}

// RULE 5 — a whole plan RESOLD through a partner nets KODA ≥4× at BOTH wholesale tiers, while
// the partner keeps their fixed spread (reseller 20% @ 80%, distributor 15% @ 85%).
console.log(`\nRULE 5 — partner plan resale nets KODA ≥4× (reseller 80% · distributor 85%):`);
for (const key of CURRENT) {
  const p = PLANS[key], incl = p.usd / p.verifs;
  for (const [who, bps, margin] of [['reseller', 8000, 20], ['distributor', 8500, 15]]) {
    const net = incl * (bps / 10000), mult = net / BILL.UNIT_COST_USD, ok = BILL.clearsFloor(net);
    if (!ok) fails++;
    console.log(`  ${p.label.padEnd(11)} via ${who.padEnd(11)} ${bps / 100}% → KODA nets $${net.toFixed(4)} = ${mult.toFixed(2)}× ${ok ? '✓' : '✗ BELOW 4×'} · partner keeps ${margin}%`);
  }
}

if (fails) { console.log(`\n${fails} price point(s) violate the rule — fix pricing or costs.`); process.exit(1); }
console.log('\nAll price points clear the rule: plans ≥4×, ad-hoc ACU ≥5× ✓');
