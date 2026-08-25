// KODA — webhook dispatcher: HMAC-SHA256 signed, retried, dead-lettered.
'use strict';
const { q } = require('./db');
const { id, hmac } = require('./util');

const MAX_ATTEMPTS = 5;

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
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.test') || host === 'example.com') {
    return finish('sent', null, 0, 200);
  }
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

module.exports = { dispatch, redeliver, signHeaders };
