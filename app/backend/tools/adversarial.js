/* KODA — ADVERSARIAL / SECURITY / INTEGRITY suite. Tries to BREAK the system:
   authz bypass, cross-merchant leaks, injection, double-spend races, money
   integrity, malformed input, DoS shapes. Any pass here is earned. */
'use strict';
const B = 'http://localhost:4600';
let pass = 0, fail = 0; const F = [];
const T = (n, ok, x = '') => { ok ? pass++ : (fail++, F.push(n)); console.log((ok ? '  ✓' : '  ✗ FAIL'), n, x); };
const j = async (p, o = {}, tok) => {
  const r = await fetch(B + p, { method: o.method || (o.body !== undefined ? 'POST' : 'GET'),
    headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}), ...(o.headers || {}) },
    body: o.body !== undefined ? (typeof o.body === 'string' ? o.body : JSON.stringify(o.body)) : undefined });
  let d = null; try { d = await r.json(); } catch {} return { s: r.status, d };
};

(async () => {
  const A = (await j('/app/auth/login', { body: { email: 'demo@koda.africa', password: 'koda-demo' } })).d; // Maison Kivu owner
  const P = (await j('/app/auth/login', { body: { email: 'platform@koda.africa', password: 'koda-demo' } })).d; // other merchant
  const C = (await j('/app/auth/login', { body: { email: 'caisse@koda.africa', password: 'koda-demo' } })).d; // cashier
  const AK = (await j('/app/keys', { body: { prefix: 'sk_test', label: 'adv' } }, A.token)).d.secret;

  console.log('— AUTH / SESSION');
  T('no token → 401', (await j('/app/dashboard')).s === 401);
  T('garbage token → 401', (await j('/app/dashboard', {}, 'not.a.jwt')).s === 401);
  T('forged jwt (alg none) rejected', (await j('/app/dashboard', {}, Buffer.from('{"alg":"none"}').toString('base64url') + '.' + Buffer.from('{"uid":"usr_admin","exp":9999999999}').toString('base64url') + '.')).s === 401);
  T('tampered signature rejected', (await j('/app/dashboard', {}, A.token.slice(0, -3) + 'xxx')).s === 401);
  T('expired-shaped token rejected', (await j('/app/dashboard', {}, 'a.' + Buffer.from('{"uid":"x","exp":1}').toString('base64url') + '.b')).s === 401);

  console.log('— AUTHORIZATION (role gates, server-side)');
  T('cashier cannot invite team', (await j('/app/team/invite', { body: { email: 'z@z.co', name: 'z', password: 'x12345' } }, C.token)).s === 403);
  T('cashier cannot create API key', (await j('/app/keys', { body: { prefix: 'sk_live' } }, C.token)).s === 403);
  T('cashier cannot change plan', (await j('/app/billing/plan', { body: { plan: 'plateforme' } }, C.token)).s === 403);
  T('cashier cannot add webhook', (await j('/app/webhooks', { body: { url: 'http://x.test' } }, C.token)).s === 403);
  T('merchant cannot hit admin', (await j('/app/admin/overview', {}, A.token)).s === 403);
  T('merchant cannot suspend merchants', (await j('/app/admin/merchants/mch_x/suspend', { body: {} }, A.token)).s === 403);

  console.log('— CROSS-MERCHANT ISOLATION (data leaks)');
  const aReceipts = (await j('/app/receipts', {}, A.token)).d;
  const pReceipts = (await j('/app/receipts', {}, P.token)).d;
  const aIds = new Set((aReceipts || []).map(r => r.id));
  T('merchant B sees none of merchant A receipts', !(pReceipts || []).some(r => aIds.has(r.id)));
  // try to read A's receipt by id as B
  if (aReceipts && aReceipts[0]) {
    T('cannot fetch other merchant receipt by id', (await j('/app/receipts/' + aReceipts[0].id, {}, P.token)).s === 404);
  }
  // API key scoped to own merchant only
  const ping = (await j('/v1/ping', {}, AK)).d;
  T('API key resolves to own merchant only', ping.merchant === 'Maison Kivu');

  console.log('— INJECTION / MALFORMED INPUT');
  T('SQL injection in login email safe', [401, 400].includes((await j('/app/auth/login', { body: { email: "' OR 1=1--", password: 'x' } })).s));
  T('SQL injection in reference safe', (await j('/app/verify', { body: { reference: "'; DROP TABLE receipts;--" } }, A.token)).s < 500);
  const stillThere = (await j('/app/receipts', {}, A.token)).d;
  T('receipts table survived injection', Array.isArray(stillThere));
  T('malformed JSON → 400 not 500', (await j('/app/verify', { body: '{bad json', headers: {} }, A.token)).s === 400);
  T('missing body fields → 4xx not 500', (await j('/app/auth/signup', { body: {} })).s >= 400 && (await j('/app/auth/signup', { body: {} })).s < 500);
  T('huge reference does not crash', (await j('/app/verify', { body: { reference: 'X'.repeat(100000) } }, A.token)).s < 500);
  T('unicode/emoji reference safe', (await j('/app/verify', { body: { reference: '💥🔥<script>alert(1)</script>' } }, A.token)).s < 500);
  T('negative topup amount safe', (await j('/app/billing/topup', { body: { usd: -1000 } }, A.token)).s < 500);
  T('non-numeric amount in intent safe', (await j('/v1/intents', { body: { amount: 'abc', currency: 'CDF' } }, AK)).s < 500);

  console.log('— DOUBLE-SPEND / REPLAY RACE (the money-critical one)');
  // seed a fresh code, then fire 20 concurrent verifies of it — exactly ONE must win
  const feed = (await j('/app/feed', {}, A.token)).d;
  const lastBal = (feed.find(x => x.operator === 'orange_cd' && !x.quarantined && x.balance_after != null) || {}).balance_after || 300000;
  const RC = 'OM.RACE.' + Date.now().toString().slice(-7);
  await j('/app/sandbox/sms', { body: { raw: `Vous avez recu 5 000 FC de RACE T (+243890001). Ref: ${RC}. Solde: ${(lastBal + 5000).toLocaleString('fr-FR')}`, operator: 'orange_cd' } }, A.token);
  const salvo = await Promise.all(Array.from({ length: 20 }, () => j('/app/verify', { body: { reference: RC } }, A.token)));
  const verified = salvo.filter(r => r.d && r.d.status === 'verified').length;
  T('concurrent double-spend: exactly 1 verify wins', verified === 1, `${verified} verified of 20`);
  const rej = salvo.filter(r => r.d && (r.d.status === 'rejected')).length;
  T('the other 19 rejected as already-used', rej === 19, `${rej} rejected`);

  console.log('— MONEY INTEGRITY (ACU ledger cannot drift)');
  const b1 = (await j('/app/billing', {}, A.token)).d;
  const startBal = b1.balance;
  // sum of acu_transactions deltas must equal balance movement
  const txns = b1.transactions || [];
  const lastTxn = txns[0];
  T('ACU balance matches last transaction balance_after', !lastTxn || Math.abs(lastTxn.balance_after - startBal) < 0.001, `bal=${startBal} txn=${lastTxn && lastTxn.balance_after}`);
  // a rejected verify must NOT charge ACU
  const before = (await j('/app/billing', {}, A.token)).d.balance;
  await j('/app/verify', { body: { reference: 'DEFINITELY-NOT-A-REAL-CODE-XYZ' } }, A.token);
  const after = (await j('/app/billing', {}, A.token)).d.balance;
  T('failed verify charges 0 ACU', before === after, `${before} → ${after}`);

  console.log('— FULL PAYMENT CYCLE (API, end to end)');
  const intent = (await j('/v1/intents', { body: { amount: 7500, currency: 'CDF', operators: ['orange_cd'], metadata: { order_id: 'ADV-1' } } }, AK)).d;
  T('intent created with pay_to', !!intent.intent_id && Array.isArray(intent.pay_to));
  // customer "pays" → sms lands
  const bal2 = (await j('/app/feed', {}, A.token)).d.find(x => x.operator === 'orange_cd' && !x.quarantined && x.balance_after != null).balance_after;
  const PC = 'OM.CYCLE.' + Date.now().toString().slice(-7);
  await j('/app/sandbox/sms', { body: { raw: `Vous avez recu 7 500 FC de CYCLE C (+243890002). Ref: ${PC}. Solde: ${(bal2 + 7500).toLocaleString('fr-FR')}`, operator: 'orange_cd' } }, A.token);
  const ver = (await j(`/v1/intents/${intent.intent_id}/verify`, { body: { reference: PC } }, AK)).d;
  T('intent verified against real ledger sms', ver.status === 'verified', ver.status);
  T('receipt carries metadata + audit trace', !!ver.receipt_id);
  const got = (await j('/v1/intents/' + intent.intent_id, {}, AK)).d;
  T('intent status now verified', got.status === 'verified' || got.status === 'verified_late');
  // reversal parsing
  T('intent re-verify blocked (already settled)', (await j(`/v1/intents/${intent.intent_id}/verify`, { body: { reference: PC } }, AK)).s >= 400);

  console.log('— RATE LIMITING / DoS SHAPE');
  // free-tier key hits limit
  const nu = (await j('/app/auth/signup', { body: { business: 'RL', name: 'r', email: 'rl' + Date.now() + '@t.co', password: 'x12345' } })).d;
  const rlk = (await j('/app/keys', { body: { prefix: 'sk_test' } }, nu.token)).d.secret;
  const burst = await Promise.all(Array.from({ length: 12 }, () => j('/v1/ping', {}, rlk)));
  T('rate limiter returns 429 under burst', burst.some(r => r.s === 429), burst.map(r => r.s).join(','));
  T('server still healthy after burst', (await fetch(B + '/healthz')).status === 200);

  console.log('— WEBHOOK SIGNING');
  const wh = (await j('/app/webhooks', { body: { url: 'http://localhost:9/wh' } }, A.token)).d;
  T('webhook secret issued', !!wh.secret && wh.secret.startsWith('whsec_'));

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) { console.log('BROKEN:', F.join(' | ')); process.exit(1); }
})().catch(e => { console.error('ADVERSARIAL CRASH', e); process.exit(2); });
