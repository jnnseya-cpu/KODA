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

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ FAIL ' + m); } };
const approx = (a, b) => Math.abs(a - b) <= 1e-9;

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

try { fs.rmSync(process.env.KODA_DATA_DIR, { recursive: true, force: true }); } catch {}
console.log(`trend-intel: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
