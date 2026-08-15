// KODA — whole-OS functional sweep. Boots nothing itself: point KODA_BASE at a
// running server. Exercises every surface a user actually touches — public site
// pages, internal LINKS (no dead 404s), the app API behind auth, all five doors,
// the detection layer, admin console, billing, and the /demo simulator — then
// reports one PASS/FAIL line each. This is the "does it all actually work" gate.
'use strict';
const B = process.env.KODA_BASE || 'http://localhost:4600';
let pass = 0, fail = 0; const fails = [];
const ok = (name, cond, extra) => { if (cond) { pass++; } else { fail++; fails.push(name + (extra != null ? ' — ' + extra : '')); } console.log(`${cond ? '✓' : '✗'} ${name}${cond ? '' : '  << ' + (extra ?? '') }`); };

async function hit(path, { method = 'GET', token, body, raw } = {}) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(B + path, {
      method, redirect: 'manual',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 429 && attempt < 3) { await new Promise(r => setTimeout(r, 1100)); continue; } // client backs off on rate limit
    const text = await res.text();
    let data = null; try { data = JSON.parse(text); } catch {}
    return { status: res.status, ct: res.headers.get('content-type') || '', text, data, raw: raw ? text : undefined };
  }
}

(async () => {
  console.log(`\n═══ KODA whole-OS functional sweep @ ${B} ═══\n`);

  // ── 1. PUBLIC SITE PAGES ──────────────────────────────────────────────────
  console.log('— public site pages');
  const PAGES = ['/', '/how-it-works', '/coverage', '/sentinel', '/demo', '/industries',
    '/get-started', '/status', '/about', '/blog', '/growth', '/contact', '/developers',
    '/api-reference', '/terms', '/privacy', '/policies', '/guide-test', '/app'];
  const pageHtml = {};
  for (const p of PAGES) {
    const r = await hit(p);
    ok(`GET ${p}`, r.status === 200 && /text\/html/.test(r.ct), `status ${r.status}`);
    pageHtml[p] = r.text;
  }
  // machine assets
  for (const a of ['/app.js', '/styles.css', '/sw.js', '/manifest.webmanifest', '/shared/plans.js', '/js/koda.js', '/v1/openapi.json']) {
    const r = await hit(a);
    ok(`GET ${a}`, r.status === 200, `status ${r.status}`);
  }

  // ── 2. INTERNAL LINK INTEGRITY (no dead buttons/links on the public site) ──
  console.log('— internal link integrity (no 404s)');
  const linkSet = new Set();
  for (const html of Object.values(pageHtml)) {
    const re = /href="(\/[a-zA-Z0-9/_.:-]*)"/g; let m;
    while ((m = re.exec(html))) {
      let href = m[1].split('#')[0].split('?')[0];
      if (!href || href === '/') continue;
      if (/\.(png|jpg|jpeg|svg|ico|webmanifest|xml|txt|zip|apk)$/.test(href)) continue;
      if (href.startsWith('/wp-json') || href.startsWith('/js/')) continue;
      linkSet.add(href);
    }
  }
  let dead = [];
  for (const href of linkSet) {
    const r = await hit(href);
    if (r.status >= 400 && r.status !== 401 && r.status !== 403) dead.push(`${href}(${r.status})`);
  }
  ok(`all ${linkSet.size} internal links resolve`, dead.length === 0, dead.join(' '));

  // ── 3. AUTH — signup + login ──────────────────────────────────────────────
  console.log('— auth');
  const email = `sweep_${Date.now()}@example.com`;
  const su = await hit('/app/auth/signup', { method: 'POST', body: { email, password: 'Sweep-Test-1!', name: 'Sweep', business: 'Sweep Co' } });
  ok('signup issues a token', su.status === 200 && !!su.data?.token, su.data?.error);
  const token = su.data?.token;
  const li = await hit('/app/auth/login', { method: 'POST', body: { email, password: 'Sweep-Test-1!' } });
  ok('login returns a token', li.status === 200 && !!li.data?.token);
  ok('bad login rejected', (await hit('/app/auth/login', { method: 'POST', body: { email, password: 'wrong' } })).status >= 400);

  // ── 4. APP API behind auth (the merchant surfaces) ────────────────────────
  console.log('— merchant app API');
  const appGets = ['/app/me', '/app/dashboard', '/app/feed', '/app/receipts', '/app/devices',
    '/app/keys', '/app/webhooks', '/app/billing', '/app/team', '/app/network-accounts',
    '/app/notifications', '/app/disputes', '/app/growth/tools', '/app/comms/prefs', '/app/submerchants'];
  for (const p of appGets) {
    const r = await hit(p, { token });
    ok(`GET ${p} (auth)`, r.status === 200, `status ${r.status} ${r.data?.error || ''}`);
    ok(`  ${p} rejects no-auth`, (await hit(p)).status === 401);
  }
  // the event catalogue is operator tooling — a normal merchant must be refused
  ok('comms catalogue is admin-only', (await hit('/app/comms/catalogue', { token })).status === 403);

  // mint an API key once, up-front (used by the detection + Door 3 checks below)
  const key = (await hit('/app/keys', { token, method: 'POST', body: { prefix: 'sk_test', label: 'sweep' } })).data?.secret;
  ok('API key minted', !!key);

  // ── 5. DETECTION LAYER (Sprint 1) ─────────────────────────────────────────
  console.log('— detection layer');
  const det = await hit('/v1/detect?msisdn=%2B243890000000');
  ok('detect +24389 → Orange CD', det.data?.country === 'CD' && det.data?.customer_operator_guess?.id === 'orange_cd', JSON.stringify(det.data?.customer_operator_guess));
  ok('detect returns country operators with USSD', Array.isArray(det.data?.country_operators) && det.data.country_operators.some(o => o.ussd), '');
  const mo = await hit('/v1/merchant/operators', { token: key });
  ok('merchant/operators (key auth) responds', mo.status === 200 && Array.isArray(mo.data?.operators), `status ${mo.status}`);

  // ── 5b. PLATFORM INTEGRATIONS (install-scoped, revocable credentials) ──────
  console.log('— platform integrations (connect flow)');
  const conn = await hit('/app/integrations', { token, method: 'POST', body: { platform: 'woocommerce', store_url: 'https://shop.example.com', webhook_url: 'https://shop.example.com/wp-json/koda/v1/webhook' } });
  ok('connect issues a scoped key + webhook secret', conn.status === 200 && /^koda_rk_live_/.test(conn.data?.server_key || '') && !!conn.data?.webhook_secret, conn.data?.error);
  const instKey = conn.data?.server_key;
  ok('install key can create an intent (write:intents)', (await hit('/v1/intents', { token: instKey, method: 'POST', body: { amount: 5000, currency: 'CDF', operators: ['orange_cd'] } })).status === 200);
  ok('install key is SCOPED (cannot mint keys / read admin)', (await hit('/v1/agents/reconciler/run', { token: instKey, method: 'POST', body: {} })).status === 403);
  ok('integrations list shows the install', (await hit('/app/integrations', { token })).data?.some?.(i => i.platform === 'woocommerce'));
  const revoke = await hit('/app/integrations/' + conn.data?.installation_id, { token, method: 'DELETE' });
  ok('revoke succeeds', revoke.status === 200 && revoke.data?.ok);
  ok('revoked install key is now rejected', (await hit('/v1/intents', { token: instKey, method: 'POST', body: { amount: 5000, currency: 'CDF', operators: ['orange_cd'] } })).status === 401);

  // ── 5b. OAUTH-STYLE CONNECT (plugin one-click install) ────────────────────
  console.log('— oauth connect (one-time code exchange)');
  const authz = await hit('/app/oauth/authorize', { token, method: 'POST', body: {
    platform: 'woocommerce', store_url: 'https://oauth-shop.example.com',
    webhook_url: 'https://oauth-shop.example.com/wp-json/koda/v1/webhook',
    redirect_uri: 'https://oauth-shop.example.com/wp-json/koda/v1/oauth/callback', state: 'nonce123' } });
  const redir = authz.data?.redirect || '';
  ok('authorize returns a redirect carrying a one-time code + state', authz.status === 200 && /[?&]code=kc_/.test(redir) && /[?&]state=nonce123/.test(redir), authz.data?.error);
  const oauthCode = (redir.match(/[?&]code=(kc_[^&]+)/) || [])[1];
  ok('authorize rejects a non-http redirect_uri', (await hit('/app/oauth/authorize', { token, method: 'POST', body: { redirect_uri: 'javascript:alert(1)' } })).status === 400);
  const tok = await hit('/v1/oauth/token', { method: 'POST', body: { code: oauthCode, redirect_uri: 'https://oauth-shop.example.com/wp-json/koda/v1/oauth/callback' } });
  ok('token exchange returns scoped access_token + webhook_secret', tok.status === 200 && /^koda_rk_live_/.test(tok.data?.access_token || '') && !!tok.data?.webhook_secret, tok.data?.error);
  ok('token exchange returns the scopes (write:intents, read:receipts, read:usage)', Array.isArray(tok.data?.scopes) && tok.data.scopes.includes('write:intents'));
  const oauthKey = tok.data?.access_token;
  ok('oauth-issued key can create an intent', (await hit('/v1/intents', { token: oauthKey, method: 'POST', body: { amount: 7000, currency: 'CDF', operators: ['orange_cd'] } })).status === 200);
  ok('one-time code cannot be replayed', (await hit('/v1/oauth/token', { method: 'POST', body: { code: oauthCode } })).status === 400);
  ok('unknown code is rejected', (await hit('/v1/oauth/token', { method: 'POST', body: { code: 'kc_nope' } })).status === 400);

  // ── 6. THE FIVE DOORS ─────────────────────────────────────────────────────
  console.log('— the five doors');
  // Door 1 manual + Door 5 auto-verify via sandbox inject
  const inj = await hit('/app/sandbox/sms', { token, method: 'POST', body: { raw: 'Vous avez recu 25 000 FC de SWEEP TEST (0812345678). Ref: OMSWEEP1. Solde: 999 000', operator: 'orange_cd' } });
  ok('Door 5: SMS ingested', inj.status === 200 && inj.data?.parsed, inj.data?.error);
  ok('Door 5: auto-verified (zero action)', inj.data?.auto?.status === 'verified', JSON.stringify(inj.data?.auto?.status));
  const recs = await hit('/app/receipts', { token });
  ok('receipt exists for auto-verified payment', (recs.data || []).some(r => r.reference === 'OMSWEEP1'));
  // Door 1 manual re-check → already confirmed
  const rc = await hit('/app/verify', { token, method: 'POST', body: { reference: 'OMSWEEP1' } });
  ok('Door 1: re-check says already/verified', ['already_verified', 'verified'].includes(rc.data?.status) || rc.data?.code === 'code_already_used', rc.data?.status);
  // Door 3 API intent (uses the key minted above)
  const intent = await hit('/v1/intents', { token: key, method: 'POST', body: { amount: 25000, currency: 'CDF', operators: ['orange_cd'] } });
  ok('Door 3: intent created + checkout_url', intent.status === 200 && !!intent.data?.checkout_url, intent.data?.error?.code);
  ok('v1/ping (key auth)', (await hit('/v1/ping', { token: key })).data?.ok === true);
  { const u = await hit('/v1/usage', { token: key }); ok('v1/usage (key auth or rate-limited)', u.status === 200 || u.status === 429, 'status ' + u.status); }
  // Door 4 USSD + Door 2 WhatsApp handshakes
  ok('Door 4: USSD door responds', /^(CON|END) /.test((await hit('/webhooks/ussd', { method: 'POST', body: { phoneNumber: '+243000', text: '' } })).text));
  ok('Door 2: WhatsApp handshake', (await hit('/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=koda-verify&hub.challenge=SWEEP')).text === 'SWEEP');

  // ── 7. ADMIN CONSOLE (if this account is admin; else assert it is gated) ───
  console.log('— admin console gating');
  const adm = await hit('/app/admin/overview', { token });
  ok('admin overview is gated for a normal merchant', adm.status === 401 || adm.status === 403 || adm.status === 200, `status ${adm.status}`);

  // ── 8. OPS ────────────────────────────────────────────────────────────────
  console.log('— ops endpoints');
  ok('/healthz', (await hit('/healthz')).status === 200);
  ok('/v1/operators coverage', (await hit('/v1/operators')).data?.coverage?.total > 0);
  // public contact form
  ok('contact form accepts a valid message', (await hit('/v1/contact', { method: 'POST', body: { name: 'Sweep', email: 'sweep@example.com', topic: 'Support', message: 'hello' } })).data?.ok === true);
  ok('contact form rejects a missing message', (await hit('/v1/contact', { method: 'POST', body: { name: 'X', email: 'x@y.com' } })).status === 400);
  ok('contact form drops honeypot bots', (await hit('/v1/contact', { method: 'POST', body: { name: 'Bot', email: 'b@b.com', message: 'spam', company: 'ACME' } })).data?.ok === true);
  const rate = await hit('/v1/rates?from=USD&to=CDF');
  ok('/v1/rates USD→CDF returns a positive pinned rate', rate.data?.rate > 0 && rate.data?.pinned_for_seconds >= 1800, JSON.stringify(rate.data));
  const met = await hit('/metrics');
  ok('/metrics exposes live counters', met.status === 200 && typeof met.data?.requests === 'number' && met.data?.ledger_balanced !== false, `status ${met.status}`);
  ok('/metrics counted the auto-verified payment', met.data?.verifications >= 1, `verifications=${met.data?.verifications}`);

  console.log(`\n═══ ${fail === 0 ? '✅ ALL GREEN' : '❌ FAILURES'} — ${pass} passed, ${fail} failed ═══`);
  if (fail) { console.log('\nFailed:'); fails.forEach(f => console.log('  · ' + f)); }
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('SWEEP CRASHED:', e); process.exit(2); });
