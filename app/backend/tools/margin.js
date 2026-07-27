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
if (fails) { console.log(`\n${fails} price point(s) violate the rule — fix pricing or costs.`); process.exit(1); }
console.log('\nAll price points clear the 100%-profit rule ✓');
