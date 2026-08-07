// KODA — ADD-ON A: operator-API cross-verification ("dual-confirmed").
//
// This is a strict ADD-ON. KODA's verification is and stays SMS-anchored: the
// operator's own confirmation SMS, captured on the merchant's device, is the
// source of truth, and the verify() decision is never changed here. When (and
// only when) an operator API adapter is configured, we can INDEPENDENTLY confirm
// a receipt against the operator's own API and upgrade its trust label from
// `sms_anchored` to `dual_confirmed`. No adapter configured → this is a no-op and
// every receipt stays exactly as today.
//
// Adapters are configured per operator via env, so KODA keeps its "no telco
// contract required" default — a merchant with an operator API deal simply plugs
// it in for belt-and-suspenders assurance.
//
//   KODA_OPAPI_ORANGE_CD = https://partner.example/confirm      (POST endpoint)
//   KODA_OPAPI_ORANGE_CD_KEY = <bearer token>                   (optional)
//   ...one per operator code (uppercased). Special test values:
//   mock://confirm  → always confirms   ·   mock://deny → never confirms
'use strict';
const { q } = require('./db');

// Which operator has an adapter configured? (env-driven, so off by default.)
function adapterFor(operator) {
  const url = process.env['KODA_OPAPI_' + String(operator || '').toUpperCase()];
  if (!url) return null;
  return { url, key: process.env['KODA_OPAPI_' + String(operator).toUpperCase() + '_KEY'] || null };
}
function available(operator) { return !!adapterFor(operator); }

// Ask the operator API whether this transaction really exists. Returns
// { available, confirmed, provider, detail }. Never throws — a down/unknown API
// falls back to "not available" so the SMS-anchored verdict simply stands.
async function verifyTx({ operator, reference, amount, msisdn }) {
  const a = adapterFor(operator);
  if (!a) return { available: false, confirmed: null, provider: null, detail: 'no_adapter' };
  // deterministic test adapters — no network
  if (a.url === 'mock://confirm') return { available: true, confirmed: true, provider: 'mock', detail: 'mock_confirm' };
  if (a.url === 'mock://deny') return { available: true, confirmed: false, provider: 'mock', detail: 'mock_deny' };
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(a.url, {
      method: 'POST', signal: ctrl.signal,
      headers: Object.assign({ 'content-type': 'application/json' }, a.key ? { authorization: 'Bearer ' + a.key } : {}),
      body: JSON.stringify({ operator, reference, amount, msisdn }),
    });
    clearTimeout(timer);
    if (!res.ok) return { available: true, confirmed: null, provider: 'operator_api', detail: 'http_' + res.status };
    const data = await res.json().catch(() => ({}));
    const confirmed = data.confirmed === true || data.status === 'confirmed' || data.exists === true;
    return { available: true, confirmed, provider: 'operator_api', detail: confirmed ? 'confirmed' : 'not_found' };
  } catch (e) {
    return { available: true, confirmed: null, provider: 'operator_api', detail: 'error' };
  }
}

// Enrich an existing receipt: run the operator-API check and, if it independently
// confirms, upgrade confirmation_level to 'dual_confirmed'. The SMS-anchored
// verdict itself is untouched — we only add a stronger label + a trace line.
async function enrichReceipt(merchant, receiptId) {
  const r = q.get('SELECT * FROM receipts WHERE id=? AND merchant_id=?', receiptId, merchant.id);
  if (!r) return { ok: false, error: 'receipt_not_found' };
  if (!available(r.operator)) {
    return { ok: true, receipt_id: r.id, confirmation_level: r.confirmation_level || 'sms_anchored',
             available: false, note: 'No operator-API adapter configured for ' + r.operator + '; stays SMS-anchored.' };
  }
  const res = await verifyTx({ operator: r.operator, reference: r.reference, amount: r.amount,
    msisdn: r.payer_suffix ? '****' + r.payer_suffix : null });
  const level = res.confirmed === true ? 'dual_confirmed' : (r.confirmation_level || 'sms_anchored');
  let trace = {};
  try { trace = JSON.parse(r.decision_trace || '{}'); } catch { trace = {}; }
  if (!Array.isArray(trace.steps)) trace.steps = [];
  trace.steps.push(`operator_api_crosscheck: ${res.provider || 'n/a'} → ${res.detail}` + (res.confirmed === true ? ' (DUAL-CONFIRMED)' : ''));
  q.run('UPDATE receipts SET confirmation_level=?, decision_trace=? WHERE id=?', level, JSON.stringify(trace), r.id);
  return { ok: true, receipt_id: r.id, confirmation_level: level, available: true,
           operator_api: { provider: res.provider, confirmed: res.confirmed, detail: res.detail } };
}

module.exports = { available, verifyTx, enrichReceipt, adapterFor };
