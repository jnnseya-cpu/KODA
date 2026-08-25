// KODA — margin guard (npm run margin). Enforces the 100%-profit rule:
// every retail price point must be ≥ 2× fully-loaded cost. Exits 1 on violation.
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
// point clears the 4× floor. Top-ups MUST be ≥5× (strictly above the 4× plan rate) so
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

// RULE 4 — plans sit at the 4× floor, ad-hoc ACU sits above at 5×. A plan's INCLUDED rate
// (usd/verifs) must clear the 4× floor AND be strictly cheaper than the ad-hoc ACU rate
// (so a plan is always the better deal); overage falls back to the ad-hoc ACU rate (5×).
console.log(`\nRULE 4 — plan rate 4× ($${BILL.PLAN_PRICE_USD}) < ad-hoc ACU 5× ($${BILL.ACU_PRICE_USD}):`);
if (!(BILL.PLAN_PRICE_USD + 1e-9 < BILL.ACU_PRICE_USD)) { fails++; console.log('  ✗ plan rate is not below the ad-hoc ACU rate'); }
const LADDER = ['boutique', 'commerce', 'plateforme'];
for (const key of LADDER) {
  const p = PLANS[key];
  const incl = p.usd / p.verifs;
  const over = p.overage;
  const inclOk = BILL.clearsFloor(incl) && incl + 1e-9 < BILL.ACU_PRICE_USD; // ≥4× AND cheaper than PAYG
  const overOk = over != null && BILL.clearsFloor(over);
  if (!inclOk || !overOk) fails++;
  console.log(`  ${p.label.padEnd(11)} incl $${incl.toFixed(4)}/verif (${p.verifs}/mo) ${(incl / BILL.UNIT_COST_USD).toFixed(1)}× ${inclOk ? '✓' : '✗'}  ·  overage $${over.toFixed(4)} ${(over / BILL.UNIT_COST_USD).toFixed(1)}× ${overOk ? '✓' : '✗'}`);
}

if (fails) { console.log(`\n${fails} price point(s) violate the rule — fix pricing or costs.`); process.exit(1); }
console.log('\nAll price points clear the rule: plans ≥4×, ad-hoc ACU ≥5× ✓');
