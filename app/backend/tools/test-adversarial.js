// KODA — adversarial / launch-gate audit. Tries to BREAK the platform: cross-tenant
// data theft (IDOR/BOLA), price authority, webhook forgery, replay, injection, secret
// exposure, auth bypass, and financial-ledger integrity. Every check is an attack that
// MUST fail (be blocked). Point KODA_BASE at a running server. Exit 0 only if every
// attack was correctly blocked.
'use strict';
const crypto = require('node:crypto');
const B = process.env.KODA_BASE || 'http://localhost:4600';
let held = 0, breached = 0; const breaches = [];
// `secure` = the property that MUST hold (attack blocked). Fails loud if breached.
const secure = (name, cond, evidence) => {
  if (cond) { held++; console.log(`✓ HELD   ${name}`); }
  else { breached++; breaches.push(name + (evidence ? ' — ' + evidence : '')); console.log(`✗ BREACH ${name}  << ${evidence ?? ''}`); }
};

async function hit(path, { method = 'GET', token, body, headers } = {}) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(B + path, { method, redirect: 'manual',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}), ...(headers || {}) },
      body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined });
    if (res.status === 429 && attempt < 3) { await new Promise(r => setTimeout(r, 1100)); continue; } // client backs off
    const text = await res.text(); let data = null; try { data = JSON.parse(text); } catch {}
    return { status: res.status, headers: res.headers, text, data };
  }
}
const signup = async (tag) => {
  const email = `adv_${tag}_${Date.now()}@example.com`;
  const r = await hit('/app/auth/signup', { method: 'POST', body: { email, password: 'Adv-Test-1!', name: tag, business: tag + ' Co' } });
  return { token: r.data?.token, email, merchant: r.data?.merchant };
};

(async () => {
  console.log(`\n═══ KODA ADVERSARIAL / LAUNCH-GATE AUDIT @ ${B} ═══\n`);

  // Two independent tenants (A = victim, B = attacker)
  const A = await signup('victimA');
  const Bk = await signup('attackerB');
  secure('two tenants provisioned', !!A.token && !!Bk.token);

  // Victim A creates real data: an API key, a receipt (via sandbox), an intent.
  const aKey = (await hit('/app/keys', { token: A.token, method: 'POST', body: { prefix: 'sk_test', label: 'A' } })).data?.secret;
  await hit('/app/sandbox/sms', { token: A.token, method: 'POST', body: { raw: 'Vous avez recu 77 000 FC de VICTIM A (0812345678). Ref: OMVICTIMA. Solde: 500 000', operator: 'orange_cd' } });
  const aReceipts = (await hit('/app/receipts', { token: A.token })).data || [];
  const aReceiptId = aReceipts[0]?.id;
  const aIntent = (await hit('/v1/intents', { token: aKey, method: 'POST', body: { amount: 5000, currency: 'CDF', operators: ['orange_cd'] } })).data;

  // ── PHASE 5/6 — CROSS-TENANT (IDOR / BOLA): B must NOT read A's data ────────
  console.log('— cross-tenant access (IDOR/BOLA)');
  const bSeesA = (await hit(`/app/receipts/${aReceiptId}`, { token: Bk.token }));
  secure('B cannot read A\'s receipt by id', bSeesA.status === 404 || bSeesA.status === 403 || (bSeesA.data && bSeesA.data.error), `status ${bSeesA.status}`);
  const bIntentA = await hit(`/v1/intents/${aIntent?.id || aIntent?.intent_id}`, { token: (await hit('/app/keys', { token: Bk.token, method: 'POST', body: { prefix: 'sk_test', label: 'B' } })).data?.secret });
  secure('B cannot read A\'s intent by id', bIntentA.status === 404 || bIntentA.status === 403 || bIntentA.data?.error, `status ${bIntentA.status}`);
  // B's own receipts must never contain A's reference
  const bReceipts = (await hit('/app/receipts', { token: Bk.token })).data || [];
  secure('B\'s receipt list is isolated from A', !bReceipts.some(r => r.reference === 'OMVICTIMA'));

  // ── PHASE 9 — PRICE AUTHORITY: server must own the money, not the client ───
  console.log('— financial: price authority & replay');
  // Replaying a consumed reference against a NEW intent must be rejected (replay).
  const replay = await hit(`/v1/intents/${aIntent?.id || aIntent?.intent_id}/verify`, { token: aKey, method: 'POST', body: { reference: 'OMVICTIMA' } });
  secure('used reference cannot claim another order (replay)', replay.data?.status !== 'verified', `status ${replay.data?.status}`);
  // A screenshot/claim cannot self-verify without the operator SMS.
  const ghost = await hit('/app/verify', { token: A.token, method: 'POST', body: { reference: 'GHOST-NEVER-SEEN-123' } });
  secure('unseen reference is never auto-verified', ghost.data?.status !== 'verified', `status ${ghost.data?.status}`);

  // ── PHASE 9 — WEBHOOK FORGERY & REPLAY (merchant-inbound webhooks) ──────────
  console.log('— webhook signature & inbound trust');
  // WhatsApp webhook with a WRONG verify token must be rejected.
  const waBad = await hit('/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=WRONG&hub.challenge=X');
  secure('WhatsApp handshake rejects a wrong verify token', waBad.status === 403, `status ${waBad.status}`);
  // A forged PAYMENT-PROVIDER webhook must NEVER settle money — fail closed on a
  // missing / bad signature (Gate 5). Settling ACU top-ups is real value movement.
  const billNoSig = await hit('/webhooks/billing/stripe', { method: 'POST', body: { topup_id: 'top_forged', amount: 999999 } });
  secure('billing webhook rejects an UNSIGNED callback (no settle)', billNoSig.status === 401, `status ${billNoSig.status}`);
  const billBadSig = await hit('/webhooks/billing/stripe', { method: 'POST', body: { topup_id: 'top_forged' }, headers: { 'x-koda-signature': 'deadbeef'.repeat(8) } });
  secure('billing webhook rejects a BAD signature (no settle)', billBadSig.status === 401, `status ${billBadSig.status}`);
  secure('forged billing webhook never reports success/settled', !/"ok"\s*:\s*true|"status"\s*:\s*"settled"|"credited"/i.test(billNoSig.text + billBadSig.text));

  // ── PHASE 11 — INJECTION / MALFORMED INPUT: no 500s, no stack traces ───────
  console.log('— injection & malformed input');
  const inj1 = await hit('/app/auth/login', { method: 'POST', body: { email: "' OR 1=1 --", password: "' OR '1'='1" } });
  secure('SQLi in login does not authenticate', inj1.status >= 400 && !inj1.data?.token, `status ${inj1.status}`);
  const inj2 = await hit('/app/auth/login', { method: 'POST', body: '{ this is not json' });
  secure('malformed JSON body → 4xx, not 500', inj2.status >= 400 && inj2.status < 500, `status ${inj2.status}`);
  const inj3 = await hit('/v1/detect?msisdn=' + encodeURIComponent("'; DROP TABLE merchants; --"));
  secure('injection in detect param does not 500', inj3.status < 500, `status ${inj3.status}`);
  secure('no stack trace / internal path leaked in errors', !/ at .*\/app\/backend\/|node:internal|Error:/.test(inj2.text + inj3.text));

  // ── PHASE 5 — AUTH: no-token and garbage-token are rejected ────────────────
  console.log('— auth boundary');
  secure('protected route rejects no token', (await hit('/app/me')).status === 401);
  secure('protected route rejects garbage token', (await hit('/app/me', { token: 'not.a.real.jwt' })).status === 401);
  secure('invalid API key rejected', (await hit('/v1/usage', { token: 'sk_test_totally_fake' })).status === 401);

  // ── PHASE 2/11 — SECRET EXPOSURE on public surfaces ────────────────────────
  console.log('— secret exposure');
  const appjs = await hit('/app.js'); const idx = await hit('/');
  secure('no sk_live / JWT secret / password hash in public bundles',
    !/sk_live_[A-Za-z0-9]{10}|KODA_JWT_SECRET|pass_hash/.test(appjs.text + idx.text));
  const openapi = await hit('/v1/openapi.json');
  // a REAL leaked secret is a prefix + high-entropy token (24 chars), not the doc
  // string "sk_live_ keys" — match only realistic secret material.
  secure('openapi.json exposes no real secret', !/sk_(live|test)_[A-Za-z0-9]{20,}|whsec_[A-Za-z0-9]{16,}/.test(openapi.text));

  // ── PHASE 11 — SECURITY HEADERS + FRAME POLICY (now hard gates) ────────────
  console.log('— security headers & frame policy');
  const rootH = (await hit('/')).headers;
  const rootCsp = rootH.get('content-security-policy') || '';
  secure('CSP present on app/site', /default-src/.test(rootCsp), rootCsp.slice(0, 40));
  secure('app/site is clickjack-locked (frame-ancestors self + XFO)',
    /frame-ancestors 'self'/.test(rootCsp) && (rootH.get('x-frame-options') || '').toUpperCase() === 'SAMEORIGIN');
  secure('CSP hardens object-src/base-uri', /object-src 'none'/.test(rootCsp) && /base-uri 'self'/.test(rootCsp));
  const payH = (await hit('/pay/anything')).headers;
  const payCsp = payH.get('content-security-policy') || '';
  // the drop-in widget iframes /pay cross-origin — it MUST be embeddable (regression
  // guard for the X-Frame-Options bug that would blank the widget in production).
  secure('checkout /pay is widget-embeddable (frame-ancestors *, no SAMEORIGIN XFO)',
    /frame-ancestors \*/.test(payCsp) && (payH.get('x-frame-options') || '').toUpperCase() !== 'SAMEORIGIN',
    `csp=${/frame-ancestors \*/.test(payCsp)} xfo=${payH.get('x-frame-options')}`);
  console.log(`   HSTS: ${rootH.get('strict-transport-security') ? 'present' : 'set in production (NODE_ENV) / TLS-terminated upstream'}`);

  // ── PHASE 7 — FINANCIAL LEDGER INVARIANT (double-entry Σ=0) ─────────────────
  // Verified directly against the DB after the run (see the wrapper); here we assert
  // the billing balance endpoint never goes negative for a fresh account.
  console.log('— financial ledger sanity');
  const bal = await hit('/v1/billing/balance', { token: aKey });
  secure('ACU balance is a finite non-negative number', typeof bal.data?.acu_balance === 'number' && bal.data.acu_balance >= 0, JSON.stringify(bal.data));

  console.log(`\n═══ ${breached === 0 ? '✅ ALL ATTACKS BLOCKED' : '❌ ' + breached + ' BREACH(ES)'} — ${held} held, ${breached} breached ═══`);
  if (breached) { console.log('\nBreaches (launch blockers):'); breaches.forEach(b => console.log('  · ' + b)); }
  process.exit(breached === 0 ? 0 : 1);
})().catch(e => { console.error('AUDIT CRASHED:', e); process.exit(2); });
