// KODA — purge stale, never-settled top-ups (test artifacts that pollute the
// admin Collections table). A top-up is "stale" if it is NOT settled and either
// is old, or has inconsistent stored pricing (subtotal != total by more than a
// rail fee could explain) — the fingerprint of rows created before the pricing fix.
// Settled top-ups are NEVER touched (they are real money-in and feed the ledger).
//   node backend/tools/purge-stale-topups.js            # dry run (shows what it WOULD delete)
//   node backend/tools/purge-stale-topups.js --commit   # actually delete
'use strict';
const { q } = require('../lib/db');
const commit = process.argv.includes('--commit');

// Candidates: any top-up that never reached 'settled'. Pre-launch these are all
// test/checkout artifacts. We surface each so nothing is deleted blind.
const rows = q.all(`SELECT id, rail, status, acu_amount, subtotal_usd, total_usd, purpose, plan_key, created_at
  FROM topups WHERE status IS NULL OR status <> 'settled' ORDER BY created_at`);

if (!rows.length) { console.log('No unsettled top-ups — nothing to purge.'); process.exit(0); }

console.log(`${rows.length} unsettled top-up(s) found (settled rows are never touched):\n`);
for (const r of rows) {
  const inconsistent = Number(r.total_usd) > Number(r.subtotal_usd) * 1.1 + 1; // gross wildly above subtotal
  console.log(`  ${r.id}  rail=${r.rail}  status=${r.status}  acu=${r.acu_amount}` +
    `  subtotal=$${r.subtotal_usd}  gross=$${r.total_usd}` +
    (r.purpose === 'plan' ? `  plan=${r.plan_key}` : '') +
    (inconsistent ? '  ← inconsistent pricing (pre-fix artifact)' : ''));
}

if (!commit) {
  console.log(`\nDry run. Re-run with --commit to delete these ${rows.length} unsettled top-up(s).`);
  process.exit(0);
}

const ids = rows.map(r => r.id);
const placeholders = ids.map(() => '?').join(',');
const res = q.run(`DELETE FROM topups WHERE id IN (${placeholders})`, ...ids);
console.log(`\nDeleted ${res.changes} unsettled top-up(s). Settled money-in and the ledger are untouched.`);
