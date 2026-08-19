// KODA — sandbox-reference gate (security regression).
// A customer holding only an intent's client_secret must NOT be able to type a magic
// "TEST-OK-<amount>" reference at a LIVE checkout and receive a verified receipt for
// nothing. Sandbox refs are honoured ONLY on test-mode intents (created by a koda_test
// key) or when KODA_ALLOW_SANDBOX_REFS is set (dev/CI). This suite boots a server WITHOUT
// that flag — i.e. production-like — and proves the gate holds.
'use strict';
const { spawn } = require('node:child_process');
const path = require('node:path'), fs = require('node:fs'), os = require('node:os');
const PORT = process.env.KODA_TEST_PORT || 4788;
const B = `http://localhost:${PORT}`;
let pass = 0, fail = 0;
const ok = (c, m, x = '') => { c ? (pass++, console.log(`  ✓ ${m} ${x}`)) : (fail++, console.log(`  ✗ FAIL ${m} ${x}`)); };
const j = (m, p, body, tok) => fetch(B + p, {
  method: m, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) },
  body: body ? JSON.stringify(body) : undefined,
}).then(async r => ({ s: r.status, d: await r.json().catch(() => ({})) }));

(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'koda-sbx-'));
  // Production-like env: the server may boot with the dev secret, but sandbox refs are OFF.
  const env = { ...process.env, PORT: String(PORT), KODA_DATA_DIR: dataDir, KODA_QUIET: '1', KODA_ALLOW_DEV_SECRET: '1' };
  delete env.KODA_ALLOW_SANDBOX_REFS;
  const srv = spawn(process.execPath, ['--no-warnings', path.join(__dirname, '..', 'server.js')], { env, stdio: 'ignore' });
  const done = (code) => { try { srv.kill('SIGKILL'); } catch {} process.exit(code); };
  for (let i = 0; i < 60; i++) { try { await fetch(B + '/healthz'); break; } catch { await new Promise(r => setTimeout(r, 250)); } }
  try {
    console.log('\nKODA — sandbox-reference gate (production-like: KODA_ALLOW_SANDBOX_REFS unset)\n');
    const login = (await j('POST', '/app/auth/login', { email: 'demo@koda.africa', password: 'koda-demo' })).d;
    const tk = login.token;
    const liveKey = (await j('POST', '/app/keys', { prefix: 'sk_live', label: 'gate-live' }, tk)).d.secret;
    const testKey = (await j('POST', '/app/keys', { prefix: 'sk_test', label: 'gate-test' }, tk)).d.secret;
    ok(/^koda_live_/.test(liveKey) && /^koda_test_/.test(testKey), 'minted a live key and a test key', `${(liveKey||'').slice(0,10)} / ${(testKey||'').slice(0,10)}`);

    // 1) THE EXPLOIT PATH: a LIVE order + customer-facing checkout must reject TEST-OK.
    const liveIntent = (await j('POST', '/v1/intents', { amount: 25000, currency: 'CDF', operators: ['orange_cd'] }, liveKey)).d;
    const cust = await j('POST', `/checkout/${liveIntent.intent_id}/verify`, { cs: liveIntent.client_secret, reference: 'TEST-OK-25000' });
    ok(cust.d.status !== 'verified' && cust.d.status !== 'verified_late',
      'customer checkout: TEST-OK does NOT verify a LIVE order', `status=${cust.d.status}`);

    // 2) LIVE API verify must also reject TEST-OK.
    const apiLive = (await j('POST', `/v1/intents/${liveIntent.intent_id}/verify`, { reference: 'TEST-OK-25000' }, liveKey)).d;
    ok(apiLive.status !== 'verified' && apiLive.status !== 'verified_late',
      'live API key: TEST-OK does NOT verify a live intent', `status=${apiLive.status}`);

    // 3) A genuine sandbox context still works: a TEST-mode intent (koda_test key) verifies.
    const testIntent = (await j('POST', '/v1/intents', { amount: 25000, currency: 'CDF', operators: ['orange_cd'] }, testKey)).d;
    const apiTest = (await j('POST', `/v1/intents/${testIntent.intent_id}/verify`, { reference: 'TEST-OK-25000' }, testKey)).d;
    ok(apiTest.status === 'verified' || apiTest.status === 'verified_late',
      'test key: TEST-OK still verifies a sandbox (test-mode) intent', `status=${apiTest.status}`);

    console.log(`\n${fail === 0 ? '✅ SANDBOX GATE GREEN' : '❌ SANDBOX GATE FAILED'} — ${pass} passed, ${fail} failed\n`);
    done(fail === 0 ? 0 : 1);
  } catch (e) { console.error('SANDBOX GATE CRASH', e); done(1); }
})();
