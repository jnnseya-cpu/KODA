// KODA — load / soak harness (launch Gate 6 / Phase 13). Drives sustained concurrent
// traffic at the PUBLIC hot paths (rate-limited authed paths are excluded by design —
// their 429 is a feature, tested elsewhere) and reports p50/p95/p99, throughput and
// error rate. Reads the server process RSS before/after (same host) to catch gross
// memory leaks under load. Configure: KODA_BASE, LOAD_CONCURRENCY, LOAD_TOTAL, LOAD_PID.
'use strict';
const fs = require('node:fs');
const B = process.env.KODA_BASE || 'http://localhost:4600';
const CONCURRENCY = Number(process.env.LOAD_CONCURRENCY || 50);
const TOTAL = Number(process.env.LOAD_TOTAL || 4000);
const PID = process.env.LOAD_PID ? Number(process.env.LOAD_PID) : null;
// targets (local, single process — production behind Caddy/replicas will differ)
const P95_TARGET_MS = Number(process.env.LOAD_P95_MS || 150);
const ERR_TARGET = Number(process.env.LOAD_ERR_PCT || 1);

const PATHS = ['/', '/healthz', '/v1/detect?msisdn=%2B243890000000', '/v1/operators'];
const rss = () => { try { const s = fs.readFileSync(`/proc/${PID}/status`, 'utf8').match(/VmRSS:\s+(\d+)/); return s ? Math.round(+s[1] / 1024) : null; } catch { return null; } };

(async () => {
  console.log(`\n═══ KODA LOAD/SOAK — ${TOTAL} reqs @ concurrency ${CONCURRENCY} → ${B} ═══\n`);
  // warm up
  for (const p of PATHS) { try { await fetch(B + p); } catch {} }
  const rssBefore = PID ? rss() : null;

  const lat = new Float64Array(TOTAL);
  let done = 0, errors = 0, next = 0;
  const t0 = performance.now();
  async function worker() {
    while (true) {
      const i = next++; if (i >= TOTAL) return;
      const p = PATHS[i % PATHS.length];
      const s = performance.now();
      try {
        const r = await fetch(B + p, { redirect: 'manual' });
        // drain body so the socket frees
        await r.text();
        if (r.status >= 400) errors++;
      } catch { errors++; lat[i] = performance.now() - s; done++; continue; }
      lat[i] = performance.now() - s; done++;
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const wall = (performance.now() - t0) / 1000;
  const rssAfter = PID ? rss() : null;

  const sorted = Array.from(lat).sort((a, b) => a - b);
  const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p / 100 * sorted.length))];
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  const throughput = TOTAL / wall;
  const errPct = (errors / TOTAL) * 100;

  console.log(`requests:    ${TOTAL} in ${wall.toFixed(2)}s`);
  console.log(`throughput:  ${throughput.toFixed(0)} req/s`);
  console.log(`latency ms:  mean ${mean.toFixed(1)} · p50 ${pct(50).toFixed(1)} · p95 ${pct(95).toFixed(1)} · p99 ${pct(99).toFixed(1)} · max ${sorted[sorted.length - 1].toFixed(1)}`);
  console.log(`errors:      ${errors} (${errPct.toFixed(2)}%)`);
  if (rssBefore != null) console.log(`server RSS:  ${rssBefore} MB → ${rssAfter} MB (Δ ${rssAfter - rssBefore} MB)`);

  let ok = true;
  const gate = (n, c, e) => { if (!c) ok = false; console.log(`${c ? '✓' : '✗'} ${n}${c ? '' : '  << ' + e}`); };
  console.log('');
  gate(`p95 < ${P95_TARGET_MS}ms`, pct(95) < P95_TARGET_MS, `p95=${pct(95).toFixed(1)}ms`);
  gate(`error rate < ${ERR_TARGET}%`, errPct < ERR_TARGET, `${errPct.toFixed(2)}%`);
  if (rssBefore != null) gate('no gross memory leak (Δ RSS < 60MB)', (rssAfter - rssBefore) < 60, `Δ${rssAfter - rssBefore}MB`);

  console.log(`\n${ok ? '✅ LOAD GATE PASSED' : '❌ LOAD GATE FAILED'}`);
  process.exit(ok ? 0 : 1);
})();
