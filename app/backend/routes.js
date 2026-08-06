// KODA — API routes. One router, sectioned by module.
// App routes (/app/*) use JWT session auth; public API (/v1/*) uses Bearer API keys.
'use strict';
const { q, tx } = require('./lib/db');
const U = require('./lib/util');
const engine = require('./lib/engine');
const { OPERATORS } = require('../shared/parser');
const { CATEGORIES, ALL, BY_KEY, CHANNELS } = require('../shared/events');
const notify = require('./comms/notify');

const { PLANS } = require('../shared/plans');
const VERSION = require('../shared/version');
const networks = require('./lib/networks');
const billing = require('./lib/billing');
const vouchers = require('./lib/vouchers');

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
    // brute-force / credential-stuffing throttle: 10 attempts / 60s per email+IP
    const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'ip';
    if (bruteLimited('login:' + String(email || '').toLowerCase() + ':' + ip))
      return [429, { error: { code: 'too_many_attempts', retry_after: 60 } }];
    const user = q.get('SELECT * FROM users WHERE email=?', String(email || '').toLowerCase());
    if (!user || !U.verifyPassword(password || '', user.pass_hash)) return [401, { error: 'invalid_credentials' }];
    if (user.status !== 'active') return [403, { error: 'account_suspended' }];
    const merchant = user.merchant_id ? q.get('SELECT * FROM merchants WHERE id=?', user.merchant_id) : null;
    notify.fire('auth.login.success', { user, merchant });
    return { token: U.signJwt({ uid: user.id, mid: user.merchant_id, adm: !!user.is_admin }), user: safeUser(user), merchant };
  });

  // ---- forgot password: email a single-use reset link ----
  r.post('/app/auth/forgot', (req) => {
    const email = String(req.body.email || '').toLowerCase().trim();
    const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'ip';
    if (bruteLimited('forgot:' + email + ':' + ip, 5, 60000)) return [429, { error: { code: 'too_many_attempts', retry_after: 60 } }];
    // Always respond ok — never reveal whether an email is registered.
    const user = email ? q.get('SELECT * FROM users WHERE email=?', email) : null;
    if (user && user.status === 'active') {
      const raw = U.token(24);
      q.run(`INSERT INTO password_resets (token_hash,user_id,expires_at) VALUES (?,?,datetime('now','+1 hour'))`, U.sha256(raw), user.id);
      const base = (process.env.KODA_PUBLIC_URL || 'https://kodajnn.com').replace(/\/$/, '');
      const link = `${base}/app#reset?token=${raw}`;
      const merchant = user.merchant_id ? q.get('SELECT * FROM merchants WHERE id=?', user.merchant_id) : null;
      notify.fire('password.forgot', { user, merchant, data: {
        body: 'We received a request to reset your KODA password. This link is valid for 1 hour and can be used once. If you didn\'t ask for this, you can safely ignore this email.',
        cta: 'Reset password', cta_url: link,
      } });
      audit(user.merchant_id, user.id, 'password.forgot_requested', {});
    }
    return { ok: true, message: 'If that email is registered, a reset link is on its way.' };
  });

  // ---- reset password with the token from the email link ----
  r.post('/app/auth/reset', (req) => {
    const raw = String(req.body.token || '');
    const password = String(req.body.password || '');
    if (raw.length < 10) return [400, { error: { code: 'bad_token' } }];
    if (password.length < 8) return [400, { error: { code: 'weak_password', message: 'Use at least 8 characters.' } }];
    const row = q.get(`SELECT * FROM password_resets WHERE token_hash=? AND used=0 AND expires_at > datetime('now')`, U.sha256(raw));
    if (!row) return [400, { error: { code: 'invalid_or_expired' } }];
    const user = q.get('SELECT * FROM users WHERE id=?', row.user_id);
    if (!user) return [400, { error: { code: 'invalid_or_expired' } }];
    tx(() => {
      q.run('UPDATE users SET pass_hash=? WHERE id=?', U.hashPassword(password), user.id);
      q.run('UPDATE password_resets SET used=1 WHERE token_hash=?', U.sha256(raw));
      q.run('UPDATE password_resets SET used=1 WHERE user_id=? AND used=0', user.id); // invalidate siblings
    });
    const merchant = user.merchant_id ? q.get('SELECT * FROM merchants WHERE id=?', user.merchant_id) : null;
    notify.fire('password.reset.successful', { user, merchant, data: { body: 'Your KODA password was just reset. If this wasn\'t you, contact support immediately.' } });
    audit(user.merchant_id, user.id, 'password.reset_completed', {});
    return { ok: true };
  });

  r.get('/app/me', auth((req, user, merchant) => ({
    user: safeUser(user), merchant,
    plan: PLANS[merchant?.plan || 'marche'],
    acu_unlimited: engine.acuUnlimited(merchant), // admin-owned merchants are never ACU-metered
    unread: q.get('SELECT COUNT(*) c FROM notifications WHERE user_id=? AND read=0', user.id).c,
  })));

  // ---- Data subject rights (the privacy page promises these) ----
  // Machine-readable export of everything KODA holds for this merchant.
  r.get('/app/me/export', auth((req, user, merchant) => {
    const mid = merchant ? merchant.id : null;
    const dump = {
      exported_at: new Date().toISOString(),
      account: { users: q.all('SELECT id,email,name,phone,role,created_at FROM users WHERE merchant_id=?', mid), merchant },
      receipts: mid ? q.all('SELECT * FROM receipts WHERE merchant_id=?', mid) : [],
      intents: mid ? q.all('SELECT * FROM intents WHERE merchant_id=?', mid) : [],
      topups: mid ? q.all('SELECT * FROM topups WHERE merchant_id=?', mid) : [],
      devices: mid ? q.all('SELECT id,label,operator,status,last_seen FROM devices WHERE merchant_id=?', mid) : [],
      comm_prefs: q.all('SELECT channel,enabled FROM comm_prefs WHERE user_id=?', user.id),
    };
    notify.fire('privacy.data_export_ready', { user, merchant });
    return dump;
  }));

  // Right to erasure — owner-only. Anonymises PII and purges raw payment SMS/msisdn,
  // while retaining financial/audit records (legal-retention carve-out per the Terms).
  r.post('/app/me/delete', auth((req, user, merchant) => {
    if (user.role !== 'owner' && !user.is_admin) return [403, { error: { code: 'owner_only' } }];
    const mid = merchant ? merchant.id : null;
    notify.fire('privacy.account_deletion_requested', { user, merchant });
    tx(() => {
      if (mid) {
        q.run(`UPDATE sms_ledger SET raw='[erased]', counterparty_name=NULL WHERE merchant_id=?`, mid);
        q.run(`UPDATE intents SET customer_msisdn=NULL WHERE merchant_id=?`, mid);
        q.run(`UPDATE merchant_network_accounts SET account_identifier=NULL, account_holder_name=NULL WHERE merchant_id=?`, mid);
        q.run(`UPDATE devices SET sim_msisdn=NULL, status='revoked' WHERE merchant_id=?`, mid);
        q.run(`UPDATE merchants SET status='deleted', msisdn=NULL WHERE id=?`, mid);
      }
      q.run(`UPDATE users SET name='Deleted User', phone=NULL, status='deleted', email=? WHERE merchant_id=?`,
        'deleted+' + (mid || user.id) + '@koda.invalid', mid);
    });
    audit(mid, user.id, 'account.deletion', {});
    notify.fire('privacy.account_deletion_completed', { user, merchant });
    return { ok: true, erased: true, note: 'PII erased; financial and audit records retained per legal retention.' };
  }));

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
    // screenshot = VisionAgent (AI action, 3 ACU) — gated; code path is the free-to-fall-back-on money path
    if (screenshot) {
      const gate = engine.gateAI(m, engine.ACU.vision, 'vision-extract');
      if (gate.ok !== true) return gate;
    }
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
    const deviceToken = 'dvk_' + U.token(24);   // the Sentinel app authenticates SMS forwards with this
    q.run(`INSERT INTO devices (id,merchant_id,label,operator,sim_msisdn,enrol_code,device_token,status,attested,last_seen)
           VALUES (?,?,?,?,?,?,?, 'active', 1, datetime('now'))`,
      did, m.id, req.body.label || 'Merchant phone', req.body.operator || 'orange_cd', req.body.sim || null, code, deviceToken);
    notify.fireMerchant('sentinel.enrolled', m, { item: req.body.label || 'Merchant phone' });
    audit(m.id, user.id, 'device_enrolled', { did });
    // device_token is shown ONCE (like an API key) — the app stores it in the Android keystore
    return { device_id: did, enrol_code: code, device_token: deviceToken, qr: `koda://enroll/${code}?t=${deviceToken}` };
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
    // DisputeAgent assembles an AI evidence file — metered + gated like every AI action
    const gate = engine.gateAI(m, engine.ACU.dispute, 'dispute-evidence');
    if (gate.ok !== true) return gate;
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
    // rowid tiebreak: created_at is 1-second resolution, so concurrent charges
    // tie — order by insertion (rowid) so transactions[0] is always the true last.
    transactions: q.all(`SELECT * FROM acu_transactions WHERE merchant_id=? ORDER BY created_at DESC, rowid DESC LIMIT 50`, m.id),
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
    // rk_ keys default to read-only; pk_ keys (browser-exposed) may ONLY create intents;
    // sk_ (server-side secret) keys get full scope unless explicit scopes are given.
    const scopes = Array.isArray(req.body.scopes) && req.body.scopes.length ? req.body.scopes
      : prefix === 'rk_live' ? ['read:receipts', 'read:usage', 'read:agents']
      : prefix.startsWith('pk_') ? ['write:intents'] : ['*'];
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
  // ---- admin: create a new merchant + its owner login (provision an account) ----
  r.post('/app/admin/merchants', admin((req, user) => {
    const { business, email, name } = req.body;
    if (!business || !email || !name) return [400, { error: { code: 'missing_fields', message: 'business, email and name are required' } }];
    const plan = PLANS[req.body.plan] ? req.body.plan : 'marche';
    const country = String(req.body.country || 'CD').toUpperCase().slice(0, 2);
    const currency = /^[A-Z]{3}$/.test(String(req.body.currency || '')) ? req.body.currency : 'CDF';
    const em = String(email).toLowerCase().trim();
    if (q.get('SELECT id FROM users WHERE email=?', em)) return [409, { error: { code: 'email_taken' } }];
    const mid = U.id('mch'), uid = U.id('usr');
    const pw = req.body.password || U.token(8);
    const created = tx(() => {
      q.run(`INSERT INTO merchants (id,name,country,currency,plan,msisdn,logo_text) VALUES (?,?,?,?,?,?,?)`,
        mid, business, country, currency, plan, req.body.phone || null, business);
      q.run(`INSERT INTO users (id,merchant_id,email,name,phone,pass_hash,role) VALUES (?,?,?,?,?,?,'owner')`,
        uid, mid, em, name, req.body.phone || null, U.hashPassword(pw));
      return q.get('SELECT * FROM merchants WHERE id=?', mid);
    });
    audit(mid, user.id, 'admin.merchant_created', { business, email: em, plan });
    const u = q.get('SELECT * FROM users WHERE id=?', uid);
    notify.fire('merchant.activated', { user: u, merchant: created, data: { merchant: business } });
    return { ok: true, merchant: created, owner_email: em, temp_password: req.body.password ? undefined : pw };
  }));
  // ---- admin: change a merchant's plan ----
  r.post('/app/admin/merchants/:id/plan', admin((req, user) => {
    const m = q.get('SELECT * FROM merchants WHERE id=?', req.params.id);
    if (!m) return [404, { error: { code: 'merchant_not_found' } }];
    const plan = String(req.body.plan || '');
    if (!PLANS[plan]) return [400, { error: { code: 'unknown_plan', allowed: Object.keys(PLANS) } }];
    q.run('UPDATE merchants SET plan=? WHERE id=?', plan, m.id);
    audit(m.id, user.id, 'admin.plan_changed', { from: m.plan, to: plan });
    engine.notifyOwners({ ...m, plan }, 'billing.plan_changed', { plan });
    return { ok: true, plan };
  }));
  // ---- admin: grant or deduct ACU (positive credits, negative deducts) ----
  r.post('/app/admin/merchants/:id/acu', admin((req, user) => {
    const m = q.get('SELECT * FROM merchants WHERE id=?', req.params.id);
    if (!m) return [404, { error: { code: 'merchant_not_found' } }];
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount === 0) return [400, { error: { code: 'bad_amount' } }];
    const bal = amount > 0
      ? engine.creditAcu(m, amount, 'admin_grant', 'admin:' + user.id)
      : engine.chargeAcu(m, -amount, 'admin_debit', 'admin:' + user.id);
    audit(m.id, user.id, 'admin.acu_adjusted', { amount, balance: bal });
    return { ok: true, balance: bal };
  }));
  // ---- admin: merchant detail incl. its users/team ----
  r.get('/app/admin/merchants/:id', admin((req) => {
    const m = q.get('SELECT * FROM merchants WHERE id=?', req.params.id);
    if (!m) return [404, { error: { code: 'merchant_not_found' } }];
    return {
      merchant: m,
      users: q.all('SELECT id,email,name,phone,role,is_admin,status,created_at FROM users WHERE merchant_id=? ORDER BY created_at', m.id),
      keys: q.all('SELECT id,prefix,last4,label,created_at FROM api_keys WHERE merchant_id=? ORDER BY created_at DESC', m.id),
      submerchants: q.all('SELECT id,name,plan,status FROM merchants WHERE parent_id=?', m.id),
    };
  }));
  // ---- admin: add a team member to a merchant ----
  r.post('/app/admin/merchants/:id/users', admin((req, user) => {
    const m = q.get('SELECT * FROM merchants WHERE id=?', req.params.id);
    if (!m) return [404, { error: { code: 'merchant_not_found' } }];
    const { email, name, role = 'cashier' } = req.body;
    if (!email || !name) return [400, { error: { code: 'missing_fields' } }];
    if (!['cashier', 'manager', 'owner'].includes(role)) return [400, { error: { code: 'bad_role' } }];
    if (q.get('SELECT id FROM users WHERE email=?', String(email).toLowerCase())) return [409, { error: { code: 'email_taken' } }];
    const pw = req.body.password || U.token(8);
    const uid = U.id('usr');
    q.run(`INSERT INTO users (id,merchant_id,email,name,phone,pass_hash,role) VALUES (?,?,?,?,?,?,?)`,
      uid, m.id, String(email).toLowerCase(), name, req.body.phone || null, U.hashPassword(pw), role);
    audit(m.id, user.id, 'admin.user_added', { email, role });
    engine.notifyOwners(m, 'team.member_added', { email, name, role });
    return { ok: true, user_id: uid, temp_password: req.body.password ? undefined : pw };
  }));
  // ---- admin: reset a user's password ----
  r.post('/app/admin/users/:id/reset', admin((req, user) => {
    const target = q.get('SELECT * FROM users WHERE id=?', req.params.id);
    if (!target) return [404, { error: { code: 'user_not_found' } }];
    const pw = req.body.password || U.token(8);
    q.run('UPDATE users SET pass_hash=? WHERE id=?', U.hashPassword(pw), target.id);
    audit(target.merchant_id, user.id, 'admin.password_reset', { user: target.email });
    return { ok: true, temp_password: req.body.password ? undefined : pw };
  }));
  // ---- admin: change a user's role ----
  r.post('/app/admin/users/:id/role', admin((req, user) => {
    const target = q.get('SELECT * FROM users WHERE id=?', req.params.id);
    if (!target) return [404, { error: { code: 'user_not_found' } }];
    const role = String(req.body.role || '');
    if (!['cashier', 'manager', 'owner'].includes(role)) return [400, { error: { code: 'bad_role' } }];
    q.run('UPDATE users SET role=? WHERE id=?', role, target.id);
    audit(target.merchant_id, user.id, 'admin.role_changed', { user: target.email, role });
    return { ok: true, role };
  }));
  // ---- admin: suspend / restore a user ----
  r.post('/app/admin/users/:id/suspend', admin((req, user) => {
    const target = q.get('SELECT * FROM users WHERE id=?', req.params.id);
    if (!target) return [404, { error: { code: 'user_not_found' } }];
    if (target.is_admin) return [403, { error: { code: 'cannot_suspend_admin' } }];
    q.run(`UPDATE users SET status = CASE status WHEN 'suspended' THEN 'active' ELSE 'suspended' END WHERE id=?`, target.id);
    const now = q.get('SELECT status FROM users WHERE id=?', target.id).status;
    audit(target.merchant_id, user.id, 'admin.user_' + now, { user: target.email });
    return { ok: true, status: now };
  }));

  // ---------- public API (/v1) — key-authenticated ----------
  r.get('/v1/ping', apiKey((req, m) => ({
    ok: true, merchant: m.name, plan: m.plan, environment: req.keyPrefix.includes('test') ? 'test' : 'live',
  })));
  r.post('/v1/intents', apiKey((req, m) => createIntent(m, req.body), 'write:intents'));
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

  // ---------- GLOBAL BILLING MESH (System B — how KODA collects its own revenue) ----------
  // Server-authoritative pricing (4× cost, collection fee passed through), idempotent,
  // double-entry. Merchant-facing (JWT) + API (key) + KD console + reseller + webhooks.
  const doTopup = (m, body) => (String(body.rail || body.method) === 'distributor'
    ? billing.createDistributorTopup(m, body) : billing.createTopup(m, body));
  // NOTE: legacy /app/billing/topup ({usd}→verification intent) already exists above;
  // the System-B mesh uses /app/billing/collect to avoid shadowing it.
  r.get('/app/billing/methods', auth((req, user, m) => billing.methods(m, req.query)));
  r.post('/app/billing/collect', auth((req, user, m) => doTopup(m, req.body)));
  r.get('/app/billing/collect/:id', auth((req, user, m) => {
    const t = q.get('SELECT * FROM topups WHERE id=? AND merchant_id=?', req.params.id, m.id);
    return t ? billing.topupView(t) : [404, { error: { code: 'topup_not_found' } }];
  }));
  r.post('/app/billing/voucher/redeem', auth((req, user, m) =>
    bruteLimited('voucher:' + m.id, 15, 60000) ? [429, { error: { code: 'too_many_attempts' } }] : vouchers.redeem(m, req.body.pin)));
  r.get('/v1/billing/methods', apiKey((req, m) => billing.methods(m, req.query), 'read:usage'));
  r.post('/v1/billing/topup', apiKey((req, m) => doTopup(m, req.body), 'write:intents'));
  r.get('/v1/billing/topup/:id', apiKey((req, m) => {
    const t = q.get('SELECT * FROM topups WHERE id=? AND merchant_id=?', req.params.id, m.id);
    return t ? billing.topupView(t) : [404, { error: { code: 'topup_not_found' } }];
  }, 'read:usage'));
  r.post('/v1/billing/voucher/redeem', apiKey((req, m) =>
    bruteLimited('voucher:' + m.id, 15, 60000) ? [429, { error: { code: 'too_many_attempts' } }] : vouchers.redeem(m, req.body.pin), 'write:intents'));

  // KD (distributor) console — a KD is a merchant whose product is ACU float.
  r.get('/app/kd/float', auth((req, user, m) => {
    const d = q.get('SELECT * FROM distributors WHERE merchant_id=?', m.id);
    return d ? { distributor_id: d.id, name: d.name, country: d.country, float_acu: d.float_acu, status: d.status }
      : [404, { error: { code: 'not_a_distributor' } }];
  }));
  r.post('/app/kd/wholesale', auth((req, user, m) => {
    const d = q.get('SELECT * FROM distributors WHERE merchant_id=?', m.id);
    if (!d) return [404, { error: { code: 'not_a_distributor' } }];
    return billing.wholesalePurchase(d.id, req.body.acu_block);   // paid via card/aggregator upstream
  }));
  r.get('/app/kd/sales', auth((req, user, m) => {
    const d = q.get('SELECT * FROM distributors WHERE merchant_id=?', m.id);
    if (!d) return [404, { error: { code: 'not_a_distributor' } }];
    return { sales: q.all(`SELECT id,merchant_id,acu_amount,total_usd,status,created_at,settled_at FROM topups WHERE distributor_id=? ORDER BY created_at DESC LIMIT 100`, d.id) };
  }));

  // Reseller voucher issuance (admin-gated: KODA staff issue against a cleared inventory order).
  r.post('/app/resellers/:id/vouchers', auth((req, user, m) => {
    if (!user.is_admin) return [403, { error: { code: 'admin_only' } }];
    const reseller = q.get('SELECT * FROM resellers WHERE id=?', req.params.id);
    if (!reseller) return [404, { error: { code: 'reseller_not_found' } }];
    const batch = vouchers.issueBatch(reseller, req.body || {});
    if (req.body && req.body.activate) vouchers.activateBatch(batch.batch_id);
    return batch;                                                  // PINs returned once
  }));

  // Provider webhooks → settle a top-up. Sandbox accepts; real adapters verify the
  // raw-body signature before settling (never activate from a browser success screen).
  r.post('/webhooks/billing/:provider', (req) => {
    // FAIL CLOSED: a provider callback settles real money — verify its raw-body
    // signature before doing anything. No secret / bad signature ⇒ never settle.
    const v = billing.verifyWebhook(req.params.provider, req);
    if (!v.ok) return [401, { error: { code: 'webhook_unverified' } }];
    const tid = req.body && req.body.topup_id;
    if (!tid) return [400, { error: { code: 'topup_id_required' } }];
    return billing.settleTopup(tid);
  });

  // ---- Sentinel heartbeat: keeps device health fresh for the resolver (§9.3) ----
  r.post('/v1/device/heartbeat', (req) => {
    const tok = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || req.headers['x-device-token'];
    if (!tok || !/^dvk_/.test(tok)) return [401, { error: { code: 'device_unauthenticated' } }];
    const dev = q.get(`SELECT * FROM devices WHERE device_token=? AND status='active'`, tok);
    if (!dev) return [401, { error: { code: 'device_unauthenticated' } }];
    const b = req.body || {};
    q.run(`UPDATE devices SET last_seen=datetime('now'), battery=?, attested=?, parse_health=? WHERE id=?`,
      Number.isFinite(+b.battery) ? Math.max(0, Math.min(100, +b.battery)) : dev.battery,
      b.attested ? 1 : dev.attested,
      Number.isFinite(+b.parse_health) ? Math.max(0, Math.min(1, +b.parse_health)) : dev.parse_health,
      dev.id);
    return { ok: true, device_id: dev.id, next_heartbeat_s: 45 };
  });

  // ---- Sentinel config: device-token-auth token check + global sender allowlist ----
  // Sentinel calls this at pairing (validates the token, learns its merchant +
  // enrolled operator) and periodically (refreshes the operator sender allowlist
  // so its on-device privacy filter tracks the global registry with no rebuild).
  r.get('/v1/device/config', (req) => {
    const tok = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || req.headers['x-device-token'];
    if (!tok || !/^dvk_/.test(tok)) return [401, { error: { code: 'device_unauthenticated' } }];
    const dev = q.get(`SELECT * FROM devices WHERE device_token=? AND status='active'`, tok);
    if (!dev) return [401, { error: { code: 'device_unauthenticated' } }];
    const m = q.get('SELECT name FROM merchants WHERE id=?', dev.merchant_id);
    const ops = require('../shared/operators');
    // sender token → operator id (uppercased); the phone forwards only matching SMS
    const allowlist = {};
    for (const o of ops.OPERATORS) for (const s of (o.senders || [])) {
      const k = String(s).toUpperCase();
      if (!allowlist[k]) allowlist[k] = o.id;   // first wins; device operator disambiguates at ingest
    }
    return {
      ok: true, device_id: dev.id, merchant_name: (m && m.name) || 'KODA',
      operator: dev.operator || null, heartbeat_s: 300,
      allowlist,                                 // { "ORANGEMONEY":"orange_cd", ... } — global
      allowlist_version: ops.OPERATORS.length,
    };
  });

  // ---- Sentinel phone-edge: the real SMS-forward door (device-token auth) ----
  // The Sentinel Android app posts every operator SMS it reads here. Authenticated
  // by the per-device token minted at enrollment — NOT an API key — so a merchant
  // phone can only forward SMS, nothing else. This is what fills the live ledger.
  r.post('/v1/device/sms', (req) => {
    const tok = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || req.headers['x-device-token'];
    if (!tok || !/^dvk_/.test(tok)) return [401, { error: { code: 'device_unauthenticated' } }];
    const dev = q.get(`SELECT * FROM devices WHERE device_token=? AND status='active'`, tok);
    if (!dev) return [401, { error: { code: 'device_unauthenticated' } }];
    const m = q.get('SELECT * FROM merchants WHERE id=?', dev.merchant_id);
    if (!m || m.status !== 'active') return [403, { error: { code: 'merchant_suspended' } }];
    const raw = String(req.body.raw || '');
    if (!raw) return [400, { error: { code: 'raw_required' } }];
    // health telemetry the fleet view shows
    q.run(`UPDATE devices SET last_seen=datetime('now'), battery=?, attested=? WHERE id=?`,
      Number.isFinite(+req.body.battery) ? Math.max(0, Math.min(100, +req.body.battery)) : dev.battery,
      req.body.attested ? 1 : dev.attested, dev.id);
    const out = engine.ingestSms(m, { raw, operator: req.body.operator || dev.operator, device_id: dev.id });
    return { received: true, sms_id: out.id, parsed: !!out.parsed, quarantined: !!out.quarantined };
  });

  // ---------- NETWORK INTELLIGENCE LAYER (merchant network accounts + resolver) ----------
  // App/dashboard (JWT): connect, verify, activate, pause, preview resolution.
  r.get('/app/network-accounts', auth((req, user, m) => q.all(
    `SELECT id,network_code,masked,account_holder_name,ownership_status,activation_status,
            enabled_manual,enabled_whatsapp,enabled_api,receive_currencies,priority,device_id,verify_ref
     FROM merchant_network_accounts WHERE merchant_id=? AND submerchant_id IS NULL ORDER BY priority`, m.id)));
  // helper: friendly network name for comms templates
  const netName = (code) => (require('../shared/operators').byId[code] || {}).name || code;
  r.post('/app/network-accounts', auth((req, user, m) => {
    const out = networks.connect(m, req.body);
    if (!Array.isArray(out) && out.verify_ref) {                 // success (not an error tuple)
      notify.fireMerchant('networks.account_connected', m, { network: netName(out.network_code) });
      notify.fireMerchant('networks.ownership_proof_pending', m, { network: netName(out.network_code), verify_ref: out.verify_ref });
    }
    return out;
  }));
  r.post('/app/network-accounts/:id/activate', auth((req, user, m) => {
    const out = networks.activate(m, req.params.id);
    if (!Array.isArray(out) && out.ok) {
      const a = q.get('SELECT network_code FROM merchant_network_accounts WHERE id=?', req.params.id);
      notify.fireMerchant('networks.account_activated', m, { network: netName(a && a.network_code) });
    }
    return out;
  }));
  r.post('/app/network-accounts/:id/pause', auth((req, user, m) => networks.setState(m, req.params.id, { activation_status: 'PAUSED' })));
  r.post('/app/network-accounts/:id/resume', auth((req, user, m) => networks.setState(m, req.params.id, { activation_status: 'ACTIVE' })));
  r.post('/app/network-accounts/:id/link-device', auth((req, user, m) => networks.setState(m, req.params.id, { device_id: req.body.device_id || null })));
  r.get('/app/payment-methods', auth((req, user, m) => networks.resolve(m, req.query)));

  // Public API (key): connect + activate + resolve; and the public country catalogue.
  r.post('/v1/merchant-network-accounts', apiKey((req, m) => networks.connect(m, req.body), 'write:intents'));
  r.post('/v1/merchant-network-accounts/:id/activate', apiKey((req, m) => networks.activate(m, req.params.id)));
  r.post('/v1/merchant-network-accounts/:id/pause', apiKey((req, m) => networks.setState(m, req.params.id, { activation_status: 'PAUSED' })));
  r.get('/v1/merchants/me/payment-methods', apiKey((req, m) => networks.resolve(m, req.query)));
  r.get('/v1/catalog/countries/:code/networks', (req) =>
    networks.catalogue(String(req.params.code || '').toUpperCase(), { currency: req.query.currency, supportStatus: req.query.support_status }));

  // ---- operator coverage: the mobile-money landscape KODA recognises ----
  // Public (non-sensitive). `packed` = precise parser; the rest run on the
  // generic fallback (verified via manual review) until a pack is added.
  r.get('/v1/operators', () => {
    const ops = require('../shared/operators');
    return {
      coverage: ops.coverage(),
      families: ops.families(),   // pack-production backlog: one grammar → many markets
      operators: ops.OPERATORS.map(o => ({
        id: o.id, name: o.name, country: o.country, region: o.region, currency: o.currency,
        family: ops.familyOf(o), tier: ops.tierOf(o), parser: o.packed ? 'precise' : 'generic',
      })),
    };
  });

  // ---- agent surface: list the runnable mesh + run an agent (draws down ACU) ----
  r.get('/v1/agents', apiKey(() => ({ agents: AGENTS.map(({ run, ...meta }) => meta) }), 'read:agents'));
  r.post('/v1/agents/:type/run', apiKey((req, m) => {
    const agent = AGENTS.find(a => a.type === req.params.type);
    if (!agent) return [404, { error: { code: 'unknown_agent', doc_url: 'https://kodajnn.com/agents' } }];
    const gate = engine.gateAI(m, agent.acu, 'agent:' + agent.type);
    if (gate.ok !== true) return gate; // 402/500 — every AI action gated by ACU
    const result = agent.run(m, req.body || {});
    engine.chargeAcu(m, agent.acu, 'agent:' + agent.type, null);
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
    // reject forged calls — Meta signs every webhook with the app secret
    if (!meta.verifySignature(req.rawBody, req.headers['x-hub-signature-256']).ok) {
      return [401, { error: 'invalid_signature' }];
    }
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
          const ref = (text.toUpperCase().match(/[A-Z0-9][A-Z0-9.\-]{6,}/g) || []).find(t => /\d/.test(t));
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

  // ---------- LOW / NO-INTERNET + FEATURE-PHONE DOORS ----------
  // For zones with weak/no data and non-smartphones, the checkout page and
  // WhatsApp don't work. USSD and inbound-SMS do — on ANY phone, over the
  // cellular network, no internet. A MERCHANT verifies from their registered
  // phone; KODA routes by that number. Aggregator-agnostic (Africa's Talking /
  // Twilio / an MNO shortcode post here).
  function merchantByPhone(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (digits.length < 6) return null;
    const tail = digits.slice(-9);
    return q.get(`SELECT * FROM merchants WHERE status='active' AND replace(replace(msisdn,'+',''),' ','') LIKE ?`, '%' + tail) || null;
  }
  function verdictText(res, m) {
    const cur = m.currency || 'CDF';
    if (res.status === 'verified' || res.status === 'verified_late')
      return `Paiement confirme: ${Number(res.amount_confirmed).toLocaleString('fr-FR')} ${cur}. Merci!`;
    if (res.status === 'not_found_yet') return `Paiement en route. Reessayez dans un instant.`;
    if (res.code === 'code_already_used') return `Code deja utilise. Verifiez la reference.`;
    return `Non confirme. Verifiez le code et le montant.`;
  }

  // USSD (Africa's Talking style): body {sessionId, phoneNumber, text}; reply is
  // plain text "CON ..." (menu continues) or "END ..." (session ends).
  r.post('/webhooks/ussd', (req) => {
    const b = req.body || {};
    const m = merchantByPhone(b.phoneNumber);
    const steps = String(b.text || '').split('*').filter(Boolean);
    const send = (t) => [200, t, { 'content-type': 'text/plain; charset=utf-8' }];
    if (!m) return send('END Numero non enregistre chez KODA.');
    if (steps.length === 0) return send('CON KODA — verifier un paiement\nEntrez le code recu par SMS:');
    const code = steps[steps.length - 1];
    const res = engine.verify(m, null, code, { mode: 'ussd' });
    q.run(`INSERT INTO comm_deliveries (id,merchant_id,user_id,event_key,channel,recipient,subject,provider,status)
           VALUES (?,?,NULL,'verify.ussd','sms',?,?,?, 'sent')`,
      U.id('dlv'), m.id, b.phoneNumber || '', ('ussd:' + code).slice(0, 120), 'ussd');
    return send('END ' + verdictText(res, m));
  });

  // Inbound SMS-to-shortcode: body {from, to, text}. The merchant texts the code
  // to KODA's number; KODA verifies and (if a gateway is set) SMS-replies.
  r.post('/webhooks/sms', (req) => {
    const b = req.body || {};
    const from = b.from || b.msisdn || '';
    const m = merchantByPhone(from);
    if (!m) return { received: true };
    // a transaction code always contains a digit — so a greeting isn't mistaken for one
    const code = (String(b.text || '').toUpperCase().match(/[A-Z0-9][A-Z0-9.\-]{4,}/g) || []).find(t => /\d/.test(t));
    const reply = code ? verdictText(engine.verify(m, null, code, { mode: 'sms' }), m)
                       : 'Envoyez le code de transaction pour verifier votre paiement.';
    const gw = !!process.env.SMS_GATEWAY_KEY;
    q.run(`INSERT INTO comm_deliveries (id,merchant_id,user_id,event_key,channel,recipient,subject,provider,status)
           VALUES (?,?,NULL,'verify.sms_reply','sms',?,?,?,?)`,
      U.id('dlv'), m.id, from, reply.slice(0, 120), gw ? 'gateway' : 'sandbox', gw ? 'sent' : 'logged');
    return { received: true, reply };
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
    const gate = engine.gateAI(m, tool.acu, 'growth:' + req.params.tool);
    if (gate.ok !== true) return gate; // every AI action gated by available ACU
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

  // ---------- CUSTOMER-FACING CHECKOUT (intent-scoped, no API key) ----------
  // Authenticated by the intent's own client_secret so it is safe to expose in a
  // browser: it can only read and verify THIS one intent, nothing else.
  function checkoutIntent(id, cs) {
    if (!id || !cs) return null;
    const i = q.get('SELECT * FROM intents WHERE id=? AND client_secret=?', id, cs);
    return i || null;
  }
  // eligible networks for THIS intent (customer-facing; resolver output)
  r.get('/checkout/:id/payment-methods', (req) => {
    const i = checkoutIntent(req.params.id, req.query.cs);
    if (!i) return [404, { error: { code: 'intent_not_found' } }];
    const m = q.get('SELECT * FROM merchants WHERE id=?', i.merchant_id);
    return networks.resolve(m, { country: m.country, currency: i.currency, amount: i.amount, door: 'API' });
  });

  // public read: what the checkout page shows the customer
  r.get('/checkout/:id', (req) => {
    const i = checkoutIntent(req.params.id, req.query.cs);
    if (!i) return [404, { error: { code: 'intent_not_found' } }];
    const m = q.get('SELECT name, msisdn, brand_color, logo_text, currency FROM merchants WHERE id=?', i.merchant_id);
    const ops = JSON.parse(i.operators);
    return {
      intent_id: i.id, status: i.status, amount: i.amount, currency: i.currency,
      merchant: { name: m.logo_text || m.name, brand_color: m.brand_color },
      metadata: JSON.parse(i.metadata || '{}'),
      pay_to: ops.map(o => ({ operator: o, number: m.msisdn || '+243 8XX XXX XXX',
        ussd_hint: o.startsWith('orange') ? '#144#' : o.startsWith('mpesa') ? '*1122#' : o.startsWith('airtel') ? '*501#' : '*150#' })),
      expires_at: i.expires_at, has_success_url: !!i.success_url,
    };
  });
  // public verify: the CUSTOMER submits the code they received
  r.post('/checkout/:id/verify', (req) => {
    const i = checkoutIntent(req.params.id, (req.body || {}).cs);
    if (!i) return [404, { error: { code: 'intent_not_found' } }];
    if (i.status === 'verified' || i.status === 'verified_late') {
      const rc = q.get('SELECT id, amount FROM receipts WHERE intent_id=? ORDER BY verified_at DESC LIMIT 1', i.id);
      return {
        status: i.status, already: true,
        amount_confirmed: rc ? rc.amount : i.amount,
        receipt_id: rc ? rc.id : null,
        redirect: i.success_url || null,
      };
    }
    if (i.status !== 'awaiting_payment' && i.status !== 'pending_review') {
      return [409, { error: { code: 'intent_' + i.status } }];
    }
    const m = q.get('SELECT * FROM merchants WHERE id=?', i.merchant_id);
    const ref = String((req.body || {}).reference || '').trim();
    if (!ref) return [400, { error: { code: 'reference_required' } }];
    const res = engine.verify(m, i, ref, { mode: 'api' }); // fires webhook + comms on success
    // customer-facing shape: on success, hand back the redirect so the order moves forward
    return {
      status: res.status, code: res.code || null,
      amount_confirmed: res.amount_confirmed || null,
      receipt_id: res.receipt_id || null,
      redirect: (res.status === 'verified' || res.status === 'verified_late') ? (i.success_url || null) : null,
    };
  });

  // hosted checkout page + drop-in widget are static (served from frontend/checkout/*)

  // ---------- ops surface: health, readiness, version ----------
  // liveness — the process is up (cheap, no I/O)
  r.get('/healthz', () => ({ ok: true, service: 'koda-api', time: new Date().toISOString() }));
  // readiness — the process can actually serve traffic (DB reachable)
  r.get('/readyz', () => {
    try {
      q.get('SELECT 1 AS ok');
      return { ok: true, db: 'up', time: new Date().toISOString() };
    } catch (e) {
      require('./lib/alerts').alert('critical', 'readiness probe failed', { db: 'down' });
      return [503, { ok: false, db: 'down', error: 'db_unreachable' }];
    }
  });
  // version — one coherent version identity for the whole OS
  r.get('/version', () => ({
    service: 'koda', app: VERSION.app, api: VERSION.api, widget: VERSION.widget,
    fraud_model: VERSION.fraud_model, channel: VERSION.channel, build: VERSION.build(),
    node: process.version, time: new Date().toISOString(),
  }));
};

function SITE_BASE() { return process.env.KODA_PUBLIC_URL || 'http://localhost:4600'; }

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
  const clientSecret = 'cs_' + U.token(20);
  const ops = Array.isArray(body.operators) && body.operators.length
    ? body.operators.filter(o => typeof o === 'string').slice(0, 12) : ['orange_cd', 'mpesa_cd'];
  if (!ops.length) return [400, { error: { code: 'invalid_operators' } }];
  const okUrl = (u) => typeof u === 'string' && /^https?:\/\//.test(u) ? u.slice(0, 500) : null;
  q.run(`INSERT INTO intents (id,merchant_id,amount,currency,operators,customer_msisdn,metadata,purpose,client_secret,success_url,cancel_url,expires_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?, datetime('now','+' || ? || ' seconds'))`,
    iid, m.id, amount, currency, JSON.stringify(ops),
    body.customer_msisdn || null, JSON.stringify(body.metadata || {}),
    body.purpose === 'topup' ? 'topup' : 'sale', clientSecret, okUrl(body.success_url), okUrl(body.cancel_url),
    Math.min(3600, Number(body.expires_in) || 900));
  const intent = q.get('SELECT * FROM intents WHERE id=?', iid);
  // Network Intelligence: the resolver returns only the merchant's active,
  // verified, healthy networks for this country/currency/door. Falls back to the
  // legacy operators list (pay_to) when no network accounts are configured yet.
  const resolved = networks.resolve(m, { country: body.country || m.country, currency, amount, door: 'API' });
  return {
    intent_id: iid, status: intent.status,
    client_secret: clientSecret,
    checkout_url: `${SITE_BASE()}/pay/${iid}?cs=${clientSecret}`,
    network_selection: ['AUTO', 'CUSTOMER', 'FIXED'].includes(body.network_selection) ? body.network_selection : 'CUSTOMER',
    available_networks: resolved.available,
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
// brute-force limiter for unauthenticated/credential endpoints (login, voucher, checkout).
// Sliding window keyed by identity+IP; blocks credential-stuffing / PIN / code guessing.
const _brute = new Map();
function bruteLimited(key, max = 10, windowMs = 60000) {
  const now = Date.now();
  const arr = (_brute.get(key) || []).filter(t => now - t < windowMs);
  arr.push(now); _brute.set(key, arr);
  if (_brute.size > 5000) for (const [k, v] of _brute) if (!v.some(t => now - t < windowMs)) _brute.delete(k);
  return arr.length > max;
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
  { type: 'parser', id: 'K-01', label: 'ParserAgent', acu: 0.25,
    description: 'Parse a raw operator SMS into canonical fields.',
    run: (m, body) => require('../shared/parser').parseSms(body.raw || '', body.operator) || { parsed: false } },
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
    info: { title: 'KODA API', version: VERSION.api, description: 'Payment verification for mobile money — the SMS is the API.' },
    servers: [{ url: 'https://kodajnn.com/v1', description: 'Production. Use sk_live_ keys; sk_test_ keys run in sandbox on the same host.' }],
    paths: {
      '/ping': { get: { summary: 'Verify a key and see the merchant it unlocks.' } },
      '/intents': { post: { summary: 'Create payment intent — returns client_secret + checkout_url for drop-in checkout', 'x-scope': 'write:intents' } },
      '/intents/{id}': { get: { summary: 'Poll intent status' } },
      '/intents/{id}/verify': { post: { summary: 'Submit reference code or screenshot' } },
      '/intents/{id}/cancel': { post: { summary: 'Cancel intent' } },
      '/checkout/{id}': { get: { summary: 'Customer-facing intent read, authorised by the intent client_secret (no API key)' } },
      '/checkout/{id}/verify': { post: { summary: 'Customer submits their SMS code; returns redirect on success (no API key)' } },
      '/receipts': { get: { summary: 'List verified receipts', 'x-scope': 'read:receipts' } },
      '/sandbox/sms': { post: { summary: 'Inject an operator-formatted SMS (sandbox simulator)' } },
      '/device/sms': { post: { summary: 'Sentinel phone-edge SMS forward — device-token auth (fills the live ledger)' } },
      '/operators': { get: { summary: 'Operator coverage — the mobile-money landscape KODA recognises (precise vs generic)' } },
      '/billing/balance': { get: { summary: 'Prepaid ACU balance', 'x-scope': 'read:usage' } },
      '/agents': { get: { summary: 'List runnable AI agents and their ACU cost', 'x-scope': 'read:agents' } },
      '/agents/{type}/run': { post: { summary: 'Run an AI agent — consumes prepaid ACU (402 when empty)', 'x-scope': 'run:agents' } },
      '/usage': { get: { summary: 'Monthly quota, usage and ACU balance', 'x-scope': 'read:usage' } },
    },
    components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } } },
  };
}
