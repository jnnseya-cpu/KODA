// KODA — HTTP suite orchestrator. Boots ONE isolated server (own port + fresh
// DB), runs every external-server test suite against it, tears down. Makes the
// full gate reliable and CI-able regardless of any ambient server.
'use strict';
const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path'); const fs = require('node:fs'); const os = require('node:os');

const PORT = 4771;
const BASE = `http://localhost:${PORT}`;
const SUITES = ['test-adversarial', 'test-checkout', 'test-doors', 'test-ai-gating', 'test-growth', 'test-busy-merchant'];

(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'koda-http-'));
  const srv = spawn(process.execPath, ['--no-warnings', path.join(__dirname, '..', 'server.js')],
    { env: { ...process.env, PORT, KODA_DATA_DIR: dataDir, KODA_QUIET: '1', KODA_ALLOW_DEV_SECRET: '1' }, stdio: 'ignore' });
  let up = false;
  for (let i = 0; i < 60; i++) { try { await fetch(BASE + '/healthz'); up = true; break; } catch { await new Promise(r => setTimeout(r, 250)); } }
  if (!up) { console.error('server did not boot'); srv.kill('SIGKILL'); process.exit(1); }

  let failed = 0;
  for (const s of SUITES) {
    const res = spawnSync(process.execPath, ['--no-warnings', path.join(__dirname, s + '.js')],
      { env: { ...process.env, KODA_BASE: BASE }, encoding: 'utf8' });
    const out = (res.stdout || '') + (res.stderr || '');
    const line = (out.match(/\d+ passed, \d+ failed/g) || []).pop()
      || (out.match(/\{"verified":\d+\}/g) || []).pop() || '(no summary)';
    const okRun = res.status === 0;
    if (!okRun) failed++;
    console.log(`  ${okRun ? '✓' : '✗'} ${s.padEnd(20)} ${line}`);
    if (!okRun) console.log(out.split('\n').filter(l => /✗|Error|CRASH/.test(l)).slice(0, 5).map(l => '      ' + l).join('\n'));
  }
  srv.kill('SIGKILL');
  console.log(failed ? `\n${failed} suite(s) failed\n` : `\nall HTTP suites passed\n`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('ORCHESTRATOR CRASH', e); process.exit(1); });
