// KODA — Voucher rail (System B, Rail 4a). Single-use, Ed25519-signed, product- and
// market-locked, PIN stored hashed. Redemption is atomic and replay-safe. Uses only
// node:crypto — no new dependency. The reseller prepurchases inventory, then issues
// vouchers; redemption posts a double-entry entitlement into the billing ledger.
'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { q, DATA_DIR } = require('./db');
const U = require('./util');
const billing = require('./billing');

// ── signing key (persisted so restarts keep verifying old vouchers) ───────────
function loadKeys() {
  if (process.env.KODA_VOUCHER_PRIVATE_KEY && process.env.KODA_VOUCHER_PUBLIC_KEY) {
    return { priv: process.env.KODA_VOUCHER_PRIVATE_KEY, pub: process.env.KODA_VOUCHER_PUBLIC_KEY };
  }
  const file = path.join(DATA_DIR || '.', 'voucher_ed25519.json');
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* generate */ }
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const keys = {
    priv: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    pub: publicKey.export({ type: 'spki', format: 'pem' }),
  };
  try { fs.writeFileSync(file, JSON.stringify(keys)); } catch { /* ephemeral is fine for tests */ }
  return keys;
}
const KEYS = loadKeys();
const b64u = (buf) => Buffer.from(buf).toString('base64url');
const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

function sign(payload) {
  const body = b64u(JSON.stringify(payload));
  const sig = crypto.sign(null, Buffer.from(body), KEYS.priv);      // ed25519: algorithm = null
  return body + '.' + b64u(sig);
}
function verifySignature(token) {
  try {
    const [body, sig] = String(token).split('.');
    if (!body || !sig) return null;
    const ok = crypto.verify(null, Buffer.from(body), KEYS.pub, Buffer.from(sig, 'base64url'));
    return ok ? JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) : null;
  } catch { return null; }
}

// human PIN, e.g. KODA-GH-7PX9-2RMD-8KWA (country + 12 chars). We store only its hash.
function makePin(country) {
  const chunk = () => U.token(3).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4).padEnd(4, 'X');
  return `KODA-${(country || 'XX').toUpperCase()}-${chunk()}-${chunk()}-${chunk()}`;
}

// ── issue a batch (reseller prepurchase already cleared upstream) ─────────────
function issueBatch(reseller, { product_code = 'ACU_TOPUP', acu_amount = 0, quantity = 1, country_lock, currency_lock, expires_at } = {}) {
  const qty = Math.min(1000, Math.max(1, Math.round(quantity)));
  const acu = Math.round(Number(acu_amount) || 0);
  const batchId = U.id('batch');
  const out = [];
  for (let i = 0; i < qty; i++) {
    const vid = U.id('vch');
    const pin = makePin(country_lock);
    const payload = {
      version: 1, voucher_id: vid, batch_id: batchId, reseller_id: reseller.id,
      product_code, acu_amount: acu, country_lock: country_lock || null,
      currency_lock: currency_lock || null, expires_at: expires_at || null, nonce: U.token(4),
    };
    const signature = sign(payload);
    q.run(`INSERT INTO vouchers (id,batch_id,reseller_id,product_code,acu_amount,country_lock,currency_lock,pin_hash,signature,status,expires_at)
           VALUES (?,?,?,?,?,?,?,?,?, 'dormant', ?)`,
      vid, batchId, reseller.id, product_code, acu, country_lock || null, currency_lock || null,
      sha256(pin), signature, expires_at || null);
    out.push({ voucher_id: vid, pin });                 // PIN shown ONCE, to the reseller
  }
  return { batch_id: batchId, product_code, acu_amount: acu, quantity: qty, vouchers: out };
}

// dead stock until the reseller activates the batch (anti-theft of un-distributed PINs)
function activateBatch(batchId) {
  const n = q.run(`UPDATE vouchers SET status='active', activated_at=datetime('now') WHERE batch_id=? AND status='dormant'`, batchId);
  return { ok: true, batch_id: batchId, activated: n.changes };
}
function voidBatch(batchId) {
  const n = q.run(`UPDATE vouchers SET status='void' WHERE batch_id=? AND status IN ('dormant','active')`, batchId);
  return { ok: true, batch_id: batchId, voided: n.changes };
}

// ── redeem (atomic, replay-safe, all guards enforced) ─────────────────────────
function redeem(merchant, pin) {
  const v = q.get('SELECT * FROM vouchers WHERE pin_hash=?', sha256(String(pin || '').trim()));
  if (!v) return [404, { error: { code: 'voucher_not_found' } }];
  if (v.status === 'redeemed') return [409, { error: { code: 'already_redeemed' } }];
  if (v.status !== 'active') return [409, { error: { code: 'not_active', message: 'voucher not activated by the reseller yet' } }];
  if (v.expires_at && new Date(v.expires_at + 'Z').getTime() < Date.now()) {
    q.run(`UPDATE vouchers SET status='void' WHERE id=?`, v.id);
    return [410, { error: { code: 'expired' } }];
  }
  const payload = verifySignature(v.signature);          // cryptographic authenticity
  if (!payload || payload.voucher_id !== v.id) return [400, { error: { code: 'bad_signature' } }];
  const reseller = q.get('SELECT * FROM resellers WHERE id=?', v.reseller_id);
  if (!reseller || reseller.status !== 'ACTIVE') return [409, { error: { code: 'reseller_inactive' } }];
  if (v.country_lock && v.country_lock !== merchant.country) return [409, { error: { code: 'country_locked', lock: v.country_lock } }];

  // atomic: mark redeemed (guarded so a concurrent second redeem loses), then entitle.
  const upd = q.run(`UPDATE vouchers SET status='redeemed', redeemed_at=datetime('now'), redeemed_by=? WHERE id=? AND status='active'`, merchant.id, v.id);
  if (upd.changes !== 1) return [409, { error: { code: 'already_redeemed' } }]; // lost the race
  let credited = 0;
  if (v.acu_amount > 0) {
    billing.post([
      { account_key: 'koda:treasury', entry_type: 'voucher_redeem', acu_delta: -v.acu_amount },
      { account_key: 'merchant:' + merchant.id, entry_type: 'topup_credit', acu_delta: v.acu_amount },
    ], { idempotencyKey: 'voucher:' + v.id, ref: 'voucher' });
    require('./engine').creditAcu(merchant, v.acu_amount, 'topup', v.id);
    credited = v.acu_amount;
  }
  require('./engine').notifyOwners(merchant, 'billing.topup.verified', { acu: credited });
  return { ok: true, voucher_id: v.id, product_code: v.product_code, acu_credited: credited };
}

module.exports = { issueBatch, activateBatch, voidBatch, redeem, sign, verifySignature, publicKeyPem: () => KEYS.pub };
