// KODA — Meta WhatsApp Business Cloud API adapter.
// Activates when META_WA_TOKEN + META_WA_PHONE_ID are set; otherwise callers
// fall back to sandbox logging. Mirrors the Graph API contract:
//   POST https://graph.facebook.com/{VERSION}/{PHONE_NUMBER_ID}/messages
'use strict';

const VERSION = process.env.META_API_VERSION || 'v20.0';
const TOKEN = () => process.env.META_WA_TOKEN;
const PHONE_ID = () => process.env.META_WA_PHONE_ID;

const configured = () => !!(TOKEN() && PHONE_ID());

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

module.exports = { configured, sendText, sendTemplate, EVENT_TEMPLATES };
