// KODA — IndexNow client (instant search-engine indexing).
// IndexNow is the modern replacement for the deprecated sitemap "ping" endpoints
// (Google retired /ping in 2023; Bing redirects to IndexNow). One POST notifies
// Bing, Yandex, Seznam and Naver the moment pages change — and the key is PUBLIC
// by design (served at /<key>.txt to prove ownership). On each production boot we
// diff the freshly built sitemap against what was last announced and ping only the
// URLs a release actually added — so restarts stay quiet and new posts go out.
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

// Persisted record of what we last announced, so a plain restart/crash does NOT
// re-ping — only a real release that changed the URL set does. Lives in the data
// volume (survives container rebuilds).
const STATE = path.join(process.env.KODA_DATA_DIR || path.join(__dirname, '..', '..', 'data'), 'indexnow-state.json');
function lastAnnounced() { try { return JSON.parse(fs.readFileSync(STATE, 'utf8')).urls || []; } catch { return []; } }
function recordAnnounced(list) { try { fs.writeFileSync(STATE, JSON.stringify({ urls: list, at: new Date().toISOString() })); } catch { /* best-effort */ } }

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

// Diff the current sitemap against what we last announced. Returns the URLs to
// ping this release: the ADDED ones (new posts/pages), or ALL on a first run.
function pendingChanges() {
  const current = urls();
  const prev = new Set(lastAnnounced());
  const added = prev.size ? current.filter(u => !prev.has(u)) : current;
  return { current, added, firstRun: prev.size === 0 };
}

// Fire-and-forget on boot, PRODUCTION ONLY against a real public https origin.
// Change-gated: a restart/crash with an unchanged URL set stays SILENT; a release
// that added pages announces just those. (In dev/CI we never reach out — the key
// file, submit() and the diff stay available for tests.)
function autosubmit() {
  const prod = process.env.NODE_ENV === 'production';
  const real = /^https:\/\//.test(SITE) && !/localhost|127\.0\.0\.1/.test(SITE);
  if (!prod || !real || process.env.KODA_INDEXNOW_DISABLE) return;
  const { current, added } = pendingChanges();
  if (!added.length) { if (!process.env.KODA_QUIET) console.log('  → IndexNow       no new URLs since last release — skipped'); return; }
  submit(added).then(r => {
    if (r.ok) recordAnnounced(current); // only advance the baseline on a confirmed ping
    if (!process.env.KODA_QUIET) console.log(`  → IndexNow       announced ${r.count} changed URL(s) · ${r.ok ? 'accepted' : 'status ' + r.status}`);
  }).catch(() => { /* non-fatal */ });
}

module.exports = { KEY, KEY_PATH, host, urls, submit, autosubmit, pendingChanges, lastAnnounced, recordAnnounced, STATE };
