// KODA — backup/restore DRILL (automated). Proves a backup is actually restorable:
// seed a DB → snapshot via VACUUM INTO → open the snapshot as a fresh database →
// integrity_check + row counts must match the source. "A backup that has never
// been restored is not a verified backup" — this test verifies one every run.
'use strict';
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');

process.env.KODA_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'koda-bak-'));
process.env.KODA_QUIET = '1';
const { db } = require('../lib/db');
require('../seed');                          // creates merchants/users/receipts/etc.

let pass = 0, fail = 0;
const ok = (c, m, x = '') => { c ? (pass++, console.log(`  ✓ ${m} ${x}`)) : (fail++, console.log(`  ✗ ${m} ${x}`)); };
const TABLES = ['merchants', 'users', 'receipts', 'sms_ledger', 'acu_transactions', 'distributors', 'resellers'];
const countAll = (h) => Object.fromEntries(TABLES.map(t => { try { return [t, h.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c]; } catch { return [t, -1]; } }));

console.log('\nKODA — backup / restore drill\n');
const src = countAll(db);
ok(src.merchants > 0 && src.users > 0, 'source DB has seeded data', JSON.stringify(src));

// snapshot (same mechanism as backup.js) then mutate the source to prove the
// snapshot is a point-in-time copy, not a live view.
const backup = path.join(process.env.KODA_DATA_DIR, 'drill-backup.db');
db.exec(`VACUUM INTO '${backup.replace(/'/g, "''")}'`);
ok(fs.existsSync(backup) && fs.statSync(backup).size > 0, 'backup snapshot written', `${(fs.statSync(backup).size / 1024).toFixed(0)} KB`);
db.exec(`INSERT INTO resellers (id,legal_name,country,status) VALUES ('res_after','After Snapshot','CD','ACTIVE')`);

// open the snapshot as a brand-new database (simulates restore into a clean host)
const restored = new DatabaseSync(backup, { readOnly: true });
const integ = restored.prepare('PRAGMA integrity_check').get();
ok(integ && integ.integrity_check === 'ok', 'restored DB passes integrity_check');
const got = countAll(restored);
restored.close();

// every table must match the source AT SNAPSHOT TIME (not the post-snapshot mutation)
let matched = true;
for (const t of TABLES) if (got[t] !== src[t]) { matched = false; ok(false, `table ${t} count matches`, `src=${src[t]} restored=${got[t]}`); }
ok(matched, 'all table row counts match the source snapshot', JSON.stringify(got));
ok(got.resellers === src.resellers, 'snapshot is point-in-time (excludes the post-snapshot insert)', `restored=${got.resellers} vs live=${src.resellers + 1}`);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
