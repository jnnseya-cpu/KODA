// Trend Intelligence AI — INVISIBLE background agent (no UI, no user-facing routes).
// Runs server-side inside KODA like the self-monitor: reads first-party signals,
// scores opportunities, and synthesises DRAFT Growth Briefs for KODA's existing
// SEO/marketing agents. It never performs a public/live write and exposes nothing
// to users — matching the spec pilot rule (§7: automatic drafts & internal tasks
// only) and the requirement that it works invisibly.
'use strict';
const crypto = require('node:crypto');
const scoring = require('./scoring');
const briefLib = require('./brief');
const store = require('./store');

const isoZ = (d) => new Date(d).toISOString().replace(/\.\d{3}Z$/, 'Z'); // strip ms, keep Z

// Deterministic draft Growth Brief from an eligible opportunity + merchant profile.
// Returns a schema-valid brief, or null if the inputs can't make a valid one.
function synthBrief(merchantId, opp, profile, now = new Date()) {
  const market = String(opp.market || profile.default_market || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(market)) return null;                 // can't target without a valid market
  const breaking = opp.trend_class === 'breaking';
  const brief = {
    schema_version: 1,
    brief_id: 'gb_' + crypto.createHash('sha256').update(merchantId + ':' + opp.topic_id).digest('hex').slice(0, 12),
    brief_version: Math.max(1, Number(opp.brief_version) || 1),
    tenant_id: String(merchantId),
    platform_id: String(profile.platform_id || merchantId),
    market,
    locale: String(opp.locale || profile.default_locale || 'en'),
    topic_id: String(opp.topic_id),
    opportunity_score: opp.opportunity_score,
    confidence: opp.confidence,
    valid_from: isoZ(now),
    expires_at: isoZ(now.getTime() + (breaking ? 24 : 7 * 24) * 3600 * 1000),
    evidence_ids: (opp.evidence_ids && opp.evidence_ids.length) ? opp.evidence_ids.slice(0, 64) : ['ev_auto'],
    audience: String(opp.audience || profile.audience || 'relevant audience').slice(0, 500),
    intent: String(opp.intent || 'evaluate the topic').slice(0, 500),
    approved_claim_ids: (profile.approved_claim_ids || []).slice(0, 64),
    cta_id: String((profile.allowed_cta_ids && profile.allowed_cta_ids[0]) || profile.cta_id || 'cta_default'),
    allowed_channels: (profile.allowed_channels && profile.allowed_channels.length) ? profile.allowed_channels : ['seo', 'organic_social'],
    prohibited_claims: (profile.prohibited_claims || []).slice(0, 32),
    objective: String((profile.outcome && profile.outcome.conversion) || 'qualified outcome').slice(0, 500),
    experiment_id: 'exp_' + crypto.randomBytes(4).toString('hex'),
    policy_version: Math.max(1, Number(profile.policy_version) || 1),
  };
  return briefLib.validateBrief(brief).ok ? brief : null;
}

// Score ONE candidate topic and persist the result. Deterministic; no model needed.
// input: { topic_id, market, locale, window_end, demand?|movement{c,history,gate?},
//          profileScores{fit,intent,timing,readiness}, confidenceInputs{sourceQuality,coverage,freshness},
//          independentFamilies, veto?, autoOptIn?, evidence_ids?, audience?, intent?, profile? }
function detect(merchantId, input, now = new Date()) {
  const profile = input.profile || {};
  let demand = input.demand, gateFailed = false;
  if (demand == null && input.movement) {
    const z = scoring.zScore(input.movement.c, input.movement.history || []);
    demand = scoring.normalizeDemand(z);
    if (!scoring.hasEnoughHistory(input.movement.history || []) || !scoring.passesCountGate(input.movement.c, z, input.movement.gate)) gateFailed = true;
  }
  demand = scoring.clamp(demand || 0, 0, 100);

  const ps = input.profileScores || {};
  const opp = scoring.opportunityScore({ demand, fit: ps.fit, intent: ps.intent, timing: ps.timing, readiness: ps.readiness });
  const ci = input.confidenceInputs || {};
  const corroboration = scoring.corroborationScore(input.independentFamilies);
  const conf = scoring.confidenceScore({ sourceQuality: ci.sourceQuality, corroboration, coverage: ci.coverage, freshness: ci.freshness }, input.independentFamilies);

  let status = scoring.classify(opp, conf, { veto: !!input.veto, autoOptIn: !!input.autoOptIn });
  // a failed volume/history gate (insufficient evidence) can never reach a live/brief state
  if (gateFailed && (status === 'brief' || status === 'auto_eligible')) status = 'watch';

  const breakdown = { demand, fit: ps.fit, intent: ps.intent, timing: ps.timing, readiness: ps.readiness,
    sourceQuality: ci.sourceQuality, corroboration, coverage: ci.coverage, freshness: ci.freshness,
    independentFamilies: input.independentFamilies, veto: !!input.veto, gateFailed };
  const windowEnd = input.window_end || (input.movement && input.movement.window_end) || isoZ(now);
  const opportunity = store.saveOpportunity(merchantId, {
    topic_id: input.topic_id, window_end: windowEnd, opportunity_score: opp, confidence: conf, status, breakdown });

  let brief = null;
  if (status === 'brief' || status === 'auto_eligible') {
    brief = synthBrief(merchantId, { topic_id: input.topic_id, market: input.market, locale: input.locale,
      opportunity_score: opp, confidence: conf, evidence_ids: input.evidence_ids, audience: input.audience,
      intent: input.intent, trend_class: input.trend_class }, profile, now);
    if (brief) store.saveBrief(merchantId, brief, 'draft'); // DRAFT only — invisible, never auto-published
  }
  return { opportunity, status, brief };
}

// Internal, server-side resolver for KODA's agents to consult the current APPROVED
// brief at run time (spec §4/§14). Not exposed to users. Null → agent baseline.
// `query` needs an exact topic_id (topic-aware callers, e.g. a per-topic SEO page).
function effectiveBrief(merchantId, query) {
  return briefLib.resolveEffective(store.listActiveBriefs(merchantId), query);
}

// INVISIBLE run-time steering for KODA's live marketing/SEO agents. Given only a
// market/locale/channel scope (no topic), returns normalised guidance from the best
// APPROVED brief, or null → the agent runs exactly as it does today. OFF unless
// KODA_TREND_ENABLE=1, so KODA's locked behaviour is byte-identical by default and
// nothing from the Trend engine ever surfaces to a merchant.
function guidanceFor(merchantId, scope) {
  if (process.env.KODA_TREND_ENABLE !== '1') return null; // invisible + disabled unless enabled
  if (!merchantId || !scope || !scope.market || !scope.locale || !scope.channel) return null;
  const b = briefLib.bestForScope(store.listActiveBriefs(merchantId), scope);
  if (!b) return null;
  return {
    brief_id: b.brief_id,
    topic_id: b.topic_id,
    audience: b.audience,
    intent: b.intent,
    objective: b.objective,
    cta_id: b.cta_id,
    approved_claim_ids: Array.isArray(b.approved_claim_ids) ? b.approved_claim_ids.slice(0, 64) : [],
    prohibited_claims: Array.isArray(b.prohibited_claims) ? b.prohibited_claims.slice(0, 32) : [],
    allowed_channels: Array.isArray(b.allowed_channels) ? b.allowed_channels : [],
  };
}

// Invisible background loop. OFF by default (opt-in per deployment via env), so it
// never runs in tests/CI and never surprises a merchant. It only ever writes draft
// briefs; public activation stays behind KODA's existing approval path.
let _timer = null;
function startTrendLoop(runner) {
  if (process.env.KODA_TREND_ENABLE !== '1') return null;      // invisible + disabled unless explicitly enabled
  if (_timer) return _timer;
  const everyMs = Math.max(60000, Number(process.env.KODA_TREND_INTERVAL_MS) || 3600000);
  const tick = () => { try { (runner || (() => {}))(); } catch { /* a trend tick must never destabilise KODA */ } };
  _timer = setInterval(tick, everyMs); _timer.unref();
  return _timer;
}
function stopTrendLoop() { if (_timer) { clearInterval(_timer); _timer = null; } }

module.exports = { detect, synthBrief, effectiveBrief, guidanceFor, startTrendLoop, stopTrendLoop };
