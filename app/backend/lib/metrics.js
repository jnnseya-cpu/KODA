// KODA — in-process metrics (observability, launch Gate 8). Zero-dep counters that
// server.js and the engine bump on the hot path, exposed as JSON at /metrics for an
// external uptime/APM probe. Cheap: plain integer increments, no allocation.
'use strict';

const START = Date.now();
const c = {
  requests: 0, errors_4xx: 0, errors_5xx: 0,
  verifications: 0, verifications_auto: 0, rejects: 0, quarantines: 0,
  intents_created: 0, alerts_fired: 0,
  by_status: {}, // { '200': n, '404': n, ... }
};

function inc(name, n = 1) { if (name in c && typeof c[name] === 'number') c[name] += n; }
function status(code) {
  c.requests++;
  c.by_status[code] = (c.by_status[code] || 0) + 1;
  if (code >= 500) c.errors_5xx++;
  else if (code >= 400) c.errors_4xx++;
}

function snapshot() {
  const mem = process.memoryUsage();
  const uptimeS = Math.round((Date.now() - START) / 1000);
  const total = c.requests || 1;
  return {
    uptime_seconds: uptimeS,
    started_at: new Date(START).toISOString(),
    requests: c.requests,
    error_rate_5xx: +(c.errors_5xx / total).toFixed(5),
    error_rate_4xx: +(c.errors_4xx / total).toFixed(5),
    errors_5xx: c.errors_5xx,
    errors_4xx: c.errors_4xx,
    verifications: c.verifications,
    verifications_auto: c.verifications_auto,
    rejects: c.rejects,
    quarantines: c.quarantines,
    intents_created: c.intents_created,
    alerts_fired: c.alerts_fired,
    by_status: c.by_status,
    memory_mb: { rss: Math.round(mem.rss / 1048576), heap_used: Math.round(mem.heapUsed / 1048576) },
    node: process.version,
  };
}

module.exports = { inc, status, snapshot };
