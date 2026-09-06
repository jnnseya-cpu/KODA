// KODA — USSD (Door 4) aggregator adapter. Feature-phone / no-internet verification:
// a MERCHANT dials a shortcode from their registered SIM and types the payment code;
// KODA routes by the SIM number and returns the verdict in the same session.
//
// Aggregator-agnostic. The shortcode itself lives at the aggregator (Africa's Talking,
// an MNO, Hubtel, …) — there is no "KODA USSD key", so the door is CONFIGURED by naming
// the provider (wire format) and, optionally, a shared secret the aggregator sends back:
//
//   KODA_USSD_PROVIDER = africastalking | generic   (unset → endpoint still answers in
//                                                    AT format for sandbox, door not "live")
//   KODA_USSD_SECRET   = <shared secret>            (optional; when set, inbound calls
//                                                    MUST present it or are rejected)
//   KODA_USSD_SHORTCODE = *123#                     (display only — shown in the console)
//
// Wire formats:
//   africastalking — inbound {sessionId, phoneNumber, text} (text is '*'-joined steps);
//                    reply is PLAIN TEXT prefixed "CON " (session continues) / "END ".
//   generic        — inbound {session_id, msisdn, input}; reply is JSON
//                    {action:'continue'|'end', message}. For aggregators that speak JSON.
'use strict';
const crypto = require('node:crypto');

const PROVIDER = () => String(process.env.KODA_USSD_PROVIDER || '').toLowerCase().trim();
const SECRET = () => process.env.KODA_USSD_SECRET;
const SHORTCODE = () => process.env.KODA_USSD_SHORTCODE || '';

const KNOWN = ['africastalking', 'generic'];
const configured = () => KNOWN.includes(PROVIDER());
const secretSet = () => !!SECRET();
// Default wire format is Africa's Talking (the de-facto standard most MNO aggregators
// mimic), so the endpoint keeps answering in CON/END even before a provider is named.
const format = () => (PROVIDER() === 'generic' ? 'generic' : 'africastalking');

// Reject a forged/unauthorised call. USSD has no universal request signature, so the
// guard is an OPT-IN shared secret: when KODA_USSD_SECRET is set, the aggregator must
// echo it (header `x-ussd-secret` or a `secret` body field) or the call is refused. When
// no secret is configured we do not fail closed — there is no standard secret to require,
// and requiring one would break a legitimate aggregator that cannot send custom fields.
function verifySource(headers = {}, body = {}) {
  const secret = SECRET();
  if (!secret) return { ok: true, skipped: true };
  const given = String(headers['x-ussd-secret'] || (body && body.secret) || '');
  const a = Buffer.from(given), b = Buffer.from(String(secret));
  return { ok: a.length === b.length && crypto.timingSafeEqual(a, b) };
}

// Normalise an inbound request across wire formats into {sessionId, phone, steps, rawText}.
// `steps` are the '*'-separated USSD menu entries a user has typed so far.
function parseInbound(body = {}) {
  const phone = String(body.phoneNumber || body.msisdn || body.from || '').trim();
  const sessionId = String(body.sessionId || body.session_id || '').trim();
  const rawText = body.text != null ? String(body.text)
    : body.input != null ? String(body.input) : '';
  const steps = rawText.split('*').filter(s => s !== '');
  return { sessionId, phone, steps, rawText };
}

// Build the route response tuple. `cont` true → the session stays open (CON / continue);
// false → terminal verdict (END / end). Text is provider-formatted so the same route
// logic serves any aggregator.
function reply(cont, text) {
  if (format() === 'generic') {
    return [200, { action: cont ? 'continue' : 'end', message: String(text) }];
  }
  return [200, (cont ? 'CON ' : 'END ') + String(text), { 'content-type': 'text/plain; charset=utf-8' }];
}

// One-line status for the admin Doors console.
function describe() {
  if (!configured()) {
    return 'not configured — set KODA_USSD_PROVIDER (africastalking|generic) and register a shortcode at the aggregator';
  }
  return `${PROVIDER()}${secretSet() ? ' · shared secret set' : ' · no shared secret (set KODA_USSD_SECRET to harden)'}`
    + (SHORTCODE() ? ` · ${SHORTCODE()}` : '');
}

module.exports = { configured, secretSet, format, provider: PROVIDER, shortcode: SHORTCODE,
  verifySource, parseInbound, reply, describe };
