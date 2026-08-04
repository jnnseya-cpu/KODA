// KODA — AI metering policy: EVERY AI action is metered (cost > 0) and gated by
// available ACU. Proves no AI action is free and none runs at insufficient balance.
'use strict';
const B = process.env.KODA_URL || 'http://localhost:4600';
let pass = 0, fail = 0; const F = [];
const T = (n, ok, x = '') => { ok ? pass++ : (fail++, F.push(n)); console.log((ok ? '  ✓' : '  ✗ FAIL'), n, x); };
const j = async (p, o = {}, tok) => { const r = await fetch(B + p, { method: o.method || (o.body !== undefined ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: o.body !== undefined ? JSON.stringify(o.body) : undefined }); return { s: r.status, d: await r.json().catch(() => ({})) }; };

(async () => {
  const A = (await j('/app/auth/login', { body: { email: 'demo@koda.africa', password: 'koda-demo' } })).d;

  console.log('— NO AI ACTION IS FREE (every catalogue entry costs > 0)');
  const tools = (await j('/app/growth/tools', {}, A.token)).d.tools;
  T('all 10 growth tools cost > 0', tools.every(t => t.acu >= 0.25), tools.filter(t => t.acu < 0.25).map(t => t.id).join(','));
  const key = (await j('/app/keys', { body: { prefix: 'sk_test' } }, A.token)).d.secret;
  const agents = (await j('/v1/agents', {}, key)).d.agents;
  T('all runnable agents cost > 0 (parser no longer free)', agents.every(a => a.acu >= 0.25), agents.filter(a => a.acu < 0.25).map(a => a.type).join(','));

  console.log('— GATING: AI actions blocked at insufficient balance');
  // create a fresh merchant, drain its ACU to ~0, then try every AI action → all 402
  const nu = (await j('/app/auth/signup', { body: { business: 'Gate Test', name: 'g', email: 'gate' + Date.now() + '@t.co', password: 'x12345' } })).d;
  // Marché starts with 50 ACU; spend it down via growth until near zero
  const nk = (await j('/app/keys', { body: { prefix: 'sk_test' } }, nu.token)).d.secret;
  let bal = (await j('/app/billing', {}, nu.token)).d.balance;
  let guard = 0;
  while (bal >= 0.5 && guard++ < 200) { await j('/app/growth/hashtags', { body: {} }, nu.token); bal = (await j('/app/billing', {}, nu.token)).d.balance; }
  T('drained new merchant to < 0.5 ACU', bal < 0.5, `bal=${bal}`);

  const g1 = await j('/app/growth/social_post', { body: {} }, nu.token);
  T('growth social_post blocked (402) at empty balance', g1.s === 402 && g1.d.error?.code === 'insufficient_credit');
  const g2 = await j('/app/growth/landing_page', { body: {} }, nu.token);
  T('growth landing_page blocked (402)', g2.s === 402);
  const a1 = await j('/v1/agents/parser/run', { body: { raw: 'x' } }, nk);
  T('agent parser (was free) now blocked (402)', a1.s === 402, `status ${a1.s}`);
  const a2 = await j('/v1/agents/reconciler/run', { body: {} }, nk);
  T('agent reconciler blocked (402)', a2.s === 402);
  const d1 = await j('/app/disputes', { body: { reference: 'X', reason: 'y' } }, nu.token);
  T('DisputeAgent evidence blocked (402) at empty balance', d1.s === 402);
  const v1 = await j('/app/verify', { body: { reference: 'ANYTHING', screenshot: true, screenshot_ref: 'X' } }, nu.token);
  T('Vision screenshot path blocked (402) at empty balance', v1.s === 402, `status ${v1.s}`);

  console.log('— WITH ACU: same actions run and meter correctly');
  const before = (await j('/app/billing', {}, A.token)).d.balance;
  const ok1 = await j('/app/growth/social_post', { body: {} }, A.token);
  T('funded merchant: social_post runs', ok1.d.result && ok1.d.acu_consumed === 1);
  const after = (await j('/app/billing', {}, A.token)).d.balance;
  T('ACU actually deducted', Math.abs((before - after) - 1) < 0.001, `${before}→${after}`);

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) { console.log('BROKEN:', F.join(' | ')); process.exit(1); }
})().catch(e => { console.error('AI-GATING CRASH', e); process.exit(2); });
