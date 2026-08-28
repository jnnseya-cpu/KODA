// KODA — webhook dispatcher: HMAC-SHA256 signed, retried, dead-lettered.
'use strict';
const { q } = require('./db');
const { id, hmac } = require('./util');
const net = require('node:net');
const dns = require('node:dns').promises;

const MAX_ATTEMPTS = 5;

// ── SSRF egress guard ────────────────────────────────────────────────────────
// A webhook URL is merchant-supplied and the KODA server fetches it. Without this
// guard a merchant could point an endpoint at cloud-metadata (169.254.169.254),
// loopback, or an RFC-1918 host and use KODA as a blind internal-network probe.
// We block internal address ranges both as literal-IP hosts (synchronously, at
// create time) and after DNS resolution (at delivery time, to defeat a hostname
// that resolves to an internal IP — including a re-check on every attempt).
function ipBlocked(ip) {
  ip = String(ip || '');
  if (ip.includes(':')) {                        // IPv6
    const l = ip.toLowerCase();
    if (l === '::1' || l === '::') return true;
    if (l.startsWith('::ffff:')) return ipBlocked(l.slice(7)); // v4-mapped
    if (l.startsWith('fe80') || l.startsWith('fc') || l.startsWith('fd')) return true; // link-local + unique-local
    return false;
  }
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return true; // malformed → block
  const [a, b] = p;
  if (a === 0 || a === 127) return true;               // this-host / loopback
  if (a === 10) return true;                           // private
  if (a === 172 && b >= 16 && b <= 31) return true;    // private
  if (a === 192 && b === 168) return true;             // private
  if (a === 169 && b === 254) return true;             // link-local + cloud metadata
  if (a === 100 && b >= 64 && b <= 127) return true;   // CGNAT
  if (a >= 224) return true;                           // multicast / reserved
  return false;
}
// Synchronous validation for the CREATE/UPDATE path: scheme must be http(s) and a
// literal-IP host must not be internal. Hostnames are re-checked after DNS at delivery.
function unwrap(host) {   // strip [ ] from an IPv6 URL host
  host = String(host || '');
  return (host.startsWith('[') && host.endsWith(']')) ? host.slice(1, -1) : host;
}
// Sandbox convention: these hosts are marked "sent" at delivery WITHOUT a network
// call (see attempt), so they are inert and cannot drive an SSRF. Allowed on create.
function isSandboxHost(host) {
  host = unwrap(String(host || '')).toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.test') || host === 'example.com';
}
function validWebhookUrl(url) {
  let u; try { u = new URL(String(url)); } catch { return false; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  const host = unwrap(u.hostname).toLowerCase();
  if (isSandboxHost(host)) return true;              // inert — never fetched
  if (net.isIP(host) && ipBlocked(host)) return false;
  return true;
}
// Resolve a host and confirm EVERY resolved address is public (unresolvable → unsafe).
async function resolvesToPublic(host) {
  host = unwrap(host);
  if (net.isIP(host)) return !ipBlocked(host);
  try {
    const addrs = await dns.lookup(host, { all: true });
    return addrs.length > 0 && addrs.every(a => !ipBlocked(a.address));
  } catch { return false; }
}

function dispatch(merchantId, event, payload) {
  const endpoints = q.all(
    `SELECT * FROM webhook_endpoints WHERE merchant_id=? AND active=1`, merchantId);
  // Routing (spec §15): a verification/event can name a destination (top-level or in
  // metadata); an endpoint scoped to a destination only receives matching events,
  // while a NULL-destination endpoint is a catch-all (unchanged legacy behaviour).
  const dest = payload.destination || payload.metadata?.destination || payload.metadata?.application || null;
  for (const ep of endpoints) {
    const events = JSON.parse(ep.events || '["*"]');
    if (!events.includes('*') && !events.includes(event)) continue;
    if (ep.destination && ep.destination !== dest) continue;   // scoped endpoint, non-matching → skip
    const body = JSON.stringify({ event, ...payload, created_at: new Date().toISOString() });
    const signature = hmac(ep.secret, body);   // stored record (legacy body-only sig)
    const dlv = id('whd');
    q.run(`INSERT INTO webhook_deliveries (id,endpoint_id,merchant_id,event,payload,signature,status)
           VALUES (?,?,?,?,?,?, 'pending')`, dlv, ep.id, merchantId, event, body, signature);
    attempt(dlv, ep.url, body, ep.secret, 1);
  }
}

// Signature headers computed at SEND time (so retries carry a fresh timestamp).
// Returns both the legacy body-only sig and the spec §12 timestamped Koda-Signature.
function signHeaders(secret, body, dlvId) {
  const ts = Math.floor(Date.now() / 1000);
  return {
    'x-koda-signature': hmac(secret, body),                       // legacy, backward-compatible
    'koda-signature': `t=${ts},v1=${hmac(secret, ts + '.' + body)}`, // §12 replay-protected
    'koda-event-id': dlvId,
  };
}

function attempt(dlvId, url, body, secret, n) {
  const finish = (status, err, ms, code) => {
    q.run(`UPDATE webhook_deliveries SET status=?, attempts=?, last_error=?, duration_ms=?, response_status=?,
           delivered_at=CASE WHEN ?='sent' THEN datetime('now') ELSE delivered_at END WHERE id=?`,
      status, n, err || null, ms == null ? null : Math.round(ms), code == null ? null : code, status, dlvId);
  };
  // localhost/sandbox endpoints marked sent without network; real URLs get fetch + retry
  let host = ''; try { host = new URL(url).hostname; } catch { return finish('failed', 'invalid_url'); }
  if (isSandboxHost(host)) {
    return finish('sent', null, 0, 200);   // sandbox endpoints: marked sent, never fetched
  }
  // SSRF guard: refuse to deliver to any host that resolves to an internal address.
  // Re-checked on every attempt so a rebind can't slip a later retry through.
  resolvesToPublic(host).then((okPublic) => {
    if (!okPublic) return finish('failed', 'blocked_internal_host', 0, null);
    deliver();
  }).catch(() => finish('failed', 'blocked_internal_host', 0, null));

  function deliver() {
  const t0 = Date.now();
  fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...signHeaders(secret, body, dlvId) },
    body, signal: AbortSignal.timeout(8000),
  }).then(r => {
    const ms = Date.now() - t0;
    if (r.ok) return finish('sent', null, ms, r.status);
    // record the response time + status even on an error response, then retry/dead-letter
    q.run(`UPDATE webhook_deliveries SET duration_ms=?, response_status=? WHERE id=?`, Math.round(ms), r.status, dlvId);
    throw new Error(`http_${r.status}`);
  }).catch(e => {
    const ms = Date.now() - t0;
    if (n >= MAX_ATTEMPTS) return finish('dead', String(e.message || e), ms, null);
    q.run(`UPDATE webhook_deliveries SET status='pending', attempts=?, last_error=?, duration_ms=? WHERE id=?`,
      n, String(e.message || e), Math.round(ms), dlvId);
    setTimeout(() => attempt(dlvId, url, body, secret, n + 1),
      Math.min(60000, 1000 * 2 ** n)).unref?.();
  });
  } // deliver()
}

// Manually re-send a single delivery (from the dashboard "Retry" button). Reuses
// the stored, already-signed body — the endpoint secret is unchanged — and starts
// a fresh attempt cycle against the endpoint's CURRENT url.
function redeliver(dlvId) {
  const d = q.get('SELECT * FROM webhook_deliveries WHERE id=?', dlvId);
  if (!d) return { ok: false, error: 'delivery_not_found' };
  const ep = q.get('SELECT * FROM webhook_endpoints WHERE id=?', d.endpoint_id);
  if (!ep) return { ok: false, error: 'endpoint_gone' };
  q.run(`UPDATE webhook_deliveries SET status='pending', last_error=NULL WHERE id=?`, dlvId);
  attempt(dlvId, ep.url, d.payload, ep.secret, 1);
  return { ok: true, delivery_id: dlvId, endpoint_id: ep.id, url: ep.url };
}

module.exports = { dispatch, redeliver, signHeaders, validWebhookUrl, ipBlocked };
