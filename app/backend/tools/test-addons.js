// KODA — add-on tests: (A) operator-API dual-confirm, (B) cross-merchant trust
// network. Proves both are ADDITIVE: the SMS-anchored verify decision is unchanged
// (every receipt is 'sms_anchored' by default), dual-confirm only layers on when an
// operator adapter is configured, and the network exposes only privacy-safe aggregates.
// Run against a server started with KODA_OPAPI_ORANGE_CD=mock://confirm (see launch-audit).
'use strict';
const B = process.env.KODA_BASE || 'http://localhost:4720';
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra ? '· ' + JSON.stringify(extra) : ''); } }
async function hit(path, { method = 'GET', token, body } = {}) {
  for (let a = 0; ; a++) {
    const res = await fetch(B + path, { method, redirect: 'manual',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
      body: body ? JSON.stringify(body) : undefined });
    if (res.status === 429 && a < 3) { await new Promise(r => setTimeout(r, 1100)); continue; }
    const text = await res.text(); let data = null; try { data = JSON.parse(text); } catch {}
    return { status: res.status, data, text };
  }
}

(async () => {
  console.log(`\n═══ KODA add-ons: dual-confirm + trust network @ ${B} ═══\n`);
  const email = `addon_${Date.now()}@example.com`;
  const su = await hit('/app/auth/signup', { method: 'POST', body: { email, password: 'Addon-Test-1!', name: 'Addon', business: 'Addon Co' } });
  const token = su.data?.token;
  ok('merchant signup', !!token);
  const key = (await hit('/app/keys', { token, method: 'POST', body: { prefix: 'sk_test', label: 'addon' } })).data?.secret;
  ok('api key minted', !!key);

  // a clean walk-in payment → auto-verified receipt (records the payer to the network)
  console.log('— baseline: SMS-anchored verification is unchanged');
  const suffix = '4477';
  const inj = await hit('/v1/sandbox/sms', { token: key, method: 'POST', body: {
    raw: `Vous avez recu 25 000 FC de RESEAU TEST (081234${suffix}). Ref: OMADDON1. Solde: 500 000`, operator: 'orange_cd' } });
  ok('walk-in SMS auto-verifies (engine unchanged)', inj.data?.auto?.status === 'verified', inj.data);
  const recs = await hit('/v1/receipts', { token: key });
  const rc = (recs.data?.receipts || recs.data || []).find(r => r.reference === 'OMADDON1');
  ok('receipt exists', !!rc, recs.data);
  ok('ADD-ON A: receipt is SMS-anchored by DEFAULT (nothing changed)', rc?.confirmation_level === 'sms_anchored', { got: rc?.confirmation_level });

  // ADD-ON A — operator-API dual-confirm (server has mock://confirm for orange_cd)
  console.log('— ADD-ON A: operator-API cross-verification (dual-confirm)');
  const cc = await hit(`/v1/receipts/${rc.id}/crosscheck`, { token: key, method: 'POST' });
  ok('crosscheck runs', cc.status === 200, cc.data);
  ok('receipt upgraded to dual_confirmed (operator API agreed)', cc.data?.confirmation_level === 'dual_confirmed', cc.data);
  const recs2 = await hit('/v1/receipts', { token: key });
  const rc2 = (recs2.data?.receipts || recs2.data || []).find(r => r.id === rc.id);
  ok('upgrade persisted on the receipt', rc2?.confirmation_level === 'dual_confirmed', { got: rc2?.confirmation_level });

  // ADD-ON B — cross-merchant trust network
  console.log('— ADD-ON B: cross-merchant trust / fraud network');
  const tr = await hit(`/v1/trust/${suffix}`, { token: key });
  ok('trust lookup returns a network block', tr.data && 'network' in tr.data, tr.data);
  ok('network saw the verified payment (aggregate, privacy-safe)', tr.data?.network?.seen === true && tr.data?.network?.signals?.verified_across_network >= 1, tr.data?.network);
  ok('network exposes an aggregate score (counts only, no merchant id)', typeof tr.data?.network?.network_trust_score === 'number' && !('merchant_id' in (tr.data.network.signals || {})), tr.data?.network);
  // contribute an explicit fraud flag → other merchants inherit the signal
  const fl = await hit('/v1/trust/flag', { token: key, method: 'POST', body: { subject: suffix, reason: 'test_chargeback' } });
  ok('flag accepted', fl.data?.ok === true, fl.data);
  const tr2 = await hit(`/v1/trust/${suffix}`, { token: key });
  ok('flag reflected in the network signal', tr2.data?.network?.signals?.explicit_flags >= 1, tr2.data?.network);
  ok('flag validation: subject or reference required', (await hit('/v1/trust/flag', { token: key, method: 'POST', body: {} })).status === 400);

  console.log(`\n═══ ${fail === 0 ? '✅ ADD-ONS GREEN' : '❌ FAILURES'} — ${pass} passed, ${fail} failed ═══`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('ADD-ON TEST CRASHED:', e); process.exit(2); });
