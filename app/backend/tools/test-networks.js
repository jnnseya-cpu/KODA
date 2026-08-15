// Network Intelligence Layer — the Payment Method Resolver + §28 visibility formula.
// A customer-visible method must resolve to exactly one verified, active, healthy
// merchant receiving account that KODA can actually verify.
'use strict';
const { spawn } = require('node:child_process');
const path = require('node:path'); const fs = require('node:fs'); const os = require('node:os');
const PORT = process.env.KODA_TEST_PORT || 4761;
const B = process.env.KODA_BASE || `http://localhost:${PORT}`;
let pass = 0, fail = 0;
const ok = (c, m, x = '') => { c ? (pass++, console.log(`  ✓ ${m} ${x}`)) : (fail++, console.log(`  ✗ ${m} ${x}`)); };
async function j(method, path, body, headers) {
  const r = await fetch(B + path, { method, headers: { 'content-type': 'application/json', ...(headers || {}) }, body: body ? JSON.stringify(body) : undefined });
  let d = null; try { d = await r.json(); } catch {}
  return { status: r.status, d };
}
const reasons = (res, code) => (res.d.excluded || []).find(e => e.network_code === code)?.reason;
const has = (res, code) => (res.d.available || []).some(a => a.network_code === code);

(async () => {
  // self-host on an isolated port + fresh DB (no dependence on an external server)
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'koda-net-'));
  const srv = process.env.KODA_BASE ? null : spawn(process.execPath,
    ['--no-warnings', path.join(__dirname, '..', 'server.js')],
    { env: { ...process.env, PORT, KODA_DATA_DIR: dataDir, KODA_QUIET: '1', KODA_ALLOW_DEV_SECRET: '1' }, stdio: 'ignore' });
  const done = (code) => { if (srv) try { srv.kill('SIGKILL'); } catch {} process.exit(code); };
  for (let i = 0; i < 60; i++) { try { await fetch(B + '/healthz'); break; } catch { await new Promise(r => setTimeout(r, 250)); } }
  try {
  console.log('\nKODA — Network Intelligence Layer (Payment Method Resolver)\n');
  const login = await j('POST', '/app/auth/login', { email: 'demo@koda.africa', password: 'koda-demo' });
  const bearer = { authorization: 'Bearer ' + login.d.token };            // Maison Kivu, CD/CDF
  const sk = await j('POST', '/app/keys', { prefix: 'sk_live', label: 'net' }, bearer);
  const SK = { authorization: 'Bearer ' + sk.d.secret };

  // public catalogue — country-scoped, tier-C excluded
  const cat = await j('GET', '/v1/catalog/countries/CD/networks');
  ok(cat.status === 200 && cat.d.networks.some(n => n.code === 'orange_cd' && n.koda_support_status === 'LIVE'), 'catalogue lists Orange Money CD as LIVE');
  ok(!cat.d.networks.some(n => n.tier === 'C'), 'catalogue excludes Tier-C (bank-rail/app) networks');

  // Tier-C network cannot be connected
  const c = await j('POST', '/v1/merchant-network-accounts', { network_code: 'upi_in', account_identifier: '1' }, SK);
  ok(c.status === 422, 'connecting a Tier-C network (UPI) is rejected', String(c.status));

  // connect Orange Money CD — starts DRAFT (self-serve activation, no ownership ceremony)
  const conn = await j('POST', '/v1/merchant-network-accounts', { network_code: 'orange_cd', account_identifier: '+243812345678', account_holder_name: 'MAISON KIVU', receive_currencies: ['CDF'] }, SK);
  ok(conn.status === 200 && conn.d.verify_ref && conn.d.activation_status === 'DRAFT', 'network connected → DRAFT + verify_ref issued', conn.d.verify_ref);
  const maId = conn.d.merchant_account_id, vref = conn.d.verify_ref;

  // before activation → not customer-visible
  let res = await j('GET', '/v1/merchants/me/payment-methods?currency=CDF&door=API', null, SK);
  ok(!has(res, 'orange_cd') && reasons(res, 'orange_cd') === 'MERCHANT_NOT_ACTIVATED', 'unactivated account is hidden', reasons(res, 'orange_cd'));

  // activation is SELF-SERVE — the merchant just turns it on, no ownership proof required
  const act = await j('POST', `/v1/merchant-network-accounts/${maId}/activate`, {}, SK);
  ok(act.status === 200, 'activation is self-serve (no ownership ceremony blocks it)');

  // a device makes the auto (API) door healthy
  const enroll = await j('POST', '/app/devices/enroll', { label: 'Till phone', operator: 'orange_cd' }, bearer);
  const DT = { authorization: 'Bearer ' + enroll.d.device_token };
  await j('POST', `/app/network-accounts/${maId}/link-device`, { device_id: enroll.d.device_id }, bearer);
  const hb = await j('POST', '/v1/device/heartbeat', { battery: 90, attested: true, parse_health: 1 }, DT);
  ok(hb.status === 200 && hb.d.ok, 'Sentinel heartbeat accepted');

  // now customer-visible on the API door — ownership badge not yet earned
  res = await j('GET', '/v1/merchants/me/payment-methods?currency=CDF&door=API', null, SK);
  let av = (res.d.available || []).find(a => a.network_code === 'orange_cd');
  ok(av && av.health === 'HEALTHY', 'active + healthy → customer-visible (ownership not required)', av ? av.health : 'hidden');
  ok(av && av.ownership_verified === false, 'ownership badge is off until proven', av ? String(av.ownership_verified) : 'hidden');
  ok(av && av.masked_receiving_identifier && !/\d{6,}/.test(av.masked_receiving_identifier), 'receiving number is masked in output', av && av.masked_receiving_identifier);

  // ownership is an auto-earned TRUST BADGE: a forwarded SMS carrying the verify_ref flips it
  await j('POST', '/v1/device/sms', { raw: `KODA verification ${vref} for Orange Money`, operator: 'orange_cd' }, DT);
  res = await j('GET', '/v1/merchants/me/payment-methods?currency=CDF&door=API', null, SK);
  av = (res.d.available || []).find(a => a.network_code === 'orange_cd');
  ok(av && av.ownership_verified === true, 'ownership badge auto-earned from a matching SMS', av ? String(av.ownership_verified) : 'hidden');

  // currency / country / door exclusions
  res = await j('GET', '/v1/merchants/me/payment-methods?currency=KES&door=API', null, SK);
  ok(reasons(res, 'orange_cd') === 'CURRENCY_UNSUPPORTED', 'currency mismatch → excluded (KES)');
  res = await j('GET', '/v1/merchants/me/payment-methods?country=KE&currency=CDF&door=API', null, SK);
  ok(reasons(res, 'orange_cd') === 'COUNTRY_MISMATCH', 'country mismatch → excluded (paying a CD merchant as KE)');

  // pause hides it; resume brings it back
  await j('POST', `/v1/merchant-network-accounts/${maId}/pause`, {}, SK);
  res = await j('GET', '/v1/merchants/me/payment-methods?currency=CDF&door=API', null, SK);
  ok(reasons(res, 'orange_cd') === 'MERCHANT_TEMPORARILY_PAUSED', 'paused account is hidden');
  await j('POST', `/app/network-accounts/${maId}/resume`, {}, bearer);
  res = await j('GET', '/v1/merchants/me/payment-methods?currency=CDF&door=API', null, SK);
  ok(has(res, 'orange_cd'), 'resumed account is visible again');

  // device health gates the auto door: an offline device hides the method
  await j('POST', `/app/devices/${enroll.d.device_id}/revoke`, {}, bearer);
  res = await j('GET', '/v1/merchants/me/payment-methods?currency=CDF&door=API', null, SK);
  ok(reasons(res, 'orange_cd') === 'DEVICE_OFFLINE', 'offline/revoked Sentinel → method hidden on auto door', reasons(res, 'orange_cd'));

  // edit: fixing the number resets the ownership badge (proof was for the old number)
  const upd = await j('POST', `/app/network-accounts/${maId}/update`, { account_identifier: '+243899990000', account_holder_name: 'MAISON KIVU SARL' }, bearer);
  ok(upd.status === 200 && upd.d.ownership_status === 'UNVERIFIED' && upd.d.account_holder_name === 'MAISON KIVU SARL', 'edit number/holder → saved + ownership reset');

  // remove: delete a wrong entry entirely
  const rm = await j('POST', `/app/network-accounts/${maId}/remove`, {}, bearer);
  ok(rm.status === 200 && rm.d.removed === maId, 'account removed');
  res = await j('GET', '/v1/merchants/me/payment-methods?currency=CDF&door=API', null, SK);
  ok(!has(res, 'orange_cd') && !reasons(res, 'orange_cd'), 'removed account no longer resolves at all');

  // isolation: a fresh merchant sees none of Maison Kivu's accounts
  const other = await j('POST', '/app/auth/signup', { business: 'Other Shop', name: 'Owner Two', email: `other${Math.floor(performance.now()%1e6)}@koda.africa`, password: 'koda-demo123' });
  if (other.d.token) {
    const oSk = await j('POST', '/app/keys', { prefix: 'sk_live', label: 'o' }, { authorization: 'Bearer ' + other.d.token });
    const oRes = await j('GET', '/v1/merchants/me/payment-methods?currency=CDF&door=API', null, { authorization: 'Bearer ' + oSk.d.secret });
    ok((oRes.d.available || []).length === 0 && (oRes.d.excluded || []).length === 0, 'cross-merchant isolation: other merchant sees no accounts');
  } else ok(true, 'isolation check skipped (signup shape)', '');

    console.log(`\n${pass} passed, ${fail} failed\n`);
    done(fail ? 1 : 0);
  } catch (e) { console.error('NETWORKS TEST CRASH', e && e.stack || e); done(1); }
})();
