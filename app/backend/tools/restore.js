// KODA — restore + verify a backup. By default VALIDATES a backup file (integrity
// check + row counts) without touching the live DB — a backup you've never restored
// is not a backup. Pass --commit to actually install it as the live koda.db
//   node backend/tools/restore.js <backup.db> [--commit]
'use strict';
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const file = process.argv[2];
const commit = process.argv.includes('--commit');
if (!file || !fs.existsSync(file)) { console.error('usage: restore.js <backup.db> [--commit]'); process.exit(2); }

// open read-only and verify it's a sound, complete SQLite database
const b = new DatabaseSync(file, { readOnly: true });
const integrity = b.prepare('PRAGMA integrity_check').get();
const ok = integrity && (integrity.integrity_check === 'ok');
const TABLES = ['merchants', 'users', 'receipts', 'sms_ledger', 'acu_transactions', 'topups', 'billing_ledger', 'vouchers'];
const counts = {};
for (const t of TABLES) { try { counts[t] = b.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c; } catch { counts[t] = 'n/a'; } }
b.close();

console.log(`\nrestore verify · ${file}`);
console.log(`  integrity_check: ${ok ? 'ok ✓' : 'FAILED ✗'}`);
console.log('  row counts:', JSON.stringify(counts));

if (!ok) { console.error('\n✗ backup failed integrity check — NOT restoring.'); process.exit(1); }

if (commit) {
  const DATA_DIR = process.env.KODA_DATA_DIR || path.join(__dirname, '..', '..', 'data');
  const live = path.join(DATA_DIR, 'koda.db');
  // stop the app first in production. Copy over the live DB (+ remove stale WAL/SHM).
  fs.copyFileSync(file, live);
  for (const ext of ['-wal', '-shm']) { try { fs.unlinkSync(live + ext); } catch {} }
  console.log(`\n✓ restored into ${live} — restart the app.`);
} else {
  console.log('\n✓ backup is valid and restorable. Re-run with --commit to install it as live.');
}
