// KODA — weekly product newsletter.
// Builds a feature-selling HTML email (many deep links into the site + blog) and
// sends it to every active registered user who hasn't unsubscribed. Runs itself
// weekly via a boot check + timer (like fx_live), and is also triggerable/previewable
// by a staff-admin. Marketing mail, so: a one-click unsubscribe is always present and
// the send respects both the email and the newsletter opt-out.
'use strict';
const { q } = require('../lib/db');
const U = require('../lib/util');
const senders = require('./senders');

const SITE = 'https://kodajnn.com';
const SECRET = process.env.KODA_JWT_SECRET || 'koda-dev-secret-change-in-production';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const SETTING = 'newsletter_last';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const link = (href, text) => `<a href="${esc(href)}" style="color:#0C231C;font-weight:bold;text-decoration:underline">${esc(text)}</a>`;

// The features/functions we sell, each a deep link. Order rotates weekly so the
// "spotlight" and section ordering differ every send.
const FEATURES = [
  { url: `${SITE}/how-it-works`, name: 'Automatic verification', pitch: 'KODA reads the operator confirmation SMS itself and verifies each payment in seconds — no screenshots, no manual checking, no false "paid".' },
  { url: `${SITE}/coverage`, name: '95 countries, 235 operators', pitch: 'One account verifies Orange Money, M-Pesa, Airtel, MTN, Wave and 230+ more across Africa and beyond — add a number in any country from one dashboard.' },
  { url: `${SITE}/sentinel`, name: 'Sentinel phone-edge app', pitch: 'Turn any Android phone into a verification endpoint — it reads only payment SMS and confirms every sale automatically, even offline-first tills.' },
  { url: `${SITE}/developers`, name: 'Developer API & webhooks', pitch: 'Drop-in checkout, signed webhooks, idempotency keys and a REST API — verify payments from your store, bot or app in a few lines.' },
  { url: `${SITE}/industries`, name: 'Built for your business', pitch: 'Restaurants fire the kitchen only on confirmed orders; shops, schools and marketplaces unlock on verified payment — see your playbook.' },
  { url: `${SITE}/growth`, name: 'Earn with referrals', pitch: 'Invite other merchants and earn — the Growth Partner Programme turns every happy merchant into a paid channel.' },
  { url: `${SITE}/pricing`, name: 'Plans that scale with you', pitch: 'Start free, pay only as you grow. Paid plans activate the moment KODA confirms your mobile-money payment.' },
  { url: `${SITE}/status`, name: 'Live operator health', pitch: 'Per-operator parse rates and API uptime, in the open — you always know the platform is on.' },
];

// public URLs for compose helpers (also used by the admin preview)
function unsubToken(userId) { return U.hmac(SECRET, 'nl:' + userId).slice(0, 32); }
function unsubUrl(userId) { return `${SITE}/unsubscribe?u=${encodeURIComponent(userId)}&t=${unsubToken(userId)}`; }
function verifyUnsub(userId, token) { return !!userId && !!token && token === unsubToken(userId); }

// active users who still want the newsletter (respects email + newsletter opt-outs)
function recipients() {
  return q.all(`
    SELECT u.id, u.email, u.name
    FROM users u
    WHERE u.status='active' AND u.email IS NOT NULL AND u.email <> ''
      AND u.id NOT IN (SELECT user_id FROM comm_prefs WHERE channel IN ('email','newsletter') AND enabled=0)
    ORDER BY u.created_at`);
}

function weekIndex(nowMs) { return Math.floor(nowMs / WEEK_MS); }

// Build the newsletter for a given week. `user` (optional) personalises the greeting
// and the unsubscribe link; without it a generic preview is produced.
function build(nowMs, user) {
  const wk = weekIndex(nowMs);
  const spotlight = FEATURES[wk % FEATURES.length];
  const rest = FEATURES.filter(f => f !== spotlight);
  // rotate the ordering of the rest so the list looks fresh weekly
  const rot = wk % (rest.length || 1);
  const ordered = rest.slice(rot).concat(rest.slice(0, rot));

  let posts = [];
  try {
    const seo = require('../lib/seo');
    const all = (seo.allPosts && seo.allPosts()) || [];
    // rotate 3 blog links weekly
    const start = all.length ? (wk * 3) % all.length : 0;
    posts = [0, 1, 2].map(i => all[(start + i) % (all.length || 1)]).filter(Boolean);
  } catch { /* blog optional */ }

  const greet = user && user.name ? `Hi ${esc(String(user.name).split(' ')[0])},` : 'Hi there,';
  const unsub = user ? unsubUrl(user.id) : `${SITE}/app#comms`;
  const subject = `KODA weekly: ${spotlight.name} — and more ways to get paid with proof`;

  const featureRow = (f) => `
    <tr><td style="padding:12px 0;border-top:1px solid #E3DCC7">
      <div style="font-size:15px;font-weight:bold;color:#241F14">${link(f.url, f.name)}</div>
      <div style="font-size:13.5px;color:#5C564A;line-height:1.55;margin-top:3px">${esc(f.pitch)} ${link(f.url, 'Learn more →')}</div>
    </td></tr>`;

  const blogRows = posts.length ? `
    <tr><td style="padding:18px 0 6px">
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8A8168;font-family:'Courier New',monospace"><b>Fresh from the blog</b></div>
    </td></tr>
    ${posts.map(p => `<tr><td style="padding:6px 0">
      <div style="font-size:14px">${link(`${SITE}/blog/${p.slug}`, p.title)}</div>
      <div style="font-size:12.5px;color:#5C564A;line-height:1.5">${esc((p.description || '').slice(0, 130))} ${link(`${SITE}/blog/${p.slug}`, 'Read →')}</div>
    </td></tr>`).join('')}
    <tr><td style="padding:6px 0"><div style="font-size:13px">${link(`${SITE}/blog`, 'Browse all articles →')}</div></td></tr>` : '';

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#EFEAD9;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#EFEAD9;padding:24px 0"><tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#F7F2E4;border-radius:14px;overflow:hidden;border:1px solid #E3DCC7">
    <tr><td style="background:#081813;padding:20px 26px">
      <span style="display:inline-block;width:26px;height:26px;border-radius:7px;background:#E8A11F;color:#081813;text-align:center;line-height:26px;font-weight:bold;font-family:'Courier New',monospace">&#10003;</span>
      <span style="color:#F5EFDF;font-weight:bold;letter-spacing:3px;font-size:16px;vertical-align:middle;margin-left:8px">KODA</span>
      <span style="float:right;color:#9BA79B;font-size:11px;font-family:'Courier New',monospace;line-height:26px">weekly</span>
    </td></tr>
    <tr><td style="padding:26px 26px 6px">
      <p style="margin:0 0 4px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#C08A1E;font-family:'Courier New',monospace"><b>This week's spotlight</b></p>
      <h1 style="margin:0 0 10px;font-size:23px;line-height:1.25;color:#241F14">${esc(spotlight.name)}</h1>
      <p style="margin:0 0 14px;font-size:14.5px;color:#4A4438;line-height:1.6">${greet} ${esc(spotlight.pitch)}</p>
      <a href="${esc(spotlight.url)}" style="display:inline-block;background:#E8A11F;color:#081813;font-weight:bold;font-size:14px;padding:11px 24px;border-radius:8px;text-decoration:none">${esc('Explore ' + spotlight.name)} →</a>
    </td></tr>
    <tr><td style="padding:14px 26px 6px">
      <p style="margin:0 0 2px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8A8168;font-family:'Courier New',monospace"><b>More you can do with KODA</b></p>
      <table width="100%" cellpadding="0" cellspacing="0">${ordered.map(featureRow).join('')}</table>
    </td></tr>
    <tr><td style="padding:2px 26px">
      <table width="100%" cellpadding="0" cellspacing="0">${blogRows}</table>
    </td></tr>
    <tr><td style="padding:20px 26px">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#081813;border-radius:10px"><tr><td style="padding:18px 20px">
        <div style="color:#F5EFDF;font-size:15px;font-weight:bold;margin-bottom:4px">Not verifying payments yet?</div>
        <div style="color:#9BA79B;font-size:13px;margin-bottom:12px">Set up KODA free and confirm your first payment today.</div>
        <a href="${SITE}/get-started" style="display:inline-block;background:#E8A11F;color:#081813;font-weight:bold;font-size:13.5px;padding:10px 20px;border-radius:7px;text-decoration:none">Get started free →</a>
        <a href="${SITE}/app#login" style="display:inline-block;color:#E8A11F;font-weight:bold;font-size:13.5px;padding:10px 14px;text-decoration:none">Sign in →</a>
      </td></tr></table>
    </td></tr>
    <tr><td style="padding:16px 26px 24px;border-top:1px solid #E3DCC7">
      <p style="margin:0;font-size:11.5px;color:#8A8168;line-height:1.7">
        You're receiving KODA's weekly product update because you have a KODA account.<br>
        ${link(`${SITE}/how-it-works`, 'How it works')} &nbsp;·&nbsp; ${link(`${SITE}/coverage`, 'Coverage')} &nbsp;·&nbsp; ${link(`${SITE}/pricing`, 'Pricing')} &nbsp;·&nbsp; ${link(`${SITE}/app#comms`, 'Notification preferences')}<br>
        <a href="${esc(unsub)}" style="color:#8A8168;text-decoration:underline">Unsubscribe from the weekly newsletter</a> · KODA — le code confirme le cash.
      </p>
    </td></tr>
  </table></td></tr></table></body></html>`;

  return { subject, html };
}

// ---- delivery ----------------------------------------------------------------
function markSent(nowMs, count) {
  q.run(`INSERT INTO koda_settings (key,value,updated_at) VALUES (?,?,datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,
    SETTING, JSON.stringify({ at: nowMs, week: weekIndex(nowMs), count }));
}
function lastSent() {
  try { const r = q.get('SELECT value FROM koda_settings WHERE key=?', SETTING); return r ? JSON.parse(r.value) : null; }
  catch { return null; }
}
function due(nowMs) {
  const last = lastSent();
  return !last || (nowMs - (last.at || 0)) >= WEEK_MS;
}

// Send to everyone (or just `testTo`). Logs each delivery to comm_deliveries so the
// admin comms log shows the blast. Sequential + gentle to be kind to the SMTP relay.
async function send({ testTo = null, nowMs = Date.now() } = {}) {
  const list = testTo
    ? [{ id: 'test', email: testTo, name: null }]
    : recipients();
  let sent = 0, skipped = 0, failed = 0;
  for (const u of list) {
    const { subject, html } = build(nowMs, u.id === 'test' ? null : u);
    const dlvId = U.id('dlv');
    q.run(`INSERT INTO comm_deliveries (id,merchant_id,user_id,event_key,channel,recipient,subject,provider,status)
           VALUES (?,?,?,?,?,?,?,?,?)`,
      dlvId, null, u.id === 'test' ? null : u.id, 'newsletter.weekly', 'email', u.email, subject, 'smtp', 'queued');
    try {
      const r = await senders.sendEmail(u.email, subject, html);
      if (r && r.ok) { sent++; q.run(`UPDATE comm_deliveries SET status='sent' WHERE id=?`, dlvId); }
      else { skipped++; q.run(`UPDATE comm_deliveries SET status='logged' WHERE id=?`, dlvId); } // no transport / dry-run
    } catch {
      failed++;
      q.run(`UPDATE comm_deliveries SET status='failed' WHERE id=?`, dlvId);
    }
    await new Promise(r => setTimeout(r, 120)); // ~8/sec ceiling — polite to the relay
  }
  if (!testTo) markSent(nowMs, sent);
  return { recipients: list.length, sent, skipped, failed };
}

// Auto-run: on boot, seed the baseline (no surprise blast on first deploy); thereafter
// a periodic check fires the weekly send when it comes due. Never throws/blocks boot.
function start() {
  const tick = () => {
    try {
      const now = Date.now();
      if (!lastSent()) { markSent(now, 0); return; }   // baseline: first real send goes out ~7 days later
      if (due(now)) { send({ nowMs: now }).catch(() => {}); }
    } catch { /* newsletter is best-effort, never breaks the server */ }
  };
  setTimeout(tick, 30_000);                 // shortly after boot
  setInterval(tick, 6 * 60 * 60 * 1000);    // and every 6 hours
}

module.exports = { build, send, recipients, due, lastSent, unsubUrl, verifyUnsub, start, weekIndex };
