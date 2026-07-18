// KODA — Communication engine: one fire() fans an event out across channels.
// Providers: Brevo (email), Meta Cloud API (whatsapp), FCM (push), SMS gateway.
// Without provider keys every delivery is recorded as 'logged' (sandbox) so the
// whole flow is testable end-to-end before any key is installed.
'use strict';
const { q } = require('../lib/db');
const { id } = require('../lib/util');
const { BY_KEY, CHANNELS } = require('../../shared/events');
const { renderEmail } = require('./email');

const meta = require('./meta');

const PROVIDERS = {
  email: () => process.env.BREVO_API_KEY ? 'brevo' : 'sandbox',
  whatsapp: () => meta.configured() ? 'meta' : 'sandbox',
  push: () => process.env.FCM_KEY ? 'fcm' : 'sandbox',
  sms: () => process.env.SMS_GATEWAY_KEY ? 'gateway' : 'sandbox',
  inapp: () => 'inapp',
};

function interpolate(tpl, data = {}) {
  return String(tpl).replace(/\{\{(\w+)\}\}/g, (_, k) => data[k] ?? `{{${k}}}`);
}

function prefEnabled(userId, channel) {
  const row = q.get('SELECT enabled FROM comm_prefs WHERE user_id=? AND channel=?', userId, channel);
  return row ? !!row.enabled : true; // default opt-in
}

// fire an event to a user (and optionally their merchant context)
// opts: { user, merchant, data, channelsOverride }
function fire(eventKey, opts = {}) {
  const ev = BY_KEY[eventKey];
  if (!ev) throw new Error(`unknown comm event: ${eventKey}`);
  const { user, merchant, data = {} } = opts;
  const subject = interpolate(ev.subject, { merchant: merchant?.name, ...data });
  const channels = opts.channelsOverride || ev.channels;
  const results = [];

  for (const channel of channels) {
    if (!CHANNELS.includes(channel)) continue;
    // opt-outs: in-app always on; mandatory notices bypass opt-outs
    if (channel !== 'inapp' && !ev.mandatory && user && !prefEnabled(user.id, channel)) continue;

    const provider = PROVIDERS[channel]();
    const recipient = channel === 'email' ? user?.email
      : channel === 'inapp' ? user?.id
      : (user?.phone || merchant?.msisdn || null);

    if (channel === 'inapp' && user) {
      q.run(`INSERT INTO notifications (id,user_id,merchant_id,event_key,severity,title,body)
             VALUES (?,?,?,?,?,?,?)`,
        id('ntf'), user.id, merchant?.id || null, ev.key, ev.severity, subject,
        interpolate(ev.label, data));
    }

    // provider adapters: real send when a key exists, otherwise sandbox-log.
    const dlvId = id('dlv');
    let status = provider === 'sandbox' || provider === 'inapp' ? (provider === 'inapp' ? 'sent' : 'logged') : 'queued';
    q.run(`INSERT INTO comm_deliveries (id,merchant_id,user_id,event_key,channel,recipient,subject,provider,status)
           VALUES (?,?,?,?,?,?,?,?,?)`,
      dlvId, merchant?.id || null, user?.id || null, ev.key, channel,
      recipient, subject, provider, status);

    // live WhatsApp send via Meta Cloud API — async, never blocks the caller
    if (channel === 'whatsapp' && provider === 'meta' && recipient) {
      const tpl = meta.EVENT_TEMPLATES[ev.key];
      const to = String(recipient).replace(/[^\d]/g, '');
      (tpl ? meta.sendTemplate(to, tpl, (merchant?.language || 'fr') === 'fr' ? 'fr' : 'en_US')
           : meta.sendText(to, subject))
        .then(() => q.run(`UPDATE comm_deliveries SET status='sent' WHERE id=?`, dlvId))
        .catch(e => q.run(`UPDATE comm_deliveries SET status='failed' WHERE id=?`, dlvId));
    }
    results.push({ channel, provider, status });
  }
  return { event: ev.key, subject, deliveries: results };
}

// fire to every active user of a merchant (e.g. sentinel.offline)
function fireMerchant(eventKey, merchant, data = {}) {
  const users = q.all(`SELECT * FROM users WHERE merchant_id=? AND status='active'`, merchant.id);
  return users.map(u => fire(eventKey, { user: u, merchant, data }));
}

function previewEmail(eventKey, merchant, user, data = {}) {
  const ev = BY_KEY[eventKey];
  if (!ev) return null;
  const subject = interpolate(ev.subject, { merchant: merchant?.name, ...data });
  return renderEmail({ subject, event: ev, merchant, user, data });
}

module.exports = { fire, fireMerchant, previewEmail, interpolate };
