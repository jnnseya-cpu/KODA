// KODA — operational alerting. When something breaks, page a human. Zero-dep:
// POSTs a compact JSON message to KODA_ALERT_WEBHOOK (Slack/Discord/generic
// incoming webhook). Deduped within a window so one failure storm ≠ 500 pages.
// Never throws into the caller; alerting must not break the thing it watches.
'use strict';

const WINDOW_MS = 5 * 60 * 1000;   // suppress identical alerts for 5 min
const _seen = new Map();

function post(payload) {
  const url = process.env.KODA_ALERT_WEBHOOK;
  if (!url) return Promise.resolve({ ok: false, skipped: 'no_webhook' });
  // Slack/Discord both accept { text }; include structured fields too.
  const body = JSON.stringify({ text: payload.text, ...payload });
  return fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body })
    .then(() => ({ ok: true })).catch(() => ({ ok: false }));
}

/**
 * alert(severity, title, detail?) — severity: 'critical' | 'error' | 'warn'.
 * Deduped by severity+title. Returns a promise (fire-and-forget at call sites).
 */
function alert(severity, title, detail) {
  try {
    const key = severity + ':' + title;
    const now = Date.now();
    const last = _seen.get(key) || 0;
    if (now - last < WINDOW_MS) return Promise.resolve({ ok: true, deduped: true });
    _seen.set(key, now);
    try { require('./metrics').inc('alerts_fired'); } catch { /* metrics optional */ }
    if (_seen.size > 500) for (const [k, t] of _seen) if (now - t > WINDOW_MS) _seen.delete(k);
    const emoji = severity === 'critical' ? '🔴' : severity === 'error' ? '🟠' : '🟡';
    const text = `${emoji} KODA ${severity.toUpperCase()}: ${title}` + (detail ? ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : '');
    return post({ text, severity, title, detail: detail || null, at: new Date().toISOString() });
  } catch { return Promise.resolve({ ok: false }); }
}

// Ledger integrity self-check — the money invariant must always hold. Alerts on drift.
function checkLedger() {
  try {
    const r = require('./billing').reconcile();
    if (!r.balanced) alert('critical', 'billing ledger imbalance', { sum: r.sum });
    return r;
  } catch (e) { return { balanced: null, error: String(e && e.message || e) }; }
}

// Consumption (verifications, AI) debits merchants.acu_balance but is NOT posted to the
// double-entry ledger, so reconcile() alone can't see burned/negative ACU. This surfaces
// the real outstanding exposure: total ACU delivered on grace/credit that was never paid
// for. A large or growing total is the early warning of a metering leak or grace abuse.
function checkOutstandingGrace() {
  try {
    const { q } = require('./db');
    const row = q.get(`SELECT COALESCE(SUM(-acu_balance),0) owed, COUNT(*) n FROM merchants WHERE acu_balance < 0`);
    const owedAcu = Number(row.owed || 0);
    const capAcu = Number(process.env.KODA_GRACE_ALERT_ACU || 5000); // ~$130 retail of unpaid service
    if (owedAcu > capAcu) alert('warn', 'ACU grace exposure high', { outstanding_acu: owedAcu, merchants: row.n, threshold: capAcu });
    return { owedAcu, merchants: row.n };
  } catch (e) { return { owedAcu: null, error: String(e && e.message || e) }; }
}

// Start periodic self-monitoring (ledger reconcile + grace exposure). Called once at boot.
function startSelfMonitor(intervalMs = 10 * 60 * 1000) {
  const tick = () => { checkLedger(); checkOutstandingGrace(); };
  const t = setInterval(tick, intervalMs);
  if (t.unref) t.unref();   // don't keep the process alive for the timer
  return t;
}

module.exports = { alert, checkLedger, checkOutstandingGrace, startSelfMonitor };
