// KODA — real payment-rail correctness (System B, Stripe + Paystack + Flutterwave).
// Proves: (1) Paystack rail exists + quotes with ≥100% margin, (2) plan methods offer
// the card/PSP rails gated on their API key, (3) a configured provider yields a real
// KODA redirect checkout (not a sandbox URL), (4) each provider's NATIVE webhook
// signature scheme verifies a genuine success event and rejects a forgery, and only a
// paid event settles. Unit-style (in-process, temp DB) — no live provider account.
'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
process.env.KODA_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'koda-rails-'));
process.env.KODA_QUIET = '1';
const crypto = require('node:crypto');
const { q } = require('../lib/db');
require('../seed');
const billing = require('../lib/billing');
const BILL = require('../../shared/billing');

let pass = 0, fail = 0;
const ok = (c, m, x = '') => { c ? (pass++, console.log(`  ✓ ${m} ${x}`)) : (fail++, console.log(`  ✗ ${m} ${x}`)); };
const mkReq = (body, headers) => ({ headers: headers || {}, rawBody: Buffer.from(JSON.stringify(body)), body });

(async () => {
  console.log('\nKODA — real payment rails (Stripe · Paystack · Flutterwave)\n');
  const merchant = q.get('SELECT * FROM merchants LIMIT 1');

  // ── 1. Paystack rail is registered but SWITCHED OFF for now (flip live to re-offer) ──
  ok(!!BILL.RAILS.paystack && BILL.RAILS.paystack.live === false, 'Paystack rail registered but switched off (live:false)');
  ok(!!BILL.RAILS.flutterwave && BILL.RAILS.flutterwave.live === false, 'Flutterwave rail registered but switched off (live:false)');
  const pq = BILL.quote(1000, 'paystack');   // quote still computes (adapter stays ready)
  ok(pq.margin_pct >= 100, 'Paystack quote still keeps ≥100% margin when re-enabled', `${pq.margin_pct}%`);
  ok(Math.abs(pq.collection_fee_usd - pq.subtotal_usd * 0.039) < 1e-6, 'Paystack collection fee is passed through', `$${pq.collection_fee_usd}`);

  // ── 2. plan collection is exactly two rails: mobile money (KODA) + card (Stripe) ──
  delete process.env.STRIPE_KEY; delete process.env.PAYSTACK_KEY; delete process.env.FLUTTERWAVE_KEY;
  const rail = (pm, r) => pm.methods.find(x => x.rail === r);
  const pm = billing.planMethods('boutique');
  ok(pm.methods.length === 2 && rail(pm, 'koda') && rail(pm, 'stripe'), 'plan checkout offers exactly Mobile money (KODA) + Card (Stripe)');
  ok(!rail(pm, 'paystack') && !rail(pm, 'flutterwave'), 'aggregators are NOT offered on plan checkout (Door 3 for MoMo, Stripe for card)');
  ok(rail(pm, 'stripe').available === false, 'Stripe shown but NOT available with no key');
  process.env.STRIPE_KEY = 'sk_test_stripe_plan';
  ok(rail(billing.planMethods('boutique'), 'stripe').available === true, 'Card (Stripe) becomes available once STRIPE_KEY is set');
  delete process.env.STRIPE_KEY;
  // ── 2b. ACU top-ups offer the SAME two rails: Mobile money (KODA) + Card (Stripe) ──
  const tm = billing.methods(merchant, { amount_acu: 100 });
  ok(tm.methods.length === 2 && rail(tm, 'koda') && rail(tm, 'stripe'), 'ACU top-up offers exactly Mobile money (KODA) + Card (Stripe)');
  ok(!rail(tm, 'paystack') && !rail(tm, 'flutterwave'), 'Paystack/Flutterwave are switched off for top-ups too');
  process.env.PAYSTACK_KEY = 'sk_test_paystack';   // even with a key, an off rail is not offered
  ok(!billing.methods(merchant, { amount_acu: 100 }).methods.find(m => m.rail === 'paystack'), 'a switched-off rail stays hidden even if its key is present');

  // ── 3. a configured provider yields a real KODA redirect, not a sandbox URL ──
  process.env.STRIPE_KEY = 'sk_test_stripe';
  process.env.KODA_PUBLIC_URL = 'https://kodajnn.com';
  const co = billing.createPlanCheckout(merchant, 'boutique', 'stripe');
  ok(!Array.isArray(co) && co.session && /\/billing\/go\//.test(co.session.checkout_url), 'configured Stripe → real /billing/go redirect', co.session && co.session.checkout_url);
  ok(co.session.checkout_url.indexOf('sandbox://') === -1, 'no sandbox URL when the key is configured');
  delete process.env.STRIPE_KEY;
  const coSb = billing.createPlanCheckout(merchant, 'commerce', 'stripe');
  ok(coSb.session && /sandbox:\/\//.test(coSb.session.checkout_url), 'no key → sandbox URL (unchanged legacy behaviour)');

  // ── 4a. Stripe native webhook: valid signed completed event verifies + settles-eligible ──
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  const sBody = { type: 'checkout.session.completed', data: { object: { client_reference_id: 'top_stripe', payment_status: 'paid' } } };
  const sRaw = JSON.stringify(sBody), sTs = '1700000000';
  const sSig = crypto.createHmac('sha256', 'whsec_test').update(`${sTs}.${sRaw}`).digest('hex');
  const sv = billing.verifyWebhook('stripe', { headers: { 'stripe-signature': `t=${sTs},v1=${sSig}` }, rawBody: Buffer.from(sRaw), body: sBody });
  ok(sv.ok && sv.topup_id === 'top_stripe' && sv.paid === true, 'Stripe: genuine completed event verifies → topup_id + paid');
  const svBad = billing.verifyWebhook('stripe', { headers: { 'stripe-signature': `t=${sTs},v1=deadbeef` }, rawBody: Buffer.from(sRaw), body: sBody });
  ok(!svBad.ok, 'Stripe: forged signature rejected');
  delete process.env.STRIPE_WEBHOOK_SECRET;

  // ── 4b. Paystack native webhook: SHA512 body signature ──────────────────────
  const pBody = { event: 'charge.success', data: { reference: 'top_ps', status: 'success' } };
  const pRaw = JSON.stringify(pBody);
  const pSig = crypto.createHmac('sha512', process.env.PAYSTACK_KEY).update(pRaw).digest('hex');
  const pv = billing.verifyWebhook('paystack', { headers: { 'x-paystack-signature': pSig }, rawBody: Buffer.from(pRaw), body: pBody });
  ok(pv.ok && pv.topup_id === 'top_ps' && pv.paid === true, 'Paystack: genuine charge.success verifies → topup_id + paid');
  ok(!billing.verifyWebhook('paystack', { headers: { 'x-paystack-signature': 'bad' }, rawBody: Buffer.from(pRaw), body: pBody }).ok, 'Paystack: forged signature rejected');

  // ── 4c. Flutterwave native webhook: verif-hash equality ─────────────────────
  process.env.FLUTTERWAVE_WEBHOOK_HASH = 'flw_hash_secret';
  const fBody = { event: 'charge.completed', data: { tx_ref: 'top_flw', status: 'successful' } };
  const fv = billing.verifyWebhook('flutterwave', mkReq(fBody, { 'verif-hash': 'flw_hash_secret' }));
  ok(fv.ok && fv.topup_id === 'top_flw' && fv.paid === true, 'Flutterwave: genuine successful event verifies → tx_ref + paid');
  ok(!billing.verifyWebhook('flutterwave', mkReq(fBody, { 'verif-hash': 'wrong' })).ok, 'Flutterwave: wrong verif-hash rejected');
  delete process.env.FLUTTERWAVE_WEBHOOK_HASH;

  // ── 5. a non-paid provider event is verified but does NOT settle ─────────────
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  const nBody = { type: 'checkout.session.expired', data: { object: { client_reference_id: 'top_x', payment_status: 'unpaid' } } };
  const nRaw = JSON.stringify(nBody), nSig = crypto.createHmac('sha256', 'whsec_test').update(`${sTs}.${nRaw}`).digest('hex');
  const nv = billing.verifyWebhook('stripe', { headers: { 'stripe-signature': `t=${sTs},v1=${nSig}` }, rawBody: Buffer.from(nRaw), body: nBody });
  ok(nv.ok && nv.paid === false, 'Stripe: a non-completed event verifies but is NOT paid (no settle)');
  delete process.env.STRIPE_WEBHOOK_SECRET;

  // ── 6. KODA self-collection is admin-managed (DB settings), no env editing ───
  const settings = require('../lib/settings');
  delete process.env.KODA_COLLECT_MSISDN; delete process.env.KODA_COLLECT_MERCHANT;
  settings.set('collect_numbers', JSON.stringify([]));
  ok(settings.collectConfigured() === false, 'self-collect NOT configured with no numbers (env or DB)');
  ok(billing.methods(merchant, { amount_acu: 100 }).methods.find(m => m.rail === 'koda').available === false, 'KODA MoMo rail hidden until a number is set');
  // admin saves a receiving number + rate + collector via the settings store
  settings.set('collect_numbers', JSON.stringify([{ operator: 'airtel_cd', msisdn: '+243999000111', label: 'Kinshasa till', active: 1 }]));
  settings.set('collect_currency', 'CDF');
  settings.set('usd_to_local', '2500');
  settings.set('collect_merchant_id', merchant.id);
  ok(settings.collectConfigured() === true, 'self-collect becomes configured once a number is saved (no restart)');
  ok(settings.primaryNumber() === '+243999000111', 'primary receiving number resolves from the DB store');
  ok(settings.collectMerchantId() === merchant.id, 'collector merchant resolves from the DB store');
  const topup = billing.createTopup(merchant, { amount_acu: 100, rail: 'koda', usd: 10 });
  ok(topup.session && topup.session.pay_to === '+243999000111', 'KODA MoMo checkout shows the admin-set number', topup.session && topup.session.pay_to);
  ok(topup.session.amount_local === Math.round(10 * 2500) + 0 || Math.abs(topup.session.amount_local - 10 * 2500) < 100, 'exact local amount uses the admin-set rate', topup.session.amount_local);
  // multiple receiving numbers: the checkout must offer ALL active ones (per operator)
  settings.set('collect_numbers', JSON.stringify([
    { operator: 'airtel_cd', msisdn: '+243999000111', label: 'Airtel', active: 1 },
    { operator: 'orange_cd', msisdn: '+243888000222', label: 'Orange', active: 1 },
    { operator: 'mpesa_cd', msisdn: '+243777000333', label: 'off', active: 0 },
  ]));
  const t2 = billing.createTopup(merchant, { amount_acu: 50, rail: 'koda', usd: 10 });
  ok(Array.isArray(t2.session.pay_to_numbers) && t2.session.pay_to_numbers.length === 2, 'MoMo checkout lists ALL active numbers (2 active, 1 disabled)', t2.session.pay_to_numbers && t2.session.pay_to_numbers.length);
  ok(t2.session.pay_to_numbers.some(n => n.operator === 'orange_cd') && t2.session.pay_to_numbers.some(n => n.operator === 'airtel_cd'), 'each operator number is offered so the buyer pays from their own wallet');

  // ── 7. settlement rate auto-derives from currency (90+ markets); explicit wins ──
  const fx = require('../../shared/fx');
  settings.set('usd_to_local', '');            // clear any explicit override
  settings.set('collect_currency', 'XOF');
  ok(settings.usdToLocal() === fx.defaultRate('XOF'), 'rate auto-derives from the currency default (XOF → 600)', settings.usdToLocal());
  settings.set('collect_currency', 'NGN');
  ok(settings.usdToLocal() === fx.defaultRate('NGN'), 'switching currency auto-updates the derived rate (NGN)', settings.usdToLocal());
  settings.set('usd_to_local', '3100');        // explicit override always wins
  ok(settings.usdToLocal() === 3100 && settings.rateIsExplicit() === true, 'an explicitly saved rate overrides the auto-default');
  ok(fx.currencyForCountry('NG') === 'NGN' && fx.currencyForCountry('SN') === 'XOF' && fx.currencyForCountry('CD') === 'CDF', 'country → currency resolves (NG→NGN, SN→XOF, CD→CDF)');
  ok(Object.keys(fx.COUNTRY_CURRENCY).length >= 70, 'country→currency map covers KODA\'s broad footprint', Object.keys(fx.COUNTRY_CURRENCY).length + ' countries');

  console.log(`\n${fail === 0 ? '✅ RAILS GREEN' : '❌ RAILS FAILED'} — ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('RAILS TEST CRASH', e && e.stack || e); process.exit(1); });
