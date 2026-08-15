// KODA — live FX refresher. Keeps the indicative USD→local rates fresh across
// KODA's 90+ country footprint WITHOUT making KODA an FX desk:
//   · fetches USD→currency rates daily from a free, no-key source, caches them in
//     koda_settings (key 'fx_live') with a timestamp;
//   · settings.usdToLocal() prefers this cached rate over the STATIC shared/fx.js
//     table — but the admin-saved rate / KODA_USD_TO_LOCAL still win (the exact
//     mobile-money cash rate stays authoritative);
//   · every failure mode falls back to the last cache, then the static table, then
//     2800. It NEVER throws and NEVER blocks the money path (usdToLocal only reads
//     the cache; the network fetch runs on boot + a timer).
'use strict';
const { q } = require('./db');

const KEY = 'fx_live';
const MAX_AGE_MS = 12 * 3600 * 1000; // refresh at most ~twice a day
const SOURCE = 'https://open.er-api.com/v6/latest/USD'; // free, no API key, wide coverage

function read() {
  try { const r = q.get('SELECT value FROM koda_settings WHERE key=?', KEY); return r ? JSON.parse(r.value) : null; }
  catch { return null; }
}
// current live rate for a currency, or null if we don't have a fresh-enough one
function rateFor(currency) {
  const c = String(currency || '').toUpperCase();
  const d = read();
  const r = d && d.rates ? d.rates[c] : null;
  return (typeof r === 'number' && r > 0) ? r : null;
}
function isStale() {
  const d = read();
  if (!d || !d.at) return true;
  return (Date.now() - new Date(d.at).getTime()) > MAX_AGE_MS;
}
// fetch + cache. Best-effort: returns {ok,...}, never throws.
async function refresh(force = false) {
  if (!force && !isStale()) return { ok: true, cached: true };
  try {
    const res = await fetch(SOURCE, { signal: AbortSignal.timeout(8000) });
    const j = await res.json().catch(() => null);
    if (!j || j.result !== 'success' || !j.rates || typeof j.rates !== 'object') return { ok: false, reason: 'bad_response' };
    q.run(`INSERT INTO koda_settings (key,value,updated_at) VALUES (?,?,datetime('now'))
           ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,
      KEY, JSON.stringify({ base: 'USD', rates: j.rates, at: new Date().toISOString(), source: 'open.er-api.com' }));
    return { ok: true, count: Object.keys(j.rates).length };
  } catch (e) { return { ok: false, reason: String((e && e.message) || e) }; }
}
// boot hook + periodic timer; both no-throw. Refreshes only when stale.
function start() {
  const go = () => refresh(false).then(r => {
    if (r && r.ok && !r.cached && !process.env.KODA_QUIET) console.log(`  → FX rates       refreshed ${r.count} currencies (open.er-api.com)`);
  }).catch(() => { /* non-fatal */ });
  go();
  try { setInterval(go, MAX_AGE_MS).unref?.(); } catch { /* no timer in some hosts */ }
}

module.exports = { rateFor, refresh, isStale, read, start };
