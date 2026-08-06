// KODA — purge all demo/seed data for going live. Dry-run by default (shows what
// it WOULD delete); pass --commit to actually delete. Targets the seeded demo,
// portfolio, platform, distributor and reseller accounts (every seed user uses an
// @koda.africa address) and cascades to all their data. Real merchants (any other
// email domain) are never touched.
//   node backend/tools/purge-demo.js            # dry run
//   node backend/tools/purge-demo.js --commit   # actually delete
'use strict';
const { q, tx } = require('../lib/db');
const commit = process.argv.includes('--commit');

// 1) demo merchants = those owned by an @koda.africa user, plus their sub-merchants
const demoUsers = q.all(`SELECT id, merchant_id FROM users WHERE email LIKE '%@koda.africa'`);
const mids = new Set(demoUsers.map(u => u.merchant_id).filter(Boolean));
for (const child of q.all(`SELECT id FROM merchants WHERE parent_id IN (${[...mids].map(() => '?').join(',') || 'NULL'})`, ...mids)) mids.add(child.id);
const M = [...mids];
const inM = M.length ? `merchant_id IN (${M.map(() => '?').join(',')})` : '0';

// tables scoped by merchant_id (billing_accounts keyed by account_key, handled separately)
// tables with a merchant_id column (billing_ledger is keyed by account_key — handled below)
const TABLES = ['api_keys', 'devices', 'sms_ledger', 'intents', 'receipts', 'replay_index',
  'disputes', 'webhook_endpoints', 'webhook_deliveries', 'acu_transactions', 'invoices',
  'notifications', 'comm_deliveries', 'merchant_network_accounts', 'topups', 'distributors'];
const acctKeys = M.flatMap(id => [`merchant:${id}`, `distributor:${id}`]);
const inK = acctKeys.length ? `account_key IN (${acctKeys.map(() => '?').join(',')})` : '0';

const plan = {};
for (const t of TABLES) plan[t] = M.length ? q.get(`SELECT COUNT(*) c FROM ${t} WHERE ${inM}`, ...M).c : 0;
plan.users = q.get(`SELECT COUNT(*) c FROM users WHERE email LIKE '%@koda.africa'`).c;
plan.merchants = M.length ? q.get(`SELECT COUNT(*) c FROM merchants WHERE id IN (${M.map(() => '?').join(',')})`, ...M).c : 0;
plan.comm_prefs = q.get(`SELECT COUNT(*) c FROM comm_prefs WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@koda.africa')`).c;
plan.audit_log = M.length ? q.get(`SELECT COUNT(*) c FROM audit_log WHERE ${inM}`, ...M).c : 0;
plan.resellers = q.get(`SELECT COUNT(*) c FROM resellers WHERE legal_name IN ('Accra Digital Reseller Ltd')`).c;
plan.vouchers = q.get(`SELECT COUNT(*) c FROM vouchers WHERE reseller_id IN (SELECT id FROM resellers WHERE legal_name='Accra Digital Reseller Ltd')`).c;
plan.billing_ledger = acctKeys.length ? q.get(`SELECT COUNT(*) c FROM billing_ledger WHERE ${inK}`, ...acctKeys).c : 0;

console.log(`\nKODA demo purge — ${commit ? 'COMMIT' : 'DRY RUN'}`);
console.log(`  demo merchants: ${M.length}  ·  demo users: ${plan.users}`);
console.log('  rows to delete:', JSON.stringify(plan));

if (!commit) { console.log('\nDry run only. Re-run with --commit to delete.\n'); process.exit(0); }

tx(() => {
  q.run(`DELETE FROM vouchers WHERE reseller_id IN (SELECT id FROM resellers WHERE legal_name='Accra Digital Reseller Ltd')`);
  q.run(`DELETE FROM resellers WHERE legal_name='Accra Digital Reseller Ltd'`);
  q.run(`DELETE FROM comm_prefs WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@koda.africa')`);
  if (M.length) { for (const t of TABLES) q.run(`DELETE FROM ${t} WHERE ${inM}`, ...M); q.run(`DELETE FROM audit_log WHERE ${inM}`, ...M); }
  if (acctKeys.length) q.run(`DELETE FROM billing_ledger WHERE ${inK}`, ...acctKeys);
  q.run(`DELETE FROM users WHERE email LIKE '%@koda.africa'`);
  if (M.length) q.run(`DELETE FROM merchants WHERE id IN (${M.map(() => '?').join(',')})`, ...M);
  // reset billing treasury/KD ledger accounts left dangling
  q.run(`DELETE FROM billing_accounts WHERE account_key LIKE 'distributor:%' OR account_key='koda:treasury'`);
});
console.log('\n✓ demo data purged. Set a real admin with: node backend/tools/make-admin.js <email> <password>\n');
