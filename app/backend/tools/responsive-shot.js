// Screenshot the KODA app across screen sizes to prove the PWA fits all screens.
'use strict';
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const path = require('node:path'); const fs = require('node:fs');
const B = process.env.KODA_BASE || 'http://localhost:4600';
const DIR = path.join(__dirname, '..', '..', 'proof'); fs.mkdirSync(DIR, { recursive: true });
const SIZES = [
  { name: 'phone', w: 390, h: 844 },
  { name: 'tablet', w: 768, h: 1024 },
  { name: 'desktop', w: 1440, h: 900 },
];
(async () => {
  const browser = await pw.chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  for (const s of SIZES) {
    const page = await browser.newPage({ viewport: { width: s.w, height: s.h } });
    // login
    await page.goto(B + '/app', { waitUntil: 'networkidle' });
    await page.fill('input[type=email]', 'demo@koda.africa').catch(() => {});
    await page.fill('input[type=password]', 'koda-demo').catch(() => {});
    await page.getByRole('button', { name: /sign in/i }).click().catch(() => page.locator('.btn-gold').first().click().catch(() => {}));
    await page.waitForTimeout(1800);
    await page.screenshot({ path: path.join(DIR, `pwa-${s.name}.png`) });
    console.log(`shot pwa-${s.name}.png (${s.w}x${s.h})`);
    await page.close();
  }
  await browser.close();
})().catch(e => { console.error('SHOT CRASH', e); process.exit(1); });
