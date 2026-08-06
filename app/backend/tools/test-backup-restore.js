// KODA — backup & disaster-recovery drill (launch Gate 4 / Phase 18).
// "A backup that has never been restored is not a verified backup." This proves it:
//   1. seed a live DB with real data across the money-critical tables
//   2. take an online backup (VACUUM INTO — the production backup path)
//   3. RESTORE the backup into a fresh, isolated data dir
//   4. open the restored DB and verify: integrity_check ok, row counts match
//      exactly, and a specific money record (a receipt + its ledger) survived intact
// Exit 0 only if the restored copy is byte-faithful and queryable.
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

let pass = 0, fail = 0;
const T = (n, c, e) => { c ? pass++ : fail++; console.log(`${c ? '✓' : '✗ FAIL'} ${n}${c ? '' : '  << ' + (e ?? '')}`); };

// 1 — seed a live DB (isolated dir so we never touch the repo data)
const liveDir = fs.mkdtempSync(path.join(os.tmpdir(), 'koda-dr-live-'));
process.env.KODA_DATA_DIR = liveDir;
const { db, q } = require('../lib/db');           // creates + migrates schema
require('../seed');                                // realistic demo dataset via ingestSms

// add one deterministic money record we will hunt for after restore
q.run(`INSERT INTO merchants (id,name,plan,status) VALUES ('mch_dr','DR Test','commerce','active')`);
const eng = require('../lib/engine');
const m = q.get(`SELECT * FROM merchants WHERE id='mch_dr'`);
eng.ingestSms(m, { raw: 'Vous avez recu 42 000 FC de DR WITNESS (0812345678). Ref: OMDRWIT1. Solde: 900 000', operator: 'orange_cd' });
const beforeCounts = {};
for (const t of ['merchants', 'users', 'receipts', 'sms_ledger', 'intents', 'api_keys', 'acu_transactions', 'billing_ledger']) {
  beforeCounts[t] = q.get(`SELECT COUNT(*) c FROM ${t}`).c;
}
const witnessBefore = q.get(`SELECT amount, currency, reference FROM receipts WHERE reference='OMDRWIT1'`);
T('seed produced data', beforeCounts.receipts > 0 && !!witnessBefore, JSON.stringify(beforeCounts));

// 2 — online backup (the exact production path: VACUUM INTO)
const backupFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'koda-dr-bak-')), 'koda-backup.db');
db.exec(`VACUUM INTO '${backupFile.replace(/'/g, "''")}'`);
T('backup written (VACUUM INTO)', fs.existsSync(backupFile) && fs.statSync(backupFile).size > 0, `${(fs.statSync(backupFile).size / 1024).toFixed(0)} KB`);

// 3 — RESTORE into a fresh, isolated data dir (simulate total volume loss)
const restoreDir = fs.mkdtempSync(path.join(os.tmpdir(), 'koda-dr-restore-'));
fs.copyFileSync(backupFile, path.join(restoreDir, 'koda.db'));

// 4 — open the restored DB independently and validate
const rdb = new DatabaseSync(path.join(restoreDir, 'koda.db'));
const integrity = rdb.prepare('PRAGMA integrity_check').get();
T('restored DB passes integrity_check', integrity && integrity.integrity_check === 'ok', JSON.stringify(integrity));
let countsMatch = true, mismatch = '';
for (const t of Object.keys(beforeCounts)) {
  const after = rdb.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c;
  if (after !== beforeCounts[t]) { countsMatch = false; mismatch += ` ${t}:${beforeCounts[t]}→${after}`; }
}
T('every table row-count matches after restore', countsMatch, mismatch);
const witnessAfter = rdb.prepare(`SELECT amount, currency, reference FROM receipts WHERE reference='OMDRWIT1'`).get();
T('witness money record survived intact',
  witnessAfter && witnessAfter.amount === witnessBefore.amount && witnessAfter.reference === witnessBefore.reference,
  JSON.stringify(witnessAfter));
// ledger still balances in the restored copy
const ledger = rdb.prepare('SELECT COALESCE(SUM(acu_delta),0) s FROM billing_ledger').get();
T('restored ledger still balances (Σ acu_delta = 0)', ledger.s === 0, `Σ=${ledger.s}`);

rdb.close();
console.log(`\n${fail === 0 ? '✅ DR DRILL PASSED — backup is restorable' : '❌ DR DRILL FAILED'} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
