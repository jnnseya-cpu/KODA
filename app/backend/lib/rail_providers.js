// KODA — real payment-rail adapters (System B). Turns a pending `topups` row into a
// live hosted-checkout URL by calling the provider's REST API. Zero-dependency:
// uses global fetch (Node ≥22). Each adapter is a thin, well-documented HTTP call —
// no SDK, no state. Called ONLY from billing.startProviderSession (the async
// /billing/go/:id redirect), so the synchronous money-path (createTopup /
// createPlanCheckout / settleTopup) is never made async and its tests stay valid.
//
// A rail is only reachable here when its API key env is set; otherwise the caller
// keeps the sandbox flow. Configure per provider:
//   Stripe       STRIPE_KEY           (sk_live_… / sk_test_…)   + STRIPE_WEBHOOK_SECRET (whsec_…)
//   Paystack     PAYSTACK_KEY         (sk_live_… / sk_test_…)   [webhook signed with the same secret key]
//   Flutterwave  FLUTTERWAVE_KEY      (FLWSECK-…)               + FLUTTERWAVE_WEBHOOK_HASH
'use strict';
const { q } = require('./db');

const TIMEOUT_MS = Number(process.env.KODA_RAIL_HTTP_TIMEOUT_MS) || 12000;

function merchantEmail(topup) {
  const m = q.get('SELECT * FROM merchants WHERE id=?', topup.merchant_id);
  const u = m ? q.get(`SELECT email FROM users WHERE merchant_id=? AND role='owner' ORDER BY created_at ASC LIMIT 1`, m.id) : null;
  return (u && u.email) || `billing+${topup.merchant_id}@kodajnn.com`;
}
function label(topup) {
  return topup.purpose === 'plan'
    ? `KODA ${topup.plan_key || ''} plan — monthly`.trim()
    : `KODA ${topup.acu_amount} ACU top-up`;
}
async function httpJson(url, opts) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    const text = await res.text();
    let json = null; try { json = text ? JSON.parse(text) : null; } catch {}
    return { ok: res.ok, status: res.status, json, text };
  } finally { clearTimeout(timer); }
}

// ── Stripe — Checkout Session (hosted). Amount in the currency's minor unit. ──
async function stripe(topup, ctx) {
  const key = process.env.STRIPE_KEY;
  if (!key) return { error: 'stripe_not_configured' };
  const currency = (process.env.STRIPE_CURRENCY || 'usd').toLowerCase();
  const cents = Math.round(Number(topup.total_usd) * 100);
  // form-encoded body (Stripe's API is application/x-www-form-urlencoded)
  const form = new URLSearchParams();
  form.set('mode', 'payment');
  form.set('success_url', ctx.success_url);
  form.set('cancel_url', ctx.cancel_url);
  form.set('client_reference_id', topup.id);
  form.set('metadata[topup_id]', topup.id);
  form.set('customer_email', merchantEmail(topup));
  form.set('line_items[0][quantity]', '1');
  form.set('line_items[0][price_data][currency]', currency);
  form.set('line_items[0][price_data][unit_amount]', String(cents));
  form.set('line_items[0][price_data][product_data][name]', label(topup));
  const r = await httpJson('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  if (!r.ok || !r.json || !r.json.url) return { error: 'stripe_error', detail: r.json && r.json.error && r.json.error.message };
  return { url: r.json.url, provider_ref: r.json.id };
}

// ── Paystack — Transaction Initialize (hosted authorization_url). Minor unit. ──
async function paystack(topup, ctx) {
  const key = process.env.PAYSTACK_KEY;
  if (!key) return { error: 'paystack_not_configured' };
  const currency = (process.env.PAYSTACK_CURRENCY || 'NGN').toUpperCase();
  // Paystack amount is in the subunit (kobo/pesewa/cents). total_usd is a USD figure;
  // when charging a non-USD Paystack account, set PAYSTACK_CURRENCY + PAYSTACK_FX so the
  // amount is converted; default FX=1 charges the numeric value in the account currency.
  const fx = Number(process.env.PAYSTACK_FX) || 1;
  const subunit = Math.round(Number(topup.total_usd) * fx * 100);
  const r = await httpJson('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      email: merchantEmail(topup),
      amount: subunit,
      currency,
      reference: topup.id,               // our topup id IS the provider reference → webhook maps back
      callback_url: ctx.success_url,
      metadata: { topup_id: topup.id, purpose: topup.purpose || 'acu', label: label(topup) },
    }),
  });
  if (!r.ok || !r.json || !r.json.data || !r.json.data.authorization_url) {
    return { error: 'paystack_error', detail: r.json && r.json.message };
  }
  return { url: r.json.data.authorization_url, provider_ref: r.json.data.reference || topup.id };
}

// ── Flutterwave — Standard payment (hosted link). Amount in major unit. ──
async function flutterwave(topup, ctx) {
  const key = process.env.FLUTTERWAVE_KEY;
  if (!key) return { error: 'flutterwave_not_configured' };
  const currency = (process.env.FLUTTERWAVE_CURRENCY || 'USD').toUpperCase();
  const r = await httpJson('https://api.flutterwave.com/v3/payments', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      tx_ref: topup.id,
      amount: Number(topup.total_usd),
      currency,
      redirect_url: ctx.success_url,
      customer: { email: merchantEmail(topup) },
      meta: { topup_id: topup.id, purpose: topup.purpose || 'acu' },
      customizations: { title: 'KODA', description: label(topup) },
    }),
  });
  if (!r.ok || !r.json || !r.json.data || !r.json.data.link) {
    return { error: 'flutterwave_error', detail: r.json && r.json.message };
  }
  return { url: r.json.data.link, provider_ref: topup.id };
}

async function createCheckout(rail, topup, ctx) {
  if (rail === 'stripe') return stripe(topup, ctx);
  if (rail === 'paystack') return paystack(topup, ctx);
  if (rail === 'flutterwave') return flutterwave(topup, ctx);
  return { error: 'rail_has_no_live_adapter', rail };
}

module.exports = { createCheckout, stripe, paystack, flutterwave };
