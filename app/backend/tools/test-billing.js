// KODA — Global Billing Mesh (System B) adversarial suite. In-process against a
// temp DB (deterministic; no HTTP flakiness). Enforces the financial invariants a
// launch audit demands: server-side price authority, idempotency, double-entry
// reconciliation = 0, no entitlement before payment, replay/tamper/expiry defence.
'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
process.env.KODA_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'koda-bill-'));
process.env.KODA_QUIET = '1';

const { q } = require('../lib/db');
require('../seed');
const billing = require('../lib/billing');
const vouchers = require('../lib/vouchers');
const BILL = require('../../shared/billing');
const U = require('../lib/util');

let pass = 0, fail = 0;
const ok = (c, m, x = '') => { c ? (pass++, console.log(`  ✓ ${m} ${x}`)) : (fail++, console.log(`  ✗ ${m} ${x}`)); };
const isErr = (r) => Array.isArray(r);
const bal = (mid) => q.get('SELECT acu_balance FROM merchants WHERE id=?', mid).acu_balance;

(async () => {
  console.log('\nKODA — Global Billing Mesh (System B)\n');
  const ms = q.all('SELECT * FROM merchants LIMIT 3');
  const payer = ms[0];
  const kdMerchant = ms[1] || ms[0];

  // ── PRICING LAW ────────────────────────────────────────────────────────────
  const qv = BILL.quote(1000, 'stripe');
  ok(qv.acu_markup === 4 && qv.acu_price_usd === Math.round(4 * BILL.UNIT_COST_USD * 1e6) / 1e6, 'ACU priced at 4× unit cost', `$${qv.acu_price_usd}/ACU`);
  ok(Math.abs(qv.total_usd - (qv.subtotal_usd + qv.collection_fee_usd + qv.tax_usd)) < 1e-6, 'total = subtotal + collection fee + tax');
  ok(qv.collection_fee_usd > 0 && Math.abs(qv.collection_fee_usd - qv.subtotal_usd * 0.029) < 1e-6, 'collection fee is passed through, not absorbed', `$${qv.collection_fee_usd}`);
  ok(qv.margin_pct >= 100, 'margin ≥ 100% on every quote', `${qv.margin_pct}%`);
  const qd = BILL.quote(1000, 'distributor');
  ok(qd.subtotal_usd === qv.subtotal_usd && qd.total_usd > qv.total_usd, 'costlier rail raises MERCHANT total, not KODA net', `KD total $${qd.total_usd} vs card $${qv.total_usd}`);

  // ── ROUTING ────────────────────────────────────────────────────────────────
  const rCD = BILL.routeProviders({ country: 'CD', amount_acu: 500 });
  ok(rCD.some(r => r.flow === 'MOBILE_MONEY_PUSH') && rCD.some(r => r.rail === 'distributor'), 'MM market routes mobile-money + agent rails');
  const rGB = BILL.routeProviders({ country: 'GB', amount_acu: 500 });
  ok(!rGB.some(r => r.flow === 'MOBILE_MONEY_PUSH'), 'non-MM market excludes push MM rails');
  ok(!BILL.routeProviders({ country: 'CD' }).some(r => r.rail === 'bitripay'), 'BitriPay excluded until live');

  // ── CARD/AGGREGATOR TOP-UP + IDEMPOTENCY + DOUBLE-ENTRY ─────────────────────
  const b0 = bal(payer.id);
  const t1 = billing.createTopup(payer, { amount_acu: 400, rail: 'stripe', idempotency_key: 'idem-A' });
  ok(!isErr(t1) && t1.status === 'pending', 'top-up created (pending)');
  const t1b = billing.createTopup(payer, { amount_acu: 400, rail: 'stripe', idempotency_key: 'idem-A' });
  ok(t1b.topup_id === t1.topup_id, 'idempotency-key returns the same top-up (no duplicate)');
  ok(bal(payer.id) === b0, 'no entitlement before settlement (balance unchanged while pending)');
  const s1 = billing.settleTopup(t1.topup_id);
  ok(!isErr(s1) && bal(payer.id) === b0 + 400, 'settlement credits the wallet exactly once', `+${bal(payer.id) - b0}`);
  const s1b = billing.settleTopup(t1.topup_id);
  ok(s1b.already === true && bal(payer.id) === b0 + 400, 'double settlement is idempotent (no double credit)');
  ok(billing.reconcile().balanced, 'ledger double-entry reconciles to zero', `Σ=${billing.reconcile().sum}`);

  // reject bad input (server-side authority)
  ok(isErr(billing.createTopup(payer, { amount_acu: -5, rail: 'stripe' })), 'negative amount rejected');
  ok(isErr(billing.createTopup(payer, { amount_acu: 100, rail: 'bitripay' })), 'not-live rail rejected');

  // ── DISTRIBUTOR RAIL (engine-as-escrow) ─────────────────────────────────────
  const kdId = U.id('kd');
  q.run(`INSERT INTO distributors (id,merchant_id,name,country,msisdn,float_acu,status) VALUES (?,?,?,?,?,0,'active')`,
    kdId, kdMerchant.id, 'Kivu Distrib', payer.country, '+243810000001');
  const wp = billing.wholesalePurchase(kdId, 5000);
  ok(!isErr(wp) && billing.distributorFloat(kdId) === 5000, 'KD wholesale prepurchase credits float', `float ${billing.distributorFloat(kdId)}`);

  const before = bal(payer.id), floatBefore = billing.distributorFloat(kdId);
  const dt = billing.createDistributorTopup(payer, { distributor_id: kdId, amount_acu: 600 });
  ok(!isErr(dt) && dt.pay_to === '+243810000001' && dt.status === 'pending', 'distributor top-up returns KD pay-to instructions');
  ok(bal(payer.id) === before, 'no credit while distributor top-up is pending');

  // amount authority: a mismatched verified amount must NOT settle
  const badAmt = billing.settleDistributorTopup(dt.topup_id, { verifiedAmountUsd: dt.expected_amount_usd + 5 });
  ok(isErr(badAmt) && badAmt[1].error.code === 'amount_mismatch', 'wrong verified amount is rejected (server-side authority)');
  ok(bal(payer.id) === before, 'no credit on amount mismatch');

  // the escrow moment: a verified KD payment settles it — atomic float↔wallet move
  const settled = billing.matchDistributorPayment(kdMerchant.id, dt.expected_amount_usd);
  ok(settled && bal(payer.id) === before + 600, 'verified KD payment auto-credits the merchant', `+${bal(payer.id) - before}`);
  ok(billing.distributorFloat(kdId) === floatBefore - 600, 'KD float debited by the same amount', `float ${billing.distributorFloat(kdId)}`);
  ok(billing.reconcile().balanced, 'ledger still reconciles to zero after distributor settle');

  // a KD can never mint ACU beyond its prepaid float
  const huge = billing.createDistributorTopup(payer, { distributor_id: kdId, amount_acu: 999999 });
  ok(isErr(huge) && huge[1].error.code === 'insufficient_float', 'KD cannot sell beyond prepaid float');

  // ── VOUCHER RAIL (Ed25519, single-use, market-locked) ───────────────────────
  const resId = U.id('res');
  q.run(`INSERT INTO resellers (id,legal_name,country,status) VALUES (?,?,?,'ACTIVE')`, resId, 'GH Reseller', 'GH');
  const reseller = q.get('SELECT * FROM resellers WHERE id=?', resId);
  const batch = vouchers.issueBatch(reseller, { product_code: 'ACU_TOPUP', acu_amount: 500, quantity: 2, country_lock: payer.country });
  ok(batch.vouchers.length === 2 && batch.vouchers[0].pin, 'voucher batch issued (PINs shown once)');

  const pin = batch.vouchers[0].pin;
  const early = vouchers.redeem(payer, pin);
  ok(isErr(early) && early[1].error.code === 'not_active', 'dormant voucher cannot be redeemed (dead stock)');
  vouchers.activateBatch(batch.batch_id);
  const vb = bal(payer.id);
  const red = vouchers.redeem(payer, pin);
  ok(!isErr(red) && bal(payer.id) === vb + 500, 'active voucher redeems → ACU credited', `+${bal(payer.id) - vb}`);
  const replay = vouchers.redeem(payer, pin);
  ok(isErr(replay) && replay[1].error.code === 'already_redeemed', 'voucher replay blocked (single-use)');
  ok(bal(payer.id) === vb + 500, 'no double credit on voucher replay');

  // signature authenticity
  ok(vouchers.verifySignature(vouchers.sign({ a: 1 })) && !vouchers.verifySignature('tampered.sig'), 'Ed25519 signature verifies genuine, rejects tampered');
  // tampered stored signature is rejected at redemption
  const b2 = vouchers.issueBatch(reseller, { product_code: 'ACU_TOPUP', acu_amount: 100, quantity: 1, country_lock: payer.country });
  vouchers.activateBatch(b2.batch_id);
  q.run(`UPDATE vouchers SET signature='forged.forged' WHERE batch_id=?`, b2.batch_id);
  ok(isErr(vouchers.redeem(payer, b2.vouchers[0].pin)), 'voucher with forged signature is rejected');

  // country lock
  const b3 = vouchers.issueBatch(reseller, { product_code: 'ACU_TOPUP', acu_amount: 100, quantity: 1, country_lock: 'ZZ' });
  vouchers.activateBatch(b3.batch_id);
  const locked = vouchers.redeem(payer, b3.vouchers[0].pin);
  ok(isErr(locked) && locked[1].error.code === 'country_locked', 'country-locked voucher rejected outside its market');

  // expiry
  const b4 = vouchers.issueBatch(reseller, { product_code: 'ACU_TOPUP', acu_amount: 100, quantity: 1, country_lock: payer.country, expires_at: '2020-01-01T00:00:00' });
  vouchers.activateBatch(b4.batch_id);
  const exp = vouchers.redeem(payer, b4.vouchers[0].pin);
  ok(isErr(exp) && exp[1].error.code === 'expired', 'expired voucher rejected');

  // ── FINAL RECONCILIATION ────────────────────────────────────────────────────
  ok(billing.reconcile().balanced, 'FINAL: entire billing ledger reconciles to zero', `Σ=${billing.reconcile().sum}`);

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('BILLING TEST CRASH', e && e.stack || e); process.exit(1); });
