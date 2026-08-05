// Doors 2 & the Sentinel phone-edge — end-to-end.
//   WhatsApp (Door 2): GET verification handshake, POST signature guard, and an
//     inbound "verify my payment" message that flows through the engine.
//   Device forward: enroll a Sentinel device, forward a real operator SMS with
//     its device token, then confirm the payment through the customer checkout.
'use strict';
const crypto = require('node:crypto');
const B = process.env.KODA_BASE || `http://localhost:${process.env.PORT || 4600}`;
let pass = 0, fail = 0;
const ok = (c, m, x = '') => { c ? (pass++, console.log(`  ✓ ${m} ${x}`)) : (fail++, console.log(`  ✗ ${m} ${x}`)); };
async function j(method, path, body, headers) {
  const r = await fetch(B + path, { method, headers: { 'content-type': 'application/json', ...(headers || {}) }, body: body ? JSON.stringify(body) : undefined });
  let d = null, t = null; try { t = await r.text(); d = JSON.parse(t); } catch {}
  return { status: r.status, d, t };
}

(async () => {
  console.log('\nKODA — WhatsApp door + Sentinel phone-edge\n');

  // ── WhatsApp: verification handshake ──────────────────────────────────────
  const vt = process.env.META_WA_VERIFY_TOKEN || 'koda-verify';
  const good = await j('GET', `/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${vt}&hub.challenge=42abc`);
  ok(good.status === 200 && good.t === '42abc', 'WA handshake echoes challenge on correct token', `→ ${good.t}`);
  const bad = await j('GET', `/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=42abc`);
  ok(bad.status === 403, 'WA handshake rejects wrong verify token (403)');

  // ── WhatsApp: signature guard is skipped when META_APP_SECRET is unset (dev) ─
  const inbound = { entry: [{ changes: [{ value: { metadata: { display_phone_number: '' }, messages: [{ type: 'text', from: '243890000000', text: { body: 'bonjour' } }] } }] }] };
  const nudge = await j('POST', '/webhooks/whatsapp', inbound);
  ok(nudge.status === 200 && nudge.d.received === true, 'WA inbound accepted in dev (no app secret set)');

  // ── Sentinel: enroll a device (merchant side) ─────────────────────────────
  const login = await j('POST', '/app/auth/login', { email: 'demo@koda.africa', password: 'koda-demo' });
  const bearer = { authorization: 'Bearer ' + login.d.token };
  const enroll = await j('POST', '/app/devices/enroll', { label: 'Kiosk phone', operator: 'orange_cd' }, bearer);
  ok(enroll.status === 200 && /^dvk_/.test(enroll.d.device_token || ''), 'device enrolled with a device_token', (enroll.d.device_token || '').slice(0, 10) + '…');
  ok(/^koda:\/\/enroll\/.+\?t=dvk_/.test(enroll.d.qr || ''), 'pairing QR carries the token');
  const DT = { authorization: 'Bearer ' + enroll.d.device_token };

  // ── Sentinel: device forward is rejected without a valid device token ──────
  const noauth = await j('POST', '/v1/device/sms', { raw: 'x' });
  ok(noauth.status === 401, 'device forward without token → 401');
  const wrong = await j('POST', '/v1/device/sms', { raw: 'x' }, { authorization: 'Bearer dvk_nope' });
  ok(wrong.status === 401, 'device forward with bad token → 401');

  // ── Sentinel: forward a REAL operator SMS → it lands in the live ledger ────
  const pk = await j('POST', '/app/keys', { prefix: 'pk_live', label: 'doors' }, bearer);
  const ref = 'OM.260805.1900.DOOR' + Math.floor(performance.now() % 1e5);
  const intent = await j('POST', '/v1/intents', { amount: 33000, currency: 'CDF', operators: ['orange_cd'], success_url: 'https://shop.example.com/ok' }, { authorization: 'Bearer ' + pk.d.secret });
  const fwd = await j('POST', '/v1/device/sms', {
    raw: `Vous avez recu 33 000 FC de DOOR TEST (+243890555444). Ref: ${ref}.`,
    operator: 'orange_cd', battery: 88, attested: true,
  }, DT);
  ok(fwd.status === 200 && fwd.d.parsed === true && !fwd.d.quarantined, 'Sentinel SMS forwarded, parsed into the ledger');

  // ── the customer now confirms via checkout → verified end-to-end ──────────
  const verify = await j('POST', `/checkout/${intent.d.intent_id}/verify`, { cs: intent.d.client_secret, reference: ref });
  ok(verify.status === 200 && (verify.d.status === 'verified' || verify.d.status === 'verified_late'), 'payment VERIFIED off a device-forwarded SMS', verify.d.status);
  ok(verify.d.amount_confirmed === 33000, 'confirmed amount matches', String(verify.d.amount_confirmed));

  // ── device telemetry updated (fleet view) ─────────────────────────────────
  const devices = await j('GET', '/app/devices', null, bearer);
  const dev = (devices.d || []).find(x => x.id === enroll.d.device_id);
  ok(dev && dev.battery === 88, 'device battery telemetry recorded', dev ? String(dev.battery) : 'n/a');

  // ── low/no-internet + feature-phone doors (USSD + inbound SMS) ────────────
  const PHONE = '+243812345678'; // Maison Kivu registered merchant phone (seed)
  const refU = 'OM.260805.1930.USSD' + Math.floor(performance.now() % 1e5);
  const refS = 'OM.260805.1931.SMS' + Math.floor(performance.now() % 1e5);
  await j('POST', '/v1/device/sms', { raw: `Vous avez recu 12 000 FC de USSD TEST (+243890111000). Ref: ${refU}.`, operator: 'orange_cd' }, DT);
  await j('POST', '/v1/device/sms', { raw: `Vous avez recu 9 000 FC de SMS TEST (+243890222000). Ref: ${refS}.`, operator: 'orange_cd' }, DT);

  // USSD: empty text → menu; unregistered number → rejected; code → verified
  const menu = await j('POST', '/webhooks/ussd', { phoneNumber: PHONE, text: '' });
  ok(menu.status === 200 && /^CON /.test(menu.t || ''), 'USSD menu prompts for a code (CON)', (menu.t || '').split('\n')[0]);
  const unreg = await j('POST', '/webhooks/ussd', { phoneNumber: '+10000000', text: '' });
  ok(/^END Numero non enregistre/.test(unreg.t || ''), 'USSD rejects unregistered number');
  const ussdV = await j('POST', '/webhooks/ussd', { phoneNumber: PHONE, text: refU });
  ok(ussdV.status === 200 && /^END Paiement confirme/.test(ussdV.t || ''), 'USSD verifies a real payment (feature phone, no internet)', (ussdV.t || '').replace('END ', ''));

  // Inbound SMS: merchant texts the code to the shortcode → verified reply
  const smsV = await j('POST', '/webhooks/sms', { from: PHONE, text: 'PAY ' + refS });
  ok(smsV.status === 200 && /confirme/i.test(smsV.d.reply || ''), 'inbound SMS verifies a real payment', smsV.d.reply);
  const smsNoCode = await j('POST', '/webhooks/sms', { from: PHONE, text: 'bonjour' });
  ok(/code de transaction/i.test(smsNoCode.d.reply || ''), 'inbound SMS with no code asks for one');

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('DOORS TEST CRASH', e); process.exit(1); });
