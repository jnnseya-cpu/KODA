// KODA — real browser smoke test (launch Phase 3/14). Drives the pre-installed
// Chromium via the Chrome DevTools Protocol (Node's built-in WebSocket, zero npm
// deps). For each critical page it opens a tab, captures uncaught exceptions +
// console errors, and takes a SCREENSHOT — asserting the page actually PAINTED
// substantial content (a blank/black-screen regression compresses to a tiny PNG; a
// rendered page does not). Directly catches "SPA boots to a black screen" bugs.
// Connects to each PAGE's own debug socket (screenshots via a flatten sessionId
// return empty in headless). Point KODA_BASE at a running server; set CHROME.
'use strict';
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const B = process.env.KODA_BASE || 'http://localhost:4600';
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = Number(process.env.CDP_PORT || 9351);
const MIN_PAINT_BYTES = 8000; // a blank page PNG is < ~3KB; a rendered page is much larger
let pass = 0, fail = 0; const fails = [];
const T = (n, c, e) => { c ? pass++ : (fail++, fails.push(n + (e ? ' — ' + e : ''))); console.log(`${c ? '✓' : '✗'} ${n}${c ? '' : '  << ' + (e ?? '')}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// connect to a single page target's own websocket
function pageClient(wsUrl) {
  const ws = new WebSocket(wsUrl); let id = 0; const waiting = new Map(); const evs = [];
  const ready = new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); } else if (m.method) evs.push(m); };
  const send = (method, params) => ready.then(() => new Promise(r => { const i = ++id; waiting.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); }));
  return { send, evs, ready, close: () => ws.close() };
}

async function main() {
  const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'koda-chrome-'));
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1200,900', `--remote-debugging-port=${PORT}`, `--user-data-dir=${udd}`, 'about:blank'], { stdio: 'ignore' });
  for (let i = 0; i < 25; i++) { try { await (await fetch(`http://localhost:${PORT}/json/version`)).json(); break; } catch { await sleep(300); } }

  async function check(name, url, { minBytes = MIN_PAINT_BYTES } = {}) {
    // open a fresh tab at the url, then connect to ITS own ws
    const t = await (await fetch(`http://localhost:${PORT}/json/new?${url}`, { method: 'PUT' })).json();
    const c = pageClient(t.webSocketDebuggerUrl);
    await c.ready;
    await c.send('Runtime.enable');
    await c.send('Page.enable');
    await sleep(2200);
    const shot = await c.send('Page.captureScreenshot', { format: 'png' });
    const bytes = shot.result?.data ? Buffer.from(shot.result.data, 'base64').length : 0;
    const errs = c.evs.filter(m => m.method === 'Runtime.exceptionThrown' || (m.method === 'Runtime.consoleAPICalled' && m.params?.type === 'error'))
      .map(m => m.params?.exceptionDetails?.exception?.description || m.params?.exceptionDetails?.text || (m.params?.args || []).map(a => a.value).join(' '));
    T(`${name}: painted content (not blank)`, bytes >= minBytes, `${bytes} bytes`);
    T(`${name}: no uncaught exceptions / console errors`, errs.length === 0, errs.slice(0, 2).join(' | '));
    c.close();
    await fetch(`http://localhost:${PORT}/json/close/${t.id}`).catch(() => {});
    return { bytes, errs };
  }

  console.log(`— real-browser render + error checks @ ${B}\n`);
  await check('landing (/)', B + '/');
  await check('how-it-works', B + '/how-it-works');
  await check('coverage', B + '/coverage');
  await check('demo (/demo)', B + '/demo');
  await check('app SPA (/app login)', B + '/app');           // black-screen regression guard
  await check('checkout (/pay/x)', B + '/pay/demo', { minBytes: 4000 });

  chrome.kill();
  console.log(`\n${fail === 0 ? '✅ BROWSER SMOKE PASSED' : '❌ BROWSER SMOKE FAILED'} — ${pass} passed, ${fail} failed`);
  if (fail) fails.forEach(f => console.log('  · ' + f));
  process.exit(fail === 0 ? 0 : 1);
}
main().catch(e => { console.error('BROWSER TEST CRASHED:', e); process.exit(2); });
