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
  const okay = markup >= C.MARKUP_MIN;
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
const be = Math.ceil(C.FIXED_TOTAL / (0.024 - C.COST.code));
console.log(`  overhead break-even without any subscriptions: ~${be.toLocaleString()} verifications/mo`);

// RULE 3 — every ACU SALE price (top-up packs + partner wholesale) clears the
// enforced 100% floor. This is the same PRICE_FLOOR_USD the runtime guards use, so
// CI fails the moment any pack or the minimum wholesale rate would sell below 100%.
const BILL = require('../../shared/billing');
const PACKS = require('../../shared/plans').TOPUP_PACKS;
console.log(`\nRULE 3 — ACU sale floor $${BILL.PRICE_FLOOR_USD}/ACU (100% over $${BILL.UNIT_COST_USD} cost):`);
for (const p of PACKS) {
  const perAcu = p.usd / p.acu, ok = BILL.clearsFloor(perAcu);
  if (!ok) fails++;
  console.log(`  top-up $${p.usd} → ${p.acu} ACU = $${perAcu.toFixed(4)}/ACU  ${((perAcu / BILL.UNIT_COST_USD - 1) * 100).toFixed(0)}%  ${ok ? '✓' : '✗ BELOW 100% FLOOR'}`);
}
const minBps = BILL.minWholesaleBps(), wholesaleMin = BILL.ACU_PRICE_USD * (minBps / 10000);
if (!BILL.clearsFloor(wholesaleMin)) fails++;
console.log(`  retail $${BILL.ACU_PRICE_USD}/ACU = ${((BILL.ACU_PRICE_USD / BILL.UNIT_COST_USD - 1) * 100).toFixed(0)}% · wholesale 85% = $${(BILL.ACU_PRICE_USD * 0.85).toFixed(4)} = ${((BILL.ACU_PRICE_USD * 0.85 / BILL.UNIT_COST_USD - 1) * 100).toFixed(0)}% · floor at ${minBps / 100}% ${BILL.clearsFloor(wholesaleMin) ? '✓' : '✗'}`);

// RULE 4 — SUBSCRIPTION ≻ PAY-AS-YOU-GO. Raw ACU top-up ($ACU_PRICE/verif) is the PAYG
// escape hatch. Every paid tier must be strictly cheaper than PAYG both on its included
// rate (usd/verifs) and its overage, get cheaper up the ladder, and never drop below the
// $PRICE_FLOOR margin floor. This is what stops merchants dodging subscriptions by living
// on free Marché + ACU top-ups (the cannibalisation inversion).
console.log(`\nRULE 4 — subscription ≻ PAYG (PAYG = $${BILL.ACU_PRICE_USD}/verif, floor $${BILL.PRICE_FLOOR_USD}):`);
const LADDER = ['boutique', 'commerce', 'plateforme'];
let prevIncl = Infinity, prevOver = Infinity;
for (const key of LADDER) {
  const p = PLANS[key];
  const incl = p.usd / p.verifs;
  const over = p.overage;
  const inclOk = incl < BILL.ACU_PRICE_USD && incl >= BILL.PRICE_FLOOR_USD && incl <= prevIncl;
  const overOk = over != null && over < BILL.ACU_PRICE_USD && over >= BILL.PRICE_FLOOR_USD && over <= prevOver;
  if (!inclOk || !overOk) fails++;
  console.log(`  ${p.label.padEnd(11)} incl $${incl.toFixed(4)}/verif (${p.verifs}/mo) ${inclOk ? '✓' : '✗'}  ·  overage $${over.toFixed(4)} ${overOk ? '✓' : '✗'}`);
  prevIncl = incl; prevOver = over;
}

if (fails) { console.log(`\n${fails} price point(s) violate the rule — fix pricing or costs.`); process.exit(1); }
console.log('\nAll price points + ACU sale prices clear the 100%-profit rule ✓');
