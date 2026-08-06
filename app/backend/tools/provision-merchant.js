// KODA — attach a working merchant tenant to an existing user, so one login can
// both administer the platform (#admin) AND operate the product (Verify Console,
// Feed, Receipts, Billing, Developers…). Also mints a Door-3 sk_test API key so
// you can test the API immediately. Existing admin flag/role are preserved.
//   node backend/tools/provision-merchant.js <email> "<Business name>" [plan] [country] [currency]
// e.g.
//   node backend/tools/provision-merchant.js koda@kodajnn.com "Groupe Nseya Digital" plateforme CD CDF
'use strict';
const { q } = require('../lib/db');
const U = require('../lib/util');

const email = (process.argv[2] || '').toLowerCase().trim();
const business = process.argv[3] || '';
const plan = process.argv[4] || 'plateforme';
const country = process.argv[5] || 'CD';
const currency = process.argv[6] || 'CDF';
if (!email || !business) { console.error('usage: provision-merchant.js <email> "<Business name>" [plan] [country] [currency]'); process.exit(2); }

const user = q.get('SELECT * FROM users WHERE email=?', email);
if (!user) { console.error(`no user with email ${email} — create it first (make-admin.js or signup).`); process.exit(2); }

let mid = user.merchant_id;
if (mid && q.get('SELECT id FROM merchants WHERE id=?', mid)) {
  console.log(`• ${email} already owns merchant ${mid} — reusing it.`);
} else {
  mid = U.id('mch');
  q.run(`INSERT INTO merchants (id,name,country,currency,plan,msisdn,logo_text) VALUES (?,?,?,?,?,?,?)`,
    mid, business, country, currency, plan, user.phone || null, business);
  q.run(`UPDATE users SET merchant_id=? WHERE id=?`, mid, user.id);
  console.log(`✓ created merchant "${business}" (${mid}, plan=${plan}) and attached it to ${email}.`);
}

// mint a Door-3 sk_test key with full scope, unless one already exists
const existingKey = q.get(`SELECT id FROM api_keys WHERE merchant_id=? AND prefix='sk_test'`, mid);
if (existingKey) {
  console.log('• an sk_test key already exists for this merchant — create fresh ones in the app (Developers).');
} else {
  const secret = `sk_test_${U.token(24)}`;
  q.run(`INSERT INTO api_keys (id,merchant_id,prefix,key_hash,last4,label,scopes) VALUES (?,?,?,?,?,?,?)`,
    U.id('key'), mid, 'sk_test', U.sha256(secret), secret.slice(-4), 'Door 3 test (provisioned)', JSON.stringify(['*']));
  console.log(`\n  Door-3 API test key (shown once — copy it now):\n    ${secret}\n`);
}
console.log('Done. Sign in at /app — Dashboard, Verify, Feed, Billing, Developers now work; the #admin control centre is still there.');
