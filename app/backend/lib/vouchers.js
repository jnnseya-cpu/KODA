// KODA — Voucher rail (System B, Rail 4a). Single-use, Ed25519-signed, product- and
// market-locked, PIN stored hashed. Redemption is atomic and replay-safe. Uses only
// node:crypto — no new dependency. The reseller prepurchases inventory, then issues
// vouchers; redemption posts a double-entry entitlement into the billing ledger.
'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { q, tx, DATA_DIR } = require('./db');
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
// A plan is sellable via a partner rail only if it is a genuine PAID, finite tier —
// never free Marché and never sales-gated Enterprise (usd:null). Mirrors billing's gate.
function isSellablePlan(planKey) {
  const P = require('../../shared/plans').PLANS[planKey];
  return !!(P && typeof P.usd === 'number' && P.usd > 0);
}

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
// Draw from a fixed 32-symbol Crockford-style alphabet (no I/L/O/U — unambiguous) using
// rejection-free uniform bytes, so each char carries a full 5 bits. The old approach
// uppercased base64url, collapsing a–z onto A–Z and shrinking effective entropy.
const PIN_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // 32 symbols
function makePin(country) {
  const bytes = crypto.randomBytes(12);
  const chars = Array.from(bytes, b => PIN_ALPHABET[b & 31]).join(''); // 12 chars × 5 bits = 60 bits
  const chunk = (i) => chars.slice(i * 4, i * 4 + 4);
  return `KODA-${(country || 'XX').toUpperCase()}-${chunk(0)}-${chunk(1)}-${chunk(2)}`;
}

// ── issue a batch (reseller prepurchase already cleared upstream) ─────────────
function issueBatch(reseller, { product_code = 'ACU_TOPUP', plan_key = null, acu_amount = 0, quantity = 1, country_lock, currency_lock, expires_at } = {}) {
  const qty = Math.min(1000, Math.max(1, Math.round(quantity)));
  const acu = Math.round(Number(acu_amount) || 0);
  const batchId = U.id('batch');
  const out = [];
  for (let i = 0; i < qty; i++) {
    const vid = U.id('vch');
    const pin = makePin(country_lock);
    const payload = {
      version: 1, voucher_id: vid, batch_id: batchId, reseller_id: reseller.id,
      product_code, plan_key: plan_key || null, acu_amount: acu, country_lock: country_lock || null,
      currency_lock: currency_lock || null, expires_at: expires_at || null, nonce: U.token(4),
    };
    const signature = sign(payload);
    q.run(`INSERT INTO vouchers (id,batch_id,reseller_id,product_code,plan_key,acu_amount,country_lock,currency_lock,pin_hash,signature,status,expires_at)
           VALUES (?,?,?,?,?,?,?,?,?,?, 'dormant', ?)`,
      vid, batchId, reseller.id, product_code, plan_key || null, acu, country_lock || null, currency_lock || null,
      sha256(pin), signature, expires_at || null);
    out.push({ voucher_id: vid, pin });                 // PIN shown ONCE, to the reseller
  }
  return { batch_id: batchId, product_code, plan_key: plan_key || null, acu_amount: acu, quantity: qty, vouchers: out };
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
  // TRUST THE SIGNATURE, NOT THE ROW. Every value-bearing field is read from the SIGNED
  // payload; the DB row is then cross-checked against it and any mismatch is rejected.
  // Previously redeem() acted on v.acu_amount / v.plan_key / locks straight from the row,
  // so the Ed25519 signature (which binds all of these) protected nothing — tampering the
  // row minted arbitrary ACU or granted Enterprise for pennies.
  const acuAmount = Math.round(Number(payload.acu_amount) || 0);
  const planKey = payload.plan_key || null;
  const countryLock = payload.country_lock || null;
  const currencyLock = payload.currency_lock || null;
  const resellerId = payload.reseller_id;
  const rowMatches = resellerId === v.reseller_id
    && acuAmount === Math.round(Number(v.acu_amount) || 0)
    && (planKey || null) === (v.plan_key || null)
    && (countryLock || null) === (v.country_lock || null)
    && (currencyLock || null) === (v.currency_lock || null);
  if (!rowMatches) return [409, { error: { code: 'voucher_tampered', message: 'Voucher data does not match its signature.' } }];
  // A subscription voucher may only carry a genuinely sellable plan — re-assert here so a
  // tampered/forged plan_key (e.g. 'enterprise') can never be activated via redeem, which
  // otherwise writes straight into merchants.plan with no sellable-gate.
  if (planKey && !isSellablePlan(planKey)) return [409, { error: { code: 'plan_not_sellable', plan: planKey } }];
  const reseller = q.get('SELECT * FROM resellers WHERE id=?', resellerId);
  if (!reseller || reseller.status !== 'ACTIVE') return [409, { error: { code: 'reseller_inactive' } }];
  // Anti-loophole: a reseller must not redeem their OWN vouchers into their own
  // account — that would be buying ACU at wholesale for their own consumption.
  if (reseller.merchant_id && reseller.merchant_id === merchant.id)
    return [409, { error: { code: 'self_redeem_forbidden', message: 'A reseller cannot redeem their own vouchers. Sell them to other merchants.' } }];
  if (countryLock && countryLock !== merchant.country) return [409, { error: { code: 'country_locked', lock: countryLock } }];
  if (currencyLock && String(currencyLock).toUpperCase() !== String(merchant.currency || '').toUpperCase())
    return [409, { error: { code: 'currency_locked', lock: currencyLock } }];

  // All-or-nothing: the guarded CAS flip (a concurrent second redeem loses the race)
  // AND the entitlement live in one transaction — if crediting throws, the redeemed
  // flag rolls back and the voucher stays legitimately redeemable (no lost value).
  let res;
  try {
    res = tx(() => {
    const upd = q.run(`UPDATE vouchers SET status='redeemed', redeemed_at=datetime('now'), redeemed_by=? WHERE id=? AND status='active'`, merchant.id, v.id);
    if (upd.changes !== 1) return { lost: true };
    if (acuAmount > 0) {
      // FAIL CLOSED: value is drawn ONLY from the reseller's own prepaid inventory. The
      // old treasury fallback let a reseller (or a tampered voucher) hand out value KODA
      // paid for — the exact opposite of "never give value they haven't prepaid for".
      const rkey = 'reseller:' + resellerId;
      const rbal = q.get('SELECT balance_acu FROM billing_accounts WHERE account_key=?', rkey);
      if (!rbal || rbal.balance_acu < acuAmount) throw new Error('unbacked'); // rolls back the CAS flip
      if (planKey) {
        // SUBSCRIPTION voucher: activate a 30-day plan instead of crediting ACU. The
        // prepaid value converts to KODA plan revenue (merchant gets a plan, not ACU).
        billing.post([
          { account_key: rkey, entry_type: 'voucher_plan_redeem', acu_delta: -acuAmount },
          { account_key: 'koda:plan_revenue', entry_type: 'plan_sale', acu_delta: acuAmount },
        ], { idempotencyKey: 'voucher:' + v.id, ref: 'voucher_plan' });
        billing.activatePlan(merchant.id, planKey);
        return { plan: planKey };
      }
      billing.post([
        { account_key: rkey, entry_type: 'voucher_redeem', acu_delta: -acuAmount },
        { account_key: 'merchant:' + merchant.id, entry_type: 'topup_credit', acu_delta: acuAmount },
      ], { idempotencyKey: 'voucher:' + v.id, ref: 'voucher' });
      require('./engine').creditAcu(merchant, acuAmount, 'topup', v.id);
    }
    return { credited: acuAmount };
    });
  } catch (e) {
    if (String(e && e.message) === 'unbacked')
      return [409, { error: { code: 'insufficient_reseller_backing', message: 'This voucher is not backed by prepaid reseller inventory.' } }];
    throw e;
  }
  if (res.lost) return [409, { error: { code: 'already_redeemed' } }];
  if (res.plan) {
    require('./engine').notifyOwners(merchant, 'plan.upgraded', { plan: res.plan });
    return { ok: true, voucher_id: v.id, product_code: v.product_code, plan_activated: res.plan };
  }
  require('./engine').notifyOwners(merchant, 'billing.topup.verified', { acu: res.credited });
  return { ok: true, voucher_id: v.id, product_code: v.product_code, acu_credited: res.credited };
}

module.exports = { issueBatch, activateBatch, voidBatch, redeem, sign, verifySignature, publicKeyPem: () => KEYS.pub };
