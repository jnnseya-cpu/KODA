// KODA — Meta WhatsApp Business Cloud API adapter.
// Activates when META_WA_TOKEN + META_WA_PHONE_ID are set; otherwise callers
// fall back to sandbox logging. Mirrors the Graph API contract:
//   POST https://graph.facebook.com/{VERSION}/{PHONE_NUMBER_ID}/messages
'use strict';
const crypto = require('node:crypto');

const VERSION = process.env.META_API_VERSION || 'v20.0';
const TOKEN = () => process.env.META_WA_TOKEN;
const PHONE_ID = () => process.env.META_WA_PHONE_ID;
const APP_SECRET = () => process.env.META_APP_SECRET;

const configured = () => !!(TOKEN() && PHONE_ID());
const appSecretSet = () => !!APP_SECRET();

// Verify Meta's X-Hub-Signature-256 (HMAC-SHA256 of the RAW body with the app
// secret). If META_APP_SECRET is unset we skip ONLY when the door is not actually
// live (no TOKEN/PHONE_ID) — a dev/sandbox convenience. When WhatsApp IS configured
// but the secret is missing we FAIL CLOSED: an inbound-payment door must never accept
// an unverifiable (potentially forged) call in production.
function verifySignature(rawBody, signatureHeader) {
  const secret = APP_SECRET();
  if (!secret) return configured() ? { ok: false, reason: 'app_secret_required' } : { ok: true, skipped: true };
  const sig = String(signatureHeader || '');
  if (!sig.startsWith('sha256=')) return { ok: false };
  const expected = 'sha256=' + crypto.createHmac('sha256', secret)
    .update(rawBody && rawBody.length ? rawBody : Buffer.alloc(0)).digest('hex');
  const a = Buffer.from(sig), b = Buffer.from(expected);
  return { ok: a.length === b.length && crypto.timingSafeEqual(a, b) };
}

async function call(payload) {
  const res = await fetch(`https://graph.facebook.com/${VERSION}/${PHONE_ID()}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
    signal: AbortSignal.timeout(10000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || `graph_http_${res.status}`);
  return { ok: true, message_id: data.messages?.[0]?.id || null };
}

// plain text — allowed inside the 24h customer-service window (i.e. replies in Chat Mode)
function sendText(to, body) {
  return call({ to, type: 'text', text: { preview_url: false, body } });
}

// template — required for business-initiated messages (digests, alerts, receipts)
function sendTemplate(to, name, langCode = 'fr', components = undefined) {
  return call({ to, type: 'template',
    template: { name, language: { code: langCode }, ...(components ? { components } : {}) } });
}

// map KODA comm events to pre-approved template names (create these in WhatsApp Manager)
const EVENT_TEMPLATES = {
  'payment.verified': 'koda_payment_verified',
  'payment.verified.late': 'koda_payment_verified',
  'billing.topup.verified': 'koda_topup_verified',
  'billing.low_balance': 'koda_low_balance',
  'sentinel.offline': 'koda_sentinel_offline',
  'fraud.chain_break': 'koda_security_alert',
  'digest.daily': 'koda_daily_digest',
};

module.exports = { configured, appSecretSet, verifySignature, sendText, sendTemplate, EVENT_TEMPLATES };
