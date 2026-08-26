// KODA — margin guard (npm run margin). Enforces the 4× floor: every ACU KODA sells
// (plan-included, top-up/overage/AI, and partner wholesale) nets ≥4× fully-loaded cost.
// Two-book: DIRECT plan = 4× (beats PAYG), LIST = 5× (partner resale, agent price); ACU 5×;
// partner wholesale 80%/85% so KODA nets ≥4× on any resold plan. Exits 1 on violation.
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

// RULE 4 — TWO-BOOK. A CURRENT plan's DIRECT rate (usd/verifs) must clear the 4× floor AND be
// strictly below the 5× ACU rate — so a direct subscriber genuinely beats pay-as-you-go. Its
// LIST rate (list_usd/verifs) must be ≥ the 5× rate so partner resale (next rule) clears 4×.
console.log(`\nRULE 4 — direct plan rate ≥4× AND < ad-hoc ACU 5× ($${BILL.ACU_PRICE_USD}); list rate ≥5×:`);
const CURRENT = ['boutique', 'commerce', 'plateforme', 'scale'];
const LEGACY = ['boutique_legacy', 'commerce_legacy'];
for (const key of CURRENT) {
  const p = PLANS[key];
  const direct = p.usd / p.verifs, list = p.list_usd / p.verifs, over = p.overage;
  const directOk = BILL.clearsFloor(direct) && direct + 1e-9 < BILL.ACU_PRICE_USD;  // ≥4× AND < PAYG
  const listOk = list + 1e-9 >= BILL.ACU_PRICE_USD;                                  // ≥5× → resells at ≥4×
  const overOk = over != null && BILL.clearsFloor(over);
  if (!directOk || !listOk || !overOk) fails++;
  console.log(`  ${p.label.padEnd(11)} direct $${direct.toFixed(4)} ${(direct / BILL.UNIT_COST_USD).toFixed(2)}× ${directOk ? '✓' : '✗'} · list $${list.toFixed(4)} ${(list / BILL.UNIT_COST_USD).toFixed(2)}× ${listOk ? '✓' : '✗'} · overage ${(over / BILL.UNIT_COST_USD).toFixed(1)}× ${overOk ? '✓' : '✗'}`);
}
for (const key of LEGACY) {
  const p = PLANS[key];
  const direct = p.usd / p.verifs, ok = BILL.clearsFloor(direct);   // direct-only, grandfathered
  if (!ok) fails++;
  console.log(`  ${(p.label + ' (legacy)').padEnd(18)} direct $${direct.toFixed(4)} ${(direct / BILL.UNIT_COST_USD).toFixed(2)}× — direct-only, ≥4× ${ok ? '✓' : '✗'}`);
}

// RULE 5 — a whole plan RESOLD at LIST through a partner nets KODA ≥4× at both wholesale tiers,
// while the partner keeps their fixed spread (reseller 20% @ 80%, distributor 15% @ 85%).
console.log(`\nRULE 5 — partner plan resale (at list) nets KODA ≥4× (reseller 80% · distributor 85%):`);
for (const key of CURRENT) {
  const p = PLANS[key], listRate = p.list_usd / p.verifs;
  for (const [who, bps, margin] of [['reseller', 8000, 20], ['distributor', 8500, 15]]) {
    const net = listRate * (bps / 10000), mult = net / BILL.UNIT_COST_USD, ok = BILL.clearsFloor(net);
    const keeps = Math.round((1 - bps / 10000) * 100);
    if (!ok) fails++;
    console.log(`  ${p.label.padEnd(11)} via ${who.padEnd(11)} ${bps / 100}% of $${p.list_usd} list → KODA nets ${mult.toFixed(2)}× ${ok ? '✓' : '✗ BELOW 4×'} · partner keeps ~${keeps}%`);
  }
}

if (fails) { console.log(`\n${fails} price point(s) violate the rule — fix pricing or costs.`); process.exit(1); }
console.log('\nAll price points clear the rule: plans ≥4×, ad-hoc ACU ≥5× ✓');
