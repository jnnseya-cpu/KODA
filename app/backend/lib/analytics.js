'use strict';
// Server-side conversion forwarding — Meta Conversions API + GA4 Measurement Protocol.
//
// Privacy posture (deliberate): the signed-in app carries NO browser trackers. Business
// conversions are forwarded from the backend instead, and we send only the event name +
// a one-way hashed, stable pseudonymous merchant id (external_id / client_id) for
// deduplication and attribution. NO customer data, NO payment data, NO merchant PII
// ever leaves in these calls.
//
// Env-gated like the billing rails: a no-op unless credentials are configured, so it is
// inert in dev/CI and only fires in production once you set the secrets. Fire-and-forget
// with a hard timeout — it can never block, throw into, or slow a request.
const crypto = require('node:crypto');

const META_PIXEL_ID = process.env.META_PIXEL_ID || '1598261432033956';
const META_TOKEN    = process.env.META_CAPI_TOKEN || '';        // Meta system-user access token
const META_TEST     = process.env.META_CAPI_TEST_CODE || '';    // optional: test_event_code
const GA4_ID        = process.env.GA4_MEASUREMENT_ID || '';     // G-XXXXXXXXXX
const GA4_SECRET    = process.env.GA4_API_SECRET || '';         // GA4 Measurement Protocol api_secret

const enabled = () => Boolean(META_TOKEN || (GA4_ID && GA4_SECRET));

const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

// Stable, non-reversible pseudonymous ids derived from the merchant id (no PII).
const externalId = (mid) => sha256('koda:' + mid);
const clientId = (mid) => {
  const h = externalId(mid);
  return parseInt(h.slice(0, 8), 16) + '.' + parseInt(h.slice(8, 16), 16); // GA4 client_id shape
};

function postJson(url, body) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4000);
  Promise.resolve()
    .then(() => fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    }))
    .catch(() => { /* fire-and-forget: never surface network errors */ })
    .finally(() => clearTimeout(t));
}

// Forward one conversion. meta = Meta event name, ga4 = GA4 event name.
function track(merchantId, { meta, ga4, value, currency } = {}) {
  if (!enabled() || !merchantId) return;
  const now = Math.floor(Date.now() / 1000);
  const eventId = sha256(merchantId + ':' + (meta || ga4) + ':' + now).slice(0, 24); // dedup key

  if (META_TOKEN && meta) {
    const event = {
      event_name: meta,
      event_time: now,
      action_source: 'system_generated',
      event_id: eventId,
      user_data: { external_id: [externalId(merchantId)] }, // hashed, non-reversible
    };
    if (value != null) event.custom_data = { value, currency: currency || 'USD' };
    const body = { data: [event] };
    if (META_TEST) body.test_event_code = META_TEST;
    postJson(`https://graph.facebook.com/v19.0/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(META_TOKEN)}`, body);
  }

  if (GA4_ID && GA4_SECRET && ga4) {
    const body = {
      client_id: clientId(merchantId),
      events: [{ name: ga4, params: value != null ? { value, currency: currency || 'USD' } : {} }],
    };
    postJson(`https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(GA4_ID)}&api_secret=${encodeURIComponent(GA4_SECRET)}`, body);
  }
}

module.exports = {
  enabled,
  track,
  // named business conversions
  merchantSignup:       (merchantId) => track(merchantId, { meta: 'CompleteRegistration', ga4: 'koda_merchant_signup' }),
  deviceEnrolled:       (merchantId) => track(merchantId, { meta: 'EnrollDevice',         ga4: 'koda_enroll_device' }),
  apiKeyCreated:        (merchantId) => track(merchantId, { meta: 'CreateApiKey',          ga4: 'koda_api_key_created' }),
  firstPaymentVerified: (merchantId) => track(merchantId, { meta: 'FirstPaymentVerified',  ga4: 'koda_first_payment_verified' }),
};
