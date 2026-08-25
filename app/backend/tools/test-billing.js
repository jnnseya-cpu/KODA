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
  ok(qv.acu_markup === 5 && qv.acu_price_usd === Math.round(5 * BILL.UNIT_COST_USD * 1e6) / 1e6, 'ad-hoc ACU priced at 5× unit cost', `$${qv.acu_price_usd}/ACU`);
  ok(BILL.PLAN_PRICE_USD === Math.round(4 * BILL.UNIT_COST_USD * 1e6) / 1e6 && BILL.PLAN_PRICE_USD < BILL.ACU_PRICE_USD, 'plan rate is 4× and strictly below the 5× ACU rate', `plan $${BILL.PLAN_PRICE_USD} < acu $${BILL.ACU_PRICE_USD}`);
  ok(BILL.PRICE_FLOOR_USD === BILL.PLAN_PRICE_USD, '4× floor equals the plan rate (nothing sold below 4×)');
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
  const wp = billing.wholesalePurchase(kdId, 5000, 'test-wholesale-1');
  ok(!isErr(wp) && billing.distributorFloat(kdId) === 5000, 'KD wholesale prepurchase credits float', `float ${billing.distributorFloat(kdId)}`);

  const before = bal(payer.id), floatBefore = billing.distributorFloat(kdId);
  const dt = billing.createDistributorTopup(payer, { distributor_id: kdId, amount_acu: 600 });
  ok(!isErr(dt) && dt.pay_to === '+243810000001' && dt.status === 'pending', 'distributor top-up returns KD pay-to instructions');
  ok(bal(payer.id) === before, 'no credit while distributor top-up is pending');

  // amount authority: a mismatched verified amount must NOT settle
  const badAmt = billing.settleDistributorTopup(dt.topup_id, { verifiedAmountUsd: dt.expected_amount_usd + 5 });
  ok(isErr(badAmt) && badAmt[1].error.code === 'amount_mismatch', 'wrong verified amount is rejected (server-side authority)');
  ok(bal(payer.id) === before, 'no credit on amount mismatch');

  // the escrow moment: a verified KD payment settles it — atomic float↔wallet move.
  // The KD's Sentinel SMS carries the LOCAL amount + currency (not USD) — the matcher
  // converts total_usd→local and requires the currency to match.
  const settled = billing.matchDistributorPayment(kdMerchant.id, dt.expected_amount_local, payer.currency);
  ok(settled && bal(payer.id) === before + 600, 'verified KD payment auto-credits the merchant', `+${bal(payer.id) - before}`);
  ok(billing.distributorFloat(kdId) === floatBefore - 600, 'KD float debited by the same amount', `float ${billing.distributorFloat(kdId)}`);
  ok(billing.reconcile().balanced, 'ledger still reconciles to zero after distributor settle');

  // REGRESSION (currency confusion): a tiny LOCAL payment must NOT settle a USD-quoted
  // top-up. Old code compared raw local (e.g. 600) to total_usd and settled a ~$16 order
  // for ~600 units of soft currency (~$0.21). Now the amount is checked in-currency.
  const cc = billing.createDistributorTopup(payer, { distributor_id: kdId, amount_acu: 600 });
  const tiny = billing.matchDistributorPayment(kdMerchant.id, cc.expected_amount_usd, payer.currency); // pay the USD number as if it were local
  ok(tiny === null, 'tiny local payment does NOT settle a USD-quoted distributor top-up (currency-safe)');
  ok(bal(payer.id) === before + 600, 'no extra credit from the currency-confusion attempt');
  // REGRESSION: no currency on the SMS ⇒ cannot verify amount ⇒ hold (never settle)
  ok(billing.matchDistributorPayment(kdMerchant.id, cc.expected_amount_local, null) === null, 'no-currency SMS holds (never settles)');
  // the correct local amount + currency settles it
  const good = billing.matchDistributorPayment(kdMerchant.id, cc.expected_amount_local, payer.currency);
  ok(good && bal(payer.id) === before + 1200, 'correct local amount + currency settles the distributor top-up');

  // REGRESSION (idempotency): wholesale float credit requires a stable idem key —
  // deriving it from the mutable float was a replay-double-credit hole.
  ok(isErr(billing.wholesalePurchase(kdId, 100)) , 'wholesale purchase without an idempotency key is refused');

  // a KD can never mint ACU beyond its prepaid float
  const huge = billing.createDistributorTopup(payer, { distributor_id: kdId, amount_acu: 999999 });
  ok(isErr(huge) && huge[1].error.code === 'insufficient_float', 'KD cannot sell beyond prepaid float');

  // ── VOUCHER RAIL (Ed25519, single-use, market-locked) ───────────────────────
  const resId = U.id('res');
  q.run(`INSERT INTO resellers (id,legal_name,country,status) VALUES (?,?,?,'ACTIVE')`, resId, 'GH Reseller', 'GH');
  const reseller = q.get('SELECT * FROM resellers WHERE id=?', resId);
  // Fail-closed invariant: vouchers must be backed by PREPAID reseller inventory (no
  // treasury fallback). Fund the reseller ledger before issuing.
  billing.resellerBuyInventory(resId, 5000, 'test-reseller-1');
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

  // currency lock (REGRESSION: was stored at issue but never enforced at redeem)
  const b3c = vouchers.issueBatch(reseller, { product_code: 'ACU_TOPUP', acu_amount: 100, quantity: 1, country_lock: payer.country, currency_lock: 'ZWL' });
  vouchers.activateBatch(b3c.batch_id);
  const curLocked = vouchers.redeem(payer, b3c.vouchers[0].pin);
  ok(isErr(curLocked) && curLocked[1].error.code === 'currency_locked', 'currency-locked voucher rejected in the wrong currency');

  // expiry
  const b4 = vouchers.issueBatch(reseller, { product_code: 'ACU_TOPUP', acu_amount: 100, quantity: 1, country_lock: payer.country, expires_at: '2020-01-01T00:00:00' });
  vouchers.activateBatch(b4.batch_id);
  const exp = vouchers.redeem(payer, b4.vouchers[0].pin);
  ok(isErr(exp) && exp[1].error.code === 'expired', 'expired voucher rejected');

  // ── WEBHOOK AUTHENTICITY (regression for the free-credit hole) ──────────────
  const crypto = require('node:crypto');
  const mkReq = (body, sig) => ({ body, rawBody: Buffer.from(JSON.stringify(body)), headers: sig ? { 'x-koda-signature': sig } : {} });
  const noSecret = billing.verifyWebhook('stripe', mkReq({ topup_id: 'x' }, 'anything'));
  ok(!noSecret.ok, 'webhook FAILS CLOSED when no secret is configured (no free settle)');
  process.env.KODA_WEBHOOK_SECRET = 'test-secret';
  const bodyW = { topup_id: 'x' };
  const goodSig = crypto.createHmac('sha256', 'test-secret').update(JSON.stringify(bodyW)).digest('hex');
  ok(billing.verifyWebhook('stripe', mkReq(bodyW, goodSig)).ok, 'webhook accepts a correctly-signed payload');
  ok(!billing.verifyWebhook('stripe', mkReq(bodyW, 'deadbeef')).ok, 'webhook rejects a forged signature');
  ok(!billing.verifyWebhook('stripe', mkReq(bodyW, null)).ok, 'webhook rejects a missing signature');
  delete process.env.KODA_WEBHOOK_SECRET;

  // ── MONEY-SEAL REGRESSIONS (deep-audit fixes) ───────────────────────────────
  const engine = require('../lib/engine');

  // 1. Retail top-up cannot be self-priced below list (wholesale-floor leak).
  const cheap = billing.createTopup(payer, { rail: 'koda', amount_acu: 1000, usd: 13.01 });
  ok(!isErr(cheap) && cheap.subtotal_usd >= Math.round(1000 * BILL.ACU_PRICE_USD * 100) / 100,
    'retail top-up is repriced to list, not the client-supplied floor', `$${cheap && cheap.subtotal_usd}`);

  // 2. Voucher signature binds value: tampering acu_amount on the row is rejected.
  billing.resellerBuyInventory(resId, 100000, 'test-reseller-2');
  const tb = vouchers.issueBatch(reseller, { product_code: 'ACU_TOPUP', acu_amount: 10, quantity: 1, country_lock: payer.country });
  vouchers.activateBatch(tb.batch_id);
  q.run(`UPDATE vouchers SET acu_amount=1000000 WHERE batch_id=?`, tb.batch_id);
  ok(isErr(vouchers.redeem(payer, tb.vouchers[0].pin)) , 'tampered voucher acu_amount rejected (signature binds value)');

  // 3. Voucher plan escalation to Enterprise is rejected even if the row is mutated.
  const pv = vouchers.issueBatch(reseller, { product_code: 'PLAN', plan_key: 'boutique', acu_amount: 800, quantity: 1, country_lock: payer.country });
  vouchers.activateBatch(pv.batch_id);
  q.run(`UPDATE vouchers SET plan_key='enterprise' WHERE batch_id=?`, pv.batch_id);
  ok(isErr(vouchers.redeem(payer, pv.vouchers[0].pin)), 'tampered voucher plan_key=enterprise rejected');

  // 4. Voucher must be backed by prepaid reseller inventory (no treasury fail-open).
  const resId2 = U.id('res');
  q.run(`INSERT INTO resellers (id,legal_name,country,status) VALUES (?,?,?,'ACTIVE')`, resId2, 'Unfunded', payer.country);
  const ub = vouchers.issueBatch(q.get('SELECT * FROM resellers WHERE id=?', resId2), { product_code: 'ACU_TOPUP', acu_amount: 500, quantity: 1, country_lock: payer.country });
  vouchers.activateBatch(ub.batch_id);
  const ubRes = vouchers.redeem(payer, ub.vouchers[0].pin);
  ok(isErr(ubRes) && ubRes[1].error.code === 'insufficient_reseller_backing', 'unbacked voucher rejected (no treasury fallback)');

  // 5. Hard credit floor: verifications beyond quota/grace are refused (not unlimited negative).
  const brokeMid = U.id('mch');
  q.run(`INSERT INTO merchants (id,name,country,currency,plan,acu_balance) VALUES (?,?,?,?, 'marche', ?)`, brokeMid, 'Broke', payer.country, payer.currency, -1000);
  const broke = q.get('SELECT * FROM merchants WHERE id=?', brokeMid);
  ok(engine.canSpend(broke, engine.ACU.code) === false, 'credit floor: a deeply-negative merchant cannot spend');

  // 6. 4× FLOOR on every plan: included rate AND overage are ≥ retail ($0.026 = 4× cost),
  //    and overage always costs a full 1 ACU regardless of tier (no sub-4× discount).
  const PL = require('../../shared/plans').PLANS;
  ok(engine.overageAcu({ plan: 'plateforme', acu_balance: 0 }) === engine.ACU.code
    && engine.overageAcu({ plan: 'boutique', acu_balance: 0 }) === engine.ACU.code, 'overage is a flat 1 ACU (4×) on every tier');
  ok(['boutique', 'commerce', 'plateforme'].every(k => BILL.clearsFloor(PL[k].usd / PL[k].verifs) && BILL.clearsFloor(PL[k].overage)),
    'every paid plan included + overage rate clears the 4× floor');

  // 7. Chargeback clawback: a settled card top-up reversed pulls the ACU back; ledger = 0.
  const cbTop = billing.createTopup(payer, { rail: 'stripe', amount_acu: 1000 });
  billing.settleTopup(cbTop.topup_id);
  const afterCredit = bal(payer.id);
  const rev = billing.reverseTopup(cbTop.topup_id, 'charge.refunded');
  ok(!isErr(rev) && bal(payer.id) === afterCredit - 1000, 'chargeback claws back the granted ACU', `${afterCredit} → ${bal(payer.id)}`);
  ok(billing.reconcile().balanced, 'ledger reconciles after a chargeback reversal');

  // ── FINAL RECONCILIATION ────────────────────────────────────────────────────
  ok(billing.reconcile().balanced, 'FINAL: entire billing ledger reconciles to zero', `Σ=${billing.reconcile().sum}`);

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('BILLING TEST CRASH', e && e.stack || e); process.exit(1); });
