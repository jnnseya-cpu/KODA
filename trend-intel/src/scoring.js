// Trend Intelligence AI — deterministic detection & scoring core.
// Implements spec §5 (detection & scoring) and §17 (reproducible defaults).
// Pure functions, ZERO dependencies (node core only). Industry-neutral:
// no platform/industry/country branching lives here — all of that is profile data.
'use strict';

// ── numeric helpers ──────────────────────────────────────────────────────────
const log1p = (v) => Math.log(1 + Math.max(0, Number(v) || 0));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number(v)));

function median(arr) {
  const a = (arr || []).map(Number).filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return 0;
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
// median absolute deviation (robust spread)
function mad(arr) {
  const med = median(arr);
  return median((arr || []).map((v) => Math.abs(Number(v) - med)));
}

// ── per-source movement (spec §5.3) ──────────────────────────────────────────
// lift = ln((c+1)/(b+1)) with current count c and baseline median b.
function lift(c, b) { return Math.log((Number(c) + 1) / (Number(b) + 1)); }

// robust anomaly z against historical counts x[]:
//   z = (log1p(c) − median(log1p(x))) / max(1.4826 × MAD(log1p(x)), 0.2)
function zScore(c, history) {
  const lx = (history || []).map(log1p);
  const scale = Math.max(1.4826 * mad(lx), 0.2);
  return (log1p(c) - median(lx)) / scale;
}

// count-feed gate: c >= cMin AND z >= zMin (both adjustable by source/geography).
function passesCountGate(c, z, { cMin = 20, zMin = 2 } = {}) {
  return Number(c) >= cMin && z >= zMin;
}

// insufficient history: fewer than four comparable periods → keep draft-only.
function hasEnoughHistory(history) { return Array.isArray(history) && history.length >= 4; }

// demand normalisation for count feeds (spec §17): clamp(50 + 10·z, 0, 100),
// applied only AFTER the volume and history gates pass.
function normalizeDemand(z) { return clamp(50 + 10 * z, 0, 100); }

// ── opportunity score (spec §5.4) — 0–100 ────────────────────────────────────
// 25% demand, 25% platform fit, 20% commercial intent, 15% timing, 15% readiness.
// Missing readiness blocks activation; hard vetoes are applied by the caller/classify.
const OPP_WEIGHTS = Object.freeze({ demand: 0.25, fit: 0.25, intent: 0.20, timing: 0.15, readiness: 0.15 });
function opportunityScore(inputs) {
  const i = {};
  for (const k of Object.keys(OPP_WEIGHTS)) i[k] = clamp((inputs || {})[k] || 0, 0, 100);
  return OPP_WEIGHTS.demand * i.demand + OPP_WEIGHTS.fit * i.fit + OPP_WEIGHTS.intent * i.intent
    + OPP_WEIGHTS.timing * i.timing + OPP_WEIGHTS.readiness * i.readiness;
}

// ── confidence (spec §5.5 + §17) — 0–100, independent of opportunity ──────────
// 35% source quality, 25% corroboration, 20% coverage, 20% freshness.
const CONF_WEIGHTS = Object.freeze({ sourceQuality: 0.35, corroboration: 0.25, coverage: 0.20, freshness: 0.20 });
const SINGLE_FAMILY_CAP = 69; // a single source family caps confidence (spec §5.5)

// corroboration from the count of INDEPENDENT source families (spec §17):
// 0 for one, 80 for two, 100 for three or more.
function corroborationScore(independentFamilies) {
  const n = Math.max(0, Math.floor(Number(independentFamilies) || 0));
  return n >= 3 ? 100 : n === 2 ? 80 : 0;
}

function confidenceScore(inputs, independentFamilies) {
  const i = {};
  for (const k of Object.keys(CONF_WEIGHTS)) i[k] = clamp((inputs || {})[k] || 0, 0, 100);
  let c = CONF_WEIGHTS.sourceQuality * i.sourceQuality + CONF_WEIGHTS.corroboration * i.corroboration
    + CONF_WEIGHTS.coverage * i.coverage + CONF_WEIGHTS.freshness * i.freshness;
  if (independentFamilies != null && Number(independentFamilies) <= 1) c = Math.min(c, SINGLE_FAMILY_CAP);
  return c;
}

// mean of configured 0–100 quality scores for the contributing families (spec §17).
function sourceQualityScore(familyQualities) {
  const a = (familyQualities || []).map(Number).filter(Number.isFinite);
  return a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
}

// ── decision thresholds (spec §5 table) ──────────────────────────────────────
// Result ∈ 'archive' | 'watch' | 'brief' | 'auto_eligible'.
//  · score<60 OR confidence<55                         → archive
//  · 60–74 or 55–74 (both above archive cutoffs)       → watch/draft (no live change)
//  · score≥75 AND confidence≥75 AND no veto            → reviewable brief
//  · score≥85 AND confidence≥85 AND tenant opt-in      → bounded auto-action eligible
function classify(score, confidence, { veto = false, autoOptIn = false } = {}) {
  if (score < 60 || confidence < 55) return 'archive';
  if (!veto && score >= 75 && confidence >= 75) {
    if (autoOptIn && score >= 85 && confidence >= 85) return 'auto_eligible';
    return 'brief';
  }
  return 'watch';
}

module.exports = {
  log1p, clamp, median, mad,
  lift, zScore, passesCountGate, hasEnoughHistory, normalizeDemand,
  opportunityScore, confidenceScore, corroborationScore, sourceQualityScore, classify,
  OPP_WEIGHTS, CONF_WEIGHTS, SINGLE_FAMILY_CAP,
};
