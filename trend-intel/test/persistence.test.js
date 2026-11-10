// Conformance: TI-01 (idempotent ingest / changed-hash conflict) and
// TI-02 (cross-tenant isolation) on the node:sqlite persistence layer.
'use strict';
const DB = require('../src/db');
const { ingestObservations } = require('../src/ingest');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('✓ ' + m); } else { fail++; console.log('✗ FAIL ' + m); } };

const db = DB.open(':memory:');
const admin = DB.admin(db);
const A = admin.createInstallation({ installation_id: 'inst_A', org: 'org_a', platform_slug: 'subs_ca', default_market: 'CA', default_locale: 'en-CA' });
const B = admin.createInstallation({ installation_id: 'inst_B', org: 'org_b', platform_slug: 'store_fr', default_market: 'FR', default_locale: 'fr-FR' });
const sA = DB.scoped(db, A);
const sB = DB.scoped(db, B);
sA.registerSource({ source_id: 'firstparty_search', access_path: 'host_mediated', source_family: 'internal_search', quality: 80 });
sB.registerSource({ source_id: 'firstparty_search', access_path: 'host_mediated', source_family: 'internal_search', quality: 80 });

const rec = { source_record_id: 'rec_1', observed_at: '2026-11-10T09:00:00Z', window_start: '2026-11-10T08:00:00Z', window_end: '2026-11-10T09:00:00Z', geography: 'CA', metric: 'count', value: 42, unit: 'events' };

// ── TI-01: replayed ingestion ────────────────────────────────────────────────
const r1 = ingestObservations(sA, 'firstparty_search', [rec]);
ok(r1.accepted === 1 && r1.duplicate === 0, 'TI-01 first ingest accepts once');
const r2 = ingestObservations(sA, 'firstparty_search', [rec]);
ok(r2.accepted === 0 && r2.duplicate === 1, 'TI-01 exact replay is a duplicate, not re-inserted');
ok(sA.countObservations() === 1, 'TI-01 only one row persisted after replay');
// same key (rec_1, rev 1) with a DIFFERENT value -> different hash -> conflict (409)
const r3 = ingestObservations(sA, 'firstparty_search', [{ ...rec, value: 99 }]);
ok(r3.conflict === 1 && r3.accepted === 0, 'TI-01 same key + changed content returns conflict');
ok(sA.countObservations() === 1, 'TI-01 conflicting record is not stored');
// a genuinely new record is accepted
const r4 = ingestObservations(sA, 'firstparty_search', [{ ...rec, source_record_id: 'rec_2' }]);
ok(r4.accepted === 1 && sA.countObservations() === 2, 'TI-01 a new record is accepted');

// unregistered source -> whole batch rejected
const r5 = ingestObservations(sA, 'no_such_source', [rec]);
ok(r5.rejected === 1 && r5.errors[0].code === 'unregistered_source', 'ingest rejects an unregistered source');

// ── TI-02: cross-tenant isolation ────────────────────────────────────────────
// B ingests its OWN record that happens to share the same source_record_id.
ingestObservations(sB, 'firstparty_search', [{ ...rec, geography: 'FR', value: 7 }]);
ok(sB.countObservations() === 1, 'B has exactly its own one observation');
ok(sA.countObservations() === 2, "A's count is unchanged by B's ingest (no bleed)");
// A cannot read B's row and vice-versa, even by the same id.
const aSeesB = sA.getObservation('firstparty_search', 'rec_1', 1);
ok(aSeesB && aSeesB.value === 42, 'A reading rec_1 gets ITS OWN value (42), never B\'s (7)');
const bSeesA = sB.getObservation('firstparty_search', 'rec_2', 1); // rec_2 exists only for A
ok(!bSeesA, 'B cannot see A-only record rec_2 (cross-scope id resolves to nothing)');
// scope is mandatory
let threw = false; try { DB.scoped(db, ''); } catch { threw = true; }
ok(threw, 'scoped() refuses an empty installation scope');

console.log(`\n${fail ? '✗' : '✅'} persistence: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
