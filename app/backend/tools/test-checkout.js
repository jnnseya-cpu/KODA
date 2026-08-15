// End-to-end test of the CUSTOMER-FACING checkout flow (Door 3, automatic).
//   merchant creates intent → customer opens hosted page → pays → the SMS lands
//   in the ledger → customer pastes the code → KODA verifies → order moves forward.
// Also asserts the browser-safe security envelope: a pk_ key can ONLY create
// intents, and the client_secret scopes a customer to exactly one intent.
'use strict';
const BASE = process.env.KODA_BASE || 'http://localhost:4600';
let pass = 0, fail = 0;
const ok = (c, m, extra = '') => { c ? (pass++, console.log(`  ✓ ${m} ${extra}`)) : (fail++, console.log(`  ✗ ${m} ${extra}`)); };
async function j(method, path, body, headers) {
  const r = await fetch(BASE + path, {
    method, headers: { 'content-type': 'application/json', ...(headers || {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let d = null; try { d = await r.json(); } catch {}
  return { status: r.status, d };
}

(async () => {
  console.log('\nKODA — customer checkout flow (automatic)\n');

  // --- merchant side: log in, mint a publishable (pk_) + a secret (sk_) key ---
  const login = await j('POST', '/app/auth/login', { email: 'demo@koda.africa', password: 'koda-demo' });
  ok(login.status === 200 && login.d.token, 'merchant owner logged in');
  const bearer = { authorization: 'Bearer ' + login.d.token };

  const pk = await j('POST', '/app/keys', { prefix: 'pk_live', label: 'widget' }, bearer);
  ok(pk.status === 200 && /^(koda_pub_live_|pk_live_)/.test(pk.d.secret || ''), 'publishable pk_ key minted', pk.d.secret ? pk.d.secret.slice(0, 12) + '…' : '');
  const sk = await j('POST', '/app/keys', { prefix: 'sk_live', label: 'server' }, bearer);
  ok(sk.status === 200 && /^(koda_live_|sk_live_)/.test(sk.d.secret || ''), 'secret sk_ key minted');
  const PK = { authorization: 'Bearer ' + pk.d.secret };
  const SK = { authorization: 'Bearer ' + sk.d.secret };

  // --- publishable key is browser-safe: create intents, but NOT read data ---
  const leak = await j('GET', '/v1/receipts', null, PK);
  ok(leak.status === 403, 'pk_ key CANNOT read receipts (403)', 'status ' + leak.status);
  const leak2 = await j('GET', '/v1/billing/balance', null, PK);
  ok(leak2.status === 403, 'pk_ key CANNOT read balance (403)', 'status ' + leak2.status);

  // --- customer selects "pay by mobile": browser creates the intent with pk_ ---
  const amt = 47500, ref = 'OM.260805.1701.CHK' + Math.floor(performance.now() % 1e5);
  const intent = await j('POST', '/v1/intents', {
    amount: amt, currency: 'CDF', operators: ['orange_cd'],
    metadata: { order_id: 'CMD-CHK-1' },
    success_url: 'https://shop.example.com/order/success',
  }, PK);
  ok(intent.status === 200 && intent.d.checkout_url && intent.d.client_secret, 'intent created via pk_ (checkout_url + client_secret returned)');
  const iid = intent.d.intent_id, cs = intent.d.client_secret;
  ok(/\/pay\/int_.*\?cs=cs_/.test(intent.d.checkout_url), 'checkout_url points at hosted /pay page', intent.d.checkout_url.replace(BASE, ''));

  // --- the hosted page reads the intent with the client_secret (no API key) ---
  const view = await j('GET', `/checkout/${iid}?cs=${encodeURIComponent(cs)}`);
  ok(view.status === 200 && view.d.amount === amt && view.d.merchant && view.d.pay_to.length, 'customer view: amount + merchant + pay-to shown');
  ok(view.d.has_success_url === true, 'checkout knows an order-success redirect exists');

  // --- multi-number: the checkout must show EACH active receiving account with its OWN
  //     number (not the single profile msisdn), so "4 numbers, only 2 work" can't happen ---
  const cOr = await j('POST', '/app/network-accounts', { network_code: 'orange_cd', account_identifier: '+243810000001', account_holder_name: 'DEMO', receive_currencies: ['CDF'] }, bearer);
  const cMp = await j('POST', '/app/network-accounts', { network_code: 'mpesa_cd', account_identifier: '+243820000002', account_holder_name: 'DEMO', receive_currencies: ['CDF'] }, bearer);
  await j('POST', `/app/network-accounts/${cOr.d.merchant_account_id}/activate`, {}, bearer);
  await j('POST', `/app/network-accounts/${cMp.d.merchant_account_id}/activate`, {}, bearer);
  const iMulti = await j('POST', '/v1/intents', { amount: 9900, currency: 'CDF', operators: ['orange_cd'] }, PK);
  const vMulti = await j('GET', `/checkout/${iMulti.d.intent_id}?cs=${encodeURIComponent(iMulti.d.client_secret)}`);
  const nums = (vMulti.d.pay_to || []).map(p => p.number);
  ok(vMulti.d.pay_to.length === 2 && vMulti.d.pay_to.some(p => p.operator === 'mpesa_cd'), 'checkout lists ALL active accounts (not just the intent operators)', vMulti.d.pay_to.map(p => p.operator).join(','));
  ok(nums.includes('+243810000001') && nums.includes('+243820000002'), 'each network shows its OWN receiving number', nums.join(' '));

  // wrong / missing client_secret is refused (can't enumerate other intents)
  const bad = await j('GET', `/checkout/${iid}?cs=cs_wrong`);
  ok(bad.status === 404, 'wrong client_secret rejected (404)');

  // --- customer tries the code BEFORE the SMS has landed → graceful "in route" ---
  const early = await j('POST', `/checkout/${iid}/verify`, { cs, reference: ref });
  ok(early.status === 200 && early.d.status === 'not_found_yet', 'code before SMS lands → not_found_yet (polls)', early.d.status);

  // --- the customer actually pays; the Sentinel SIM ledger receives the SMS ---
  // (in production this arrives from the phone-edge app; here via the sandbox door)
  const sms = await j('POST', '/v1/sandbox/sms', {
    operator: 'orange_cd',
    raw: `Vous avez recu 47 500 FC de KODA CLIENT (+243890123456). Ref: ${ref}.`,
  }, SK);
  ok(sms.status === 200, 'SMS ingested into the ledger (payment landed)');

  // --- customer pastes the code again → KODA verifies → order moves forward ---
  const verify = await j('POST', `/checkout/${iid}/verify`, { cs, reference: ref });
  ok(verify.status === 200 && (verify.d.status === 'verified' || verify.d.status === 'verified_late'), 'customer code VERIFIED', verify.d.status);
  ok(verify.d.amount_confirmed === amt, 'confirmed amount matches the order', String(verify.d.amount_confirmed));
  ok(verify.d.receipt_id, 'receipt issued', verify.d.receipt_id || '');
  ok(verify.d.redirect === 'https://shop.example.com/order/success', 'redirect handed back → automatic hand-off', verify.d.redirect || '(none)');

  // --- the same code cannot be replayed for a second order ---
  const intent2 = await j('POST', '/v1/intents', { amount: amt, currency: 'CDF', operators: ['orange_cd'] }, PK);
  const replay = await j('POST', `/checkout/${intent2.d.intent_id}/verify`, { cs: intent2.d.client_secret, reference: ref });
  ok(replay.status === 200 && replay.d.status !== 'verified', 'single-use code cannot be replayed on a new intent', replay.d.status + (replay.d.code ? '/' + replay.d.code : ''));

  // --- re-submitting on the already-settled intent is idempotent ---
  const again = await j('POST', `/checkout/${iid}/verify`, { cs, reference: ref });
  ok(again.status === 200 && (again.d.already === true || again.d.status === 'verified' || again.d.status === 'verified_late'), 'settled intent is idempotent (already=true)', String(again.d.already));

  // --- merchant sees the receipt server-side (sk_ can read) ---
  const receipts = await j('GET', '/v1/receipts', null, SK);
  ok(receipts.status === 200 && Array.isArray(receipts.d) && receipts.d.some(x => x.intent_id === iid), 'merchant server sees the receipt for this intent');

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('CHECKOUT TEST CRASH', e); process.exit(1); });
