// Conformance + unit tests for the deterministic scoring core (spec §5, §17).
// Includes TI-03: the §5 worked example must return exactly 86.25 / 83.5.
'use strict';
const s = require('../src/scoring');

let pass = 0, fail = 0;
const approx = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
function ok(cond, msg) { if (cond) { pass++; console.log('✓ ' + msg); } else { fail++; console.log('✗ FAIL ' + msg); } }
function eq(actual, expected, msg) { ok(approx(actual, expected), `${msg} (got ${actual}, want ${expected})`); }

// ── TI-03 / §5 worked example (release conformance) ──────────────────────────
const opp = s.opportunityScore({ demand: 80, fit: 95, intent: 85, timing: 90, readiness: 80 });
eq(opp, 86.25, 'TI-03 opportunity score = 86.25');
const conf = s.confidenceScore({ sourceQuality: 90, corroboration: 80, coverage: 70, freshness: 90 }, 2);
eq(conf, 83.5, 'TI-03 confidence = 83.5 (two families, no cap)');
ok(s.classify(opp, conf) === 'brief', 'TI-03 classifies as reviewable brief, not auto');
ok(s.classify(opp, conf, { autoOptIn: true }) === 'brief', 'TI-03 stays brief even with opt-in (conf 83.5 < 85)');

// ── opportunity weighting ────────────────────────────────────────────────────
eq(s.opportunityScore({ demand: 100, fit: 100, intent: 100, timing: 100, readiness: 100 }), 100, 'all-100 opportunity = 100');
eq(s.opportunityScore({ demand: 0, fit: 0, intent: 0, timing: 0, readiness: 0 }), 0, 'all-0 opportunity = 0');
ok(Math.abs(s.OPP_WEIGHTS.demand + s.OPP_WEIGHTS.fit + s.OPP_WEIGHTS.intent + s.OPP_WEIGHTS.timing + s.OPP_WEIGHTS.readiness - 1) < 1e-9, 'opportunity weights sum to 1');
ok(Math.abs(s.CONF_WEIGHTS.sourceQuality + s.CONF_WEIGHTS.corroboration + s.CONF_WEIGHTS.coverage + s.CONF_WEIGHTS.freshness - 1) < 1e-9, 'confidence weights sum to 1');

// ── single-source-family cap (§5.5) ──────────────────────────────────────────
const uncapped = s.confidenceScore({ sourceQuality: 100, corroboration: 0, coverage: 100, freshness: 100 }, 2);
eq(uncapped, 75, 'two families: confidence uncapped (75)');
const capped = s.confidenceScore({ sourceQuality: 100, corroboration: 0, coverage: 100, freshness: 100 }, 1);
eq(capped, 69, 'single family: confidence capped at 69');

// ── corroboration mapping (§17) ──────────────────────────────────────────────
eq(s.corroborationScore(1), 0, 'corroboration(1 family) = 0');
eq(s.corroborationScore(2), 80, 'corroboration(2 families) = 80');
eq(s.corroborationScore(3), 100, 'corroboration(3 families) = 100');
eq(s.corroborationScore(7), 100, 'corroboration(>=3 families) = 100');

// ── decision thresholds (§5 table) ───────────────────────────────────────────
ok(s.classify(59, 90) === 'archive', 'score<60 → archive');
ok(s.classify(90, 54) === 'archive', 'confidence<55 → archive');
ok(s.classify(70, 70) === 'watch', 'mid score/confidence → watch');
ok(s.classify(80, 80) === 'brief', 'score≥75 & conf≥75 → brief');
ok(s.classify(90, 90, { autoOptIn: true }) === 'auto_eligible', 'score≥85 & conf≥85 & opt-in → auto_eligible');
ok(s.classify(90, 90) === 'brief', 'auto thresholds without opt-in → brief');
ok(s.classify(90, 90, { veto: true }) === 'watch', 'veto blocks brief → watch');

// ── per-source movement: lift, z, gates, demand normalisation (§5.3, §17) ─────
eq(s.lift(10, 10), 0, 'lift with no change = 0');
ok(s.lift(40, 10) > 0, 'lift of a spike is positive');
ok(s.lift(5, 40) < 0, 'lift of a drop is negative');

const steady = [10, 12, 9, 11, 10, 8, 12, 10];
const zSpike = s.zScore(40, steady);
ok(zSpike >= 2, `clear spike yields z≥2 (z=${zSpike.toFixed(2)})`);
ok(s.passesCountGate(40, zSpike), 'c=40, high z passes count gate');
ok(!s.passesCountGate(19, zSpike), 'c=19 fails the c>=20 gate');
ok(!s.passesCountGate(40, 1.5), 'z=1.5 fails the z>=2 gate');
const zFlat = s.zScore(11, steady);
ok(zFlat < 2, `near-baseline value yields low z (z=${zFlat.toFixed(2)})`);

// MAD floor (0.2) prevents divide-by-tiny-spread blowups on constant history
const zConst = s.zScore(11, [10, 10, 10, 10]);
ok(Number.isFinite(zConst), 'z is finite even with zero-MAD (constant) history');

// demand normalisation clamps to [0,100]
eq(s.normalizeDemand(0), 50, 'normalizeDemand(z=0) = 50');
eq(s.normalizeDemand(3), 80, 'normalizeDemand(z=3) = 80');
eq(s.normalizeDemand(100), 100, 'normalizeDemand clamps high to 100');
eq(s.normalizeDemand(-100), 0, 'normalizeDemand clamps low to 0');

// ── history sufficiency (§5.3) ───────────────────────────────────────────────
ok(!s.hasEnoughHistory([1, 2, 3]), 'fewer than 4 periods = insufficient history');
ok(s.hasEnoughHistory([1, 2, 3, 4]), 'four periods = enough history');

// ── source quality mean (§17) ────────────────────────────────────────────────
eq(s.sourceQualityScore([80, 90, 100]), 90, 'source quality = mean of family qualities');

console.log(`\n${fail ? '✗' : '✅'} scoring: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
