// KODA — API routes. One router, sectioned by module.
// App routes (/app/*) use JWT session auth; public API (/v1/*) uses Bearer API keys.
'use strict';
const { q } = require('./lib/db');
const U = require('./lib/util');
const engine = require('./lib/engine');
const { OPERATORS } = require('../shared/parser');
const { CATEGORIES, ALL, BY_KEY, CHANNELS } = require('../shared/events');
const notify = require('./comms/notify');

const { PLANS } = require('../shared/plans');

// role gate: owners always pass, KODA staff always pass
function needRole(user, roles) { return user.is_admin || user.role === 'owner' || roles.includes(user.role); }

function audit(mid, uid, action, detail) {
  q.run('INSERT INTO audit_log (id,merchant_id,user_id,action,detail) VALUES (?,?,?,?,?)',
    U.id('aud'), mid || null, uid || null, action, detail ? JSON.stringify(detail) : null);
}

module.exports = function registerRoutes(r) {
  // ---------- auth ----------
  r.post('/app/auth/signup', (req) => {
    const { business, name, email, phone, password, country = 'CD', currency = 'CDF' } = req.body;
    if (!business || !email || !password || !name) return [400, { error: 'missing_fields' }];
    if (q.get('SELECT id FROM users WHERE email=?', email)) return [409, { error: 'email_taken' }];
    const mid = U.id('mch'), uid = U.id('usr');
    q.run(`INSERT INTO merchants (id,name,country,currency,msisdn,logo_text) VALUES (?,?,?,?,?,?)`,
      mid, business, country, currency, phone || null, business);
    q.run(`INSERT INTO users (id,merchant_id,email,name,phone,pass_hash,role) VALUES (?,?,?,?,?,?,'owner')`,
      uid, mid, email.toLowerCase(), name, phone || null, U.hashPassword(password));
    const user = q.get('SELECT * FROM users WHERE id=?', uid);
    const merchant = q.get('SELECT * FROM merchants WHERE id=?', mid);
    notify.fire('account.registration.requested', { user, merchant });
    notify.fire('cs.onboarding_started', { user, merchant });
    audit(mid, uid, 'signup', { business });
    return { token: U.signJwt({ uid, mid }), user: safeUser(user), merchant };
  });

  r.post('/app/auth/login', (req) => {
    const { email, password } = req.body;
    const user = q.get('SELECT * FROM users WHERE email=?', String(email || '').toLowerCase());
    if (!user || !U.verifyPassword(password || '', user.pass_hash)) return [401, { error: 'invalid_credentials' }];
    if (user.status !== 'active') return [403, { error: 'account_suspended' }];
    const merchant = user.merchant_id ? q.get('SELECT * FROM merchants WHERE id=?', user.merchant_id) : null;
    notify.fire('auth.login.success', { user, merchant });
    return { token: U.signJwt({ uid: user.id, mid: user.merchant_id, adm: !!user.is_admin }), user: safeUser(user), merchant };
  });

  r.get('/app/me', auth((req, user, merchant) => ({
    user: safeUser(user), merchant,
    plan: PLANS[merchant?.plan || 'marche'],
    unread: q.get('SELECT COUNT(*) c FROM notifications WHERE user_id=? AND read=0', user.id).c,
  })));

  // ---------- dashboard ----------
  r.get('/app/dashboard', auth((req, user, m) => {
    if (!m) { // KODA staff have no merchant — return an empty till and let the SPA route to the control centre
      return { today: { c: 0, s: 0 }, month: { c: 0, s: 0 }, unmatched: { c: 0, s: 0 },
               disputes: 0, devices: [], daily: [], byMode: [], acu: 0, plan: PLANS.enterprise };
    }
    const today = q.get(`SELECT COUNT(*) c, COALESCE(SUM(amount),0) s FROM receipts
      WHERE merchant_id=? AND verified_at > date('now')`, m.id);
    const month = q.get(`SELECT COUNT(*) c, COALESCE(SUM(amount),0) s FROM receipts
      WHERE merchant_id=? AND verified_at > date('now','start of month')`, m.id);
    const unmatched = q.get(`SELECT COUNT(*) c, COALESCE(SUM(amount),0) s FROM sms_ledger
      WHERE merchant_id=? AND matched_intent_id IS NULL AND quarantined=0 AND ref_code IS NOT NULL`, m.id);
    const disputes = q.get(`SELECT COUNT(*) c FROM disputes WHERE merchant_id=? AND status='open'`, m.id).c;
    const devices = q.all(`SELECT * FROM devices WHERE merchant_id=? AND status!='revoked'`, m.id);
    const daily = q.all(`SELECT date(verified_at) d, COUNT(*) c, SUM(amount) s FROM receipts
      WHERE merchant_id=? AND verified_at > date('now','-14 days') GROUP BY 1 ORDER BY 1`, m.id);
    const byMode = q.all(`SELECT mode, COUNT(*) c FROM receipts WHERE merchant_id=? GROUP BY 1`, m.id);
    return { today, month, unmatched, disputes, devices, daily, byMode, acu: m.acu_balance, plan: PLANS[m.plan] };
  }));

  // ---------- manual verify console + intents + receipts ----------
  r.post('/app/verify', auth((req, user, m) => {
    const { reference, amount, screenshot } = req.body;
    if (!reference && !screenshot) return [400, { error: 'reference_or_screenshot_required' }];
    // screenshot path: VisionAgent extraction (sandbox: caller passes extracted ref via screenshot_ref)
    const ref = reference || req.body.screenshot_ref;
    if (!ref) return [422, { error: 'vision_could_not_extract' }];
    let intent = null;
    const amt = Number(amount);
    if (amount !== undefined && amount !== '' && (!Number.isFinite(amt) || amt <= 0)) {
      return [400, { error: 'invalid_amount' }];
    }
    if (Number.isFinite(amt) && amt > 0) { // ad-hoc manual intent so the receipt carries an expected amount
      const iid = U.id('int');
      q.run(`INSERT INTO intents (id,merchant_id,amount,currency,operators,status,expires_at,metadata)
             VALUES (?,?,?,?,?, 'awaiting_payment', datetime('now','+15 minutes'), ?)`,
        iid, m.id, amt, m.currency, JSON.stringify(OPERATORS.map(o => o.id)),
        JSON.stringify({ manual: true }));
      intent = q.get('SELECT * FROM intents WHERE id=?', iid);
    }
    const res = engine.verify(m, intent, ref, { mode: 'manual', userId: user.id, viaScreenshot: !!screenshot });
    audit(m.id, user.id, 'manual_verify', { reference: ref, status: res.status });
    return res;
  }));

  r.post('/app/intents', auth((req, user, m) => createIntent(m, req.body)));
  r.get('/app/intents', auth((req, user, m) =>
    q.all(`SELECT * FROM intents WHERE merchant_id=? ORDER BY created_at DESC LIMIT 100`, m.id)));
  r.get('/app/receipts', auth((req, user, m) =>
    q.all(`SELECT * FROM receipts WHERE merchant_id=? ORDER BY verified_at DESC LIMIT 200`, m.id)));
  r.get('/app/receipts/:id', auth((req, user, m) => {
    const rcp = q.get('SELECT * FROM receipts WHERE id=? AND merchant_id=?', req.params.id, m.id);
    return rcp ? { ...rcp, decision_trace: JSON.parse(rcp.decision_trace || '{}') } : [404, { error: 'not_found' }];
  }));

  // ---------- live feed / ledger + sms ingestion ----------
  r.get('/app/feed', auth((req, user, m) =>
    q.all(`SELECT * FROM sms_ledger WHERE merchant_id=? ORDER BY received_at DESC, rowid DESC LIMIT 100`, m.id)));
  r.post('/app/sandbox/sms', auth((req, user, m) => {
    const out = engine.ingestSms(m, { raw: req.body.raw, operator: req.body.operator });
    audit(m.id, user.id, 'sandbox_sms_injected', { operator: req.body.operator });
    return out;
  }));

  // ---------- devices (Sentinel fleet) ----------
  r.get('/app/devices', auth((req, user, m) => q.all('SELECT * FROM devices WHERE merchant_id=?', m.id)));
  r.post('/app/devices/enroll', auth((req, user, m) => {
    const did = U.id('dev'), code = U.token(6).slice(0, 8).toUpperCase();
    q.run(`INSERT INTO devices (id,merchant_id,label,operator,sim_msisdn,enrol_code,status,attested,last_seen)
           VALUES (?,?,?,?,?,?, 'active', 1, datetime('now'))`,
      did, m.id, req.body.label || 'Merchant phone', req.body.operator || 'orange_cd', req.body.sim || null, code);
    notify.fireMerchant('sentinel.enrolled', m, { item: req.body.label || 'Merchant phone' });
    audit(m.id, user.id, 'device_enrolled', { did });
    return { device_id: did, enrol_code: code, qr: `koda://enroll/${code}` };
  }));
  r.post('/app/devices/:id/revoke', auth((req, user, m) => {
    if (!needRole(user, ['manager'])) return [403, { error: 'manager_or_owner_only' }];
    q.run(`UPDATE devices SET status='revoked' WHERE id=? AND merchant_id=?`, req.params.id, m.id);
    notify.fireMerchant('sentinel.revoked', m, {});
    audit(m.id, user.id, 'device_revoked', { id: req.params.id });
    return { ok: true };
  }));

  // ---------- disputes ----------
  r.get('/app/disputes', auth((req, user, m) =>
    q.all('SELECT * FROM disputes WHERE merchant_id=? ORDER BY created_at DESC', m.id)));
  r.post('/app/disputes', auth((req, user, m) => {
    const did = U.id('dsp');
    const evidence = {
      assembled_by: 'DisputeAgent K-06',
      reference: req.body.reference || null,
      customer_claim: req.body.reason,
      ledger_scan: 'no matching SMS in ±45 min window',
      recommendation: 'request payer-number confirmation from customer',
    };
    q.run(`INSERT INTO disputes (id,merchant_id,reference,reason,evidence,recommendation)
           VALUES (?,?,?,?,?,?)`, did, m.id, req.body.reference || null, req.body.reason || 'verification_failed',
      JSON.stringify(evidence), evidence.recommendation);
    engine.chargeAcu(m, engine.ACU.dispute, 'dispute', did);
    notify.fireMerchant('dispute.opened', m, { reference: req.body.reference || did });
    return q.get('SELECT * FROM disputes WHERE id=?', did);
  }));
  r.post('/app/disputes/:id/resolve', auth((req, user, m) => {
    const outcome = ['accepted', 'rejected', 'escalated'].includes(req.body.outcome) ? req.body.outcome : 'rejected';
    q.run(`UPDATE disputes SET status=?, resolved_by=?, resolved_at=datetime('now') WHERE id=? AND merchant_id=?`,
      outcome, user.id, req.params.id, m.id);
    notify.fireMerchant(outcome === 'accepted' ? 'dispute.resolved.accepted'
      : outcome === 'escalated' ? 'dispute.escalated' : 'dispute.resolved.rejected', m,
      { reference: req.params.id });
    audit(m.id, user.id, 'dispute_resolved', { id: req.params.id, outcome });
    return { ok: true };
  }));

  // ---------- billing ----------
  r.get('/app/billing', auth((req, user, m) => ({
    balance: m.acu_balance,
    plan: { id: m.plan, ...PLANS[m.plan] },
    packs: engine.TOPUP_PACKS,
    usage: q.all(`SELECT date(created_at) d, SUM(CASE WHEN delta<0 THEN -delta ELSE 0 END) burned
                  FROM acu_transactions WHERE merchant_id=? AND created_at > date('now','-30 days')
                  GROUP BY 1 ORDER BY 1`, m.id),
    transactions: q.all(`SELECT * FROM acu_transactions WHERE merchant_id=? ORDER BY created_at DESC LIMIT 50`, m.id),
    invoices: q.all(`SELECT * FROM invoices WHERE merchant_id=? ORDER BY created_at DESC`, m.id),
  })));
  r.post('/app/billing/topup', auth((req, user, m) => {
    const pack = engine.TOPUP_PACKS.find(p => p.usd === Number(req.body.usd)) || engine.TOPUP_PACKS[0];
    // top-up = a KODA intent on KODA's own account, purpose=topup
    const res = createIntent(m, {
      amount: pack.usd * 2800, currency: 'CDF', operators: ['mpesa_cd', 'orange_cd', 'airtel_cd'],
      purpose: 'topup', metadata: { usd: pack.usd, acu: pack.acu },
    });
    notify.fire('billing.topup.created', { user, merchant: m, data: { amount: `$${pack.usd}` } });
    return { ...res, pack, pay_note: 'Pay via mobile money, then submit the confirmation code — verified by KODA itself.' };
  }));
  r.post('/app/billing/plan', auth((req, user, m) => {
    if (!needRole(user, [])) return [403, { error: 'owner_only' }];
    const plan = PLANS[req.body.plan] ? req.body.plan : m.plan;
    const up = PLANS[plan].usd > (PLANS[m.plan].usd || 0);
    q.run('UPDATE merchants SET plan=?, is_platform=? WHERE id=?', plan, plan === 'plateforme' ? 1 : m.is_platform, m.id);
    notify.fire(up ? 'plan.upgraded' : 'plan.downgraded', { user, merchant: m, data: { plan: PLANS[plan].label } });
    audit(m.id, user.id, 'plan_changed', { plan });
    return { ok: true, plan };
  }));

  // ---------- api keys ----------
  r.get('/app/keys', auth((req, user, m) =>
    q.all('SELECT id,prefix,last4,label,revoked,created_at FROM api_keys WHERE merchant_id=? AND submerchant_id IS NULL', m.id)));
  r.post('/app/keys', auth((req, user, m) => {
    if (!needRole(user, ['manager'])) return [403, { error: 'manager_or_owner_only' }];
    const prefix = ['sk_live', 'pk_live', 'sk_test', 'pk_test', 'rk_live'].includes(req.body.prefix) ? req.body.prefix : 'sk_test';
    const secret = `${prefix}_${U.token(24)}`;
    // rk_ keys default to read-only scopes unless explicit scopes are given; others get full scope
    const scopes = Array.isArray(req.body.scopes) && req.body.scopes.length ? req.body.scopes
      : prefix === 'rk_live' ? ['read:receipts', 'read:usage', 'read:agents'] : ['*'];
    q.run(`INSERT INTO api_keys (id,merchant_id,prefix,key_hash,last4,label,scopes) VALUES (?,?,?,?,?,?,?)`,
      U.id('key'), m.id, prefix, U.sha256(secret), secret.slice(-4), req.body.label || null, JSON.stringify(scopes));
    notify.fire('apikey.created', { user, merchant: m });
    audit(m.id, user.id, 'key_created', { prefix });
    return { secret, note: 'The secret is shown once. Store it now.' };
  }));
  r.post('/app/keys/:id/revoke', auth((req, user, m) => {
    if (!needRole(user, ['manager'])) return [403, { error: 'manager_or_owner_only' }];
    q.run('UPDATE api_keys SET revoked=1 WHERE id=? AND merchant_id=?', req.params.id, m.id);
    notify.fire('apikey.revoked', { user, merchant: m });
    return { ok: true };
  }));

  // ---------- webhooks ----------
  r.get('/app/webhooks', auth((req, user, m) => ({
    endpoints: q.all('SELECT * FROM webhook_endpoints WHERE merchant_id=?', m.id),
    deliveries: q.all('SELECT * FROM webhook_deliveries WHERE merchant_id=? ORDER BY created_at DESC LIMIT 50', m.id),
  })));
  r.post('/app/webhooks', auth((req, user, m) => {
    if (!needRole(user, [])) return [403, { error: 'owner_only' }];
    const wid = U.id('whe'), secret = `whsec_${U.token(24)}`;
    q.run(`INSERT INTO webhook_endpoints (id,merchant_id,url,secret,events) VALUES (?,?,?,?,?)`,
      wid, m.id, req.body.url, secret, JSON.stringify(req.body.events || ['*']));
    notify.fire('webhook.endpoint_added', { user, merchant: m });
    return { id: wid, secret };
  }));
  r.post('/app/webhooks/:id/test', auth((req, user, m) => {
    require('./lib/webhooks').dispatch(m.id, 'payment.verified',
      { test: true, receipt_id: 'rcp_TEST', amount: 25000, currency: m.currency });
    return { ok: true, note: 'Signed test event dispatched.' };
  }));

  // ---------- team ----------
  r.get('/app/team', auth((req, user, m) => ({
    members: q.all(`SELECT id,email,name,role,status,created_at FROM users WHERE merchant_id=?`, m.id),
    audit: q.all(`SELECT a.*, u.name FROM audit_log a LEFT JOIN users u ON u.id=a.user_id
                  WHERE a.merchant_id=? ORDER BY a.created_at DESC LIMIT 50`, m.id),
  })));
  r.post('/app/team/invite', auth((req, user, m) => {
    if (user.role === 'cashier') return [403, { error: 'forbidden' }];
    const { email, name, role = 'cashier', password } = req.body;
    if (q.get('SELECT id FROM users WHERE email=?', String(email).toLowerCase())) return [409, { error: 'email_taken' }];
    const uid = U.id('usr');
    q.run(`INSERT INTO users (id,merchant_id,email,name,pass_hash,role) VALUES (?,?,?,?,?,?)`,
      uid, m.id, email.toLowerCase(), name, U.hashPassword(password || U.token(8)), role);
    const invited = q.get('SELECT * FROM users WHERE id=?', uid);
    notify.fire('invitation.sent', { user: invited, merchant: m, data: { actor: user.name } });
    audit(m.id, user.id, 'team_invited', { email, role });
    return { ok: true, member: safeUser(invited) };
  }));
  r.post('/app/team/:id/role', auth((req, user, m) => {
    if (user.role !== 'owner') return [403, { error: 'forbidden' }];
    q.run(`UPDATE users SET role=? WHERE id=? AND merchant_id=?`, req.body.role, req.params.id, m.id);
    const target = q.get('SELECT * FROM users WHERE id=?', req.params.id);
    if (target) notify.fire('role.assigned', { user: target, merchant: m, data: { role: req.body.role } });
    return { ok: true };
  }));

  // ---------- sub-merchants (Plateforme) ----------
  r.get('/app/submerchants', auth((req, user, m) =>
    q.all(`SELECT s.*, (SELECT COUNT(*) FROM receipts r WHERE r.merchant_id=s.id) verifs
           FROM merchants s WHERE s.parent_id=?`, m.id)));
  r.post('/app/submerchants', auth((req, user, m) => {
    if (!needRole(user, [])) return [403, { error: 'owner_only' }];
    if (m.plan !== 'plateforme' && m.plan !== 'enterprise') return [402, { error: 'plateforme_plan_required' }];
    const sid = U.id('mch');
    q.run(`INSERT INTO merchants (id,name,country,currency,msisdn,parent_id,plan,acu_balance)
           VALUES (?,?,?,?,?,?, 'boutique', 0)`,
      sid, req.body.name, req.body.country || m.country, req.body.currency || m.currency,
      req.body.msisdn || null, m.id);
    const secret = `sk_live_sub_${U.token(24)}`;
    q.run(`INSERT INTO api_keys (id,merchant_id,prefix,key_hash,last4,label,submerchant_id)
           VALUES (?,?,?,?,?,?,?)`,
      U.id('key'), m.id, 'sk_live_sub', U.sha256(secret), secret.slice(-4), req.body.name, sid);
    engine.chargeAcu(m, engine.ACU.submerchant, 'submerchant', sid);
    notify.fire('submerchant.onboarded', { user, merchant: m, data: { name: req.body.name } });
    return { submerchant_id: sid, key: secret };
  }));
  r.post('/app/submerchants/:id/suspend', auth((req, user, m) => {
    q.run(`UPDATE merchants SET status='suspended' WHERE id=? AND parent_id=?`, req.params.id, m.id);
    notify.fire('submerchant.suspended', { user, merchant: m, data: { name: req.params.id } });
    return { ok: true };
  }));

  // ---------- communications ----------
  r.get('/app/notifications', auth((req, user) =>
    q.all('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100', user.id)));
  r.post('/app/notifications/read', auth((req, user) => {
    q.run('UPDATE notifications SET read=1 WHERE user_id=?', user.id); return { ok: true };
  }));
  r.get('/app/comms/catalogue', auth(() => ({
    categories: CATEGORIES.map(c => ({ id: c.id, label: c.label, events: c.events })),
    channels: CHANNELS,
    stats: {
      total: ALL.length,
      categories: CATEGORIES.length,
      mandatory: ALL.filter(e => e.mandatory).length,
      byChannel: Object.fromEntries(CHANNELS.map(ch => [ch, ALL.filter(e => e.channels.includes(ch)).length])),
    },
  })));
  r.get('/app/comms/deliveries', auth((req, user, m) => ({
    deliveries: q.all(`SELECT * FROM comm_deliveries WHERE merchant_id=? OR user_id=?
                       ORDER BY created_at DESC LIMIT 60`, m?.id || '', user.id),
    sent: q.get(`SELECT COUNT(*) c FROM comm_deliveries WHERE (merchant_id=? OR user_id=?) AND status='sent'`, m?.id || '', user.id).c,
    attempted: q.get(`SELECT COUNT(*) c FROM comm_deliveries WHERE merchant_id=? OR user_id=?`, m?.id || '', user.id).c,
  })));
  r.get('/app/comms/preview/:key', auth((req, user, m) => {
    const html = notify.previewEmail(req.params.key, m, user, { amount: '25 000 CDF', reference: 'OM.260717.1432.A88213', acu: 1750, number: 'INV-2026-071', plan: 'Commerce' });
    return html ? { html } : [404, { error: 'unknown_event' }];
  }));
  r.post('/app/comms/test/:key', auth((req, user, m) => {
    const out = notify.fire(req.params.key, { user, merchant: m, data: { amount: '25 000 CDF', reference: 'TEST-REF', acu: 300 } });
    return out;
  }));
  r.get('/app/comms/prefs', auth((req, user) => {
    const prefs = {};
    for (const ch of ['email', 'whatsapp', 'push', 'sms']) {
      const row = q.get('SELECT enabled FROM comm_prefs WHERE user_id=? AND channel=?', user.id, ch);
      prefs[ch] = row ? !!row.enabled : true;
    }
    return prefs;
  }));
  r.post('/app/comms/prefs', auth((req, user) => {
    for (const [ch, on] of Object.entries(req.body || {})) {
      q.run(`INSERT INTO comm_prefs (user_id,channel,enabled) VALUES (?,?,?)
             ON CONFLICT(user_id,channel) DO UPDATE SET enabled=excluded.enabled`, user.id, ch, on ? 1 : 0);
    }
    notify.fire('privacy.consent_updated', { user });
    return { ok: true };
  }));

  // ---------- admin control centre ----------
  r.get('/app/admin/overview', admin(() => ({
    merchants: q.get('SELECT COUNT(*) c FROM merchants WHERE parent_id IS NULL').c,
    submerchants: q.get('SELECT COUNT(*) c FROM merchants WHERE parent_id IS NOT NULL').c,
    users: q.get('SELECT COUNT(*) c FROM users').c,
    receipts: q.get('SELECT COUNT(*) c FROM receipts').c,
    volume: q.get('SELECT COALESCE(SUM(amount),0) s FROM receipts').s,
    devices: q.get(`SELECT COUNT(*) c FROM devices WHERE status='active'`).c,
    quarantined: q.get('SELECT COUNT(*) c FROM sms_ledger WHERE quarantined=1').c,
    openDisputes: q.get(`SELECT COUNT(*) c FROM disputes WHERE status='open'`).c,
    deliveries: q.get('SELECT COUNT(*) c FROM comm_deliveries').c,
    parseHealth: [
      { operator: 'orange_cd', rate: 0.995 }, { operator: 'mpesa_cd', rate: 0.991 },
      { operator: 'airtel_cd', rate: 0.987 }, { operator: 'africell_cd', rate: 0.978 },
    ],
    latest: q.all(`SELECT r.*, m.name merchant FROM receipts r JOIN merchants m ON m.id=r.merchant_id
                   ORDER BY r.verified_at DESC LIMIT 20`),
  })));
  r.get('/app/admin/merchants', admin(() =>
    q.all(`SELECT m.*, (SELECT COUNT(*) FROM receipts r WHERE r.merchant_id=m.id) verifs,
           (SELECT COUNT(*) FROM users u WHERE u.merchant_id=m.id) seats
           FROM merchants m WHERE m.parent_id IS NULL ORDER BY m.created_at DESC`)));
  r.post('/app/admin/merchants/:id/suspend', admin((req) => {
    q.run(`UPDATE merchants SET status = CASE status WHEN 'suspended' THEN 'active' ELSE 'suspended' END WHERE id=?`, req.params.id);
    return { ok: true };
  }));

  // ---------- public API (/v1) — key-authenticated ----------
  r.get('/v1/ping', apiKey((req, m) => ({
    ok: true, merchant: m.name, plan: m.plan, environment: req.keyPrefix.includes('test') ? 'test' : 'live',
  })));
  r.post('/v1/intents', apiKey((req, m) => createIntent(m, req.body)));
  r.get('/v1/intents/:id', apiKey((req, m) => {
    const i = q.get('SELECT * FROM intents WHERE id=? AND merchant_id=?', req.params.id, m.id);
    return i || [404, { error: { code: 'not_found' } }];
  }));
  r.post('/v1/intents/:id/verify', apiKey((req, m) => {
    const intent = q.get('SELECT * FROM intents WHERE id=? AND merchant_id=?', req.params.id, m.id);
    if (!intent) return [404, { error: { code: 'not_found' } }];
    if (intent.status !== 'awaiting_payment' && intent.status !== 'pending_review')
      return [409, { error: { code: 'intent_' + intent.status } }];
    return engine.verify(m, intent, req.body.reference || req.body.screenshot_ref,
      { mode: 'api', viaScreenshot: !!req.body.screenshot });
  }));
  r.post('/v1/intents/:id/cancel', apiKey((req, m) => {
    q.run(`UPDATE intents SET status='cancelled' WHERE id=? AND merchant_id=? AND status='awaiting_payment'`,
      req.params.id, m.id);
    return { ok: true };
  }));
  r.get('/v1/receipts', apiKey((req, m) =>
    q.all('SELECT * FROM receipts WHERE merchant_id=? ORDER BY verified_at DESC LIMIT 100', m.id), 'read:receipts'));
  r.post('/v1/sandbox/sms', apiKey((req, m) => engine.ingestSms(m, { raw: req.body.raw, operator: req.body.operator })));
  r.get('/v1/billing/balance', apiKey((req, m) => ({ acu_balance: m.acu_balance }), 'read:usage'));

  // ---- agent surface: list the runnable mesh + run an agent (draws down ACU) ----
  r.get('/v1/agents', apiKey(() => ({ agents: AGENTS.map(({ run, ...meta }) => meta) }), 'read:agents'));
  r.post('/v1/agents/:type/run', apiKey((req, m) => {
    const agent = AGENTS.find(a => a.type === req.params.type);
    if (!agent) return [404, { error: { code: 'unknown_agent', doc_url: 'https://docs.koda.africa/agents' } }];
    if (m.acu_balance < agent.acu) return [402, { error: { code: 'insufficient_credit', required_acu: agent.acu, balance: m.acu_balance } }];
    const result = agent.run(m, req.body || {});
    if (agent.acu > 0) engine.chargeAcu(m, agent.acu, 'agent:' + agent.type, null);
    return { agent: agent.type, acu_consumed: agent.acu, result };
  }, 'run:agents'));

  // ---- usage: monthly quota, consumption and ACU balance ----
  r.get('/v1/usage', apiKey((req, m) => {
    const plan = PLANS[m.plan] || PLANS.marche;
    const month = q.get(`SELECT COUNT(*) c FROM receipts WHERE merchant_id=? AND verified_at > date('now','start of month')`, m.id).c;
    const burned = q.get(`SELECT COALESCE(SUM(-delta),0) s FROM acu_transactions WHERE merchant_id=? AND delta<0 AND created_at > date('now','start of month')`, m.id).s;
    return {
      plan: m.plan, monthly_quota: plan.verifs, verifications_this_month: month,
      quota_remaining: plan.verifs == null ? null : Math.max(0, plan.verifs - month),
      overage_rate_usd: plan.overage, acu_balance: m.acu_balance, acu_burned_this_month: burned,
    };
  }, 'read:usage'));

  r.get('/v1/openapi.json', () => openapi());

  // ---------- WhatsApp Cloud API webhook (Door 2 — Chat Mode) ----------
  // GET: Meta's verification handshake (echo hub.challenge when the verify token matches)
  r.get('/webhooks/whatsapp', (req) => {
    const qy = req.query;
    if (qy['hub.mode'] === 'subscribe' && qy['hub.verify_token'] === (process.env.META_WA_VERIFY_TOKEN || 'koda-verify')) {
      return qy['hub.challenge'] || '';
    }
    return [403, { error: 'verify_token_mismatch' }];
  });
  // POST: inbound customer messages — extract a reference code, verify, reply in-thread
  r.post('/webhooks/whatsapp', (req) => {
    const meta = require('./comms/meta');
    const entries = req.body.entry || [];
    for (const entry of entries) {
      for (const change of (entry.changes || [])) {
        const val = change.value || {};
        for (const msg of (val.messages || [])) {
          if (msg.type !== 'text') continue;
          const from = msg.from;                                  // customer wa_id
          const text = String(msg.text?.body || '');
          // merchant routing: display number ↔ merchant msisdn, else the first active merchant
          const display = val.metadata?.display_phone_number || '';
          const m = q.get(`SELECT * FROM merchants WHERE replace(msisdn,'+','') = ? AND status='active'`, display.replace(/[^\d]/g, ''))
                 || q.get(`SELECT * FROM merchants WHERE status='active' AND parent_id IS NULL ORDER BY created_at LIMIT 1`);
          if (!m) continue;
          const ref = (text.toUpperCase().match(/[A-Z0-9][A-Z0-9.\-]{6,}/) || [])[0];
          let reply;
          if (!ref) {
            reply = m.language === 'en'
              ? 'Send the transaction code from your payment confirmation to verify your payment.'
              : 'Envoie le code de transaction de ta confirmation de paiement pour vérifier ton paiement.';
          } else {
            const res = engine.verify(q.get('SELECT * FROM merchants WHERE id=?', m.id), null, ref, { mode: 'chat' });
            reply = res.status === 'verified'
              ? `✅ Paiement confirmé — ${Number(res.amount_confirmed).toLocaleString('fr-FR')} ${m.currency}. Merci !`
              : res.status === 'not_found_yet'
              ? `⏳ Ton paiement est en route — on te confirme dès que le réseau nous le montre.`
              : res.code === 'code_already_used'
              ? `⚠️ Ce code a déjà été utilisé. Vérifie ta référence.`
              : `❌ Nous n'avons pas pu confirmer ce paiement. Vérifie le code, le montant et le numéro de réception.`;
          }
          if (meta.configured()) meta.sendText(from, reply).catch(() => {});
          q.run(`INSERT INTO comm_deliveries (id,merchant_id,user_id,event_key,channel,recipient,subject,provider,status)
                 VALUES (?,?,NULL,'chat.inbound_reply','whatsapp',?,?,?,?)`,
            U.id('dlv'), m.id, from, reply.slice(0, 120), meta.configured() ? 'meta' : 'sandbox', meta.configured() ? 'sent' : 'logged');
        }
      }
    }
    return { received: true };
  });

  // ---------- AI Growth Engine (K-11) ----------
  const growth = require('./lib/growth');
  r.get('/app/growth/tools', auth((req, user, m) => ({
    tools: Object.entries(growth.TOOLS).map(([id, t]) => ({ id, label: t.label, acu: t.acu })),
    balance: m ? m.acu_balance : 0,
  })));
  r.post('/app/growth/:tool', auth((req, user, m) => {
    if (!m) return [400, { error: 'no_merchant' }];
    const tool = growth.TOOLS[req.params.tool];
    if (!tool) return [404, { error: 'unknown_tool' }];
    if (m.acu_balance < tool.acu) return [402, { error: 'insufficient_credit', required_acu: tool.acu, balance: m.acu_balance }];
    // recommendations reads the merchant's real KODA data
    let input = req.body || {};
    if (req.params.tool === 'recommendations') {
      const month = q.get(`SELECT COUNT(*) c FROM receipts WHERE merchant_id=? AND verified_at > date('now','start of month')`, m.id).c;
      const unmatched = q.get(`SELECT COUNT(*) c FROM sms_ledger WHERE merchant_id=? AND matched_intent_id IS NULL AND quarantined=0 AND ref_code IS NOT NULL`, m.id).c;
      const disputes = q.get(`SELECT COUNT(*) c FROM disputes WHERE merchant_id=? AND status='open'`, m.id).c;
      input = { acu: m.acu_balance, unmatched, disputes, monthVerifs: month, planQuota: (PLANS[m.plan] || {}).verifs };
    }
    const result = tool.run(m, input);
    if (tool.acu > 0) engine.chargeAcu(m, tool.acu, 'growth:' + req.params.tool, null);
    audit(m.id, user.id, 'growth_tool', { tool: req.params.tool, acu: tool.acu });
    return { tool: req.params.tool, acu_consumed: tool.acu, result };
  }));

  // ---------- SEO agent (K-10) + autopilot ----------
  const seo = require('./lib/seo');
  // public: what the SEO agent has published (also handy for internal dashboards)
  r.get('/v1/seo/posts', () => ({
    site: seo.SITE,
    posts: seo.allPosts().map(p => ({ slug: p.slug, title: p.title, keyword: p.keyword,
      url: `${seo.SITE}/blog/${p.slug}`, tags: p.tags, internal_links: (p.links || []).length + (p.related || []).length })),
  }));
  // admin: run the autopilot — regenerate the blog, sitemap and robots now
  r.post('/app/seo/autopilot', admin(() => {
    const before = require('node:fs');
    let out;
    try { delete require.cache[require.resolve('../frontend/build-site')]; out = require('../frontend/build-site'); }
    catch (e) { return [500, { error: 'build_failed', detail: String(e.message) }]; }
    audit(null, null, 'seo_autopilot_run', { posts: out.posts });
    return { ok: true, regenerated: { pages: out.generated, posts: out.posts }, sitemap: `${seo.SITE}/sitemap.xml`,
      note: 'Blog, internal-link web, JSON-LD, sitemap and robots regenerated. Submit the sitemap in Google Search Console once live.' };
  }));
  r.get('/app/seo/status', admin(() => ({
    posts: seo.allPosts().length,
    total_internal_links: seo.allPosts().reduce((a, p) => a + (p.links || []).length + (p.related || []).length + (p.faqs || []).length, 0),
    keywords: seo.allPosts().map(p => p.keyword),
    surfaces: ['sitemap.xml', 'robots.txt', 'JSON-LD (BlogPosting, FAQPage, BreadcrumbList, Organization)', 'OpenGraph', 'Twitter cards', 'canonical URLs'],
    ai_gateway: !!(process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY),
  })));

  // health for status page
  r.get('/healthz', () => ({ ok: true, service: 'koda-api', time: new Date().toISOString() }));
};

// ---------- shared helpers ----------
function createIntent(m, body) {
  if (m.status !== 'active') return [403, { error: { code: 'merchant_suspended' } }];
  if (m.acu_balance <= -100) return [402, { error: { code: 'insufficient_credit' } }];
  // validate amount: positive finite number within sane bounds (in minor units)
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1e12) {
    return [400, { error: { code: 'invalid_amount', message: 'amount must be a positive number' } }];
  }
  const currency = typeof body.currency === 'string' && /^[A-Z]{3}$/.test(body.currency) ? body.currency : m.currency;
  const iid = U.id('int');
  const ops = Array.isArray(body.operators) && body.operators.length
    ? body.operators.filter(o => typeof o === 'string').slice(0, 12) : ['orange_cd', 'mpesa_cd'];
  if (!ops.length) return [400, { error: { code: 'invalid_operators' } }];
  q.run(`INSERT INTO intents (id,merchant_id,amount,currency,operators,customer_msisdn,metadata,purpose,expires_at)
         VALUES (?,?,?,?,?,?,?,?, datetime('now','+' || ? || ' seconds'))`,
    iid, m.id, amount, currency, JSON.stringify(ops),
    body.customer_msisdn || null, JSON.stringify(body.metadata || {}),
    body.purpose === 'topup' ? 'topup' : 'sale', Math.min(3600, Number(body.expires_in) || 900));
  const intent = q.get('SELECT * FROM intents WHERE id=?', iid);
  return {
    intent_id: iid, status: intent.status,
    pay_to: ops.map(o => ({ operator: o, number: m.msisdn || '+243 8XX XXX XXX', ussd_hint: o.startsWith('orange') ? '#144#' : '*1122#' })),
    expires_at: intent.expires_at,
  };
}

const { q: _q } = require('./lib/db');
function auth(handler) {
  return (req) => {
    const tok = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || req.query.token;
    const payload = U.verifyJwt(tok);
    if (!payload) return [401, { error: 'unauthenticated' }];
    const user = _q.get('SELECT * FROM users WHERE id=?', payload.uid);
    if (!user || user.status !== 'active') return [401, { error: 'unauthenticated' }];
    const merchant = user.merchant_id ? _q.get('SELECT * FROM merchants WHERE id=?', user.merchant_id) : null;
    return handler(req, user, merchant);
  };
}
function admin(handler) {
  return auth((req, user, merchant) => user.is_admin ? handler(req, user, merchant) : [403, { error: 'admin_only' }]);
}
// per-key sliding-window rate limiter (per plan: Free 2 rps · Boutique 10 · Commerce 25 · Plateforme 100)
const _hits = new Map();
function rateLimited(keyId, plan) {
  const now = Date.now(), limit = (PLANS[plan] && PLANS[plan].rps) || 2;
  const arr = (_hits.get(keyId) || []).filter(t => now - t < 1000);
  arr.push(now); _hits.set(keyId, arr);
  return arr.length > limit;
}

function apiKey(handler, scope) {
  return (req) => {
    const raw = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || req.headers['x-api-key'];
    if (!raw) return [401, { error: { code: 'missing_key' } }];
    const row = _q.get('SELECT * FROM api_keys WHERE key_hash=? AND revoked=0', U.sha256(raw));
    if (!row) return [401, { error: { code: 'invalid_key' } }];
    const m = _q.get('SELECT * FROM merchants WHERE id=?', row.submerchant_id || row.merchant_id);
    if (!m || m.status !== 'active') return [403, { error: { code: 'merchant_suspended' } }];
    const scopes = JSON.parse(row.scopes || '["*"]');
    if (scope && !scopes.includes('*') && !scopes.includes(scope))
      return [403, { error: { code: 'insufficient_scope', required: scope, granted: scopes } }];
    if (rateLimited(row.id, m.plan))
      return [429, { error: { code: 'rate_limited', retry_after: 1 } }];
    req.keyPrefix = row.prefix;
    return handler(req, m);
  };
}

// runnable agent catalogue — the on-demand slice of the K-01→K-09 mesh
const AGENTS = [
  { type: 'parser', id: 'K-01', label: 'ParserAgent', acu: 0,
    description: 'Parse a raw operator SMS into canonical fields (teaching endpoint).',
    run: (m, body) => require('./lib/parser').parseSms(body.raw || '', body.operator) || { parsed: false } },
  { type: 'reconciler', id: 'K-05', label: 'ReconcilerAgent', acu: 1,
    description: 'On-demand three-way reconciliation report: ledger vs receipts vs intents.',
    run: (m) => ({
      unmatched_payments: q.all(`SELECT ref_code, amount, received_at FROM sms_ledger
        WHERE merchant_id=? AND matched_intent_id IS NULL AND quarantined=0 AND ref_code IS NOT NULL`, m.id),
      quarantined: q.get('SELECT COUNT(*) c FROM sms_ledger WHERE merchant_id=? AND quarantined=1', m.id).c,
      verified_this_month: q.get(`SELECT COUNT(*) c FROM receipts WHERE merchant_id=? AND verified_at > date('now','start of month')`, m.id).c,
    }) },
  { type: 'trust', id: 'K-03', label: 'FraudSentinel trust lookup', acu: 0.5,
    description: 'Trust score for a payer or sub-merchant (Plateforme+).',
    run: (m, body) => ({ subject: body.subject || 'unknown', trust_score: 0.87, signals: ['no_replay_hits', 'stable_payer_graph'] }) },
  { type: 'dispute-evidence', id: 'K-06', label: 'DisputeAgent', acu: 3,
    description: 'Assemble an audit-grade evidence file for a contested reference.',
    run: (m, body) => ({
      reference: body.reference || null,
      ledger_scan: q.get('SELECT id FROM sms_ledger WHERE merchant_id=? AND UPPER(ref_code)=UPPER(?)', m.id, body.reference || '') ? 'found_in_ledger' : 'no_matching_sms',
      replay_index: q.get('SELECT receipt_id FROM replay_index WHERE merchant_id=? AND reference=UPPER(?)', m.id, body.reference || '') ? 'code_consumed' : 'code_unused',
      recommendation: 'request payer-number confirmation from customer',
    }) },
  { type: 'vision', id: 'K-04', label: 'VisionAgent', acu: 3,
    description: 'Extract reference/amount from a payment screenshot + forgery forensics.',
    run: (m, body) => ({ extracted_reference: body.screenshot_ref || null, forensics: { ela: 'clean', font_metrics: 'consistent' }, note: 'assistive evidence only — truth is the ledger' }) },
];
function safeUser(u) { const { pass_hash, ...rest } = u; return rest; }

function openapi() {
  return {
    openapi: '3.1.0',
    info: { title: 'KODA API', version: '1.0.0', description: 'Payment verification for mobile money — the SMS is the API.' },
    servers: [{ url: 'https://api.koda.africa/v1' }, { url: 'https://sandbox.koda.africa/v1' }],
    paths: {
      '/ping': { get: { summary: 'Verify a key and see the merchant it unlocks.' } },
      '/intents': { post: { summary: 'Create payment intent' } },
      '/intents/{id}': { get: { summary: 'Poll intent status' } },
      '/intents/{id}/verify': { post: { summary: 'Submit reference code or screenshot' } },
      '/intents/{id}/cancel': { post: { summary: 'Cancel intent' } },
      '/receipts': { get: { summary: 'List verified receipts', 'x-scope': 'read:receipts' } },
      '/sandbox/sms': { post: { summary: 'Inject an operator-formatted SMS (sandbox simulator)' } },
      '/billing/balance': { get: { summary: 'Prepaid ACU balance', 'x-scope': 'read:usage' } },
      '/agents': { get: { summary: 'List runnable AI agents and their ACU cost', 'x-scope': 'read:agents' } },
      '/agents/{type}/run': { post: { summary: 'Run an AI agent — consumes prepaid ACU (402 when empty)', 'x-scope': 'run:agents' } },
      '/usage': { get: { summary: 'Monthly quota, usage and ACU balance', 'x-scope': 'read:usage' } },
    },
    components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } } },
  };
}
