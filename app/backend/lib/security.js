// KODA — SecurityAgent: built-in, zero-dependency human-verification + anti-abuse.
//
// Three layers, all additive and off nothing that already works:
//  1. Human gate on signup/login — honeypot + a signed proof-of-work challenge.
//     Every human sign-in costs a few thousand hashes (imperceptible to a person,
//     expensive at bot scale). Stateless: the challenge is HMAC-signed, no DB.
//  2. Abuse monitor — records suspicious events (pow fails, honeypot hits, bad
//     logins, injection-looking input, scanning) and AUTO-BLOCKS an IP that trips
//     the threshold, for a cooldown window.
//  3. isBlocked() gate at the edge so a flagged source is turned away early.
//
// Loopback / same-host is always trusted (tests, health probes, the VPS itself),
// and the whole human gate is a no-op when KODA_HUMAN_CHECK=0 (used by the test
// suite) — so production is protected by default while the gates stay testable.
'use strict';
const crypto = require('node:crypto');
const { q } = require('./db');
const U = require('./util');

const SECRET = process.env.KODA_JWT_SECRET || 'koda-dev-secret';
const ENFORCE = process.env.KODA_HUMAN_CHECK !== '0';        // human gate on by default
const DIFFICULTY = Math.max(1, Math.min(5, Number(process.env.KODA_POW_BITS) || 3)); // leading hex zeros
const CHALLENGE_TTL = 10 * 60 * 1000;
const BLOCK_THRESHOLD = Number(process.env.KODA_BLOCK_THRESHOLD) || 18; // events / 10 min → block
const BLOCK_MINUTES = Number(process.env.KODA_BLOCK_MINUTES) || 60;

function clientIp(headers = {}) {
  const xf = headers['x-forwarded-for'];
  if (xf) return String(xf).split(',')[0].trim();
  return headers['x-real-ip'] || '';
}
function isLoopback(ip) {
  ip = String(ip || '');
  return ip === '' || ip === 'ip' || ip === '::1' || ip === 'localhost'
    || ip === '127.0.0.1' || ip.startsWith('127.') || ip.startsWith('::ffff:127.');
}

// ── proof-of-work challenge (stateless, signed) ──────────────────────────────
function issueChallenge() {
  const challenge = U.token(12), ts = Date.now();
  const sig = U.hmac(SECRET, `pow:${challenge}.${ts}.${DIFFICULTY}`).slice(0, 32);
  return { challenge, ts, difficulty: DIFFICULTY, sig,
    algo: 'sha256', note: `find a nonce where sha256(challenge + ":" + nonce) starts with ${DIFFICULTY} hex zeros` };
}
function verifyChallenge(c, solution) {
  try {
    if (!c || !c.challenge || !c.ts || !c.sig || solution == null) return false;
    const diff = Math.max(1, Math.min(5, Number(c.difficulty) || DIFFICULTY));
    const expect = U.hmac(SECRET, `pow:${c.challenge}.${c.ts}.${diff}`).slice(0, 32);
    const a = Buffer.from(String(c.sig)), b = Buffer.from(expect);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;   // genuine, unforged challenge?
    if (Date.now() - Number(c.ts) > CHALLENGE_TTL) return false;                // fresh?
    return U.sha256(`${c.challenge}:${solution}`).startsWith('0'.repeat(diff)); // work actually done?
  } catch { return false; }
}

function honeypotTripped(body) { return String((body || {}).hp_field || '').trim() !== ''; }

// ── the human gate used by signup / login ────────────────────────────────────
function humanCheck(body, ip) {
  if (!ENFORCE) return { ok: true, skipped: true };
  if (isLoopback(ip)) return { ok: true, loopback: true };
  if (honeypotTripped(body)) { record('honeypot', ip, {}); return [400, { error: { code: 'bot_detected' } }]; }
  if (!verifyChallenge((body || {}).challenge, (body || {}).pow)) {
    record('pow_fail', ip, {});
    return [400, { error: { code: 'human_check_failed', message: 'Complete the human-verification challenge and try again.' } }];
  }
  return { ok: true };
}

// ── abuse monitor + auto-block ───────────────────────────────────────────────
const INJECTION = /(\bunion\s+select\b|<script\b|javascript:|onerror\s*=|\bor\s+1\s*=\s*1\b|\$\{jndi:|\.\.\/\.\.\/|;\s*rm\s+-rf|\bexec\s*\(|\bdrop\s+table\b)/i;
function scanInput(obj) {
  try { return INJECTION.test(JSON.stringify(obj || {})); } catch { return false; }
}
function record(kind, ip, detail) {
  try {
    q.run(`INSERT INTO security_events (id,kind,ip,detail) VALUES (?,?,?,?)`,
      U.id('sec'), String(kind).slice(0, 40), String(ip || '').slice(0, 60), JSON.stringify(detail || {}).slice(0, 500));
  } catch { /* never break the request path */ }
  if (!isLoopback(ip) && ['pow_fail', 'honeypot', 'injection', 'bad_login', 'scan', 'signup_abuse'].includes(kind)) {
    try {
      const n = q.get(`SELECT COUNT(*) c FROM security_events WHERE ip=? AND created_at > datetime('now','-10 minutes')`, String(ip)).c;
      if (n >= BLOCK_THRESHOLD) block(ip, kind);
    } catch { /* ignore */ }
  }
}
function block(ip, reason) {
  if (isLoopback(ip)) return;
  try {
    q.run(`INSERT OR REPLACE INTO blocked_ips (ip,reason,until) VALUES (?,?,datetime('now','+${BLOCK_MINUTES} minutes'))`,
      String(ip), String(reason).slice(0, 40));
    try { require('./alerts').alert('critical', 'SecurityAgent auto-blocked an IP', { ip, reason }); } catch {}
  } catch { /* ignore */ }
}
function isBlocked(ip) {
  if (isLoopback(ip)) return false;
  try {
    const r = q.get(`SELECT until FROM blocked_ips WHERE ip=?`, String(ip));
    if (!r) return false;
    if (new Date(r.until.replace(' ', 'T') + 'Z').getTime() < Date.now()) { q.run(`DELETE FROM blocked_ips WHERE ip=?`, String(ip)); return false; }
    return true;
  } catch { return false; }
}

// ── SecurityAgent summary (for the admin console) ────────────────────────────
function summary() {
  const since = `datetime('now','-24 hours')`;
  return {
    enforcing_human_check: ENFORCE,
    pow_difficulty: DIFFICULTY,
    events_24h: q.get(`SELECT COUNT(*) c FROM security_events WHERE created_at > ${since}`).c,
    by_kind: q.all(`SELECT kind, COUNT(*) c FROM security_events WHERE created_at > ${since} GROUP BY kind ORDER BY c DESC`),
    blocked_ips: q.all(`SELECT ip, reason, until FROM blocked_ips ORDER BY until DESC LIMIT 50`),
    recent: q.all(`SELECT kind, ip, detail, created_at FROM security_events ORDER BY created_at DESC LIMIT 40`),
  };
}

module.exports = { issueChallenge, verifyChallenge, humanCheck, honeypotTripped,
  scanInput, record, block, isBlocked, clientIp, isLoopback, summary, ENFORCE, DIFFICULTY };
