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

// RULE 3 — every ACU SALE price (top-up packs + partner wholesale) clears the enforced
// 4× floor. This is the same PRICE_FLOOR_USD the runtime guards use, so CI fails the
// moment any pack or the minimum wholesale rate would sell below 4× cost.
const PACKS = require('../../shared/plans').TOPUP_PACKS;
console.log(`\nRULE 3 — ACU sale floor $${BILL.PRICE_FLOOR_USD}/ACU (4× the $${BILL.UNIT_COST_USD} cost):`);
for (const p of PACKS) {
  const perAcu = p.usd / p.acu, ok = BILL.clearsFloor(perAcu);
  if (!ok) fails++;
  console.log(`  top-up $${p.usd} → ${p.acu} ACU = $${perAcu.toFixed(4)}/ACU  ${(perAcu / BILL.UNIT_COST_USD).toFixed(1)}×  ${ok ? '✓' : '✗ BELOW 4× FLOOR'}`);
}
const minBps = BILL.minWholesaleBps(), wholesaleMin = BILL.ACU_PRICE_USD * (minBps / 10000);
if (!BILL.clearsFloor(wholesaleMin)) fails++;
console.log(`  retail $${BILL.ACU_PRICE_USD}/ACU = ${(BILL.ACU_PRICE_USD / BILL.UNIT_COST_USD).toFixed(1)}× · min wholesale ${minBps / 100}% = $${wholesaleMin.toFixed(4)} = ${(wholesaleMin / BILL.UNIT_COST_USD).toFixed(1)}× (partners buy at retail, earn via fee on top) ${BILL.clearsFloor(wholesaleMin) ? '✓' : '✗'}`);

// RULE 4 — 4× FLOOR ON EVERY PLAN VERIFICATION. Plans win on quota + throughput +
// features, NEVER on a cheaper unit rate: a paid plan's included rate (usd/verifs) and
// its overage must each be ≥ the $PRICE_FLOOR (= 4× cost = the PAYG price). So every
// verification nets ≥4× whether bought PAYG or on a plan, and there is no rate arbitrage
// either way. CI fails if any tier is priced below the floor.
console.log(`\nRULE 4 — 4× floor on plans (PAYG = $${BILL.ACU_PRICE_USD}/verif = the floor):`);
const LADDER = ['boutique', 'commerce', 'plateforme'];
for (const key of LADDER) {
  const p = PLANS[key];
  const incl = p.usd / p.verifs;
  const over = p.overage;
  const inclOk = BILL.clearsFloor(incl);
  const overOk = over != null && BILL.clearsFloor(over);
  if (!inclOk || !overOk) fails++;
  console.log(`  ${p.label.padEnd(11)} incl $${incl.toFixed(4)}/verif (${p.verifs}/mo) ${(incl / BILL.UNIT_COST_USD).toFixed(1)}× ${inclOk ? '✓' : '✗'}  ·  overage $${over.toFixed(4)} ${(over / BILL.UNIT_COST_USD).toFixed(1)}× ${overOk ? '✓' : '✗'}`);
}

if (fails) { console.log(`\n${fails} price point(s) violate the rule — fix pricing or costs.`); process.exit(1); }
console.log('\nAll price points + ACU sale prices clear the 4×-profit rule ✓');
