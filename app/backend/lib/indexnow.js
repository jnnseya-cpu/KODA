// KODA — IndexNow client (instant search-engine indexing).
// IndexNow is the modern replacement for the deprecated sitemap "ping" endpoints
// (Google retired /ping in 2023; Bing redirects to IndexNow). One POST notifies
// Bing, Yandex, Seznam and Naver the moment pages change — and the key is PUBLIC
// by design (served at /<key>.txt to prove ownership). We submit the exact URL
// set from the freshly built sitemap.xml, so every deploy re-announces all pages.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { SITE } = require('./seo');

// Public ownership key (8–128 chars, hex/alnum/-). Not a secret. Overridable.
const KEY = (process.env.KODA_INDEXNOW_KEY || 'a7f3c9e1b2d8455689a01c2e3f4b5d6c')
  .toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 128) || 'a7f3c9e1b2d8455689a01c2e3f4b5d6c';
const KEY_PATH = `/${KEY}.txt`;
const host = () => { try { return new URL(SITE).host; } catch { return 'kodajnn.com'; } };

// the exact URLs to announce — read from the built sitemap (single source of truth)
function urls() {
  try {
    const xml = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'site', 'sitemap.xml'), 'utf8');
    return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  } catch { return []; }
}

// POST the URL list to IndexNow. Returns {ok, status, count} — never throws.
async function submit(urlList = urls()) {
  const list = (urlList || []).filter(u => u && u.startsWith('http'));
  if (!list.length) return { ok: false, status: 0, count: 0, reason: 'no_urls' };
  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: host(), key: KEY, keyLocation: `${SITE}${KEY_PATH}`, urlList: list }),
    });
    return { ok: res.ok, status: res.status, count: list.length };
  } catch (e) { return { ok: false, status: 0, count: list.length, reason: String(e && e.message || e) }; }
}

// Fire-and-forget on boot, PRODUCTION ONLY against a real public https origin.
// (In dev/CI we never reach out — the key file and submit() stay available for tests.)
function autosubmit() {
  const prod = process.env.NODE_ENV === 'production';
  const real = /^https:\/\//.test(SITE) && !/localhost|127\.0\.0\.1/.test(SITE);
  if (!prod || !real || process.env.KODA_INDEXNOW_DISABLE) return;
  submit().then(r => {
    if (!process.env.KODA_QUIET) console.log(`  → IndexNow       submitted ${r.count} URLs · ${r.ok ? 'accepted' : 'status ' + r.status}`);
  }).catch(() => { /* non-fatal */ });
}

module.exports = { KEY, KEY_PATH, host, urls, submit, autosubmit };
