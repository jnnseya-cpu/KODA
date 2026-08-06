// KODA — permanently delete a merchant and ALL its data, respecting foreign keys.
// Deletes child rows across every merchant-scoped table (and billing rows keyed by
// account_key), detaches or removes its users, then the merchant itself — all in one
// transaction. Use to remove a mistakenly-created / orphaned merchant.
//   node backend/tools/delete-merchant.js --name "Groupe Nseya Digital"
//   node backend/tools/delete-merchant.js --id mch_xxx
// Admin users on the merchant are DETACHED (merchant_id=NULL, kept); non-admin users
// are deleted with the merchant.
'use strict';
const { q, tx } = require('../lib/db');

const args = process.argv.slice(2);
const byId = args.includes('--id') ? args[args.indexOf('--id') + 1] : null;
const byName = args.includes('--name') ? args[args.indexOf('--name') + 1] : null;
if (!byId && !byName) { console.error('usage: delete-merchant.js --name "<name>" | --id <mch_id>'); process.exit(2); }

const m = byId ? q.get('SELECT * FROM merchants WHERE id=?', byId)
              : q.get('SELECT * FROM merchants WHERE name=?', byName);
if (!m) { console.log('no matching merchant — nothing to delete.'); process.exit(0); }
const id = m.id;

// every table with a merchant_id column (child rows must go before the merchant row)
const TABLES = ['api_keys', 'devices', 'sms_ledger', 'intents', 'receipts', 'replay_index',
  'disputes', 'webhook_endpoints', 'webhook_deliveries', 'acu_transactions', 'invoices',
  'notifications', 'comm_deliveries', 'merchant_network_accounts', 'topups', 'distributors', 'audit_log'];
const acctKeys = [`merchant:${id}`, `distributor:${id}`];

tx(() => {
  // comm_prefs are keyed by user_id → clear for this merchant's users first
  q.run(`DELETE FROM comm_prefs WHERE user_id IN (SELECT id FROM users WHERE merchant_id=?)`, id);
  for (const t of TABLES) { try { q.run(`DELETE FROM ${t} WHERE merchant_id=?`, id); } catch { /* table may lack the column */ } }
  q.run(`DELETE FROM billing_ledger WHERE account_key IN (${acctKeys.map(() => '?').join(',')})`, ...acctKeys);
  q.run(`DELETE FROM billing_accounts WHERE account_key IN (${acctKeys.map(() => '?').join(',')})`, ...acctKeys);
  // keep admin staff (detach), delete ordinary users
  q.run(`UPDATE users SET merchant_id=NULL WHERE merchant_id=? AND is_admin=1`, id);
  q.run(`DELETE FROM users WHERE merchant_id=? AND (is_admin=0 OR is_admin IS NULL)`, id);
  q.run(`DELETE FROM merchants WHERE id=?`, id);
});
console.log(`✓ deleted merchant "${m.name}" (${id}) and all its data. Admin users detached, kept.`);
