// KODA — real dispatch adapters for email / SMS / push. Zero-dependency:
// SMTP over implicit TLS (node:tls) for a self-hosted mailserver, plus HTTP
// providers (Brevo / SMS gateway / FCM) via fetch. Every send is gated:
//   • only when the channel is configured (keys/host present), and
//   • only when live sending is allowed (production, or KODA_COMMS_LIVE=1) —
//     otherwise it's a no-op so tests/staging never message real people.
'use strict';
const tls = require('node:tls');

// live-send gate — outside production, require an explicit opt-in.
function liveAllowed() {
  if (process.env.KODA_COMMS_DRYRUN === '1') return false;
  return process.env.NODE_ENV === 'production' || process.env.KODA_COMMS_LIVE === '1';
}

// ── SMTP reply parsing (the testable core) ───────────────────────────────────
// SMTP multiline: "250-first\r\n250-second\r\n250 last\r\n". A reply is complete
// when a line is "<code><space>...". Returns {complete, code, rest} or {complete:false}.
function parseReply(buffer) {
  const lines = buffer.split('\r\n');
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\d{3})([ -])/.exec(lines[i]);
    if (m && m[2] === ' ') {
      return { complete: true, code: Number(m[1]), rest: lines.slice(i + 1).join('\r\n') };
    }
  }
  return { complete: false };
}

const b64 = (s) => Buffer.from(String(s)).toString('base64');
const addr = (s) => { const m = /<([^>]+)>/.exec(s) || /([^\s<>]+@[^\s<>]+)/.exec(s); return m ? m[1] : s; };

// Minimal implicit-TLS SMTP client (port 465). AUTH LOGIN. Sequential state machine.
function smtpSend({ host, port = 465, user, pass, from, to, subject, html }) {
  return new Promise((resolve, reject) => {
    const sock = tls.connect({ host, port, servername: host });
    let done = false, buf = '', stage = 'greet';
    const fail = (e) => { if (!done) { done = true; try { sock.destroy(); } catch {} reject(e instanceof Error ? e : new Error(String(e))); } };
    const ok = () => { if (!done) { done = true; try { sock.end(); } catch {} resolve({ ok: true, provider: 'smtp' }); } };
    const W = (s) => sock.write(s + '\r\n');
    const body = [
      `From: ${from}`, `To: ${to}`, `Subject: ${subject}`, 'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8', '', html,
    ].join('\r\n').replace(/\r\n\./g, '\r\n..'); // dot-stuffing

    sock.setEncoding('utf8');
    sock.setTimeout(20000, () => fail(new Error('smtp_timeout')));
    sock.on('error', fail);
    sock.on('data', (chunk) => {
      buf += chunk;
      let r;
      while ((r = parseReply(buf)).complete) {
        buf = r.rest; const c = r.code;
        try {
          if (stage === 'greet') { if (c !== 220) return fail(new Error('greet ' + c)); stage = 'ehlo'; W('EHLO koda'); }
          else if (stage === 'ehlo') { if (c !== 250) return fail(new Error('ehlo ' + c)); stage = 'authU'; W('AUTH LOGIN'); }
          else if (stage === 'authU') { if (c !== 334) return fail(new Error('auth ' + c)); stage = 'authP'; W(b64(user)); }
          else if (stage === 'authP') { if (c !== 334) return fail(new Error('authuser ' + c)); stage = 'authOk'; W(b64(pass)); }
          else if (stage === 'authOk') { if (c !== 235) return fail(new Error('authfail ' + c)); stage = 'from'; W(`MAIL FROM:<${addr(from)}>`); }
          else if (stage === 'from') { if (c !== 250) return fail(new Error('from ' + c)); stage = 'rcpt'; W(`RCPT TO:<${addr(to)}>`); }
          else if (stage === 'rcpt') { if (c !== 250 && c !== 251) return fail(new Error('rcpt ' + c)); stage = 'data'; W('DATA'); }
          else if (stage === 'data') { if (c !== 354) return fail(new Error('data ' + c)); stage = 'body'; W(body + '\r\n.'); }
          else if (stage === 'body') { if (c !== 250) return fail(new Error('body ' + c)); stage = 'quit'; W('QUIT'); ok(); }
        } catch (e) { fail(e); }
      }
    });
  });
}

// ── channel senders (return {ok, provider} or throw) ─────────────────────────
async function sendEmail(to, subject, html) {
  if (!to) return { ok: false, skipped: 'no_recipient' };
  if (!liveAllowed()) return { ok: false, skipped: 'dry_run' };
  if (process.env.KODA_SMTP_HOST) {
    return smtpSend({
      host: process.env.KODA_SMTP_HOST, port: Number(process.env.KODA_SMTP_PORT) || 465,
      user: process.env.KODA_SMTP_USER, pass: process.env.KODA_SMTP_PASS,
      from: process.env.KODA_SMTP_FROM || 'KODA <no-reply@kodajnn.com>', to, subject, html,
    });
  }
  if (process.env.BREVO_API_KEY) {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST', headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ sender: { email: process.env.KODA_EMAIL_FROM || 'no-reply@kodajnn.com', name: 'KODA' }, to: [{ email: to }], subject, htmlContent: html }),
    });
    if (!r.ok) throw new Error('brevo ' + r.status);
    return { ok: true, provider: 'brevo' };
  }
  return { ok: false, skipped: 'no_transport' };
}

async function sendSms(to, text) {
  if (!to) return { ok: false, skipped: 'no_recipient' };
  if (!liveAllowed()) return { ok: false, skipped: 'dry_run' };
  if (!process.env.KODA_SMS_URL) return { ok: false, skipped: 'no_transport' };
  const r = await fetch(process.env.KODA_SMS_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(process.env.KODA_SMS_KEY ? { authorization: 'Bearer ' + process.env.KODA_SMS_KEY } : {}) },
    body: JSON.stringify({ to: String(to).replace(/[^\d+]/g, ''), text }),
  });
  if (!r.ok) throw new Error('sms ' + r.status);
  return { ok: true, provider: 'gateway' };
}

async function sendPush(token, title, body) {
  if (!token) return { ok: false, skipped: 'no_recipient' };
  if (!liveAllowed()) return { ok: false, skipped: 'dry_run' };
  if (!process.env.FCM_KEY) return { ok: false, skipped: 'no_transport' };
  const r = await fetch('https://fcm.googleapis.com/fcm/send', {
    method: 'POST', headers: { authorization: 'key=' + process.env.FCM_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ to: token, notification: { title, body } }),
  });
  if (!r.ok) throw new Error('fcm ' + r.status);
  return { ok: true, provider: 'fcm' };
}

module.exports = { sendEmail, sendSms, sendPush, parseReply, liveAllowed };
