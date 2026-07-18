// KODA — webhook dispatcher: HMAC-SHA256 signed, retried, dead-lettered.
'use strict';
const { q } = require('./db');
const { id, hmac } = require('./util');

const MAX_ATTEMPTS = 5;

function dispatch(merchantId, event, payload) {
  const endpoints = q.all(
    `SELECT * FROM webhook_endpoints WHERE merchant_id=? AND active=1`, merchantId);
  for (const ep of endpoints) {
    const events = JSON.parse(ep.events || '["*"]');
    if (!events.includes('*') && !events.includes(event)) continue;
    const body = JSON.stringify({ event, ...payload, created_at: new Date().toISOString() });
    const signature = hmac(ep.secret, body);
    const dlv = id('whd');
    q.run(`INSERT INTO webhook_deliveries (id,endpoint_id,merchant_id,event,payload,signature,status)
           VALUES (?,?,?,?,?,?, 'pending')`, dlv, ep.id, merchantId, event, body, signature);
    attempt(dlv, ep.url, body, signature, 1);
  }
}

function attempt(dlvId, url, body, signature, n) {
  const finish = (status, err) => {
    q.run(`UPDATE webhook_deliveries SET status=?, attempts=?, last_error=?,
           delivered_at=CASE WHEN ?='sent' THEN datetime('now') ELSE delivered_at END WHERE id=?`,
      status, n, err || null, status, dlvId);
  };
  // localhost/sandbox endpoints marked sent without network; real URLs get fetch + retry
  let host = ''; try { host = new URL(url).hostname; } catch { return finish('failed', 'invalid_url'); }
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.test') || host === 'example.com') {
    return finish('sent', null);
  }
  fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-koda-signature': signature },
    body, signal: AbortSignal.timeout(8000),
  }).then(r => {
    if (r.ok) return finish('sent');
    throw new Error(`http_${r.status}`);
  }).catch(e => {
    if (n >= MAX_ATTEMPTS) return finish('dead', String(e.message || e));
    q.run(`UPDATE webhook_deliveries SET status='pending', attempts=?, last_error=? WHERE id=?`,
      n, String(e.message || e), dlvId);
    setTimeout(() => attempt(dlvId, url, body, signature, n + 1),
      Math.min(60000, 1000 * 2 ** n)).unref?.();
  });
}

module.exports = { dispatch };
