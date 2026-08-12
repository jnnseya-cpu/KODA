// KODA — SecurityAgent tests. Proves the human gate (honeypot + proof-of-work) and
// the auto-block. Runs against the audit server: loopback is exempt, so we simulate
// a real client with X-Forwarded-For. Human-check enforcement is on by default.
'use strict';
const crypto = require('node:crypto');
const B = process.env.KODA_BASE || 'http://localhost:4720';
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓', n); } else { fail++; console.log('  ✗', n, x ? '· ' + JSON.stringify(x) : ''); } };
async function hit(path, { method = 'GET', ip, body } = {}) {
  const res = await fetch(B + path, { method, redirect: 'manual',
    headers: { 'content-type': 'application/json', ...(ip ? { 'x-forwarded-for': ip } : {}) },
    body: body ? JSON.stringify(body) : undefined });
  let data = null; const text = await res.text(); try { data = JSON.parse(text); } catch {}
  return { status: res.status, data };
}
function solve(ch) {
  const target = '0'.repeat(ch.difficulty);
  for (let n = 0; n < 5e7; n++) if (crypto.createHash('sha256').update(ch.challenge + ':' + n).digest('hex').startsWith(target)) return String(n);
  return '0';
}
const acct = (extra) => ({ business: 'Sec Co', name: 'Sec', email: `sec_${Date.now()}_${Math.floor(Math.random() * 1e6)}@example.com`, password: 'Sec-Test-1!', ...extra });

(async () => {
  console.log(`\n═══ KODA SecurityAgent @ ${B} ═══\n`);
  const IP_A = '198.51.100.7', IP_B = '198.51.100.99';

  const ch = await hit('/app/auth/challenge', { ip: IP_A });
  ok('challenge issued (signed PoW)', ch.status === 200 && ch.data?.challenge && ch.data?.sig && ch.data?.difficulty >= 1, ch.data);

  ok('signup with NO proof-of-work is rejected (human gate)',
    (await hit('/app/auth/signup', { method: 'POST', ip: IP_A, body: acct() })).status === 400);

  const c1 = (await hit('/app/auth/challenge', { ip: IP_A })).data;
  ok('honeypot-filled signup is rejected as a bot',
    (await hit('/app/auth/signup', { method: 'POST', ip: IP_A, body: acct({ challenge: c1, pow: solve(c1), hp_field: 'http://spam' }) })).data?.error?.code === 'bot_detected');

  const c2 = (await hit('/app/auth/challenge', { ip: IP_A })).data;
  const good = await hit('/app/auth/signup', { method: 'POST', ip: IP_A, body: acct({ challenge: c2, pow: solve(c2), hp_field: '' }) });
  ok('signup with a VALID solved proof-of-work succeeds', good.status === 200 && !!good.data?.token, good.data);

  ok('signup with a WRONG proof-of-work is rejected',
    (await hit('/app/auth/signup', { method: 'POST', ip: IP_A, body: acct({ challenge: c2, pow: '999999', hp_field: '' }) })).status === 400);

  // auto-block: hammer the human gate from IP_B until the SecurityAgent blocks it.
  let blocked = false;
  for (let i = 0; i < 25; i++) {
    const r = await hit('/app/auth/signup', { method: 'POST', ip: IP_B, body: acct() }); // no pow → pow_fail each time
    if (r.status === 403 && r.data?.error?.code === 'blocked') { blocked = true; break; }
  }
  ok('SecurityAgent auto-blocks an IP after repeated abuse', blocked);

  ok('loopback / same-host is exempt (tests + health probes still work)',
    (await hit('/healthz')).status === 200);

  console.log(`\n═══ ${fail === 0 ? '✅ SECURITY GREEN' : '❌ FAILURES'} — ${pass} passed, ${fail} failed ═══`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('SECURITY TEST CRASHED:', e); process.exit(2); });
