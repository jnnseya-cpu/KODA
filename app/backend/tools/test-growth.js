// KODA — AI Growth Engine regression: every tool returns usable output and meters ACU.
'use strict';
const B = process.env.KODA_BASE || `http://localhost:${process.env.PORT || 4600}`;
let pass = 0, fail = 0;
const T = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? '  ✓' : '  ✗ FAIL'), n, x); };
const j = async (p, o = {}, tok) => { const r = await fetch(B + p, { method: o.method || (o.body !== undefined ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: o.body !== undefined ? JSON.stringify(o.body) : undefined }); return { s: r.status, d: await r.json().catch(() => ({})) }; };

(async () => {
  const A = (await j('/app/auth/login', { body: { email: 'demo@koda.africa', password: 'koda-demo' } })).d;
  const list = (await j('/app/growth/tools', {}, A.token)).d;
  T('10 growth tools listed', list.tools.length === 10, `got ${list.tools.length}`);
  const cases = {
    social_post: r => typeof r.text === 'string' && r.text.length > 40 && Array.isArray(r.hashtags),
    advert: r => r.headline && r.primary_text && r.cta_button,
    email_campaign: r => r.subject && r.body_html.includes('koda'),
    landing_page: r => r.hero && Array.isArray(r.sections) && r.sections.length >= 3,
    hashtags: r => Array.isArray(r.hashtags) && r.hashtags.length > 5,
    video_script: r => Array.isArray(r.scenes) && r.scenes.length >= 4,
    recommendations: r => Array.isArray(r.recommendations) && r.recommendations.length >= 1,
    audience: r => r.primary && Array.isArray(r.segments),
    analytics: r => r.metrics && r.verdict,
    posting_time: r => Array.isArray(r.best_windows) && r.best_windows.length >= 3,
  };
  const balBefore = (await j('/app/billing', {}, A.token)).d.balance;
  let spent = 0;
  for (const [tool, check] of Object.entries(cases)) {
    const res = (await j('/app/growth/' + tool, { body: {} }, A.token)).d;
    T(`${tool} → usable output`, res.result && check(res.result), `acu=${res.acu_consumed}`);
    spent += res.acu_consumed || 0;
  }
  const balAfter = (await j('/app/billing', {}, A.token)).d.balance;
  T('ACU metered correctly across tools', Math.abs((balBefore - balAfter) - spent) < 0.001, `spent ${spent}, delta ${balBefore - balAfter}`);
  // insufficient credit path
  T('unknown tool → 404', (await j('/app/growth/nope', { body: {} }, A.token)).s === 404);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('GROWTH TEST CRASH', e); process.exit(2); });
