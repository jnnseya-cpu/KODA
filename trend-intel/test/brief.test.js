// Conformance: Growth Brief v1 schema (Appendix A), runtime rules (§507),
// effective-brief resolution, and TI-05 (expired brief → baseline fallback).
'use strict';
const B = require('../src/brief');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('✓ ' + m); } else { fail++; console.log('✗ FAIL ' + m); } };

// Canonical positive fixture — the §6 JSON, verbatim.
const FIXTURE = {
  schema_version: 1, brief_id: 'gb_104', brief_version: 3, tenant_id: 'tenant_demo',
  platform_id: 'fixture_platform_a', market: 'CA', locale: 'en-CA', topic_id: 'simpler-team-onboarding',
  opportunity_score: 86.25, confidence: 83.5, valid_from: '2026-11-10T10:00:00Z', expires_at: '2026-11-17T10:00:00Z',
  evidence_ids: ['ev_341', 'ev_342'], audience: 'Small teams comparing onboarding options',
  intent: 'evaluate how to onboard a small team', approved_claim_ids: ['claim_onboarding_01'],
  cta_id: 'cta_view_onboarding_guide', allowed_channels: ['seo', 'organic_social'],
  prohibited_claims: ['guaranteed onboarding time', 'unsupported third-party endorsements'],
  objective: 'qualified trial starts per eligible session', experiment_id: 'exp_91', policy_version: 5,
};
const NOW = '2026-11-12T10:00:00Z'; // inside the fixture's validity window

// ── schema (Appendix A) ──────────────────────────────────────────────────────
ok(B.validateBrief(FIXTURE).ok, '§6 canonical fixture validates');
const extra = B.validateBrief({ ...FIXTURE, sneaky: 1 });
ok(!extra.ok && extra.errors.some((e) => e.code === 'unknown_field'), 'closed object rejects an extra field');
const { schema_version, ...missing } = FIXTURE;
ok(!B.validateBrief(missing).ok, 'missing required field is rejected');
ok(!B.validateBrief({ ...FIXTURE, schema_version: 2 }).ok, 'schema_version must be 1');
ok(!B.validateBrief({ ...FIXTURE, market: 'CAN' }).ok, 'market must be ISO alpha-2');
ok(!B.validateBrief({ ...FIXTURE, opportunity_score: 101 }).ok, 'score out of 0–100 is rejected');
ok(!B.validateBrief({ ...FIXTURE, allowed_channels: ['seo', 'telepathy'] }).ok, 'unknown channel is rejected');
ok(!B.validateBrief({ ...FIXTURE, allowed_channels: [] }).ok, 'empty channel set is rejected');
ok(!B.validateBrief({ ...FIXTURE, evidence_ids: [] }).ok, 'evidence_ids needs at least one');
ok(!B.validateBrief({ ...FIXTURE, valid_from: '2026-11-10T10:00:00+00:00' }).ok, 'non-Z UTC is rejected');
ok(!B.validateBrief({ ...FIXTURE, brief_version: 0 }).ok, 'brief_version must be >= 1');

// ── runtime rules (§507) ─────────────────────────────────────────────────────
ok(B.checkRuntime(FIXTURE, { now: NOW, activeMarket: 'CA', installedLocales: ['en-CA'], channel: 'seo' }).ok, 'runtime passes in-window, in-scope');
ok(!B.checkRuntime(FIXTURE, { now: '2026-12-01T00:00:00Z' }).ok, 'expired brief fails runtime freshness');
ok(!B.checkRuntime(FIXTURE, { now: NOW, channel: 'paid' }).ok, 'channel not in allowed_channels fails');
ok(!B.checkRuntime(FIXTURE, { now: NOW, activeMarket: 'US' }).ok, 'market mismatch fails');
ok(!B.checkRuntime(FIXTURE, { now: NOW, installedLocales: ['fr-FR'] }).ok, 'locale not installed fails');
ok(!B.checkRuntime({ ...FIXTURE, valid_from: '2026-11-20T00:00:00Z' }, { now: NOW }).ok, 'valid_from after expires_at fails');

// ── ZZ market rule (§301) ────────────────────────────────────────────────────
ok(B.marketMatches('CA', 'CA'), 'CA matches CA');
ok(!B.marketMatches('ZZ', 'CA'), 'ZZ (global) does not match a CA lookup by default');
ok(!B.marketMatches('CA', 'FR'), 'CA does not match FR');

// ── effective-brief resolution + TI-05 ───────────────────────────────────────
const q = { market: 'CA', locale: 'en-CA', topic_id: 'simpler-team-onboarding', channel: 'seo', now: NOW };
ok(B.resolveEffective([FIXTURE], q) === FIXTURE, 'resolves the matching fresh brief');
// newest version wins
const v4 = { ...FIXTURE, brief_version: 4 };
ok(B.resolveEffective([FIXTURE, v4], q).brief_version === 4, 'resolves the newest brief version');
// TI-05: the only candidate has expired → no effective brief (SDK falls back to baseline)
ok(B.resolveEffective([FIXTURE], { ...q, now: '2026-12-01T00:00:00Z' }) === null, 'TI-05 expired brief resolves to null (baseline fallback)');
// out-of-scope channel/locale/topic → no match
ok(B.resolveEffective([FIXTURE], { ...q, channel: 'lifecycle' }) === null, 'non-allowed channel resolves to null');
ok(B.resolveEffective([FIXTURE], { ...q, locale: 'fr-FR' }) === null, 'different locale resolves to null');

console.log(`\n${fail ? '✗' : '✅'} brief: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
