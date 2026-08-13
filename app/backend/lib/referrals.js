// KODA — Referral engine (organic growth loop). Every merchant gets a share code;
// a new merchant who signs up with it and verifies their FIRST payment "qualifies"
// the referral, and BOTH sides are rewarded with ACU. This is the compounding
// word-of-mouth loop for a trust product: a merchant who trusts KODA brings the
// next one. Deterministic + idempotent; rewards are granted exactly once.
'use strict';
const crypto = require('node:crypto');
const { q } = require('./db');
const U = require('./util');

const REWARD_ACU = Number(process.env.KODA_REFERRAL_REWARD_ACU) || 100;   // to EACH side on qualify
function base() { return (process.env.KODA_PUBLIC_URL || 'http://localhost:4600').replace(/\/$/, ''); }

// human-friendly code: no ambiguous chars (0/O, 1/I/L)
function genCode() {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const b = crypto.randomBytes(6); let c = '';
  for (let i = 0; i < 6; i++) c += A[b[i] % A.length];
  return c;
}
function ensureCode(merchantId) {
  const m = q.get('SELECT ref_code FROM merchants WHERE id=?', merchantId);
  if (m && m.ref_code) return m.ref_code;
  let code = genCode();
  for (let i = 0; i < 12 && q.get('SELECT id FROM merchants WHERE ref_code=?', code); i++) code = genCode();
  q.run('UPDATE merchants SET ref_code=? WHERE id=?', code, merchantId);
  return code;
}
function linkFor(merchantId) { return `${base()}/app/#signup?ref=${ensureCode(merchantId)}`; }

// called on signup: link the new merchant to whoever referred them (once).
function attach(newMerchantId, refCode) {
  if (!refCode) return;
  const ref = q.get('SELECT id FROM merchants WHERE ref_code=?', String(refCode).toUpperCase().trim());
  if (!ref || ref.id === newMerchantId) return;
  const already = q.get('SELECT referred_by FROM merchants WHERE id=?', newMerchantId);
  if (already && already.referred_by) return;
  q.run('UPDATE merchants SET referred_by=? WHERE id=?', ref.id, newMerchantId);
  q.run(`INSERT INTO referrals (id,referrer_id,referred_id,status) VALUES (?,?,?, 'signed_up')`, U.id('ref'), ref.id, newMerchantId);
  try { require('./engine').notifyOwners({ id: ref.id }, 'referral.signup', { name: '' }); } catch { /* comms optional */ }
}

// called after a merchant's FIRST verified payment: reward both sides, once.
function qualify(merchantId) {
  try {
    const m = q.get('SELECT id, referred_by FROM merchants WHERE id=?', merchantId);
    if (!m || !m.referred_by) return;
    const row = q.get(`SELECT * FROM referrals WHERE referred_id=? AND status='signed_up'`, merchantId);
    if (!row) return;   // no pending referral (already qualified or none)
    const cas = q.run(`UPDATE referrals SET status='qualified', qualified_at=datetime('now'), reward_acu=? WHERE id=? AND status='signed_up'`, REWARD_ACU, row.id);
    if (cas.changes !== 1) return;   // idempotent: another path already qualified it
    const engine = require('./engine');
    const referrer = q.get('SELECT * FROM merchants WHERE id=?', m.referred_by);
    const referred = q.get('SELECT * FROM merchants WHERE id=?', merchantId);
    if (referrer) { engine.creditAcu(referrer, REWARD_ACU, 'referral_reward', row.id); engine.notifyOwners(referrer, 'referral.qualified', {}); engine.notifyOwners(referrer, 'referral.reward_earned', { acu: REWARD_ACU }); }
    if (referred) { engine.creditAcu(referred, REWARD_ACU, 'referral_welcome', row.id); engine.notifyOwners(referred, 'referral.reward_earned', { acu: REWARD_ACU }); }
  } catch { /* growth reward must never break the money path */ }
}

function stats(merchantId) {
  const code = ensureCode(merchantId);
  const total = q.get('SELECT COUNT(*) c FROM referrals WHERE referrer_id=?', merchantId).c;
  const qualified = q.get(`SELECT COUNT(*) c FROM referrals WHERE referrer_id=? AND status='qualified'`, merchantId).c;
  const earned = q.get(`SELECT COALESCE(SUM(reward_acu),0) s FROM referrals WHERE referrer_id=? AND status='qualified'`, merchantId).s;
  return {
    code, link: linkFor(merchantId), reward_per: REWARD_ACU,
    referred: total, qualified, pending: total - qualified, acu_earned: earned,
    list: q.all(`SELECT rf.status, rf.created_at, rf.qualified_at, mm.name
                 FROM referrals rf JOIN merchants mm ON mm.id=rf.referred_id
                 WHERE rf.referrer_id=? ORDER BY rf.created_at DESC LIMIT 50`, merchantId),
  };
}

module.exports = { ensureCode, linkFor, attach, qualify, stats, REWARD_ACU };
