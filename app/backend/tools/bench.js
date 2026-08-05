// KODA — verification-path benchmark: measures the money path end-to-end
// (HTTP intent create → verify) sequentially and under concurrency.
'use strict';
const B = process.env.KODA_BASE || `http://localhost:${process.env.PORT || 4600}`;

async function main() {
  // setup: login + API key
  const login = await post('/app/auth/login', { email: 'demo@koda.africa', password: 'koda-demo' });
  await post('/app/billing/plan', { plan: 'enterprise' }, login.token); // marketplace-tier rate limits for the run
  const key = (await post('/app/keys', { prefix: 'sk_test', label: 'bench' }, login.token)).secret;
  const H = { 'content-type': 'application/json', authorization: `Bearer ${key}` };

  // warm-up
  for (let i = 0; i < 20; i++) await fetch(B + '/v1/ping', { headers: H });

  // 1) sequential latency: full intent→verify cycle
  const N = 200, lat = [];
  for (let i = 0; i < N; i++) {
    const t0 = performance.now();
    const intent = await fetch(B + '/v1/intents', { method: 'POST', headers: H,
      body: JSON.stringify({ amount: 25000, currency: 'CDF', operators: ['orange_cd'] }) }).then(r => r.json());
    await fetch(B + `/v1/intents/${intent.intent_id}/verify`, { method: 'POST', headers: H,
      body: JSON.stringify({ reference: `TEST-OK-25000` }) }).then(r => r.json());
    lat.push(performance.now() - t0);
  }
  lat.sort((a, b) => a - b);
  const pct = p => lat[Math.floor(lat.length * p)].toFixed(1);
  console.log(`sequential intent→verify (${N} cycles, 2 HTTP calls each):`);
  console.log(`  p50 ${pct(0.5)} ms · p95 ${pct(0.95)} ms · p99 ${pct(0.99)} ms per full cycle`);

  // 2) concurrent throughput: raw verify calls (plateforme-tier key rate: use demo commerce merchant, so run in waves)
  const C = 25, WAVES = 8;
  const t0 = performance.now();
  let done = 0;
  for (let w = 0; w < WAVES; w++) {
    if (w) await new Promise(r => setTimeout(r, 60)); // stay inside enterprise rps window
    await Promise.all(Array.from({ length: C }, async () => {
      const i = await fetch(B + '/v1/intents', { method: 'POST', headers: H,
        body: JSON.stringify({ amount: 1000, currency: 'CDF', operators: ['orange_cd'] }) }).then(r => r.json());
      if (!i.intent_id) return;
      const v = await fetch(B + `/v1/intents/${i.intent_id}/verify`, { method: 'POST', headers: H,
        body: JSON.stringify({ reference: 'TEST-OK-1000' }) }).then(r => r.json());
      if (v.status === 'verified') done++;
    }));
  }
  const secs = (performance.now() - t0) / 1000;
  console.log(`concurrent (${C} parallel × ${WAVES} waves): ${done} verified in ${secs.toFixed(2)}s → ${(done / secs).toFixed(0)} verifications/sec on one node`);
  await post('/app/billing/plan', { plan: 'commerce' }, login.token); // restore demo plan

  // 3) read path (marketplace polling): GET /receipts
  const t1 = performance.now(); const R = 300;
  for (let i = 0; i < R; i++) await fetch(B + '/v1/receipts', { headers: H });
  console.log(`read path: ${R} GET /receipts in ${((performance.now() - t1) / 1000).toFixed(2)}s → ${(R / ((performance.now() - t1) / 1000)).toFixed(0)} req/s sequential`);
}

async function post(p, body, tok) {
  return fetch(B + p, { method: 'POST',
    headers: { 'content-type': 'application/json', ...(tok ? { authorization: `Bearer ${tok}` } : {}) },
    body: JSON.stringify(body) }).then(r => r.json());
}
main().catch(e => { console.error(e); process.exit(1); });
