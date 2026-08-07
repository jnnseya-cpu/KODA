// KODA — payment-provider webhook correctness (launch Gate 5 / Phase 9). Proves the
// money-settling billing webhook: (1) verifies a real HMAC signature and rejects a
// forged one, (2) credits ACU exactly once, (3) is IDEMPOTENT — a replayed valid
// webhook (duplicate delivery, the #1 payment-webhook hazard) never double-credits.
// Unit-style (uses the billing lib directly) so it needs no live provider account.
'use strict';
process.env.KODA_DATA_DIR = require('node:fs').mkdtempSync('/tmp/koda-billwh-');
process.env.KODA_WEBHOOK_SECRET = 'whsec_test_secret';
const crypto = require('node:crypto');
const { q } = require('../lib/db');
const billing = require('../lib/billing');

let pass = 0, fail = 0;
const T = (n, c, e) => { c ? pass++ : fail++; console.log(`${c ? '✓' : '✗ FAIL'} ${n}${c ? '' : '  << ' + (e ?? '')}`); };

// seed a merchant + a pending Stripe ACU top-up (100 ACU)
q.run(`INSERT INTO merchants (id,name,plan,status,acu_balance) VALUES ('mch_wh','WH','commerce','active',0)`);
q.run(`INSERT INTO topups (id,merchant_id,acu_amount,subtotal_usd,collection_fee_usd,tax_usd,total_usd,currency,rail,purpose,status)
       VALUES ('top_wh','mch_wh',100,10,0.29,0,10.29,'USD','stripe','acu','pending')`);

// 1 — signature verification (valid vs forged)
const body = JSON.stringify({ topup_id: 'top_wh' });
const good = crypto.createHmac('sha256', process.env.KODA_WEBHOOK_SECRET).update(Buffer.from(body)).digest('hex');
const mkReq = (sig) => ({ headers: { 'x-koda-signature': sig }, rawBody: Buffer.from(body), body: JSON.parse(body) });
T('valid signature verifies', billing.verifyWebhook('stripe', mkReq(good)).ok === true);
T('forged signature rejected', billing.verifyWebhook('stripe', mkReq('deadbeef'.repeat(8))).ok === false);
T('empty signature rejected', billing.verifyWebhook('stripe', mkReq('')).ok === false);

// 2 — settle once → ACU credited exactly once
const r1 = billing.settleTopup('top_wh');
const bal1 = q.get(`SELECT acu_balance FROM merchants WHERE id='mch_wh'`).acu_balance;
T('first settle credits 100 ACU', bal1 === 100, `balance=${bal1} ${JSON.stringify(r1)}`);

// 3 — IDEMPOTENCY: replay the same webhook → no double credit
const r2 = billing.settleTopup('top_wh');
const bal2 = q.get(`SELECT acu_balance FROM merchants WHERE id='mch_wh'`).acu_balance;
T('replayed settle is idempotent (still 100, already:true)', bal2 === 100 && r2 && r2.already === true, `balance=${bal2} ${JSON.stringify(r2)}`);

// 4 — ledger still balances after settle
const led = q.get('SELECT COALESCE(SUM(acu_delta),0) s FROM billing_ledger');
T('ledger balances after settle (Σ acu_delta = 0)', led.s === 0, `Σ=${led.s}`);

console.log(`\n${fail === 0 ? '✅ BILLING WEBHOOK CORRECT' : '❌ BILLING WEBHOOK FAILED'} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
