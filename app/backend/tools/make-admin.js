// KODA — create or reset a full-access admin (KODA staff, is_admin=1).
//   node backend/tools/make-admin.js <email> <password>
// If the email exists, its password is reset and it's promoted to admin.
'use strict';
const { q } = require('../lib/db');
const U = require('../lib/util');

const email = (process.argv[2] || '').toLowerCase().trim();
const password = process.argv[3] || '';
if (!email || !password) { console.error('usage: make-admin.js <email> <password>'); process.exit(2); }
if (password.length < 10) { console.error('choose a password of at least 10 characters.'); process.exit(2); }

const existing = q.get('SELECT id FROM users WHERE email=?', email);
if (existing) {
  q.run(`UPDATE users SET pass_hash=?, is_admin=1, role='owner', status='active', merchant_id=NULL WHERE id=?`,
    U.hashPassword(password), existing.id);
  console.log(`✓ ${email} updated → full admin (password reset).`);
} else {
  q.run(`INSERT INTO users (id,merchant_id,email,name,pass_hash,role,is_admin) VALUES (?,NULL,?,?,?, 'owner',1)`,
    U.id('usr'), email, 'KODA Operations', U.hashPassword(password));
  console.log(`✓ ${email} created → full admin.`);
}
console.log('  Sign in at /app with this email + password. Admin console is at #admin.');
