// KODA — load / performance harness. Boots an isolated instance, drives a
// realistic request mix at a fixed concurrency, and reports p50/p95/p99 latency,
// throughput and error rate — overall and per endpoint. Evidence for the launch
// audit's performance gate. Tunable: LOAD_N (total reqs), LOAD_C (concurrency).
'use strict';
const { spawn } = require('node:child_process');
const path = require('node:path'), fs = require('node:fs'), os = require('node:os');

const PORT = process.env.LOAD_PORT || 4930;
const BASE = process.env.KODA_BASE || `http://localhost:${PORT}`;
const N = Number(process.env.LOAD_N) || 3000;     // total requests
const C = Number(process.env.LOAD_C) || 50;       // concurrent workers

async function j(method, p, body, headers) {
  const r = await fetch(BASE + p, { method, headers: { 'content-type': 'application/json', ...(headers || {}) }, body: body ? JSON.stringify(body) : undefined });
  let d = null; try { d = await r.json(); } catch {}
  return { status: r.status, d };
}
const pct = (arr, q) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'koda-load-'));
  const srv = process.env.KODA_BASE ? null : spawn(process.execPath, ['--no-warnings', path.join(__dirname, '..', 'server.js')],
    { env: { ...process.env, PORT, KODA_DATA_DIR: dataDir, KODA_QUIET: '1', KODA_ALLOW_DEV_SECRET: '1' }, stdio: 'ignore' });
  const done = (code) => { if (srv) try { srv.kill('SIGKILL'); } catch {} process.exit(code); };
  for (let i = 0; i < 80; i++) { try { await fetch(BASE + '/healthz'); break; } catch { await new Promise(r => setTimeout(r, 250)); } }

  try {
    // set up: a key + a pool of intents to poll/read (realistic read-heavy traffic)
    const login = await j('POST', '/app/auth/login', { email: 'demo@koda.africa', password: 'koda-demo' });
    const sk = (await j('POST', '/app/keys', { prefix: 'sk_live', label: 'load' }, { authorization: 'Bearer ' + login.d.token })).d.secret;
    const KEY = { authorization: 'Bearer ' + sk };
    const intents = [];
    for (let i = 0; i < 20; i++) {
      const r = await j('POST', '/v1/intents', { amount: 25000, currency: 'CDF', operators: ['orange_cd'] }, KEY);
      if (r.d && r.d.intent_id) intents.push({ id: r.d.intent_id, cs: r.d.client_secret });
    }
    // weighted request mix — mostly reads, some writes (mirrors real API traffic)
    const pick = () => {
      const x = Math.random(), it = intents[Math.floor(Math.random() * intents.length)];
      if (x < 0.30) return ['ping', () => j('GET', '/v1/ping', null, KEY)];
      if (x < 0.50) return ['poll_intent', () => j('GET', `/v1/intents/${it.id}`, null, KEY)];
      if (x < 0.65) return ['checkout_read', () => j('GET', `/checkout/${it.id}?cs=${encodeURIComponent(it.cs)}`)];
      if (x < 0.78) return ['billing_methods', () => j('GET', '/v1/billing/methods?amount_acu=500', null, KEY)];
      if (x < 0.88) return ['operators', () => j('GET', '/v1/operators')];
      if (x < 0.96) return ['create_intent', () => j('POST', '/v1/intents', { amount: 7500, currency: 'CDF', operators: ['orange_cd'] }, KEY)];
      return ['healthz', () => j('GET', '/healthz')];
    };

    const lat = [], errs = [], byEp = {};
    let issued = 0;
    const t0 = performance.now();
    async function worker() {
      while (issued < N) {
        issued++;
        const [ep, fn] = pick();
        const s = performance.now();
        let okReq = false;
        try { const r = await fn(); okReq = r.status < 500; } catch { okReq = false; }
        const ms = performance.now() - s;
        lat.push(ms);
        (byEp[ep] = byEp[ep] || { n: 0, lat: [], err: 0 }); byEp[ep].n++; byEp[ep].lat.push(ms);
        if (!okReq) { errs.push(ep); byEp[ep].err++; }
      }
    }
    await Promise.all(Array.from({ length: C }, worker));
    const secs = (performance.now() - t0) / 1000;

    console.log(`\nKODA — load test · ${N} requests · concurrency ${C}\n`);
    console.log(`  throughput   ${(N / secs).toFixed(0)} req/s   (${secs.toFixed(1)}s wall)`);
    console.log(`  latency ms   p50 ${pct(lat, .50).toFixed(1)} · p95 ${pct(lat, .95).toFixed(1)} · p99 ${pct(lat, .99).toFixed(1)} · max ${Math.max(...lat).toFixed(1)}`);
    console.log(`  error rate   ${(errs.length / N * 100).toFixed(2)}%  (${errs.length} of ${N}, 5xx/conn only)\n`);
    console.log('  per endpoint            n     p50     p95     p99    err');
    for (const [ep, s] of Object.entries(byEp)) {
      console.log(`  ${ep.padEnd(20)} ${String(s.n).padStart(5)}  ${pct(s.lat, .5).toFixed(1).padStart(6)}  ${pct(s.lat, .95).toFixed(1).padStart(6)}  ${pct(s.lat, .99).toFixed(1).padStart(6)}  ${String(s.err).padStart(4)}`);
    }
    // launch gate: p95 < 250ms and error rate < 1% on this single-instance box
    const p95 = pct(lat, .95), errRate = errs.length / N;
    const passGate = p95 < 250 && errRate < 0.01;
    console.log(`\n  gate: p95<250ms & err<1%  →  ${passGate ? 'PASS' : 'REVIEW'}  (p95 ${p95.toFixed(0)}ms, err ${(errRate * 100).toFixed(2)}%)\n`);
    done(passGate ? 0 : 1);
  } catch (e) { console.error('LOADTEST CRASH', e && e.stack || e); done(1); }
})();
