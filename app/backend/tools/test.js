// KODA — consolidated test suite (npm test). Boots its own server on a fresh
// database, runs every surface end-to-end, then tears down. CI-able, zero deps.
'use strict';
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const PORT = 4750;
const B = `http://localhost:${PORT}`;
let pass = 0, fail = 0;
const T = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log((ok ? '  ✓' : '  ✗ FAIL'), name, extra); };
const H = (tok) => ({ 'content-type': 'application/json', authorization: `Bearer ${tok}` });
const j = (p, opts = {}, tok) => fetch(B + p, {
  method: opts.method || (opts.body ? 'POST' : 'GET'),
  headers: { 'content-type': 'application/json', ...(tok ? { authorization: `Bearer ${tok}` } : {}), ...(opts.headers || {}) },
  body: opts.body ? JSON.stringify(opts.body) : undefined,
}).then(async r => ({ s: r.status, d: await r.json().catch(() => ({})), r }));

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'koda-test-'));
  const srv = spawn(process.execPath, ['--no-warnings', path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT, KODA_DATA_DIR: dataDir, KODA_QUIET: '1', KODA_ALLOW_DEV_SECRET: '1' }, stdio: 'ignore', detached: false,
  });
  for (let i = 0; i < 40; i++) { // wait for boot
    try { await fetch(B + '/healthz'); break; } catch { await new Promise(r => setTimeout(r, 250)); }
  }

  try {
    console.log('— auth & accounts');
    const owner = (await j('/app/auth/login', { body: { email: 'demo@koda.africa', password: 'koda-demo' } })).d;
    T('owner login', !!owner.token);
    T('bad password rejected', (await j('/app/auth/login', { body: { email: 'demo@koda.africa', password: 'no' } })).s === 401);
    const cashier = (await j('/app/auth/login', { body: { email: 'caisse@koda.africa', password: 'koda-demo' } })).d;
    T('cashier login', cashier.user?.role === 'cashier');
    const admin = (await j('/app/auth/login', { body: { email: 'admin@koda.africa', password: 'koda-admin' } })).d;
    T('admin login', !!admin.user?.is_admin);
    for (const email of ['tunakula@koda.africa', 'scango@koda.africa', 'studyear@koda.africa', 'ticketroyality@koda.africa', 'platform@koda.africa']) {
      const r = (await j('/app/auth/login', { body: { email, password: 'koda-demo' } })).d;
      T(`portfolio account ${email.split('@')[0]}`, !!r.token && !!r.merchant);
    }
    const tk = owner.token;

    console.log('— verification engine (fully automatic)');
    const feed = (await j('/app/feed', {}, tk)).d;
    T('seeded ledger', feed.length >= 6, `rows=${feed.length}`);
    T('spoof quarantined by balance-chain', feed.some(x => x.quarantined === 1));
    // Clean operator SMS auto-verify on arrival — the merchant does nothing.
    const verified = feed.find(x => !x.quarantined && x.matched_intent_id && x.ref_code);
    T('clean payment auto-verified (zero action)', !!verified, `matched=${feed.filter(x => x.matched_intent_id).length}`);
    // Re-checking an already-verified code returns it positively — no double receipt.
    const rc = (await j('/app/verify', { body: { reference: verified.ref_code } }, tk)).d;
    T('re-check says already confirmed', rc.status === 'already_verified' || (rc.status === 'rejected' && rc.code === 'code_already_used'), rc.status);
    // A genuinely fresh (unseen) code has no operator SMS yet → not_found_yet.
    const nf = (await j('/app/verify', { body: { reference: 'OM.NEVER.SEEN.' + Math.floor(Math.random() * 1e6) } }, tk)).d;
    T('unseen code → not_found_yet', nf.status === 'not_found_yet', nf.status);

    console.log('— public API, scopes, agents, limits');
    const key = (await j('/app/keys', { body: { prefix: 'sk_test', label: 'suite' } }, tk)).d.secret;
    T('v1/ping', (await j('/v1/ping', {}, key)).d.ok === true);
    const intent = (await j('/v1/intents', { body: { amount: 25000, currency: 'CDF', operators: ['orange_cd'] } }, key)).d;
    T('intent create', !!intent.intent_id);
    // Idempotency-Key: a repeat create with the same key returns the ORIGINAL verification
    const idem = 'idem-' + Math.floor(Math.random() * 1e9);
    const i1 = (await j('/v1/intents', { body: { amount: 12345, currency: 'CDF', operators: ['orange_cd'] }, headers: { 'idempotency-key': idem } }, key)).d;
    const i2 = (await j('/v1/intents', { body: { amount: 12345, currency: 'CDF', operators: ['orange_cd'] }, headers: { 'idempotency-key': idem } }, key)).d;
    T('idempotency-key returns the same verification', !!i1.intent_id && i1.intent_id === i2.intent_id, `${i1.intent_id} == ${i2.intent_id}`);
    const ver = (await j(`/v1/intents/${intent.intent_id}/verify`, { body: { reference: 'TEST-OK-25000' } }, key)).d;
    T('magic ref verify', ver.status === 'verified');
    T('openapi 3.1', (await j('/v1/openapi.json')).d.openapi === '3.1.0');
    T('agents list', (await j('/v1/agents', {}, key)).d.agents?.length === 5);
    const run = (await j('/v1/agents/reconciler/run', { body: {} }, key)).d;
    T('agent run consumes ACU', run.acu_consumed === 1);
    T('usage endpoint', (await j('/v1/usage', {}, key)).d.acu_balance !== undefined);
    const rk = (await j('/app/keys', { body: { prefix: 'rk_live' } }, tk)).d.secret;
    T('rk key read allowed', (await j('/v1/usage', {}, rk)).s === 200);
    T('rk key run blocked (scope)', (await j('/v1/agents/reconciler/run', { body: {} }, rk)).s === 403);
    T('x-api-key header', (await j('/v1/ping', { headers: { 'x-api-key': key } })).s === 200);
    // key lifecycle: a key must be REVOKED before it can be deleted, and a live key must remain
    await j('/app/keys', { body: { prefix: 'koda_test', label: 'todelete' } }, tk);
    const kRow = (await j('/app/keys', {}, tk)).d.find(x => x.label === 'todelete');
    T('cannot delete an active (non-revoked) key', (await j(`/app/keys/${kRow.id}/delete`, { body: {} }, tk)).s === 409);
    await j(`/app/keys/${kRow.id}/revoke`, { body: {} }, tk);
    T('revoked key deletes while a live key remains', (await j(`/app/keys/${kRow.id}/delete`, { body: {} }, tk)).d.ok === true);
    T('deleted key is gone from the list', !((await j('/app/keys', {}, tk)).d).some(x => x.id === kRow.id));

    console.log('— billing loop');
    const top = (await j('/app/billing/topup', { body: { usd: 10 } }, tk)).d;
    T('topup intent', !!top.intent_id);
    const tc = (await j(`/v1/intents/${top.intent_id}/verify`, { body: { reference: 'TEST-OK-28000' } }, key)).d;
    T('topup verified by own engine', tc.status === 'verified');
    const bill = (await j('/app/billing', {}, tk)).d;
    T('ACU credited +100', bill.transactions.some(x => x.kind === 'topup' && x.delta === 100));

    console.log('— operations');
    T('device enroll', !!(await j('/app/devices/enroll', { body: { label: 'T', operator: 'mpesa_cd' } }, tk)).d.enrol_code);
    // Sentinel reports its build's capture mode (sms side-load / notification Play) via heartbeat
    const capDev = (await j('/app/devices/enroll', { body: { label: 'CapPhone', operator: 'orange_cd' } }, tk)).d;
    T('device defaults to sms capture', ((await j('/app/devices', {}, tk)).d).find(x => x.label === 'CapPhone')?.capture === 'sms');
    await j('/v1/device/heartbeat', { body: { battery: 80, capture: 'notification' } }, capDev.device_token);
    T('heartbeat updates capture mode to notification', ((await j('/app/devices', {}, tk)).d).find(x => x.label === 'CapPhone')?.capture === 'notification');
    // operator picker: dropdown source — human names + codes, SMS-verifiable only, never empty
    const ops = (await j('/app/operators', {}, tk)).d;
    T('operators span all supported countries (not just home)', Array.isArray(ops.operators) && new Set(ops.operators.map(o => o.country)).size > 20);
    T('operators carry code + human name + country', ops.operators.every(o => o.code && o.name && o.country) && ops.operators.some(o => /money|orange|airtel|m-?pesa/i.test(o.name)));
    const opsCd = (await j('/app/operators?country=CD', {}, tk)).d;
    T('country filter narrows to that country only', opsCd.operators.length > 0 && opsCd.operators.every(o => o.country === 'CD'));
    T('operators exclude tier-C (non-SMS-verifiable) rails', !ops.operators.some(o => o.code === 'upi_in'));
    // device-less MANUAL door: the merchant pastes the operator SMS by hand (no Sentinel)
    // and it verifies a waiting order. A balance "gap" (normal for occasional pastes) must
    // NOT quarantine it — chain-gating is only for continuous device streams.
    await j('/v1/intents', { body: { amount: 33000, currency: 'CDF', operators: ['orange_cd'] } }, key);
    const paste1 = (await j('/app/verify-sms', { body: { raw: 'Vous avez recu 33 000 FC de A Kalala (0810000001). Ref: OMDL01. Solde: 500 000' } }, tk)).d;
    T('device-less SMS paste verifies an order (no Sentinel needed)', paste1.status === 'verified');
    await j('/v1/intents', { body: { amount: 44000, currency: 'CDF', operators: ['orange_cd'] } }, key);
    const paste2 = (await j('/app/verify-sms', { body: { raw: 'Vous avez recu 44 000 FC de B Mumba (0810000002). Ref: OMDL02. Solde: 90 000' } }, tk)).d;
    T('manual paste with a balance gap is NOT quarantined', paste2.status === 'verified');
    const dsp = (await j('/app/disputes', { body: { reference: 'X.1', reason: 'suite' } }, tk)).d;
    T('dispute open + evidence', dsp.status === 'open' && !!dsp.evidence);
    T('dispute resolve', (await j(`/app/disputes/${dsp.id}/resolve`, { body: { outcome: 'accepted' } }, tk)).d.ok === true);
    const wh = (await j('/app/webhooks', { body: { url: 'http://localhost:9/wh' } }, tk)).d;
    T('webhook endpoint add', !!wh.secret);
    const rot = (await j(`/app/webhooks/${wh.id}/rotate`, { body: {} }, tk)).d;
    T('webhook secret rotates (new whsec, differs)', !!rot.secret && rot.secret.startsWith('whsec_') && rot.secret !== wh.secret);
    // webhook has a name and the FULL secret is retrievable (copyable) by the owner
    const named = (await j('/app/webhooks', { body: { url: 'http://localhost:9/named', name: 'WooCommerce prod' } }, tk)).d;
    T('webhook stores a name + returns full secret on create', named.name === 'WooCommerce prod' && named.secret.startsWith('whsec_') && named.secret.length > 20);
    const listed = ((await j('/app/webhooks', {}, tk)).d.endpoints || []).find(e => e.id === named.id);
    T('GET returns the webhook name + full secret (copyable)', !!listed && listed.name === 'WooCommerce prod' && listed.secret === named.secret);
    // verification.* event namespace fires ADDITIVELY (payment.verified still fires)
    await j('/app/webhooks', { body: { url: 'http://localhost:9/whv', events: ['*'] } }, tk);
    const vok = (await j('/v1/intents', { body: { amount: 5000, currency: 'CDF', operators: ['orange_cd'] } }, key)).d;
    await j(`/v1/intents/${vok.intent_id}/verify`, { body: { reference: 'TEST-OK-5000' } }, key);
    const vbad = (await j('/v1/intents', { body: { amount: 5000, currency: 'CDF', operators: ['orange_cd'] } }, key)).d;
    await j(`/v1/intents/${vbad.intent_id}/verify`, { body: { reference: 'TEST-REPLAY' } }, key);
    const dv = (await j('/app/webhooks', {}, tk)).d.deliveries || [];
    const evs = new Set(dv.map(d => d.event));
    T('verification.succeeded fires on verify', evs.has('verification.succeeded'));
    T('verification.duplicate_detected fires on replay', evs.has('verification.duplicate_detected'));
    T('payment.verified still fires (backward compat)', evs.has('payment.verified'));
    // §12 timestamped signature: Koda-Signature: t=,v1= alongside legacy x-koda-signature
    const whlib = require('../lib/webhooks'), util = require('../lib/util');
    const hdr = whlib.signHeaders('sekret', '{"a":1}', 'evt_x');
    const mm = /^t=(\d+),v1=([a-f0-9]+)$/.exec(hdr['koda-signature'] || '');
    T('koda-signature is timestamped (t=,v1=) + legacy header intact',
      !!mm && hdr['x-koda-signature'] === util.hmac('sekret', '{"a":1}') && mm[2] === util.hmac('sekret', mm[1] + '.{"a":1}'));
    // §15 routing: a destination-scoped endpoint only gets matching events; catch-all gets all
    const woo = (await j('/app/webhooks', { body: { url: 'http://localhost:9/woo', destination: 'woocommerce' } }, tk)).d;
    const pos = (await j('/app/webhooks', { body: { url: 'http://localhost:9/pos', destination: 'pos' } }, tk)).d;
    const vr = (await j('/v1/intents', { body: { amount: 7000, currency: 'CDF', operators: ['orange_cd'], metadata: { destination: 'woocommerce' } } }, key)).d;
    await j(`/v1/intents/${vr.intent_id}/verify`, { body: { reference: 'TEST-OK-7000' } }, key);
    const dv2 = (await j('/app/webhooks', {}, tk)).d.deliveries || [];
    T('routing: woocommerce endpoint received the event', dv2.some(d => d.endpoint_id === woo.id));
    T('routing: pos endpoint did NOT receive it', !dv2.some(d => d.endpoint_id === pos.id));
    // /v1/verifications alias (§36): create + verify via the alias path works identically
    const va = (await j('/v1/verifications', { body: { amount: 8500, currency: 'CDF', operators: ['orange_cd'] } }, key)).d;
    T('POST /v1/verifications creates a verification', !!va.intent_id);
    T('GET /v1/verifications/:id via alias', (await j(`/v1/verifications/${va.intent_id}`, {}, key)).d.status === 'awaiting_payment');
    T('POST /v1/verifications/:id/verify via alias', (await j(`/v1/verifications/${va.intent_id}/verify`, { body: { reference: 'TEST-OK-8500' } }, key)).d.status === 'verified');
    // amount_mismatch outcome (§24): SMS confirms a different amount than the order expected
    const vm = (await j('/v1/intents', { body: { amount: 99999, currency: 'CDF', operators: ['orange_cd'] } }, key)).d;
    await j('/app/sandbox/sms', { body: { raw: `Vous avez recu 12 000 FC de MISMATCH. Ref: OM.AMTMIS.1. Solde: 500 000`, operator: 'orange_cd' } }, tk);
    const mmv = (await j(`/v1/intents/${vm.intent_id}/verify`, { body: { reference: 'OM.AMTMIS.1' } }, key)).d;
    T('amount_mismatch rejects a wrong-amount payment', mmv.status === 'rejected' && mmv.code === 'amount_mismatch', `${mmv.status}/${mmv.code}`);
    // USD units regression: intents carry MINOR units (589 = $5.89) while the operator
    // SMS writes the human amount ("5.89 USD"). Compared raw, every honest USD payment
    // was an amount_mismatch — and the hosted checkout asked a real buyer for
    // "589 USD" on a $5.89 order. The units bridge is shared/currency.js; the proof is
    // that this SMS AUTO-verifies the intent on ingestion (auto-match needs the
    // amounts to agree), which was impossible before the fix.
    const vusd = (await j('/v1/intents', { body: { amount: 589, currency: 'USD', operators: ['orange_cd'] } }, key)).d;
    await j('/app/sandbox/sms', { body: { raw: `Vous avez recu 5.89 USD de JUSTIN TEST (0002). Ref: OM.USD589.1. Solde: 100`, operator: 'orange_cd' } }, tk);
    const usdi = (await j(`/v1/intents/${vusd.intent_id}`, {}, key)).d;
    T('a USD SMS in display units verifies a minor-unit intent', usdi.status === 'verified' || usdi.status === 'verified_late', String(usdi.status));
    // units bridge robustness: ANY unlisted 2-decimal rail must still bridge (default is
    // 2 decimals, not 0) — otherwise KODA's expansion currencies (EGP, MAD, TZS, BDT, …)
    // would silently re-introduce the 100× bug. Franc rails stay whole; 3-decimal scale ×1000.
    const cur = require('../../shared/currency');
    T('currency: unlisted 2-decimal rails default to minor units (no 100× regression)',
      cur.toMinor(5.89, 'TZS') === 589 && cur.toDisplay(589, 'EGP') === 5.89 && cur.decimals('MAD') === 2);
    T('currency: franc rails stay whole (factor 1); 3-decimal rails scale ×1000',
      cur.toMinor(25000, 'CDF') === 25000 && cur.factor('XOF') === 1 && cur.toMinor(1.234, 'BHD') === 1234);
    // The three extra requests above tip the per-minute rate limiter mid-suite;
    // give the window a beat so later tests measure their own behaviour, not ours.
    await new Promise(r => setTimeout(r, 1200));
    // DUAL-CURRENCY SAFETY: DRC runs CDF and USD side by side, so 589 CDF and 5.89 USD
    // share the stored minor value 589. A 589 FC payment (~$0.21) must NOT satisfy a
    // $5.89 (589-minor USD) order. Generic-parse SMS (no phone) so the walk-in path holds
    // it for review and leaves the code free for the explicit currency-mismatched verify.
    const kj2 = async (p, body) => { let r = await j(p, body ? { body } : {}, key); if (r.d && r.d.error && r.d.error.code === 'rate_limited') { await new Promise(x => setTimeout(x, 1100)); r = await j(p, body ? { body } : {}, key); } return r.d; };
    const vDual = await kj2('/v1/intents', { amount: 589, currency: 'USD', operators: ['orange_cd'] });
    await j('/app/sandbox/sms', { body: { raw: `Vous avez recu 589 FC de MISMATCH. Ref: OM.DUALCUR.1.`, operator: 'orange_cd' } }, tk);
    const dualV = await kj2(`/v1/intents/${vDual.intent_id}/verify`, { reference: 'OM.DUALCUR.1' });
    T('dual-currency: a 589 CDF payment cannot satisfy a 589-minor USD order', dualV.status === 'rejected' && dualV.code === 'amount_mismatch', `${dualV.status}/${dualV.code}`);
    // admin-created merchant welcome email carries login + temp password (customer can sign in)
    const wemail = require('../comms/email').renderEmail({
      subject: 'x', event: { key: 'merchant.activated' }, merchant: { name: 'Acme' }, user: {},
      data: { merchant: 'Acme Co', email: 'new@cust.co', temp_password: 'TMP-abc123', cta: 'Sign in to KODA', cta_url: 'https://kodajnn.com/app#login' },
    });
    T('welcome email includes email + temp password + sign-in link',
      wemail.includes('new@cust.co') && wemail.includes('TMP-abc123') && wemail.includes('kodajnn.com/app#login'));
    // a SUSPENDED merchant blocks all its users (session login + existing token)
    const susp = (await j('/app/admin/merchants', { body: { business: 'SuspendCo', email: 'susp@co.test', name: 'Suzy' } }, admin.token)).d;
    const suspLogin1 = await j('/app/auth/login', { body: { email: 'susp@co.test', password: susp.temp_password } });
    T('active merchant can log in', suspLogin1.s === 200 && !!suspLogin1.d.token);
    const suspTok = suspLogin1.d.token;
    await j(`/app/admin/merchants/${susp.merchant.id}/suspend`, { body: {} }, admin.token);
    T('suspended merchant CANNOT log in', (await j('/app/auth/login', { body: { email: 'susp@co.test', password: susp.temp_password } })).s === 403);
    T('suspended merchant existing session token is revoked', (await j('/app/me', {}, suspTok)).s === 403);
    // admin can permanently DELETE a merchant — but ONLY once it is suspended
    const delActive = (await j('/app/admin/merchants', { body: { business: 'DelActiveCo', email: 'da@co.test', name: 'Deb' } }, admin.token)).d;
    T('delete blocked while merchant is active', (await j(`/app/admin/merchants/${delActive.merchant.id}/delete`, { body: {} }, admin.token)).s === 409);
    const delRes = (await j(`/app/admin/merchants/${susp.merchant.id}/delete`, { body: {} }, admin.token)).d;
    T('suspended merchant deleted', delRes.ok === true && delRes.deleted === susp.merchant.id);
    T('deleted merchant gone from admin list', !((await j('/app/admin/merchants', {}, admin.token)).d).some(x => x.id === susp.merchant.id));
    T('deleted merchant owner cannot log in', (await j('/app/auth/login', { body: { email: 'susp@co.test', password: susp.temp_password } })).s !== 200);
    // weekly product newsletter — feature-selling email with many deep links, opt-out honoured
    const nlStat = (await j('/app/admin/newsletter', {}, admin.token)).d;
    const nlLinks = (nlStat.preview_html.match(/href="https:\/\/kodajnn\.com/g) || []).length;
    T('newsletter: recipients + subject + many hyperlinks', nlStat.recipients > 0 && !!nlStat.subject && nlLinks >= 15, `${nlStat.recipients} users · ${nlLinks} links`);
    const nlSend = (await j('/app/admin/newsletter/send', { body: { test: true } }, admin.token)).d;
    T('newsletter: admin can send a test', nlSend.ok === true && nlSend.recipients === 1);
    const nlCrypto = require('node:crypto');
    T('newsletter: invalid unsubscribe token is refused', (await (await fetch(B + '/unsubscribe?u=nobody&t=bad')).text()).includes('invalid or has expired'));
    // a VALID tokenised link unsubscribes and drops the recipient count
    const nlOwner = (await j('/app/auth/login', { body: { email: 'demo@koda.africa', password: 'koda-demo' } })).d.user;
    const nlTok = nlCrypto.createHmac('sha256', process.env.KODA_JWT_SECRET || 'koda-dev-secret-change-in-production').update('nl:' + nlOwner.id).digest('hex').slice(0, 32);
    const before = (await j('/app/admin/newsletter', {}, admin.token)).d.recipients;
    await fetch(B + `/unsubscribe?u=${nlOwner.id}&t=${nlTok}`);
    T('newsletter: valid unsubscribe drops the recipient', (await j('/app/admin/newsletter', {}, admin.token)).d.recipients === before - 1);
    // self-service change password + admin resend-credentials-without-seeing
    const pwm = (await j('/app/admin/merchants', { body: { business: 'PwCo', email: 'pw@co.test', name: 'Pia' } }, admin.token)).d;
    const pwLogin = (await j('/app/auth/login', { body: { email: 'pw@co.test', password: pwm.temp_password } })).d;
    T('change password: wrong current rejected', (await j('/app/account/password', { body: { current_password: 'nope', new_password: 'brandnew123' } }, pwLogin.token)).s === 403);
    T('change password succeeds', (await j('/app/account/password', { body: { current_password: pwm.temp_password, new_password: 'brandnew123' } }, pwLogin.token)).d.ok === true);
    T('can log in with the new password', (await j('/app/auth/login', { body: { email: 'pw@co.test', password: 'brandnew123' } })).s === 200);
    const resend = (await j(`/app/admin/merchants/${pwm.merchant.id}/resend-welcome`, { body: {} }, admin.token)).d;
    T('admin resend returns sent_to but NEVER the password', resend.ok === true && resend.sent_to === 'pw@co.test' && resend.temp_password === undefined);
    T('resend set a fresh temp password (old one no longer works)', (await j('/app/auth/login', { body: { email: 'pw@co.test', password: 'brandnew123' } })).s === 401);
    // merchant can set their pay-to number → it shows on the customer checkout
    await j('/app/settings/profile', { body: { msisdn: '+243 812 345 678' } }, tk);
    T('merchant pay-to number is editable', (await j('/app/me', {}, tk)).d.merchant.msisdn === '+243 812 345 678');
    // The profile number belongs to ONE network (+243 81x = M-Pesa) and may only ever
    // be offered as that network's pay-to. Offering it for other operators once showed
    // a merchant's UK contact number as the pay-to for four Congolese networks.
    const payIntent = (await j('/v1/intents', { body: { amount: 6000, currency: 'CDF', operators: ['mpesa_cd', 'orange_cd'] } }, key)).d;
    T('checkout pay_to shows the merchant number on its own network', (payIntent.pay_to || []).some(p => p.operator === 'mpesa_cd' && p.number === '+243 812 345 678'));
    T('checkout pay_to never lends the number to another network', !(payIntent.pay_to || []).some(p => p.operator !== 'mpesa_cd'));
    const wrongNet = (await j('/v1/intents', { body: { amount: 6100, currency: 'CDF', operators: ['orange_cd'] } }, key)).d;
    T('no enrolled account + wrong-network profile number = an empty pay_to, not a wrong one', (wrongNet.pay_to || []).length === 0);
    T('cashier cannot invite', (await j('/app/team/invite', { body: { email: 'x@x.co', name: 'x' } }, cashier.token)).s === 403);

    console.log('— communications');
    // The event catalogue / preview / test are OPERATOR tooling — admin-only now.
    T('comms catalogue is admin-only (merchant refused)', (await j('/app/comms/catalogue', {}, tk)).s === 403);
    const cat = (await j('/app/comms/catalogue', {}, admin.token)).d;
    const { ALL: CAT_ALL, CATEGORIES: CAT_CATS } = require('../../shared/events');
    T('catalogue matches source of truth', cat.stats.total === CAT_ALL.length && cat.stats.categories === CAT_CATS.length && cat.stats.total >= 150,
      `${cat.stats.total} events · ${cat.stats.categories} categories · mandatory=${cat.stats.mandatory}`);
    T('email preview renders (admin QA)', (await j('/app/comms/preview/payment.verified', {}, admin.token)).d.html.length > 100);
    T('test fire (admin QA)', (await j('/app/comms/test/billing.low_balance', { body: {} }, admin.token)).s === 200);
    T('prefs save', (await j('/app/comms/prefs', { body: { sms: false } }, tk)).d.ok === true);

    console.log('— WhatsApp Door 2');
    const ch = await fetch(B + '/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=koda-verify&hub.challenge=OK9');
    T('meta handshake', (await ch.text()) === 'OK9');
    const last = feed.find(s => s.operator === 'orange_cd' && !s.quarantined && s.balance_after != null);
    const bal = (last ? last.balance_after : 250000) + 30000;
    await j('/app/sandbox/sms', { body: { raw: `Vous avez recu 30 000 FC de SUITE C (+243891234). Ref: OM.999999.TEST.SUITE1. Solde: ${bal.toLocaleString('fr-FR')}`, operator: 'orange_cd' } }, tk);
    await j('/webhooks/whatsapp', { body: { entry: [{ changes: [{ value: { metadata: { display_phone_number: '243812345678' }, messages: [{ type: 'text', from: '2438999', text: { body: 'code: OM.999999.TEST.SUITE1' } }] } }] }] } });
    const receipts = (await j('/app/receipts', {}, tk)).d;
    // With auto-verify, a clean SMS is confirmed the moment it lands (mode 'manual');
    // the WhatsApp door then acts as a confirmation channel. Either way the payment
    // must end verified with a receipt for this reference.
    T('chat-door verification', receipts.some(r => r.reference === 'OM.999999.TEST.SUITE1'));

    console.log('— platform & admin');
    const plat = (await j('/app/auth/login', { body: { email: 'platform@koda.africa', password: 'koda-demo' } })).d;
    const subs = (await j('/app/submerchants', {}, plat.token)).d;
    T('platform has sub-merchants', subs.length >= 2, `subs=${subs.length}`);
    T('admin overview', (await j('/app/admin/overview', {}, admin.token)).d.merchants >= 6);
    T('merchant blocked from admin', (await j('/app/admin/overview', {}, tk)).s === 403);

    console.log('— static & PWA & site');
    for (const p of ['/', '/app', '/styles.css', '/app.js', '/sw.js', '/manifest.webmanifest', '/icon.svg', '/shared/plans.js',
      '/about', '/how-it-works', '/industries', '/blog', '/developers', '/contact', '/get-started', '/growth', '/terms', '/privacy', '/policies', '/status']) {
      T(`GET ${p}`, (await fetch(B + p)).status === 200);
    }

    console.log('— SEO: sitemap, robots, JSON-LD & IndexNow');
    const sm = await (await fetch(B + '/sitemap.xml')).text();
    const locs = (sm.match(/<loc>/g) || []).length;
    T('sitemap.xml lists blog + city pages', locs >= 70, `${locs} URLs`);
    T('robots.txt points at sitemap', (await (await fetch(B + '/robots.txt')).text()).includes('Sitemap:'));
    T('homepage carries WebSite JSON-LD', (await (await fetch(B + '/')).text()).includes('"@type":"WebSite"'));
    // Self-referencing canonicals (https, non-www) so redirecting variants aren't indexed
    // ("Page with redirect"). Each page's canonical must point at its OWN absolute URL.
    for (const [p, want] of [['/', 'https://kodajnn.com/'], ['/how-it-works', 'https://kodajnn.com/how-it-works'], ['/coverage', 'https://kodajnn.com/coverage'], ['/pricing', 'https://kodajnn.com/pricing']]) {
      const h = await (await fetch(B + p)).text();
      T(`canonical self-references ${p}`, h.includes(`rel="canonical" href="${want}"`) && (h.match(/rel="canonical"/g) || []).length === 1);
    }
    const idx = require('../lib/indexnow');
    const kf = await fetch(B + idx.KEY_PATH);
    T('IndexNow key file served at /<key>.txt', kf.status === 200 && (await kf.text()).trim() === idx.KEY);
    T('IndexNow reads the built sitemap URLs', idx.urls().length >= 70, `${idx.urls().length} urls`);
    T('IndexNow submit refuses an empty list (no accidental ping)', (await idx.submit([])).ok === false);
    idx.recordAnnounced([]); // reset baseline so this block is deterministic across repeated runs
    T('IndexNow first run announces all URLs', idx.pendingChanges().added.length === idx.urls().length);
    idx.recordAnnounced(idx.urls()); // simulate a completed announce
    T('IndexNow re-ping is change-gated (silent when nothing changed)', idx.pendingChanges().added.length === 0);
  } finally {
    srv.kill('SIGTERM');
    setTimeout(() => { try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch {} }, 500);
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main().catch(e => { console.error('SUITE CRASH', e); process.exit(1); });
