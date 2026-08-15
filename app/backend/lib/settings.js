// KODA — runtime settings store. Admin-editable config that OVERRIDES env defaults,
// so the team manages operational values (above all KODA's own mobile-money receiving
// numbers used for zero-fee self-collection) from the admin console — never by editing
// env files on the VPS. Resolution order for every value: DB row → env var → default.
'use strict';
const { q } = require('./db');

function raw(key) {
  try { const r = q.get('SELECT value FROM koda_settings WHERE key=?', key); return r ? r.value : null; }
  catch { return null; }
}
function set(key, value) {
  const v = value == null ? '' : (typeof value === 'string' ? value : JSON.stringify(value));
  q.run(`INSERT INTO koda_settings (key,value,updated_at) VALUES (?,?,datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`, key, v);
  return v;
}
function get(key, envKey, dflt) {
  const v = raw(key);
  if (v != null && v !== '') return v;
  if (envKey && process.env[envKey]) return process.env[envKey];
  return dflt;
}
function getJson(key, dflt) {
  const v = raw(key);
  if (v != null && v !== '') { try { return JSON.parse(v); } catch { return dflt; } }
  return dflt;
}

// ── KODA self-collection config (zero-fee mobile-money rail) ──────────────────
// The collection merchant is a KODA-owned account whose Sentinel phone holds the
// receiving SIM(s); its incoming operator SMS auto-settles pending plan/top-up orders.
function collectMerchantId() { return get('collect_merchant_id', 'KODA_COLLECT_MERCHANT', ''); }
function collectCurrency() { return String(get('collect_currency', 'KODA_COLLECT_CURRENCY', 'CDF')).toUpperCase(); }
// Settlement rate: an explicitly-saved value (admin console) or env always wins;
// otherwise it AUTO-DERIVES from the collection currency's indicative default
// (shared/fx.js), so the rate is sensible per country without manual entry.
function rateIsExplicit() {
  const v = raw('usd_to_local');
  return (v != null && v !== '') || !!process.env.KODA_USD_TO_LOCAL;
}
function usdToLocal() {
  const v = raw('usd_to_local');
  if (v != null && v !== '') return Number(v) || 2800;                              // admin-saved (exact cash rate) wins
  if (process.env.KODA_USD_TO_LOCAL) return Number(process.env.KODA_USD_TO_LOCAL) || 2800; // env pin
  try { const live = require('./fx_live').rateFor(collectCurrency()); if (live) return live; } catch { /* live optional */ } // fresh live rate
  try { const fx = require('../../shared/fx').defaultRate(collectCurrency()); if (fx) return fx; } catch { /* fx optional */ } // static default
  return 2800;
}
// Receiving numbers: [{ operator, msisdn, label, active }]. Falls back to the single
// env number (KODA_COLLECT_MSISDN) so existing deployments keep working.
function collectNumbers() {
  const list = getJson('collect_numbers', null);
  if (Array.isArray(list) && list.length) return list;
  const env = process.env.KODA_COLLECT_MSISDN;
  return env ? [{ operator: '', msisdn: env, label: 'primary', active: 1 }] : [];
}
function activeNumbers() { return collectNumbers().filter(n => n && n.active && n.msisdn); }
// Pick the number to show a buyer: prefer one matching the operator they'll pay from.
function primaryNumber(operator) {
  const list = activeNumbers();
  if (!list.length) return '';
  if (operator) { const m = list.find(n => (n.operator || '') === operator); if (m) return m.msisdn; }
  return list[0].msisdn;
}
function collectConfigured() { return activeNumbers().length > 0; }

module.exports = {
  raw, get, getJson, set,
  collectMerchantId, collectCurrency, usdToLocal, rateIsExplicit,
  collectNumbers, activeNumbers, primaryNumber, collectConfigured,
};
