/* KODA — full UI test harness. Drives EVERY component of the real running
   platform as owner, cashier, manager, platform and admin. Screenshots each
   verified state into proof/. Exits non-zero listing any failure. */
'use strict';
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core'); // npm i -D playwright-core to run locally
const DIR = process.env.KODA_PROOF_DIR || require('node:path').join(__dirname, '..', '..', 'proof');
const B = process.env.KODA_BASE || `http://localhost:${process.env.PORT || 4600}`;
const results = [];
const ok = (name, cond, extra = '') => { results.push({ name, cond: !!cond, extra }); console.log((cond ? '✓' : '✗ FAIL'), name, extra); };

(async () => {
  // mint a FRESH ledger code for this run (the replay lock kills reused ones — by design)
  const login0 = await fetch(B + '/app/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'demo@koda.africa', password: 'koda-demo' }) }).then(r => r.json());
  const feed0 = await fetch(B + '/app/feed', { headers: { authorization: 'Bearer ' + login0.token } }).then(r => r.json());
  const last0 = feed0.find(x => x.operator === 'orange_cd' && !x.quarantined && x.balance_after != null);
  const FRESH = 'OM.' + Date.now().toString().slice(-6) + '.UI.T' + Math.floor(Math.random() * 900 + 100);
  const bal0 = (last0 ? last0.balance_after : 250000) + 12000;
  await fetch(B + '/app/sandbox/sms', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + login0.token },
    body: JSON.stringify({ raw: `Vous avez recu 12 000 FC de UI TESTER (+243897777). Ref: ${FRESH}. Solde: ${bal0.toLocaleString('fr-FR')}`, operator: 'orange_cd' }) });

  const browser = await pw.chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const pg = await browser.newPage({ viewport: { width: 1360, height: 820 } });
  pg.on('pageerror', e => console.log('  [pageerror]', String(e).slice(0, 120)));
  const shot = (n) => pg.screenshot({ path: `${DIR}/${n}.png` });
  const text = () => pg.evaluate(() => document.body.innerText);
  const go = async (hash, ms = 900) => { await pg.evaluate(h => location.hash = h, hash); await pg.waitForTimeout(ms); };
  const login = async (email, password) => {
    await pg.evaluate(() => { localStorage.removeItem('koda_token'); location.hash = '#login'; location.reload(); });
    await pg.waitForTimeout(900);
    await pg.fill('#em', email); await pg.fill('#pw', password);
    await pg.click('.auth-card .btn-gold'); await pg.waitForTimeout(1300);
  };

  // ── 01 login screen ─────────────────────────────────────────
  await pg.goto(B + '/app'); await pg.waitForTimeout(900);
  await pg.evaluate(() => localStorage.removeItem('koda_token'));
  await pg.goto(B + '/app'); await pg.waitForTimeout(900);
  ok('01 login screen renders', await pg.evaluate(() => !!document.querySelector('.auth-card')));
  await shot('01-login');

  // ── OWNER ───────────────────────────────────────────────────
  await login('demo@koda.africa', 'koda-demo');
  let t = await text();
  ok('02 owner dashboard', t.includes('Maison Kivu') && t.includes('ACU'));
  await shot('02-owner-dashboard');

  // verify console — real ledger code
  await go('#verify');
  await pg.fill('#ref', FRESH);
  await pg.click('.console .btn-gold'); await pg.waitForTimeout(900);
  t = await pg.evaluate(() => document.getElementById('verdict').innerText);
  ok('03 manual verify VERIFIED', /VERIFIED|VÉRIFIÉ/i.test(t), t.split('\n')[0]);
  await shot('03-verify-verified');

  // replay attack blocked
  await pg.click('.console .btn-gold'); await pg.waitForTimeout(900);
  t = await pg.evaluate(() => document.getElementById('verdict').innerText);
  ok('04 replay blocked', /code_already_used|REJECTED|REJETÉ/i.test(t), t.split('\n')[0]);
  await shot('04-verify-replay-blocked');

  // live feed with quarantined spoof
  await go('#feed');
  t = await text();
  ok('05 live feed + spoof quarantined', /QUARANT/i.test(t) && t.includes('GRACE K'));
  await shot('05-live-feed');

  // receipts + audit trace
  await go('#receipts');
  ok('06 receipts list', (await text()).includes(FRESH));
  await shot('06-receipts');
  await pg.click('table.tbl a'); await pg.waitForTimeout(900);
  t = await text();
  ok('07 receipt decision trace', /decision trace|fraud_score/i.test(t));
  await shot('07-receipt-audit-trace');

  // disputes
  await go('#disputes');
  t = await text();
  ok('08 disputes + DisputeAgent evidence', t.includes('DisputeAgent') && /open/i.test(t));
  await shot('08-disputes');

  // devices
  await go('#devices');
  t = await text();
  ok('09 sentinel fleet', t.includes('Play Integrity') && t.includes('Caisse principale'));
  await shot('09-devices');

  // billing: top-up verified by the engine itself
  await go('#billing');
  await pg.click('button.btn-ghost'); await pg.waitForTimeout(700); // $10 pack
  await pg.fill('#tref', 'TEST-OK-28000');
  const balBefore = await pg.evaluate(() => Number(document.querySelector('.stat b').innerText.replace(/[^\d]/g, '')));
  await pg.click('#topup-out .btn-gold'); await pg.waitForTimeout(1400);
  const balAfter = await pg.evaluate(() => Number(document.querySelector('.stat b').innerText.replace(/[^\d]/g, '')));
  ok('10 top-up credited by own engine', balAfter === balBefore + 300, `${balBefore} → ${balAfter}`);
  await shot('10-billing-topup-credited');

  // team + audit
  await go('#team');
  t = await text();
  ok('11 team seats + audit trail', t.includes('cashier') && /Audit trail/i.test(t));
  await shot('11-team');

  // developers: key shown once + quickstart
  await go('#developers');
  await pg.click('.card button.btn-ghost'); await pg.waitForTimeout(800); // + sk_live
  t = await text();
  ok('12 API key created (shown once)', t.includes('shown once'));
  await shot('12-developers-key');

  // communications: 128 events + branded preview
  await go('#comms', 1300);
  t = await text();
  ok('13 comms: 128 events / mandatory / channels', t.includes('128') && /mandatory/i.test(t));
  await shot('13-comms-architecture');
  await pg.click('button.btn-gold.btn-sm'); await pg.waitForTimeout(900); // Preview
  ok('14 branded email preview', await pg.evaluate(() => !!document.querySelector('iframe.mailframe')));
  await shot('14-comms-email-preview');

  // settings
  await go('#settings');
  ok('15 settings + language auto-detect', (await text()).includes('LinguaAgent'));
  await shot('15-settings');

  // ── CASHIER: restricted nav ────────────────────────────────
  await login('caisse@koda.africa', 'koda-demo');
  t = await text();
  const cashierHasBilling = t.includes('Billing') || t.includes('Facturation');
  ok('16 cashier restricted view (no billing/team/devs)', !cashierHasBilling && (t.includes('Verify') || t.includes('Vérifier')));
  await shot('16-cashier-dashboard');

  // ── MANAGER: mid-tier nav ──────────────────────────────────
  await login('manager@koda.africa', 'koda-demo');
  t = await text();
  ok('17 manager view (+disputes/devices, no billing)', (t.includes('Disputes') || t.includes('Litiges')) && !(t.includes('Billing') || t.includes('Facturation')));
  await shot('17-manager-dashboard');

  // ── PLATFORM: sub-merchants ────────────────────────────────
  await login('platform@koda.africa', 'koda-demo');
  await go('#submerchants');
  t = await text();
  ok('18 platform sub-merchants (3 seeded)', t.includes('Chez Mama Ngozi') && t.includes('Pharmacie'));
  await shot('18-platform-submerchants');

  // ── ADMIN: control centre ──────────────────────────────────
  await login('admin@koda.africa', 'koda-admin');
  await go('#admin', 1200);
  t = await text();
  ok('19 admin control centre (fleet + parse health)', /parse health/i.test(t) && t.includes('Maison Kivu'));
  await shot('19-admin-control-centre');

  // ── PUBLIC SURFACES ────────────────────────────────────────
  await pg.goto(B + '/'); await pg.waitForTimeout(1600);
  ok('20 landing page + hero demo', (await text()).includes('The SMS'));
  await shot('20-public-landing');
  await pg.goto(B + '/status'); await pg.waitForTimeout(900);
  t = await text();
  ok('21 status page live healthz', /API operational/i.test(t));
  await shot('21-public-status');

  await browser.close();
  const fails = results.filter(r => !r.cond);
  console.log(`\n${results.length - fails.length}/${results.length} passed`);
  if (fails.length) { console.log('FAILURES:', fails.map(f => f.name).join(' | ')); process.exit(1); }
})().catch(e => { console.error('HARNESS CRASH', e); process.exit(1); });
