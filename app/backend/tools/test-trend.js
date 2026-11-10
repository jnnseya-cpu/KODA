// KODA — Trend Intelligence AI embedded tests. Runs against KODA's own database
// (temp data dir), proving the embedded scoring, brief contract, and merchant-
// scoped store. Conformance: TI-01, TI-02, TI-03, TI-05.
'use strict';
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
process.env.KODA_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'koda-trend-'));
const { q } = require('../lib/db');
const scoring = require('../lib/trend/scoring');
const brief = require('../lib/trend/brief');
const store = require('../lib/trend/store');
const agent = require('../lib/trend/agent');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ FAIL ' + m); } };
const approx = (a, b) => Math.abs(a - b) <= 1e-9;
const isoNow = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

// ── scoring (TI-03 / §5) ─────────────────────────────────────────────────────
ok(approx(scoring.opportunityScore({ demand: 80, fit: 95, intent: 85, timing: 90, readiness: 80 }), 86.25), 'TI-03 opportunity 86.25');
ok(approx(scoring.confidenceScore({ sourceQuality: 90, corroboration: 80, coverage: 70, freshness: 90 }, 2), 83.5), 'TI-03 confidence 83.5');
ok(scoring.classify(86.25, 83.5) === 'brief', 'TI-03 → reviewable brief');
ok(scoring.confidenceScore({ sourceQuality: 100, corroboration: 0, coverage: 100, freshness: 100 }, 1) === 69, 'single-family cap 69');
ok(scoring.classify(90, 90, { veto: true }) === 'watch', 'veto blocks brief');

// ── Growth Brief contract (§6 / §507 / TI-05) ────────────────────────────────
const FIX = { schema_version: 1, brief_id: 'gb_104', brief_version: 3, tenant_id: 'tenant_demo', platform_id: 'fixture_platform_a',
  market: 'CA', locale: 'en-CA', topic_id: 'simpler-team-onboarding', opportunity_score: 86.25, confidence: 83.5,
  valid_from: '2026-11-10T10:00:00Z', expires_at: '2026-11-17T10:00:00Z', evidence_ids: ['ev_341', 'ev_342'],
  audience: 'Small teams comparing onboarding options', intent: 'evaluate how to onboard a small team',
  approved_claim_ids: ['claim_onboarding_01'], cta_id: 'cta_view_onboarding_guide', allowed_channels: ['seo', 'organic_social'],
  prohibited_claims: ['guaranteed onboarding time'], objective: 'qualified trial starts per eligible session', experiment_id: 'exp_91', policy_version: 5 };
ok(brief.validateBrief(FIX).ok, '§6 fixture validates');
ok(!brief.validateBrief({ ...FIX, sneaky: 1 }).ok, 'closed object rejects extra field');
const q5 = { market: 'CA', locale: 'en-CA', topic_id: 'simpler-team-onboarding', channel: 'seo', now: '2026-11-12T10:00:00Z' };
ok(brief.resolveEffective([FIX], q5) === FIX, 'resolves fresh matching brief');
ok(brief.resolveEffective([FIX], { ...q5, now: '2026-12-01T00:00:00Z' }) === null, 'TI-05 expired → baseline (null)');

// ── merchant-scoped store: TI-01 ingest + TI-02 isolation (KODA DB) ───────────
q.run("INSERT INTO merchants (id,name) VALUES ('m_tA','Trend A')");
q.run("INSERT INTO merchants (id,name) VALUES ('m_tB','Trend B')");
store.registerSource('m_tA', { source_id: 'fp_search', access_path: 'host_mediated', source_family: 'internal_search', quality: 80 });
store.registerSource('m_tB', { source_id: 'fp_search', access_path: 'host_mediated', source_family: 'internal_search', quality: 80 });
const rec = { source_record_id: 'r1', observed_at: '2026-11-10T09:00:00Z', window_end: '2026-11-10T09:00:00Z', geography: 'CA', metric: 'count', value: 42 };

ok(store.ingestObservations('m_tA', 'fp_search', [rec]).accepted === 1, 'TI-01 first ingest accepts');
ok(store.ingestObservations('m_tA', 'fp_search', [rec]).duplicate === 1, 'TI-01 exact replay = duplicate');
ok(store.ingestObservations('m_tA', 'fp_search', [{ ...rec, value: 99 }]).conflict === 1, 'TI-01 changed hash = conflict');
ok(store.countObservations('m_tA') === 1, 'TI-01 one row after replay+conflict');
ok(store.ingestObservations('m_tA', 'nope', [rec]).errors[0].code === 'unregistered_source', 'unregistered source rejected');

store.ingestObservations('m_tB', 'fp_search', [{ ...rec, geography: 'FR', value: 7 }]);
ok(store.countObservations('m_tB') === 1, 'TI-02 B has its own one observation');
ok(store.countObservations('m_tA') === 1, 'TI-02 A unchanged by B ingest');
ok(store.getObservation('m_tA', 'fp_search', 'r1').value === 42, "TI-02 A reads its own value, not B's");
ok(!store.getObservation('m_tB', 'fp_search', 'r2'), 'TI-02 B cannot see an A-only id');

// ── store round-trip: opportunity + brief persistence ────────────────────────
store.saveOpportunity('m_tA', { topic_id: 'simpler-team-onboarding', window_end: '2026-11-10T09:00:00Z', opportunity_score: 86.25, confidence: 83.5, status: 'brief', breakdown: { demand: 80 } });
ok(store.listOpportunities('m_tA', { status: 'brief' }).length === 1, 'opportunity persisted and listable');
store.saveBrief('m_tA', FIX, 'draft'); store.activateBrief('m_tA', 'gb_104', 3);
ok(store.listActiveBriefs('m_tA').length === 1 && store.listActiveBriefs('m_tB').length === 0, 'brief activates scoped to its merchant');

// ── invisible background agent: detect() + effectiveBrief() + loop (§4/§7) ─────
q.run("INSERT INTO merchants (id,name) VALUES ('m_ag','Agent Merchant')");
const agProfile = { platform_id: 'plat_ag', default_market: 'CA', default_locale: 'en-CA',
  approved_claim_ids: ['claim_x'], allowed_cta_ids: ['cta_ag'], allowed_channels: ['seo', 'organic_social'],
  prohibited_claims: ['guaranteed'], outcome: { conversion: 'trial starts' }, policy_version: 2 };
// high-score inputs → reviewable brief + a persisted DRAFT Growth Brief (invisible)
const hi = agent.detect('m_ag', { topic_id: 'topic-hi', market: 'CA', locale: 'en-CA',
  demand: 80, profileScores: { fit: 95, intent: 85, timing: 90, readiness: 80 },
  confidenceInputs: { sourceQuality: 90, coverage: 70, freshness: 90 }, independentFamilies: 2,
  evidence_ids: ['ev_1', 'ev_2'], audience: 'Small teams', intent: 'evaluate onboarding',
  trend_class: 'breaking', profile: agProfile });
ok(hi.status === 'brief', 'detect: high score → reviewable brief');
ok(hi.brief && brief.validateBrief(hi.brief).ok, 'detect: synthesises schema-valid DRAFT brief');
ok(store.listOpportunities('m_ag', { status: 'brief' }).length === 1, 'detect: opportunity persisted');
ok(store.listActiveBriefs('m_ag').length === 0, 'detect: brief is DRAFT only — nothing active/visible');
// low-score inputs → no brief
const lo = agent.detect('m_ag', { topic_id: 'topic-lo', market: 'CA', locale: 'en-CA',
  demand: 5, profileScores: { fit: 10, intent: 10, timing: 10, readiness: 10 },
  confidenceInputs: { sourceQuality: 20, coverage: 20, freshness: 20 }, independentFamilies: 1,
  profile: agProfile });
ok(lo.status !== 'brief' && lo.status !== 'auto_eligible' && lo.brief === null, 'detect: low score → no brief');
// failed count/history gate downgrades a would-be brief to watch (insufficient evidence)
const gated = agent.detect('m_ag', { topic_id: 'topic-gate', market: 'CA', locale: 'en-CA',
  movement: { c: 3, history: [2, 2, 3] }, profileScores: { fit: 95, intent: 85, timing: 90, readiness: 80 },
  confidenceInputs: { sourceQuality: 90, coverage: 70, freshness: 90 }, independentFamilies: 2,
  profile: agProfile });
ok(gated.status === 'watch' && gated.brief === null, 'detect: failed volume/history gate → watch, no brief');
// effectiveBrief resolver: null for drafts, resolves once activated
ok(agent.effectiveBrief('m_ag', { market: 'CA', locale: 'en-CA', topic_id: 'topic-hi', channel: 'seo', now: isoNow() }) === null, 'effectiveBrief: DRAFT not yet effective (baseline/null)');
store.activateBrief('m_ag', hi.brief.brief_id, hi.brief.brief_version);
ok(agent.effectiveBrief('m_ag', { market: 'CA', locale: 'en-CA', topic_id: 'topic-hi', channel: 'seo', now: isoNow() }) !== null, 'effectiveBrief: resolves the APPROVED brief at run time');

// ── scope-level resolver + invisible run-time steering (§4/§14) ────────────────
const growth = require('../lib/growth');
const activeBriefs = store.listActiveBriefs('m_ag');
ok(brief.bestForScope(activeBriefs, { market: 'CA', locale: 'en-CA', channel: 'organic_social', now: isoNow() }) !== null, 'bestForScope: resolves best in-scope brief without a topic');
ok(brief.bestForScope(activeBriefs, { market: 'FR', locale: 'en-CA', channel: 'organic_social', now: isoNow() }) === null, 'bestForScope: wrong market → null');
ok(brief.bestForScope(activeBriefs, { market: 'CA', locale: 'en-CA', channel: 'paid', now: isoNow() }) === null, 'bestForScope: channel not allowed → null');
// consult is OFF/invisible by default
delete process.env.KODA_TREND_ENABLE;
ok(agent.guidanceFor('m_ag', { market: 'CA', locale: 'en-CA', channel: 'organic_social' }) === null, 'guidanceFor: null (invisible) unless KODA_TREND_ENABLE=1');
process.env.KODA_TREND_ENABLE = '1';
const g = agent.guidanceFor('m_ag', { market: 'CA', locale: 'en-CA', channel: 'organic_social' });
ok(g && g.brief_id === hi.brief.brief_id, 'guidanceFor: returns guidance from the approved brief when enabled');
ok(g && Array.isArray(g.prohibited_claims), 'guidanceFor: carries prohibited_claims guardrail');
delete process.env.KODA_TREND_ENABLE;
// growth.steer: null guidance → byte-identical; guidance → gap-fill + guard, never override
const s0 = growth.steer({ country: 'CA', language: 'en' }, { audience: 'my regulars' }, null);
ok(s0.system === growth.AI_SYSTEM && s0.options.audience === 'my regulars', 'steer: no guidance → unchanged system + options');
const s1 = growth.steer({ country: 'CA', language: 'en' }, {}, g || { audience: 'Small teams', objective: 'trial starts', intent: 'evaluate onboarding', prohibited_claims: ['guaranteed'] });
ok(s1.options.audience === 'Small teams' && s1.options.objective === 'trial starts', 'steer: gap-fills audience/objective from brief');
ok(s1.system.includes('Never make any of these claims') && s1.system.includes('guaranteed'), 'steer: adds prohibited-claims guardrail to the system prompt');
const s2 = growth.steer({ country: 'CA', language: 'en' }, { audience: 'walk-in customers' }, g || { audience: 'Small teams' });
ok(s2.options.audience === 'walk-in customers', 'steer: never overrides a merchant-typed audience');
ok(growth.channelFor('social_post') === 'organic_social' && growth.channelFor('email_campaign') === 'lifecycle', 'channelFor: maps growth tools to spec channels');

// loop stays invisible/off unless explicitly enabled
delete process.env.KODA_TREND_ENABLE;
ok(agent.startTrendLoop(() => {}) === null, 'startTrendLoop: no-op (null) unless KODA_TREND_ENABLE=1');

try { fs.rmSync(process.env.KODA_DATA_DIR, { recursive: true, force: true }); } catch {}
console.log(`trend-intel: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
