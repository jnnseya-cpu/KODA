// Visual proof of the customer checkout page: creates an intent, drives the
// hosted /pay page in a real browser through operator-pick → pay → code entry →
// VERIFIED, and screenshots each step. Requires a running server + playwright.
'use strict';
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const path = require('node:path');
const fs = require('node:fs');
const BASE = process.env.KODA_BASE || 'http://localhost:4600';
const DIR = process.env.KODA_PROOF_DIR || path.join(__dirname, '..', '..', 'proof');
fs.mkdirSync(DIR, { recursive: true });

async function j(method, p, body, headers) {
  const r = await fetch(BASE + p, { method, headers: { 'content-type': 'application/json', ...(headers || {}) }, body: body ? JSON.stringify(body) : undefined });
  return r.json();
}

(async () => {
  // set up an intent as a merchant would
  const login = await j('POST', '/app/auth/login', { email: 'demo@koda.africa', password: 'koda-demo' });
  const bearer = { authorization: 'Bearer ' + login.token };
  const pk = await j('POST', '/app/keys', { prefix: 'pk_live', label: 'ui-proof' }, bearer);
  const sk = await j('POST', '/app/keys', { prefix: 'sk_live', label: 'ui-proof' }, bearer);
  const ref = 'OM.260805.2100.UI' + Math.floor(performance.now() % 1e5);
  const intent = await j('POST', '/v1/intents', {
    amount: 25000, currency: 'CDF', operators: ['orange_cd', 'mpesa_cd'],
    metadata: { order_id: 'CMD-UI-7' },
  }, { authorization: 'Bearer ' + pk.secret });

  const browser = await pw.chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 420, height: 780 } });
  const shot = (n) => page.screenshot({ path: path.join(DIR, 'checkout-' + n + '.png') });
  let step = 0, ok = 0, fail = 0;
  const check = (c, m) => { c ? (ok++, console.log('  ✓ ' + m)) : (fail++, console.log('  ✗ ' + m)); };

  const url = BASE + '/pay/' + intent.intent_id + '?cs=' + intent.client_secret;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  check(await page.locator('text=Montant à payer').count() > 0, 'checkout page renders amount');
  check((await page.content()).includes('25'), 'amount 25 000 shown');
  await shot(String(++step).padStart(2, '0') + '-amount');

  // pick an operator (.op button)
  await page.locator('.op').first().click();
  await page.waitForTimeout(300);
  check(await page.locator('text=Paie ce montant').count() > 0, 'pay-to number shown after operator pick');
  await shot(String(++step).padStart(2, '0') + '-operator');

  // "J'ai payé" → code entry (#paid → #ref)
  await page.locator('#paid').click();
  await page.waitForTimeout(300);
  check(await page.locator('#ref').count() > 0, 'code-entry field shown');
  await shot(String(++step).padStart(2, '0') + '-code-entry');

  // land the SMS, then submit the code
  await j('POST', '/v1/sandbox/sms', { operator: 'orange_cd', raw: `Vous avez recu 25 000 FC de UI CLIENT (+243890777888). Ref: ${ref}.` }, { authorization: 'Bearer ' + sk.secret });
  await page.locator('#ref').fill(ref);
  await page.locator('#go').click();
  await page.waitForTimeout(1800);
  const body = await page.content();
  check(/confirmé|verified|✅/i.test(body), 'payment VERIFIED on the page');
  await shot(String(++step).padStart(2, '0') + '-verified');

  await browser.close();
  console.log(`\n${ok} passed, ${fail} failed  ·  screenshots → ${DIR}\n`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('CHECKOUT-UI CRASH', e); process.exit(1); });
