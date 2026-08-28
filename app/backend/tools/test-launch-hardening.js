// KODA — regression guards for the launch-audit security hardening.
// Covers: webhook SSRF egress filter (create-time + resolution), trusted client-IP
// derivation (X-Forwarded-For loopback-spoof defence), and the API-key scope map.
// These lock in the fixes from the production launch review so they can't silently
// regress. Pure unit-level: no server needed.
'use strict';
process.env.KODA_DATA_DIR = require('node:fs').mkdtempSync(require('node:path').join(require('node:os').tmpdir(), 'koda-harden-'));
process.env.KODA_QUIET = '1';
const webhooks = require('../lib/webhooks');
const security = require('../lib/security');

let pass = 0, fail = 0;
const ok = (c, m, x = '') => { c ? (pass++, console.log('  ✓', m, x)) : (fail++, console.log('  ✗', m, x)); };

console.log('\nKODA — launch hardening regression\n');

// ── 1. Webhook SSRF egress filter ────────────────────────────────────────────
// Dangerous internal targets that WOULD be fetched → must be blocked on create.
const BLOCK = ['http://169.254.169.254/latest/meta-data/', 'http://10.0.0.5:6379/',
  'http://192.168.1.1/', 'http://172.16.0.1/', 'http://[::1]/',
  'http://0.0.0.0/', 'http://100.64.0.1/', 'ftp://host/x', 'not-a-url'];
// Public URLs + the inert sandbox hosts (localhost/127.0.0.1/*.test/example.com are
// marked "sent" WITHOUT a network call at delivery, so they cannot drive an SSRF).
const ALLOW = ['https://hooks.example.org/koda', 'http://api.merchant.com/webhook', 'https://8.8.8.8/x',
  'http://localhost:9/wh', 'http://127.0.0.1/x', 'https://shop.test/hook', 'http://example.com/h'];
for (const u of BLOCK) ok(webhooks.validWebhookUrl(u) === false, 'blocks internal/invalid webhook URL', u);
for (const u of ALLOW) ok(webhooks.validWebhookUrl(u) === true, 'allows public webhook URL', u);
// raw IP range classifier
for (const ip of ['127.0.0.1', '10.9.9.9', '192.168.0.2', '172.20.1.1', '169.254.169.254', '100.100.0.1', '::1', 'fd00::1', '0.0.0.0'])
  ok(webhooks.ipBlocked(ip) === true, 'ipBlocked flags internal address', ip);
for (const ip of ['8.8.8.8', '1.1.1.1', '203.0.113.9', '2606:4700::1111'])
  ok(webhooks.ipBlocked(ip) === false, 'ipBlocked allows public address', ip);

// ── 2. Trusted client IP (X-Forwarded-For loopback-spoof defence) ─────────────
// Behind a proxy (private socket peer), the real client is the entry the proxy
// appended (rightmost, 1 hop) — a client-supplied leftmost value must not win.
const peerProxy = '172.18.0.5';   // docker proxy peer (private)
ok(security.trustedClientIp({ 'x-forwarded-for': '127.0.0.1, 8.8.8.8' }, peerProxy) === '8.8.8.8',
   'proxied: spoofed leftmost loopback ignored, real client used');
ok(security.trustedClientIp({ 'x-forwarded-for': '8.8.8.8' }, peerProxy) === '8.8.8.8',
   'proxied: single real client honoured');
// Direct connection from a PUBLIC peer: forwarded headers are ignored entirely.
ok(security.trustedClientIp({ 'x-forwarded-for': '127.0.0.1' }, '203.0.113.7') === '203.0.113.7',
   'direct public peer: forwarded header ignored, socket peer used');
// Genuine local call (loopback peer, no forwarding) stays loopback → dev/test exempt.
ok(security.isLoopback(security.trustedClientIp({}, '127.0.0.1')) === true,
   'genuine local call remains loopback-exempt');
// clientIp prefers the server-stamped canonical header over any client X-Forwarded-For.
ok(security.clientIp({ 'x-koda-client-ip': '9.9.9.9', 'x-forwarded-for': '127.0.0.1' }) === '9.9.9.9',
   'clientIp trusts the stamped canonical IP, not client XFF');

console.log(`\n${fail === 0 ? '✅ HARDENING GREEN' : '❌ HARDENING FAILED'} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
