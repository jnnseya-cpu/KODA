// KODA — API routes. One router, sectioned by module.
// App routes (/app/*) use JWT session auth; public API (/v1/*) uses Bearer API keys.
'use strict';
const { q, tx } = require('./lib/db');
const U = require('./lib/util');
const engine = require('./lib/engine');
const { OPERATORS, parseSms } = require('../shared/parser');
const { CATEGORIES, ALL, BY_KEY, CHANNELS } = require('../shared/events');
const notify = require('./comms/notify');

const { PLANS } = require('../shared/plans');
const VERSION = require('../shared/version');
const networks = require('./lib/networks');
const trustNet = require('./lib/trust_network');   // ADD-ON B: cross-merchant trust/fraud network
const crosscheck = require('./lib/crosscheck');     // ADD-ON A: operator-API dual-confirm
const security = require('./lib/security');         // SecurityAgent: human gate + anti-abuse
const billing = require('./lib/billing');
const vouchers = require('./lib/vouchers');
const analytics = require('./lib/analytics');       // server-side conversion forwarding (Meta CAPI + GA4 MP), env-gated

// role gate: owners always pass, KODA staff always pass
function needRole(user, roles) { return user.is_admin || user.role === 'owner' || roles.includes(user.role); }

function audit(mid, uid, action, detail) {
  q.run('INSERT INTO audit_log (id,merchant_id,user_id,action,detail) VALUES (?,?,?,?,?)',
    U.id('aud'), mid || null, uid || null, action, detail ? JSON.stringify(detail) : null);
}

module.exports = function registerRoutes(r) {
  // ---------- auth ----------
  // SecurityAgent: a signed proof-of-work challenge the signup/login forms solve
  // to prove a human (not a bot) is on the other end. Stateless + public.
  r.get('/app/auth/challenge', () => security.issueChallenge());

  r.post('/app/auth/signup', (req) => {
    const ip = security.clientIp(req.headers);
    const gate = security.humanCheck(req.body, ip); if (gate.ok !== true) return gate; // honeypot + proof-of-work
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
    // Referral growth loop: give this merchant a share code, and link them to
    // whoever referred them (?ref=CODE) so both are rewarded on first verify.
    try { const referrals = require('./lib/referrals'); referrals.ensureCode(mid); referrals.attach(mid, req.body.ref || req.body.referral_code); } catch { /* growth optional */ }
    notify.fire('account.registration.requested', { user, merchant });
    notify.fire('cs.onboarding_started', { user, merchant });
    audit(mid, uid, 'signup', { business });
    analytics.merchantSignup(mid);   // server-side conversion (env-gated; no PII)
    return { token: U.signJwt({ uid, mid }), user: safeUser(user), merchant };
  });

  r.post('/app/auth/login', (req) => {
    const { email, password } = req.body;
    // brute-force / credential-stuffing throttle: 10 attempts / 60s per email+IP
    const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'ip';
    const gate = security.humanCheck(req.body, security.clientIp(req.headers)); if (gate.ok !== true) return gate; // honeypot + proof-of-work
    if (bruteLimited('login:' + String(email || '').toLowerCase() + ':' + ip))
      return [429, { error: { code: 'too_many_attempts', retry_after: 60 } }];
    const user = q.get('SELECT * FROM users WHERE email=?', String(email || '').toLowerCase());
    if (!user || !U.verifyPassword(password || '', user.pass_hash)) { security.record('bad_login', security.clientIp(req.headers), { email: String(email || '').slice(0, 60) }); return [401, { error: 'invalid_credentials' }]; }
    if (user.status !== 'active') return [403, { error: 'account_suspended' }];
    const merchant = user.merchant_id ? q.get('SELECT * FROM merchants WHERE id=?', user.merchant_id) : null;
    // A suspended MERCHANT blocks all its users' access (admins/KODA staff exempt).
    if (merchant && merchant.status !== 'active' && !user.is_admin) return [403, { error: 'account_suspended' }];
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

  // ---- change my own password (logged in — e.g. after a temp password) ----
  r.post('/app/account/password', auth((req, user, merchant) => {
    if (!U.verifyPassword(String(req.body.current_password || ''), user.pass_hash))
      return [403, { error: { code: 'wrong_current_password', message: 'Current password is incorrect.' } }];
    const nw = String(req.body.new_password || '');
    if (nw.length < 8) return [400, { error: { code: 'weak_password', message: 'Use at least 8 characters.' } }];
    q.run('UPDATE users SET pass_hash=? WHERE id=?', U.hashPassword(nw), user.id);
    notify.fire('password.reset.successful', { user, merchant, data: { body: 'Your KODA password was just changed. If this wasn’t you, contact support immediately.' } });
    audit(user.merchant_id, user.id, 'password.changed', {});
    return { ok: true };
  }));

  // ---- edit business profile: pay-to number (what customers pay), name, brand ----
  // The mobile-money number here is shown on the customer checkout as the pay-to
  // destination — the simplest way to accept payments without the Sentinel/Network flow.
  r.post('/app/settings/profile', auth((req, user, m) => {
    if (!m) return [400, { error: { code: 'no_merchant' } }];
    if (!needRole(user, ['manager'])) return [403, { error: { code: 'manager_or_owner_only' } }];
    const msisdn = typeof req.body.msisdn === 'string' ? (req.body.msisdn.trim().slice(0, 32) || null) : m.msisdn;
    const name = (typeof req.body.name === 'string' && req.body.name.trim()) ? req.body.name.trim().slice(0, 120) : m.name;
    const brand = (typeof req.body.brand_color === 'string' && /^#[0-9a-fA-F]{6}$/.test(req.body.brand_color)) ? req.body.brand_color : m.brand_color;
    q.run('UPDATE merchants SET msisdn=?, name=?, brand_color=? WHERE id=?', msisdn, name, brand, m.id);
    audit(m.id, user.id, 'profile_updated', { has_msisdn: !!msisdn });
    return { ok: true, merchant: q.get('SELECT * FROM merchants WHERE id=?', m.id) };
  }));

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
      // The console operator types the amount the way the SMS shows it ("5.89");
      // intents store MINOR units, so convert on the way in or the engine's amount
      // guard would reject every manual USD verification 100× over.
      const { toMinor } = require('../shared/currency');
      q.run(`INSERT INTO intents (id,merchant_id,amount,currency,operators,status,expires_at,metadata)
             VALUES (?,?,?,?,?, 'awaiting_payment', datetime('now','+15 minutes'), ?)`,
        iid, m.id, toMinor(amt, m.currency), m.currency, JSON.stringify(OPERATORS.map(o => o.id)),
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
  // Paste-the-SMS verify: the universal path for merchants whose device can't run
  // Sentinel (iPhone reads no SMS; feature phones run no app). The merchant copies the
  // WHOLE operator SMS into the PWA — KODA ingests it (the real proof) and verifies in
  // one step. Strictly better than typing a code: KODA gets the verifiable SMS, not digits.
  r.post('/app/verify-sms', auth((req, user, m) => {
    const raw = String((req.body || {}).raw || '').trim();
    if (!raw) return [400, { error: 'empty_sms' }];
    const ing = engine.ingestSms(m, { raw, operator: req.body.operator });
    if (!ing.parsed) return { status: 'unparseable', code: 'not_an_operator_sms' };
    if (ing.quarantined) return { status: 'rejected', code: 'sms_quarantined' };
    // ingestSms auto-verifies the walk-in (ing.auto) or auto-matched a pending intent.
    const out = ing.auto || { status: 'verified', auto: true };
    if (out.status === 'verified' && out.receipt_id) audit(m.id, user.id, 'sms_pasted_verified', { receipt_id: out.receipt_id });
    return out;
  }));
  // One-tap confirm from the feed: issue a receipt for a Sentinel-captured payment
  // with no typing. Same fraud policy and receipt as the console — just no code entry.
  r.post('/app/feed/:id/confirm', auth((req, user, m) => {
    const out = engine.confirmLedgerPayment(m, req.params.id, { userId: user.id });
    if (out.status === 'verified') audit(m.id, user.id, 'feed_payment_confirmed', { sms_id: req.params.id, receipt_id: out.receipt_id });
    if (out.status === 'error') return [out.code === 'sms_not_found' ? 404 : 409, { error: out.code, trace: out.trace }];
    return out;
  }));

  // ---------- devices (Sentinel fleet) ----------
  r.get('/app/devices', auth((req, user, m) => q.all('SELECT * FROM devices WHERE merchant_id=?', m.id)));
  r.post('/app/devices/enroll', auth((req, user, m) => {
    const did = U.id('dev'), code = U.token(6).slice(0, 8).toUpperCase();
    const deviceToken = 'dvk_' + U.token(24);   // the Sentinel app authenticates SMS forwards with this
    // Enrolled but NOT yet online: 'pending' until the real phone sends its first
    // heartbeat (which flips it to 'active' + real attestation). No phantom "active,
    // attested, 100% health" device before a handset actually pairs.
    q.run(`INSERT INTO devices (id,merchant_id,label,operator,sim_msisdn,enrol_code,device_token,status,attested,last_seen)
           VALUES (?,?,?,?,?,?,?, 'pending', 0, NULL)`,
      did, m.id, req.body.label || 'Merchant phone', req.body.operator || 'orange_cd', req.body.sim || null, code, deviceToken);
    notify.fireMerchant('sentinel.enrolled', m, { item: req.body.label || 'Merchant phone' });
    audit(m.id, user.id, 'device_enrolled', { did });
    analytics.deviceEnrolled(m.id);   // server-side conversion (env-gated; no PII)
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
    // ADD-ON B: a dispute on a reference contributes the payer's hashed identity to
    // the network so other merchants inherit the signal (no raw value is stored).
    try {
      const rc = req.body.reference ? q.get('SELECT payer_suffix FROM receipts WHERE merchant_id=? AND UPPER(reference)=UPPER(?)', m.id, req.body.reference) : null;
      if (rc && rc.payer_suffix) trustNet.record({ subject: rc.payer_suffix, kind: 'disputed' });
      if (req.body.reference) trustNet.flag({ kind: 'reference', value: req.body.reference, reason: 'dispute_opened', merchantId: m.id });
    } catch { /* network optional */ }
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
    all_plans: Object.entries(PLANS).map(([id, p]) => ({ id, ...p })), // the full ladder for the Plans page
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
  // Change plan. FREE target (or a downgrade to free) applies immediately. A PAID
  // target requires payment through the mesh first — this returns the payment
  // methods (KODA mobile money / Stripe / BitriPay) instead of changing the plan.
  // (KODA staff-admins change any merchant's plan for free via /app/admin/merchants/:id/plan.)
  r.post('/app/billing/plan', auth((req, user, m) => {
    if (!needRole(user, [])) return [403, { error: 'owner_only' }];
    const plan = PLANS[req.body.plan] ? req.body.plan : m.plan;
    const priced = PLANS[plan].usd || 0;
    // free plan, no-op, or a downgrade to a cheaper/equal tier → apply free
    if (priced <= 0 || priced <= (PLANS[m.plan].usd || 0)) {
      q.run('UPDATE merchants SET plan=?, is_platform=? WHERE id=?', plan, plan === 'plateforme' ? 1 : m.is_platform, m.id);
      notify.fire(priced > (PLANS[m.plan].usd || 0) ? 'plan.upgraded' : 'plan.downgraded', { user, merchant: m, data: { plan: PLANS[plan].label } });
      audit(m.id, user.id, 'plan_changed', { plan });
      return { ok: true, plan };
    }
    // paid upgrade → must collect payment
    return { ok: false, payment_required: true, ...billing.planMethods(plan) };
  }));
  // Payment methods to subscribe to a (paid) plan.
  r.get('/app/billing/plan/:plan/methods', auth((req, user, m) => billing.planMethods(req.params.plan)));
  // Start a plan-subscription checkout via a chosen rail (koda | stripe | bitripay).
  r.post('/app/billing/subscribe', auth((req, user, m) => {
    if (!needRole(user, [])) return [403, { error: 'owner_only' }];
    return billing.createPlanCheckout(m, req.body.plan, req.body.rail || 'koda');
  }));
  r.get('/v1/billing/plan/:plan/methods', apiKey((req, m) => billing.planMethods(req.params.plan), 'read:usage'));
  r.post('/v1/billing/subscribe', apiKey((req, m) => billing.createPlanCheckout(m, req.body.plan, req.body.rail || 'koda'), 'write:intents'));

  // ---------- api keys ----------
  r.get('/app/keys', auth((req, user, m) =>
    q.all('SELECT id,prefix,last4,label,revoked,created_at FROM api_keys WHERE merchant_id=? AND submerchant_id IS NULL', m.id)));
  r.post('/app/keys', auth((req, user, m) => {
    if (!needRole(user, ['manager'])) return [403, { error: 'manager_or_owner_only' }];
    // koda_ key scheme (spec §4/§32). Legacy sk_/pk_/rk_ names are accepted as
    // aliases so existing integrations keep working — auth is hash-based, so no
    // previously-issued key ever breaks.
    const ALIAS = { sk_live: 'koda_live', sk_test: 'koda_test', pk_live: 'koda_pub_live', pk_test: 'koda_pub_test', rk_live: 'koda_rk_live' };
    const ALLOWED = ['koda_live', 'koda_test', 'koda_pub_live', 'koda_pub_test', 'koda_rk_live'];
    let prefix = ALIAS[req.body.prefix] || req.body.prefix;
    if (!ALLOWED.includes(prefix)) prefix = 'koda_test';
    const secret = `${prefix}_${U.token(24)}`;
    // koda_rk_ = read-only; koda_pub_ (browser-exposed) may ONLY create verifications;
    // koda_live/koda_test (server-side secret) get full scope unless explicit scopes are given.
    const scopes = Array.isArray(req.body.scopes) && req.body.scopes.length ? req.body.scopes
      : prefix.startsWith('koda_rk') ? ['read:receipts', 'read:usage', 'read:agents']
      : prefix.startsWith('koda_pub') ? ['write:intents'] : ['*'];
    q.run(`INSERT INTO api_keys (id,merchant_id,prefix,key_hash,last4,label,scopes) VALUES (?,?,?,?,?,?,?)`,
      U.id('key'), m.id, prefix, U.sha256(secret), secret.slice(-4), req.body.label || null, JSON.stringify(scopes));
    notify.fire('apikey.created', { user, merchant: m });
    audit(m.id, user.id, 'key_created', { prefix });
    analytics.apiKeyCreated(m.id);   // server-side conversion (env-gated; no PII)
    return { secret, note: 'The secret is shown once. Store it now.' };
  }));
  r.post('/app/keys/:id/revoke', auth((req, user, m) => {
    if (!needRole(user, ['manager'])) return [403, { error: 'manager_or_owner_only' }];
    q.run('UPDATE api_keys SET revoked=1 WHERE id=? AND merchant_id=?', req.params.id, m.id);
    notify.fire('apikey.revoked', { user, merchant: m });
    return { ok: true };
  }));
  // Delete a key permanently — but ONLY a revoked one, and only while a live key remains
  // (a replacement must be in place first, so a merchant can never delete themselves down
  // to zero working keys and lock their integration out).
  r.post('/app/keys/:id/delete', auth((req, user, m) => {
    if (!needRole(user, ['manager'])) return [403, { error: 'manager_or_owner_only' }];
    const key = q.get('SELECT * FROM api_keys WHERE id=? AND merchant_id=? AND submerchant_id IS NULL', req.params.id, m.id);
    if (!key) return [404, { error: { code: 'key_not_found' } }];
    if (!key.revoked) return [409, { error: { code: 'revoke_first', message: 'Revoke the key before deleting it.' } }];
    const activeLeft = q.get('SELECT COUNT(*) c FROM api_keys WHERE merchant_id=? AND submerchant_id IS NULL AND revoked=0', m.id).c;
    if (activeLeft < 1) return [409, { error: { code: 'need_active_key', message: 'Create a new API key before deleting your last one — a live key must stay in place.' } }];
    q.run('DELETE FROM api_keys WHERE id=? AND merchant_id=?', req.params.id, m.id);
    audit(m.id, user.id, 'key_deleted', { prefix: key.prefix, last4: key.last4 });
    return { ok: true, deleted: req.params.id };
  }));

  // ---------- webhooks ----------
  r.get('/app/webhooks', auth((req, user, m) => ({
    endpoints: q.all('SELECT * FROM webhook_endpoints WHERE merchant_id=?', m.id),
    deliveries: q.all('SELECT * FROM webhook_deliveries WHERE merchant_id=? ORDER BY created_at DESC LIMIT 50', m.id),
  })));
  r.post('/app/webhooks', auth((req, user, m) => {
    if (!needRole(user, [])) return [403, { error: 'owner_only' }];
    const wid = U.id('whe'), secret = `whsec_${U.token(24)}`;
    const destination = (typeof req.body.destination === 'string' && req.body.destination.trim()) ? req.body.destination.trim().slice(0, 64) : null;
    const name = (typeof req.body.name === 'string' && req.body.name.trim()) ? req.body.name.trim().slice(0, 80) : null;
    q.run(`INSERT INTO webhook_endpoints (id,merchant_id,url,secret,events,destination,name) VALUES (?,?,?,?,?,?,?)`,
      wid, m.id, req.body.url, secret, JSON.stringify(req.body.events || ['*']), destination, name);
    notify.fire('webhook.endpoint_added', { user, merchant: m });
    return { id: wid, secret, destination, name };
  }));

  // ---- Platform integrations: install-scoped, revocable credentials ----
  // The spec's #1 security rule (§5): no master secret pasted into WordPress. Clicking
  // "Connect" in the KODA dashboard provisions an installation with its OWN scoped
  // restricted key + webhook secret (shown once), both revocable from KODA in one call.
  const INSTALL_SCOPES = ['write:intents', 'read:receipts', 'read:usage'];
  // provision an installation: its own scoped key + (optional) webhook endpoint.
  // Returns the plaintext credentials (shown once). Shared by the direct connect
  // endpoint and the OAuth authorize flow.
  function provisionInstall(m, userId, { platform, store_url, webhook_url }) {
    platform = String(platform || 'custom').slice(0, 32);
    const storeUrl = String(store_url || '').slice(0, 300) || null;
    const webhookUrl = String(webhook_url || '').slice(0, 300) || null;
    const secret = `koda_rk_live_${U.token(24)}`, kid = U.id('key');
    q.run(`INSERT INTO api_keys (id,merchant_id,prefix,key_hash,last4,label,scopes) VALUES (?,?,?,?,?,?,?)`,
      kid, m.id, 'koda_rk_live', U.sha256(secret), secret.slice(-4), platform + ' installation', JSON.stringify(INSTALL_SCOPES));
    let whId = null, whSecret = null;
    if (webhookUrl) {
      whId = U.id('whe'); whSecret = `whsec_${U.token(24)}`;
      q.run(`INSERT INTO webhook_endpoints (id,merchant_id,url,secret,events) VALUES (?,?,?,?,?)`,
        whId, m.id, webhookUrl, whSecret, JSON.stringify(['payment.verified', 'payment.verified.late']));
    }
    const iid = U.id('ins');
    q.run(`INSERT INTO installations (id,merchant_id,platform,store_url,key_id,webhook_id) VALUES (?,?,?,?,?,?)`,
      iid, m.id, platform, storeUrl, kid, whId);
    audit(m.id, userId, 'integration_connected', { platform, store_url: storeUrl });
    return {
      installation_id: iid, platform, store_url: storeUrl,
      server_key: secret, scopes: INSTALL_SCOPES, webhook_url: webhookUrl, webhook_secret: whSecret,
      merchant_id: m.id,
    };
  }
  r.post('/app/integrations', auth((req, user, m) => {
    if (!needRole(user, [])) return [403, { error: 'owner_only' }];
    return { ...provisionInstall(m, user.id, req.body || {}),
      note: 'Scoped key + webhook secret shown once. Installation-specific and revocable from KODA.' };
  }));
  // OAuth-style connect: the merchant (logged into KODA) APPROVES a plugin connection.
  // KODA provisions the install and hands back a one-time code the plugin exchanges
  // server-to-server — the secret never travels in the browser redirect.
  r.post('/app/oauth/authorize', auth((req, user, m) => {
    if (!needRole(user, [])) return [403, { error: 'owner_only' }];
    const b = req.body || {};
    const redirectUri = String(b.redirect_uri || '');
    if (!/^https?:\/\//.test(redirectUri)) return [400, { error: { code: 'invalid_redirect_uri' } }];
    const prov = provisionInstall(m, user.id, { platform: b.platform || 'woocommerce', store_url: b.store_url, webhook_url: b.webhook_url });
    const code = 'kc_' + U.token(24);
    q.run(`INSERT INTO oauth_codes (code,merchant_id,installation_id,redirect_uri,payload) VALUES (?,?,?,?,?)`,
      code, m.id, prov.installation_id, redirectUri, JSON.stringify(prov));
    audit(m.id, user.id, 'oauth_authorized', { installation_id: prov.installation_id, redirect_uri: redirectUri });
    const sep = redirectUri.includes('?') ? '&' : '?';
    return { redirect: `${redirectUri}${sep}code=${code}${b.state ? '&state=' + encodeURIComponent(b.state) : ''}`, installation_id: prov.installation_id };
  }));
  // Exchange the one-time code (server-to-server, public) for the scoped credentials.
  r.post('/v1/oauth/token', (req) => {
    const code = String((req.body || {}).code || '');
    const row = q.get(`SELECT * FROM oauth_codes WHERE code=? AND used=0`, code);
    if (!row) return [400, { error: { code: 'invalid_or_used_code' } }];
    if (Date.now() - new Date(row.created_at + 'Z').getTime() > 10 * 60 * 1000) {
      q.run(`UPDATE oauth_codes SET used=1 WHERE code=?`, code);
      return [400, { error: { code: 'code_expired' } }];
    }
    q.run(`UPDATE oauth_codes SET used=1 WHERE code=?`, code); // single use
    const p = JSON.parse(row.payload);
    return {
      access_token: p.server_key, token_type: 'bearer', scopes: p.scopes,
      installation_id: p.installation_id, merchant_id: p.merchant_id,
      webhook_url: p.webhook_url, webhook_secret: p.webhook_secret,
    };
  });

  // Public contact form → delivers to the KODA inbox and is always stored (so a
  // message survives even when no email transport is configured). Honeypot + IP
  // rate limit for spam. No auth: it's the marketing site's "talk to us" form.
  r.post('/v1/contact', (req) => {
    const b = req.body || {};
    const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'ip';
    if (bruteLimited('contact:' + ip, 5, 10 * 60 * 1000))
      return [429, { error: { code: 'too_many_messages', retry_after: 600 } }];
    // honeypot: real users never fill a hidden field
    if (String(b.company || '').trim() !== '') return { ok: true }; // silently drop bots
    const name = String(b.name || '').trim().slice(0, 120);
    const email = String(b.email || '').trim().slice(0, 160);
    const topic = String(b.topic || '').trim().slice(0, 60) || 'General';
    const message = String(b.message || '').trim().slice(0, 5000);
    if (!name || !message) return [400, { error: { code: 'name_and_message_required' } }];
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return [400, { error: { code: 'valid_email_required' } }];

    const cid = U.id('msg');
    q.run(`INSERT INTO contact_messages (id,name,email,topic,message,source_ip,user_agent)
           VALUES (?,?,?,?,?,?,?)`,
      cid, name, email, topic, message, String(ip).slice(0, 60),
      String(req.headers['user-agent'] || '').slice(0, 300));

    const inbox = process.env.KODA_CONTACT_INBOX || 'koda@kodajnn.com';
    const esc = (s) => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const html = `<h2>New contact message — ${esc(topic)}</h2>
      <p><b>From:</b> ${esc(name)} &lt;${esc(email)}&gt;</p>
      <p><b>Message:</b></p><p style="white-space:pre-wrap">${esc(message)}</p>
      <hr><p style="color:#888;font-size:12px">Reply directly to ${esc(email)} · ref ${cid}</p>`;
    // deliver off the response path; the message is already stored either way.
    try {
      const senders = require('./comms/senders');
      Promise.resolve(senders.sendEmail(inbox, `KODA contact — ${topic}: ${name}`, html))
        .then(r => { if (r && r.ok) { try { q.run(`UPDATE contact_messages SET delivered=1 WHERE id=?`, cid); } catch {} } })
        .catch(() => { /* stored regardless; ops can read the table */ });
    } catch { /* comms optional */ }
    return { ok: true, id: cid };
  });

  r.get('/app/integrations', auth((req, user, m) =>
    q.all(`SELECT i.id, i.platform, i.store_url, i.created_at, i.revoked,
             k.last4 AS key_last4, k.revoked AS key_revoked, w.url AS webhook_url
           FROM installations i
           LEFT JOIN api_keys k ON k.id = i.key_id
           LEFT JOIN webhook_endpoints w ON w.id = i.webhook_id
           WHERE i.merchant_id=? ORDER BY i.created_at DESC`, m.id)));
  r.delete('/app/integrations/:id', auth((req, user, m) => {
    if (!needRole(user, [])) return [403, { error: 'owner_only' }];
    const i = q.get('SELECT * FROM installations WHERE id=? AND merchant_id=?', req.params.id, m.id);
    if (!i) return [404, { error: { code: 'not_found' } }];
    if (i.key_id) q.run('UPDATE api_keys SET revoked=1 WHERE id=?', i.key_id);      // scoped key dies
    if (i.webhook_id) q.run('UPDATE webhook_endpoints SET active=0 WHERE id=?', i.webhook_id);
    q.run('UPDATE installations SET revoked=1 WHERE id=?', i.id);
    audit(m.id, user.id, 'integration_revoked', { installation_id: i.id });
    return { ok: true, revoked: i.id };
  }));
  r.post('/app/webhooks/:id/test', auth((req, user, m) => {
    require('./lib/webhooks').dispatch(m.id, 'payment.verified',
      { test: true, receipt_id: 'rcp_TEST', amount: 25000, currency: m.currency });
    return { ok: true, note: 'Signed test event dispatched.' };
  }));
  // Rotate ONE endpoint's signing secret (spec §31/§36/§40). Returns the new secret
  // once; the old secret stops verifying immediately. Owner-only.
  r.post('/app/webhooks/:id/rotate', auth((req, user, m) => {
    if (!needRole(user, [])) return [403, { error: 'owner_only' }];
    const ep = q.get('SELECT * FROM webhook_endpoints WHERE id=? AND merchant_id=?', req.params.id, m.id);
    if (!ep) return [404, { error: 'endpoint_not_found' }];
    const secret = `whsec_${U.token(24)}`;
    q.run('UPDATE webhook_endpoints SET secret=? WHERE id=? AND merchant_id=?', secret, ep.id, m.id);
    audit(m.id, user.id, 'webhook_secret_rotated', { endpoint_id: ep.id });
    return { ok: true, id: ep.id, secret };
  }));
  // Enable/disable ONE endpoint (paused endpoints keep their url + secret; dispatch
  // simply skips them). Owner-only, like adding one.
  r.post('/app/webhooks/:id/toggle', auth((req, user, m) => {
    if (!needRole(user, [])) return [403, { error: 'owner_only' }];
    const ep = q.get('SELECT * FROM webhook_endpoints WHERE id=? AND merchant_id=?', req.params.id, m.id);
    if (!ep) return [404, { error: 'endpoint_not_found' }];
    const active = ep.active ? 0 : 1;
    q.run('UPDATE webhook_endpoints SET active=? WHERE id=? AND merchant_id=?', active, ep.id, m.id);
    audit(m.id, user.id, active ? 'webhook_enabled' : 'webhook_disabled', { endpoint_id: ep.id });
    return { ok: true, id: ep.id, active };
  }));
  // Delete an endpoint and its delivery history (FK-safe, one transaction). Owner-only.
  r.delete('/app/webhooks/:id', auth((req, user, m) => {
    if (!needRole(user, [])) return [403, { error: 'owner_only' }];
    const ep = q.get('SELECT id FROM webhook_endpoints WHERE id=? AND merchant_id=?', req.params.id, m.id);
    if (!ep) return [404, { error: 'endpoint_not_found' }];
    tx(() => {
      q.run('DELETE FROM webhook_deliveries WHERE endpoint_id=? AND merchant_id=?', ep.id, m.id);
      q.run('DELETE FROM webhook_endpoints WHERE id=? AND merchant_id=?', ep.id, m.id);
    });
    audit(m.id, user.id, 'webhook_deleted', { endpoint_id: ep.id });
    return { ok: true };
  }));
  // Re-send a single delivery (the "Retry" button on a failed/dead delivery).
  r.post('/app/webhooks/deliveries/:id/retry', auth((req, user, m) => {
    if (!needRole(user, ['manager'])) return [403, { error: 'manager_or_owner_only' }];
    const d = q.get('SELECT id FROM webhook_deliveries WHERE id=? AND merchant_id=?', req.params.id, m.id);
    if (!d) return [404, { error: 'delivery_not_found' }];
    const res = require('./lib/webhooks').redeliver(d.id);
    if (!res.ok) return [400, { error: res.error }];
    audit(m.id, user.id, 'webhook_retried', { delivery_id: d.id });
    return { ok: true, note: 'Delivery re-queued.' };
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
    const secret = `koda_live_sub_${U.token(24)}`;
    q.run(`INSERT INTO api_keys (id,merchant_id,prefix,key_hash,last4,label,submerchant_id)
           VALUES (?,?,?,?,?,?,?)`,
      U.id('key'), m.id, 'koda_live_sub', U.sha256(secret), secret.slice(-4), req.body.name, sid);
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
  // mark a single notification read (opening it from the inbox) + return its body
  r.post('/app/notifications/:id/read', auth((req, user) => {
    q.run('UPDATE notifications SET read=1 WHERE id=? AND user_id=?', req.params.id, user.id);
    const n = q.get('SELECT id,event_key,severity,title,body,read,created_at FROM notifications WHERE id=? AND user_id=?', req.params.id, user.id);
    return n || [404, { error: { code: 'not_found' } }];
  }));
  // The event architecture / catalogue / QA / delivery log is OPERATOR tooling —
  // admin-only. Merchants only get their own inbox (/app/notifications) + channel
  // preferences (/app/comms/prefs) below.
  r.get('/app/comms/catalogue', admin(() => ({
    categories: CATEGORIES.map(c => ({ id: c.id, label: c.label, events: c.events })),
    channels: CHANNELS,
    stats: {
      total: ALL.length,
      categories: CATEGORIES.length,
      mandatory: ALL.filter(e => e.mandatory).length,
      byChannel: Object.fromEntries(CHANNELS.map(ch => [ch, ALL.filter(e => e.channels.includes(ch)).length])),
    },
  })));
  r.get('/app/comms/deliveries', admin((req, user, m) => ({
    deliveries: q.all(`SELECT * FROM comm_deliveries WHERE merchant_id=? OR user_id=?
                       ORDER BY created_at DESC LIMIT 60`, m?.id || '', user.id),
    sent: q.get(`SELECT COUNT(*) c FROM comm_deliveries WHERE (merchant_id=? OR user_id=?) AND status='sent'`, m?.id || '', user.id).c,
    attempted: q.get(`SELECT COUNT(*) c FROM comm_deliveries WHERE merchant_id=? OR user_id=?`, m?.id || '', user.id).c,
  })));
  r.get('/app/comms/preview/:key', admin((req, user, m) => {
    const html = notify.previewEmail(req.params.key, m, user, { amount: '25 000 CDF', reference: 'OM.260717.1432.A88213', acu: 1750, number: 'INV-2026-071', plan: 'Commerce' });
    return html ? { html } : [404, { error: 'unknown_event' }];
  }));
  r.post('/app/comms/test/:key', admin((req, user, m) => {
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
  // SecurityAgent dashboard: human-gate status, event breakdown, blocked IPs.
  r.get('/app/admin/security', admin(() => security.summary()));
  // let an admin manually unblock (or block) an IP.
  r.post('/app/admin/security/unblock', admin((req) => {
    try { q.run('DELETE FROM blocked_ips WHERE ip=?', String((req.body || {}).ip || '')); } catch {}
    return { ok: true };
  }));

  // ---- KODA self-collection config (zero-fee mobile-money rail, admin-managed) ----
  // The receiving numbers + collector SIM live here, NOT in env files. Whatever the
  // team saves is what buyers pay to and what auto-settles their plan/top-up.
  r.get('/app/admin/collection', admin(() => {
    const set = require('./lib/settings');
    const mid = set.collectMerchantId();
    const collector = mid ? q.get('SELECT id,name,country,msisdn FROM merchants WHERE id=?', mid) : null;
    const devices = mid ? q.all(`SELECT id,label,operator,sim_msisdn,status,last_seen,attested FROM devices WHERE merchant_id=? ORDER BY created_at DESC`, mid) : [];
    return {
      configured: set.collectConfigured(),
      collect_merchant_id: mid,
      collector,
      collect_currency: set.collectCurrency(),
      usd_to_local: set.usdToLocal(),
      rate_is_explicit: set.rateIsExplicit(),   // false ⇒ the rate is an auto-default for the currency
      fx_defaults: require('../shared/fx').DEFAULT_RATES,        // currency → indicative rate
      country_currency: require('../shared/fx').COUNTRY_CURRENCY, // ISO-2 → currency
      numbers: set.collectNumbers(),
      devices,
      pending_collections: q.get(`SELECT COUNT(*) c FROM topups WHERE rail='koda' AND status='pending'`).c,
      merchants: q.all(`SELECT id,name,country,currency FROM merchants ORDER BY created_at ASC LIMIT 200`),
    };
  }));
  r.post('/app/admin/collection', admin((req, user) => {
    const set = require('./lib/settings');
    const b = req.body || {};
    if (b.collect_merchant_id != null) set.set('collect_merchant_id', String(b.collect_merchant_id).trim());
    if (b.collect_currency != null) set.set('collect_currency', String(b.collect_currency).trim().toUpperCase());
    if (b.usd_to_local != null && Number(b.usd_to_local) > 0) set.set('usd_to_local', String(Number(b.usd_to_local)));
    if (Array.isArray(b.numbers)) {
      const clean = b.numbers.filter(n => n && n.msisdn).slice(0, 20).map(n => ({
        operator: String(n.operator || '').trim(), msisdn: String(n.msisdn).trim(),
        label: String(n.label || '').trim().slice(0, 40), active: n.active === false ? 0 : 1,
      }));
      set.set('collect_numbers', JSON.stringify(clean));
    }
    audit(user.merchant_id || 'platform', user.id, 'collection_config_updated', { numbers: Array.isArray(b.numbers) ? b.numbers.length : undefined });
    return { ok: true, configured: set.collectConfigured(), numbers: set.collectNumbers() };
  }));

  r.get('/app/admin/overview', admin(() => {
    const ops = require('../shared/operators');
    return {
      merchants: q.get('SELECT COUNT(*) c FROM merchants WHERE parent_id IS NULL').c,
      submerchants: q.get('SELECT COUNT(*) c FROM merchants WHERE parent_id IS NOT NULL').c,
      users: q.get('SELECT COUNT(*) c FROM users').c,
      receipts: q.get('SELECT COUNT(*) c FROM receipts').c,
      volume: q.get('SELECT COALESCE(SUM(amount),0) s FROM receipts').s,
      devices: q.get(`SELECT COUNT(*) c FROM devices WHERE status='active'`).c,
      quarantined: q.get('SELECT COUNT(*) c FROM sms_ledger WHERE quarantined=1').c,
      openDisputes: q.get(`SELECT COUNT(*) c FROM disputes WHERE status='open'`).c,
      deliveries: q.get('SELECT COUNT(*) c FROM comm_deliveries').c,
      coverage: ops.coverage(),  // real registry: total/countries/packed/byTier/byRegion
      packedOperators: ops.OPERATORS.filter(o => o.packed).map(o => ({ id: o.id, name: o.name, country: o.country })),
      latest: q.all(`SELECT r.*, m.name merchant FROM receipts r JOIN merchants m ON m.id=r.merchant_id
                     ORDER BY r.verified_at DESC LIMIT 20`),
    };
  }));
  // ---- full operator coverage (the real 235-operator registry, not a hardcoded 4) ----
  r.get('/app/admin/coverage', admin(() => {
    const ops = require('../shared/operators');
    return {
      coverage: ops.coverage(),
      families: ops.families(),
      operators: ops.OPERATORS.map(o => ({
        id: o.id, name: o.name, country: o.country, region: o.region, currency: o.currency,
        family: ops.familyOf(o), tier: ops.tierOf(o), parser: o.packed ? 'precise' : 'generic',
      })),
    };
  }));
  r.get('/app/admin/merchants', admin(() =>
    q.all(`SELECT m.*, (SELECT COUNT(*) FROM receipts r WHERE r.merchant_id=m.id) verifs,
           (SELECT COUNT(*) FROM users u WHERE u.merchant_id=m.id) seats
           FROM merchants m WHERE m.parent_id IS NULL ORDER BY m.created_at DESC`)));
  r.post('/app/admin/merchants/:id/suspend', admin((req) => {
    q.run(`UPDATE merchants SET status = CASE status WHEN 'suspended' THEN 'active' ELSE 'suspended' END WHERE id=?`, req.params.id);
    return { ok: true };
  }));
  // ---- admin: permanently DELETE a merchant (only when suspended) ----
  // Guard rails: a merchant must be SUSPENDED first (deliberate two-step, no accidental
  // wipes of a live account), and a platform account with sub-merchants can't be deleted
  // until its children are gone. Removes the merchant and every row that references it
  // (users, keys, devices, ledger, receipts, webhooks, billing, comms, …) in one tx so
  // nothing is orphaned. Irreversible.
  r.post('/app/admin/merchants/:id/delete', admin((req, user) => {
    const mid = req.params.id;
    const merchant = q.get('SELECT * FROM merchants WHERE id=?', mid);
    if (!merchant) return [404, { error: { code: 'merchant_not_found' } }];
    if (merchant.status !== 'suspended')
      return [409, { error: { code: 'must_suspend_first', message: 'Suspend the merchant before deleting it.' } }];
    const kids = q.get('SELECT COUNT(*) c FROM merchants WHERE parent_id=?', mid).c;
    if (kids > 0) return [409, { error: { code: 'has_submerchants', message: `Remove ${kids} sub-merchant(s) first.` } }];
    // Introspect every table that carries a merchant_id so the cascade stays complete as
    // the schema grows. Order matters under FK enforcement: clear all merchant-scoped rows
    // (many reference users.id) BEFORE deleting the users, and clear password_resets (which
    // references users.id but has no merchant_id) by the merchant's user ids.
    const midTables = q.all(`SELECT name FROM sqlite_master WHERE type='table'`)
      .map(r => r.name)
      .filter(t => t !== 'merchants' && q.all(`PRAGMA table_info(${t})`).some(c => c.name === 'merchant_id'));
    tx(() => {
      for (const tbl of midTables) if (tbl !== 'users') q.run(`DELETE FROM ${tbl} WHERE merchant_id=?`, mid);
      try { q.run(`DELETE FROM password_resets WHERE user_id IN (SELECT id FROM users WHERE merchant_id=?)`, mid); } catch { /* table optional */ }
      q.run('DELETE FROM users WHERE merchant_id=?', mid);
      q.run('DELETE FROM merchants WHERE id=?', mid);
    });
    audit(null, user.id, 'admin.merchant_deleted', { merchant_id: mid, name: merchant.name });
    return { ok: true, deleted: mid };
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
    // Welcome email carries the login link + (only when auto-generated) the temp password,
    // so the customer can actually sign in. If the admin set the password, it isn't emailed.
    const loginUrl = `${(process.env.KODA_PUBLIC_URL || 'https://kodajnn.com').replace(/\/$/, '')}/app#login`;
    notify.fire('merchant.activated', { user: u, merchant: created, data: {
      merchant: business, email: em, temp_password: req.body.password ? null : pw,
      cta: 'Sign in to KODA', cta_url: loginUrl,
    } });
    return { ok: true, merchant: created, owner_email: em, temp_password: req.body.password ? undefined : pw };
  }));
  // ---- admin: (re)send login credentials WITHOUT seeing them ----
  // Generates a FRESH temporary password, sets it on the merchant's owner, and emails
  // it to them. The password is never returned — the admin can send access without
  // ever seeing it (passwords are hashed, so the old one can't be recovered anyway).
  r.post('/app/admin/merchants/:id/resend-welcome', admin((req, actor) => {
    const merchant = q.get('SELECT * FROM merchants WHERE id=?', req.params.id);
    if (!merchant) return [404, { error: { code: 'merchant_not_found' } }];
    const owner = q.get(`SELECT * FROM users WHERE merchant_id=? AND role='owner' ORDER BY created_at LIMIT 1`, merchant.id);
    if (!owner) return [404, { error: { code: 'owner_not_found' } }];
    const pw = U.token(8); // fresh temp password — never shown to the admin
    q.run('UPDATE users SET pass_hash=? WHERE id=?', U.hashPassword(pw), owner.id);
    const loginUrl = `${(process.env.KODA_PUBLIC_URL || 'https://kodajnn.com').replace(/\/$/, '')}/app#login`;
    notify.fire('merchant.activated', { user: owner, merchant, data: {
      merchant: merchant.name, email: owner.email, temp_password: pw, cta: 'Sign in to KODA', cta_url: loginUrl,
    } });
    audit(merchant.id, actor.id, 'admin.credentials_resent', { email: owner.email });
    return { ok: true, sent_to: owner.email }; // NO password in the response
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
  // ---- admin: weekly product newsletter (preview + status + send now) ----
  r.get('/app/admin/newsletter', admin(() => {
    const nl = require('./comms/newsletter');
    const last = nl.lastSent();
    const preview = nl.build(Date.now(), null);
    return {
      recipients: nl.recipients().length,
      last_sent: last,
      due: nl.due(Date.now()),
      next_due_at: last && last.at ? new Date(last.at + 7 * 24 * 60 * 60 * 1000).toISOString() : null,
      subject: preview.subject,
      preview_html: preview.html,
    };
  }));
  r.post('/app/admin/newsletter/send', admin(async (req, user) => {
    const nl = require('./comms/newsletter');
    // ?test=1 or {test:true} sends only to the admin's own email (safe dry-run of the real send)
    const testTo = (req.body && req.body.test) ? user.email : null;
    const out = await nl.send({ testTo });
    audit(null, user.id, 'admin.newsletter_sent', { test: !!testTo, ...out });
    return { ok: true, ...out };
  }));
  // ---- public: one-click unsubscribe from the newsletter (no login, tokenised) ----
  r.get('/unsubscribe', (req) => {
    const nl = require('./comms/newsletter');
    const uid = String(req.query.u || ''), tok = String(req.query.t || '');
    const html = (msg) => [200, `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KODA — Newsletter</title><meta name="robots" content="noindex"></head><body style="margin:0;background:#081813;color:#E9E4D5;font-family:Arial,Helvetica,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center"><div style="max-width:440px;padding:32px;text-align:center"><div style="font-weight:900;letter-spacing:3px;color:#E8A11F;margin-bottom:16px">✓ KODA</div><p style="font-size:16px;line-height:1.6">${msg}</p><p style="margin-top:22px"><a href="https://kodajnn.com/app#comms" style="color:#E8A11F">Manage all notification preferences →</a></p></div></body></html>`, { 'content-type': 'text/html; charset=utf-8' }];
    if (!nl.verifyUnsub(uid, tok)) return html('This unsubscribe link is invalid or has expired. You can manage your email preferences from your account.');
    q.run(`INSERT INTO comm_prefs (user_id,channel,enabled) VALUES (?, 'newsletter', 0)
           ON CONFLICT(user_id,channel) DO UPDATE SET enabled=0`, uid);
    return html('You\'ve been unsubscribed from the KODA weekly newsletter. You\'ll still receive important account and payment notifications.');
  });

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

  // ============ platform operator console (super-admin) ============
  const SB = require('../shared/billing');

  // ---- 5 · revenue & billing dashboard ----
  r.get('/app/admin/revenue', admin(() => {
    const byPlan = q.all(`SELECT plan, COUNT(*) n FROM merchants WHERE parent_id IS NULL GROUP BY plan`);
    let mrr = 0;
    const plans = byPlan.map(row => {
      const usd = (PLANS[row.plan] && PLANS[row.plan].usd) || 0;
      mrr += usd * row.n;
      return { plan: row.plan, merchants: row.n, unit_usd: usd, subtotal_usd: usd * row.n };
    });
    const acuSold = q.get(`SELECT COALESCE(SUM(delta),0) s FROM acu_transactions WHERE delta>0 AND kind='topup'`).s;
    const acuBurned = q.get(`SELECT COALESCE(-SUM(delta),0) s FROM acu_transactions WHERE delta<0`).s;
    const acuRevenue = Math.round(acuSold * SB.ACU_PRICE_USD * 100) / 100;
    const topMerchants = q.all(`SELECT m.id, m.name, m.plan, COUNT(r.id) verifs, COALESCE(SUM(r.amount),0) volume, m.acu_balance
      FROM merchants m LEFT JOIN receipts r ON r.merchant_id=m.id
      WHERE m.parent_id IS NULL GROUP BY m.id ORDER BY verifs DESC LIMIT 10`);
    const outstanding = q.all(`SELECT id,name,acu_balance FROM merchants WHERE acu_balance < 0 ORDER BY acu_balance ASC LIMIT 20`);
    return {
      mrr_usd: mrr, arr_usd: mrr * 12,
      acu_sold: acuSold, acu_burned: acuBurned, acu_revenue_usd: acuRevenue, acu_price_usd: SB.ACU_PRICE_USD,
      total_revenue_usd: Math.round((mrr + acuRevenue) * 100) / 100,
      by_plan: plans, top_merchants: topMerchants, outstanding,
    };
  }));

  // ---- 6 · fraud & disputes queues ----
  r.get('/app/admin/fraud', admin(() => ({
    quarantined: q.all(`SELECT s.id, s.operator, s.raw, s.amount, s.currency, s.ref_code, s.chain_ok, s.received_at, m.name merchant
      FROM sms_ledger s JOIN merchants m ON m.id=s.merchant_id WHERE s.quarantined=1 ORDER BY s.received_at DESC LIMIT 100`),
    high_risk: q.all(`SELECT r.id, r.reference, r.amount, r.currency, r.risk_score, r.mode, r.verified_at, m.name merchant
      FROM receipts r JOIN merchants m ON m.id=r.merchant_id WHERE r.risk_score >= 0.5 ORDER BY r.verified_at DESC LIMIT 100`),
  })));
  r.post('/app/admin/sms/:id/quarantine', admin((req, user) => {
    const s = q.get('SELECT * FROM sms_ledger WHERE id=?', req.params.id);
    if (!s) return [404, { error: { code: 'sms_not_found' } }];
    q.run(`UPDATE sms_ledger SET quarantined = CASE quarantined WHEN 1 THEN 0 ELSE 1 END WHERE id=?`, s.id);
    const now = q.get('SELECT quarantined FROM sms_ledger WHERE id=?', s.id).quarantined;
    audit(s.merchant_id, user.id, now ? 'admin.sms_quarantined' : 'admin.sms_released', { sms: s.id });
    return { ok: true, quarantined: !!now };
  }));
  r.get('/app/admin/disputes', admin(() =>
    q.all(`SELECT d.*, m.name merchant FROM disputes d JOIN merchants m ON m.id=d.merchant_id
           WHERE d.status='open' ORDER BY d.created_at DESC LIMIT 100`)));
  r.post('/app/admin/disputes/:id/resolve', admin((req, user) => {
    const d = q.get('SELECT * FROM disputes WHERE id=?', req.params.id);
    if (!d) return [404, { error: { code: 'dispute_not_found' } }];
    const decision = ['accepted', 'rejected', 'escalated'].includes(req.body.decision) ? req.body.decision : 'rejected';
    q.run(`UPDATE disputes SET status=?, resolved_by=?, resolved_at=datetime('now') WHERE id=?`, decision, user.id, d.id);
    audit(d.merchant_id, user.id, 'admin.dispute_' + decision, { dispute: d.id });
    return { ok: true, status: decision };
  }));

  // ---- 7 · verifications & devices explorer ----
  r.get('/app/admin/receipts', admin((req) => {
    const qy = req.query || {};
    const term = String(qy.q || '').trim();
    const mid = String(qy.merchant || '');
    const limit = Math.min(500, Math.max(1, Number(qy.limit) || 100));
    const where = [], args = [];
    if (term) { where.push('(r.reference LIKE ? OR r.operator LIKE ?)'); args.push('%' + term + '%', '%' + term + '%'); }
    if (mid) { where.push('r.merchant_id=?'); args.push(mid); }
    const sql = `SELECT r.id, r.reference, r.amount, r.currency, r.operator, r.risk_score, r.mode, r.verified_at, m.name merchant
      FROM receipts r JOIN merchants m ON m.id=r.merchant_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY r.verified_at DESC LIMIT ?`;
    const rows = q.all(sql, ...args, limit);
    if (qy.format === 'csv') {
      const head = 'verified_at,merchant,reference,amount,currency,operator,risk,mode';
      const csv = [head].concat(rows.map(r => [r.verified_at, r.merchant, r.reference, r.amount, r.currency, r.operator, r.risk_score, r.mode]
        .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))).join('\n');
      return [200, csv, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="koda-receipts.csv"' }];
    }
    return { receipts: rows, count: rows.length };
  }));
  r.get('/app/admin/devices', admin(() =>
    q.all(`SELECT d.id, d.label, d.operator, d.sim_msisdn, d.status, d.attested, d.last_seen, d.battery, d.parse_health, m.name merchant
           FROM devices d JOIN merchants m ON m.id=d.merchant_id ORDER BY d.last_seen DESC LIMIT 200`)));
  r.post('/app/admin/devices/:id/revoke', admin((req, user) => {
    const d = q.get('SELECT * FROM devices WHERE id=?', req.params.id);
    if (!d) return [404, { error: { code: 'device_not_found' } }];
    q.run(`UPDATE devices SET status = CASE status WHEN 'revoked' THEN 'active' ELSE 'revoked' END WHERE id=?`, d.id);
    const now = q.get('SELECT status FROM devices WHERE id=?', d.id).status;
    audit(d.merchant_id, user.id, 'admin.device_' + now, { device: d.id });
    return { ok: true, status: now };
  }));

  // ---- 8 · system health + audit log ----
  r.get('/app/admin/health', admin(() => {
    let dbUp = true; try { q.get('SELECT 1'); } catch { dbUp = false; }
    const recon = billing.reconcile();
    const backupDir = process.env.KODA_BACKUP_DIR || '';
    let lastBackup = null;
    try {
      if (backupDir) {
        const fs = require('node:fs');
        const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.db') || f.endsWith('.sqlite') || f.includes('backup'));
        if (files.length) {
          const newest = files.map(f => ({ f, m: fs.statSync(require('node:path').join(backupDir, f)).mtimeMs })).sort((a, b) => b.m - a.m)[0];
          lastBackup = new Date(newest.m).toISOString();
        }
      }
    } catch { /* ignore */ }
    return {
      db: dbUp ? 'up' : 'down',
      uptime_s: Math.round(process.uptime()),
      node: process.version,
      build: { sha: process.env.KODA_BUILD_SHA || 'dev', date: process.env.KODA_BUILD_DATE || 'unknown' },
      reconcile: recon,
      comms_live: !!(process.env.KODA_COMMS_LIVE === '1' || process.env.NODE_ENV === 'production'),
      smtp_configured: !!process.env.KODA_SMTP_HOST,
      backup: { dir_configured: !!backupDir, last_backup: lastBackup },
      counts: {
        merchants: q.get('SELECT COUNT(*) c FROM merchants').c,
        users: q.get('SELECT COUNT(*) c FROM users').c,
        receipts: q.get('SELECT COUNT(*) c FROM receipts').c,
        quarantined: q.get('SELECT COUNT(*) c FROM sms_ledger WHERE quarantined=1').c,
        open_disputes: q.get(`SELECT COUNT(*) c FROM disputes WHERE status='open'`).c,
        webhooks_dead: q.get(`SELECT COUNT(*) c FROM webhook_deliveries WHERE status='dead'`).c,
      },
    };
  }));
  r.get('/app/admin/audit', admin((req) => {
    const limit = Math.min(300, Math.max(1, Number((req.query || {}).limit) || 100));
    return q.all(`SELECT a.*, u.email actor_email FROM audit_log a LEFT JOIN users u ON u.id=a.user_id
                  ORDER BY a.created_at DESC LIMIT ?`, limit);
  }));

  // ============ Billing Mesh (collections) — operator surfaces ============
  // ---- Collections dashboard: topups by rail/status, treasury, ledger ----
  r.get('/app/admin/collections', admin(() => {
    const byRail = q.all(`SELECT rail, status, COUNT(*) n, COALESCE(SUM(total_usd),0) gross, COALESCE(SUM(subtotal_usd),0) net, COALESCE(SUM(acu_amount),0) acu
      FROM topups GROUP BY rail, status ORDER BY rail`);
    const totals = q.get(`SELECT COUNT(*) n, COALESCE(SUM(total_usd),0) gross, COALESCE(SUM(subtotal_usd),0) net FROM topups WHERE status='settled'`);
    const accounts = q.all(`SELECT account_key, balance_acu FROM billing_accounts ORDER BY account_key`);
    const recent = q.all(`SELECT id, account_key, entry_type, acu_delta, balance_after, created_at FROM billing_ledger ORDER BY created_at DESC LIMIT 40`);
    return { by_rail: byRail, settled_totals: totals, accounts, ledger: recent, reconcile: billing.reconcile() };
  }));

  // ---- Confirm/settle a topup (e.g. a KODA-SIM mobile-money plan payment the
  //      operator verified by hand, or a stuck rail). Activates plan or credits ACU. ----
  r.post('/app/admin/topups/:id/settle', admin((req, user) => {
    const t = q.get('SELECT * FROM topups WHERE id=?', req.params.id);
    if (!t) return [404, { error: { code: 'topup_not_found' } }];
    const out = billing.settleTopup(t.id);
    // A manual settle BYPASSES automated SMS/webhook verification, so it is
    // recorded as an override (who forced it) for the audit trail.
    audit(t.merchant_id, user.id, 'admin.topup_force_activated', { topup: t.id, purpose: t.purpose, plan: t.plan_key, override: true });
    return out;
  }));
  // TEST ONLY: simulate the operator payment SMS landing on the KODA SIM, so the
  // REAL auto-match path (matchKodaCollection → settleTopup) runs end-to-end without
  // a physical phone. Lets staff demo/test the full buyer flow: the buyer's checkout
  // screen (which polls) flips to '✓ active' on its next tick. Admin-only + audited.
  r.post('/app/admin/topups/:id/simulate-payment', admin((req, user) => {
    const t = q.get('SELECT * FROM topups WHERE id=?', req.params.id);
    if (!t) return [404, { error: { code: 'topup_not_found' } }];
    if (t.rail !== 'koda') return [400, { error: { code: 'not_a_koda_collection' } }];
    if (t.status === 'settled') return { ok: true, already: true };
    let local; try { local = JSON.parse(t.routing_snapshot || '{}').expected_local; } catch { /* none */ }
    if (local == null) return [400, { error: { code: 'no_expected_amount' } }];
    const r0 = billing.matchKodaCollection(local);   // the exact path a real Sentinel SMS triggers
    audit(t.merchant_id, user.id, 'admin.collection_simulated', { topup: t.id, amount_local: local, test: true });
    return (r0 && !Array.isArray(r0)) ? { ok: true, simulated: true, ...r0 } : { ok: false, note: 'no matching pending collection' };
  }));
  // Dismiss/cancel an UNPAID pending order (test clicks, abandoned checkouts). Never
  // touches a settled order; just clears it from the awaiting-confirmation list.
  r.post('/app/admin/topups/:id/cancel', admin((req, user) => {
    const t = q.get('SELECT * FROM topups WHERE id=?', req.params.id);
    if (!t) return [404, { error: { code: 'topup_not_found' } }];
    if (t.status === 'settled') return [409, { error: { code: 'already_settled', message: 'a settled payment cannot be dismissed' } }];
    const r0 = q.run(`UPDATE topups SET status='cancelled' WHERE id=? AND status IN ('pending','initiated')`, t.id);
    audit(t.merchant_id, user.id, 'admin.topup_cancelled', { topup: t.id, purpose: t.purpose, plan: t.plan_key });
    return { ok: r0.changes === 1, cancelled: t.id };
  }));
  // pending plan payments awaiting confirmation (surfaced in Collections)
  r.get('/app/admin/plan-payments', admin(() =>
    q.all(`SELECT t.id, t.plan_key, t.rail, t.total_usd, t.status, t.created_at, m.name merchant, m.id merchant_id
           FROM topups t JOIN merchants m ON m.id=t.merchant_id
           WHERE t.purpose='plan' ORDER BY t.created_at DESC LIMIT 100`)));

  // ---- Distributors (field agents who sell prepaid ACU) ----
  r.get('/app/admin/distributors', admin(() =>
    q.all(`SELECT d.*, (SELECT COUNT(*) FROM topups t WHERE t.distributor_id=d.id AND t.status='settled') sales,
           (SELECT COALESCE(SUM(acu_amount),0) FROM topups t WHERE t.distributor_id=d.id AND t.status='settled') sold_acu
           FROM distributors d ORDER BY d.created_at DESC`)));
  r.post('/app/admin/distributors', admin((req, user) => {
    const { name, country, msisdn } = req.body;
    if (!name || !country) return [400, { error: { code: 'missing_fields', message: 'name and country required' } }];
    const id = U.id('kd');
    q.run(`INSERT INTO distributors (id,merchant_id,name,country,msisdn,wholesale_bps,status) VALUES (?,?,?,?,?,?, 'active')`,
      id, req.body.merchant_id || null, name, String(country).toUpperCase().slice(0, 2), msisdn || null, Number(req.body.wholesale_bps) || 8500);
    audit(null, user.id, 'admin.distributor_created', { name, country });
    return { ok: true, id };
  }));
  r.post('/app/admin/distributors/:id/fund', admin((req, user) => {
    const d = q.get('SELECT * FROM distributors WHERE id=?', req.params.id);
    if (!d) return [404, { error: { code: 'distributor_not_found' } }];
    const acu = Math.round(Number(req.body.acu));
    if (!Number.isFinite(acu) || acu <= 0) return [400, { error: { code: 'bad_amount' } }];
    try {
      const r = billing.wholesalePurchase(d.id, acu, 'adminfund:' + d.id + ':' + user.id + ':' + acu + ':' + q.get('SELECT COUNT(*) c FROM topups').c);
      audit(null, user.id, 'admin.distributor_funded', { distributor: d.id, acu });
      return { ok: true, float: q.get('SELECT float_acu FROM distributors WHERE id=?', d.id).float_acu, result: r };
    } catch (e) { return [400, { error: { code: 'fund_failed', message: String(e.message || e) } }]; }
  }));
  r.post('/app/admin/distributors/:id/freeze', admin((req, user) => {
    const d = q.get('SELECT * FROM distributors WHERE id=?', req.params.id);
    if (!d) return [404, { error: { code: 'distributor_not_found' } }];
    q.run(`UPDATE distributors SET status = CASE status WHEN 'frozen' THEN 'active' ELSE 'frozen' END WHERE id=?`, d.id);
    const now = q.get('SELECT status FROM distributors WHERE id=?', d.id).status;
    audit(null, user.id, 'admin.distributor_' + now, { distributor: d.id });
    return { ok: true, status: now };
  }));

  // ---- Resellers & vouchers ----
  r.get('/app/admin/resellers', admin(() =>
    q.all(`SELECT r.*, (SELECT COUNT(*) FROM vouchers v WHERE v.reseller_id=r.id) vouchers
           FROM resellers r ORDER BY r.created_at DESC`)));
  r.post('/app/admin/resellers', admin((req, user) => {
    const { legal_name, country } = req.body;
    if (!legal_name || !country) return [400, { error: { code: 'missing_fields' } }];
    const id = U.id('rsl');
    q.run(`INSERT INTO resellers (id,legal_name,country,status,settlement_currency) VALUES (?,?,?,?,?)`,
      id, legal_name, String(country).toUpperCase().slice(0, 2), req.body.status || 'ACTIVE', req.body.settlement_currency || 'USD');
    audit(null, user.id, 'admin.reseller_created', { legal_name, country });
    return { ok: true, id };
  }));
  r.get('/app/admin/vouchers', admin(() =>
    q.all(`SELECT batch_id, reseller_id, product_code, acu_amount, country_lock, currency_lock,
           COUNT(*) n, SUM(status='dormant') dormant, SUM(status='active') active, SUM(status='redeemed') redeemed, SUM(status='void') void,
           MIN(created_at) created_at, MAX(expires_at) expires_at
           FROM vouchers GROUP BY batch_id ORDER BY created_at DESC LIMIT 100`)));
  r.post('/app/admin/resellers/:id/vouchers', admin((req, user) => {
    const reseller = q.get('SELECT * FROM resellers WHERE id=?', req.params.id);
    if (!reseller) return [404, { error: { code: 'reseller_not_found' } }];
    try {
      const out = vouchers.issueBatch(reseller, {
        product_code: req.body.product_code || 'ACU', acu_amount: Math.round(Number(req.body.acu_amount) || 0),
        quantity: Math.min(1000, Math.max(1, Math.round(Number(req.body.quantity) || 1))),
        country_lock: (req.body.country_lock || reseller.country || 'CD').toUpperCase().slice(0, 2),
        currency_lock: req.body.currency_lock || null, expires_at: req.body.expires_at || null,
      });
      if (req.body.activate && out.batch_id) vouchers.activateBatch(out.batch_id);
      audit(null, user.id, 'admin.voucher_batch_issued', { reseller: reseller.id, qty: req.body.quantity });
      return { ok: true, ...out };
    } catch (e) { return [400, { error: { code: 'issue_failed', message: String(e.message || e) } }]; }
  }));
  r.post('/app/admin/vouchers/:batch/activate', admin((req, user) => {
    try { const n = vouchers.activateBatch(req.params.batch); audit(null, user.id, 'admin.voucher_batch_activated', { batch: req.params.batch }); return { ok: true, activated: n }; }
    catch (e) { return [400, { error: { code: 'activate_failed', message: String(e.message || e) } }]; }
  }));

  // ---- Rails config (read-only view of the RAILS table + provider/secret env state) ----
  r.get('/app/admin/rails', admin(() => {
    const SBR = require('../shared/billing').RAILS;
    const envKey = { paddle_mor: 'PADDLE_KEY', stripe: 'STRIPE_KEY', flutterwave: 'FLUTTERWAVE_KEY', dlocal: 'DLOCAL_KEY', bitripay: 'BITRIPAY_KEY', bank_transfer: null, distributor: null, voucher: null };
    return {
      acu_markup: require('../shared/billing').ACU_MARKUP, unit_cost_usd: require('../shared/billing').UNIT_COST_USD, acu_price_usd: require('../shared/billing').ACU_PRICE_USD,
      rails: Object.entries(SBR).map(([code, r]) => ({
        code, ...r,
        provider_key: envKey[code] || null,
        provider_configured: envKey[code] ? !!process.env[envKey[code]] : (code === 'distributor' || code === 'voucher' || code === 'bank_transfer'),
        webhook_secret_set: !!(process.env['KODA_WEBHOOK_SECRET_' + code.toUpperCase()] || process.env.KODA_WEBHOOK_SECRET),
      })),
    };
  }));

  // ---- Doors: live-status of all 5 doors (+ Sentinel ingestion) ----
  r.get('/app/admin/doors', admin(() => {
    const meta = require('./comms/meta');
    return {
      doors: [
        { id: 1, name: 'Manual console', endpoint: 'POST /app/verify', live: true, requires: 'nothing (pure code path)', status: 'live', note: 'Screenshot path uses VisionAgent (3 ACU).' },
        { id: 3, name: 'API / drop-in', endpoint: 'POST /v1/intents', live: true, requires: 'an API key', status: 'live', note: 'koda_test keys run in sandbox on the same host.' },
        { id: 2, name: 'WhatsApp Chat', endpoint: 'POST /webhooks/whatsapp', live: meta.configured(), requires: 'META_WA_TOKEN + META_WA_PHONE_ID (+ APP_SECRET)', status: meta.configured() ? 'live' : 'sandbox', note: meta.appSecretSet() ? 'app secret set' : (meta.configured() ? 'app secret NOT set — inbound door CLOSED until set' : 'app secret NOT set (sandbox: signature skipped)') },
        { id: 4, name: 'USSD', endpoint: 'POST /webhooks/ussd', live: false, requires: 'a USSD shortcode from an aggregator (Africa\'s Talking / MNO)', status: 'endpoint ready', note: 'Routes by merchant msisdn. No KODA env key — shortcode lives at the aggregator.' },
        { id: 5, name: 'Inbound SMS', endpoint: 'POST /webhooks/sms', live: !!process.env.SMS_GATEWAY_KEY, requires: 'SMS_GATEWAY_KEY + an SMS long/short-code', status: process.env.SMS_GATEWAY_KEY ? 'live' : 'endpoint ready', note: 'Replies send via gateway only when the key is set.' },
      ],
      sentinel: {
        name: 'Sentinel phone-edge (feeds all doors)', endpoint: 'POST /v1/device/sms',
        active_devices: q.get(`SELECT COUNT(*) c FROM devices WHERE status='active'`).c,
        total_devices: q.get('SELECT COUNT(*) c FROM devices').c,
        requires: 'the Sentinel Android app on the merchant SIM phone',
      },
      config: {
        meta_wa_token: !!process.env.META_WA_TOKEN, meta_wa_phone_id: !!process.env.META_WA_PHONE_ID,
        meta_wa_app_secret: !!process.env.META_APP_SECRET, sms_gateway_key: !!process.env.SMS_GATEWAY_KEY,
      },
    };
  }));

  // ---- AI agents: the runnable mesh catalogue (+ growth + SEO) ----
  r.get('/app/admin/agents', admin(() => {
    const growth = require('./lib/growth');
    return {
      runnable: AGENTS.map(({ run, ...meta }) => meta),
      growth: Object.entries(growth.TOOLS).map(([id, t]) => ({ id, label: t.label, acu: t.acu })),
      seo: { id: 'K-10', label: 'SEO Autopilot', ai_gateway: !!(process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY) },
      acu_costs: require('../shared/plans').ACU,
    };
  }));

  // ---------- public API (/v1) — key-authenticated ----------
  r.get('/v1/ping', apiKey((req, m) => ({
    ok: true, merchant: m.name, plan: m.plan, environment: req.keyPrefix.includes('test') ? 'test' : 'live',
  })));
  // Verification lifecycle. Exposed under BOTH /v1/intents (original) and
  // /v1/verifications (spec §36 naming) — identical handlers, so either path works.
  // livemode follows the creating key: koda_test / koda_pub_test keys create TEST-mode
  // intents (sandbox refs allowed); every live key creates a live intent.
  const vCreate = (req, m) => createIntent(m, req.body, req.headers['idempotency-key'],
    /_test$/.test(req.keyPrefix || '') ? 0 : 1);
  const vList = (req, m) => q.all('SELECT * FROM intents WHERE merchant_id=? ORDER BY created_at DESC LIMIT 100', m.id);
  const vGet = (req, m) => {
    const i = q.get('SELECT * FROM intents WHERE id=? AND merchant_id=?', req.params.id, m.id);
    if (!i) return [404, { error: { code: 'not_found' } }];
    // Lazy expiry: an unpaid intent past its expires_at is reported (and flipped) to
    // 'expired', so pollers/reconcilers can release a stuck order instead of waiting forever.
    if (i.status === 'awaiting_payment' && i.expires_at && new Date(i.expires_at + 'Z').getTime() < Date.now()) {
      const cas = q.run(`UPDATE intents SET status='expired' WHERE id=? AND status='awaiting_payment'`, i.id);
      i.status = 'expired';
      if (cas.changes === 1) engine.emitOutcome(i.merchant_id, 'expired', 'timeout', { reference: i.id }); // §14 fire once
    }
    return i;
  };
  const vVerify = (req, m) => {
    const intent = q.get('SELECT * FROM intents WHERE id=? AND merchant_id=?', req.params.id, m.id);
    if (!intent) return [404, { error: { code: 'not_found' } }];
    if (intent.status !== 'awaiting_payment' && intent.status !== 'pending_review')
      return [409, { error: { code: 'intent_' + intent.status } }];
    return engine.verify(m, intent, req.body.reference || req.body.screenshot_ref,
      { mode: 'api', viaScreenshot: !!req.body.screenshot });
  };
  const vCancel = (req, m) => {
    q.run(`UPDATE intents SET status='cancelled' WHERE id=? AND merchant_id=? AND status='awaiting_payment'`,
      req.params.id, m.id);
    return { ok: true };
  };
  for (const base of ['/v1/intents', '/v1/verifications']) {
    r.post(base, apiKey(vCreate, 'write:intents')); // create is the only scoped one (unchanged)
    r.get(base, apiKey(vList));
    r.get(base + '/:id', apiKey(vGet));
    r.post(base + '/:id/verify', apiKey(vVerify));
    r.post(base + '/:id/recheck', apiKey(vVerify)); // §36 recheck == re-run verify (idempotent)
    r.post(base + '/:id/cancel', apiKey(vCancel));
  }
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
    // Real providers send their own event; only a successful-payment event settles.
    // (paid===false ⇒ acknowledge so the provider stops retrying, but credit nothing.)
    if (v.paid === false) return { ok: true, ignored: true, event: v.event };
    const tid = v.topup_id || (req.body && req.body.topup_id);
    if (!tid) return [400, { error: { code: 'topup_id_required' } }];
    return billing.settleTopup(tid);
  });

  // Buyer-facing redirect: turns a pending card/PSP checkout into the provider's real
  // hosted page. Kept isolated + async so the synchronous billing money-path stays sync.
  // The topup id is an unguessable capability token (like a checkout client_secret).
  r.get('/billing/go/:id', async (req) => {
    const t = q.get('SELECT * FROM topups WHERE id=?', req.params.id);
    if (!t) return [404, { error: { code: 'not_found' } }];
    const r0 = await billing.startProviderSession(t.id);
    if (r0 && r0.url) return [302, { redirecting_to: r0.url }, { Location: r0.url }];
    return [502, { error: { code: 'provider_error', detail: (r0 && (r0.detail || r0.error)) || 'no_checkout_url' } }];
  });

  // ---- Sentinel heartbeat: keeps device health fresh for the resolver (§9.3) ----
  r.post('/v1/device/heartbeat', (req) => {
    const tok = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || req.headers['x-device-token'];
    if (!tok || !/^dvk_/.test(tok)) return [401, { error: { code: 'device_unauthenticated' } }];
    // Accept a pending (just-enrolled) or active device; the first real heartbeat
    // activates it — that is the moment a phantom device becomes a real one.
    const dev = q.get(`SELECT * FROM devices WHERE device_token=? AND status IN ('active','pending')`, tok);
    if (!dev) return [401, { error: { code: 'device_unauthenticated' } }];
    const b = req.body || {};
    const capture = (b.capture === 'notification' || b.capture === 'sms') ? b.capture : dev.capture;
    q.run(`UPDATE devices SET status='active', last_seen=datetime('now'), battery=?, attested=?, parse_health=?, capture=? WHERE id=?`,
      Number.isFinite(+b.battery) ? Math.max(0, Math.min(100, +b.battery)) : dev.battery,
      b.attested ? 1 : dev.attested,
      Number.isFinite(+b.parse_health) ? Math.max(0, Math.min(1, +b.parse_health)) : dev.parse_health,
      capture, dev.id);
    return { ok: true, device_id: dev.id, next_heartbeat_s: 45 };
  });

  // ---- Sentinel config: device-token-auth token check + global sender allowlist ----
  // Sentinel calls this at pairing (validates the token, learns its merchant +
  // enrolled operator) and periodically (refreshes the operator sender allowlist
  // so its on-device privacy filter tracks the global registry with no rebuild).
  r.get('/v1/device/config', (req) => {
    const tok = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || req.headers['x-device-token'];
    if (!tok || !/^dvk_/.test(tok)) return [401, { error: { code: 'device_unauthenticated' } }];
    const dev = q.get(`SELECT * FROM devices WHERE device_token=? AND status IN ('active','pending')`, tok);
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
    const dev = q.get(`SELECT * FROM devices WHERE device_token=? AND status IN ('active','pending')`, tok);
    if (!dev) return [401, { error: { code: 'device_unauthenticated' } }];
    // a real forwarded SMS proves the phone is genuine — activate a pending device
    if (dev.status === 'pending') q.run(`UPDATE devices SET status='active', last_seen=datetime('now') WHERE id=?`, dev.id);
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
    `SELECT id,network_code,masked,account_identifier,account_holder_name,ownership_status,activation_status,
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
  r.post('/app/network-accounts/:id/update', auth((req, user, m) => networks.update(m, req.params.id, req.body)));
  r.post('/app/network-accounts/:id/remove', auth((req, user, m) => networks.remove(m, req.params.id)));
  r.post('/app/network-accounts/:id/link-device', auth((req, user, m) => networks.setState(m, req.params.id, { device_id: req.body.device_id || null })));
  r.get('/app/payment-methods', auth((req, user, m) => networks.resolve(m, req.query)));
  // operator picker for the "add receiving account" form — human names, not codes.
  // Returns EVERY SMS-verifiable (tier A/B) operator across all supported countries so
  // a merchant can never type "Airtel Money" and get UNKNOWN_NETWORK. The UI groups by
  // country and pre-selects the merchant's home country. Pass ?country=XX to narrow.
  r.get('/app/operators', auth((req, user, m) => {
    const reg = require('../shared/operators');
    const cc = String(req.query.country || '').toUpperCase();
    const list = reg.OPERATORS
      .filter(o => reg.tierOf(o) !== 'C')
      .filter(o => !cc || o.country === cc)
      .map(o => ({ code: o.id, name: o.name, currency: o.currency, country: o.country, support: o.packed ? 'LIVE' : 'BETA' }))
      .sort((a, b) => a.country.localeCompare(b.country) || a.name.localeCompare(b.name));
    return { home: (m.country || '').toUpperCase() || null, operators: list };
  }));

  // Public API (key): connect + activate + resolve; and the public country catalogue.
  r.post('/v1/merchant-network-accounts', apiKey((req, m) => networks.connect(m, req.body), 'write:intents'));
  r.post('/v1/merchant-network-accounts/:id/activate', apiKey((req, m) => networks.activate(m, req.params.id)));
  r.post('/v1/merchant-network-accounts/:id/pause', apiKey((req, m) => networks.setState(m, req.params.id, { activation_status: 'PAUSED' })));
  r.get('/v1/merchants/me/payment-methods', apiKey((req, m) => networks.resolve(m, req.query)));
  r.get('/v1/catalog/countries/:code/networks', (req) =>
    networks.catalogue(String(req.params.code || '').toUpperCase(), { currency: req.query.currency, supportStatus: req.query.support_status }));

  // ---- FX rate for exact-local-amount checkout (Web Integration Spec §I.2) ----
  // A store selling in USD but receiving CDF must show the EXACT local amount to send,
  // and the intent must be matched on that local amount — this kills ~90% of
  // amount_mismatch failures. KODA is NOT an FX provider: the rate is a configured,
  // pinned figure (KODA_USD_TO_LOCAL for USD↔CDF, or a KODA_RATES JSON map), returned
  // with a pin window so the shown amount can't drift mid-checkout.
  r.get('/v1/rates', (req) => {
    const from = String(req.query.from || '').toUpperCase();
    const to = String(req.query.to || '').toUpperCase();
    if (!from || !to) return [400, { error: { code: 'from_and_to_required' } }];
    let map = {}; try { map = JSON.parse(process.env.KODA_RATES || '{}'); } catch { /* ignore */ }
    const usdLocal = require('./lib/settings').usdToLocal();
    const localCur = require('./lib/settings').collectCurrency();
    // full precision on the reverse rate — rounding is applied only at final amount
    // computation, never baked into the rate (would drift the "exact amount").
    const table = { [`USD:${localCur}`]: usdLocal, [`${localCur}:USD`]: 1 / usdLocal, ...map };
    let rate = from === to ? 1 : table[`${from}:${to}`];
    if (rate == null) return [422, { error: { code: 'rate_unavailable', message: `no configured rate ${from}→${to}` } }];
    // pin window must be >= the intent lifetime (createTopup/intents use 1800s) so the
    // shown amount can't expire while the intent is still payable.
    return { from, to, rate, pinned_for_seconds: 1800, note: 'Configured rate, pinned for the checkout window. KODA does not perform FX.' };
  });

  // ---- detection: country + probable operator from customer signals ----
  // Stateless classification (Web Integration Spec §III). Public — returns no
  // merchant data. Accepts ?msisdn=&country=&locale= (any subset).
  r.get('/v1/detect', (req) => {
    const ops = require('../shared/operators');
    return ops.detect({ msisdn: req.query.msisdn, country: req.query.country, locale: req.query.locale });
  });
  // ---- a merchant's own enrolled operators + Sentinel health (secret key) ----
  // Powers the "payable operators" intersection: what THIS merchant can receive on.
  r.get('/v1/merchant/operators', apiKey((req, m) => {
    const ops = require('../shared/operators');
    const accounts = q.all(`SELECT network_code, account_identifier, masked, device_id, activation_status, ownership_status
      FROM merchant_network_accounts WHERE merchant_id=?`, m.id);
    return {
      merchant_country: m.country || null,
      operators: accounts.map(a => {
        const dev = a.device_id ? q.get('SELECT status, last_seen FROM devices WHERE id=?', a.device_id) : null;
        const online = dev && dev.status === 'active' && dev.last_seen &&
          (Date.now() - new Date(dev.last_seen + 'Z').getTime()) < 15 * 60 * 1000;
        return {
          id: a.network_code, name: (ops.byId[a.network_code] || {}).name || a.network_code,
          pay_to: a.masked || null, ussd: ops.DIAL[a.network_code] || null,
          ownership_status: a.ownership_status, enabled: a.activation_status === 'ACTIVE',
          sentinel_status: !a.device_id ? 'no_device' : online ? 'online' : 'offline',
        };
      }),
    };
  }, 'read:merchant'));

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

  // ADD-ON A — operator-API dual-confirm. Enrich a receipt: if an operator API
  // adapter is configured for its operator and it independently confirms, upgrade
  // the receipt to `dual_confirmed`. No adapter → stays `sms_anchored` (today's
  // behaviour). The SMS-anchored verdict is never changed, only labelled.
  r.post('/v1/receipts/:id/crosscheck', apiKey(async (req, m) => {
    return await crosscheck.enrichReceipt(m, req.params.id);
  }, 'read:receipts'));

  // ADD-ON B — network trust score (the productised data asset). Merchant-local
  // history + the privacy-preserving KODA-wide aggregate for a payer subject.
  r.get('/v1/trust/:subject', apiKey((req, m) =>
    trustLookup(m, { subject: req.params.subject }), 'read:agents'));
  // Contribute an explicit network fraud flag (a chargeback / confirmed scam).
  r.post('/v1/trust/flag', apiKey((req, m) => {
    const b = req.body || {};
    if (!b.subject && !b.reference) return [400, { error: { code: 'subject_or_reference_required' } }];
    try {
      if (b.subject) trustNet.flag({ kind: 'payer', value: b.subject, reason: b.reason, merchantId: m.id });
      if (b.reference) trustNet.flag({ kind: 'reference', value: b.reference, reason: b.reason, merchantId: m.id });
    } catch { /* network optional */ }
    return { ok: true, contributed: true, note: 'Flag added to the KODA trust network (hashed; no raw value stored).' };
  }, 'write:intents'));

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

  // Machine-readable spec for tools. When a human opens it in a BROWSER
  // (Accept: text/html), redirect to the rendered /api-reference page so nobody
  // ever lands on raw JSON by navigating. curl/Postman/SDK gens still get JSON.
  r.get('/v1/openapi.json', (req) => {
    const accept = String(req.headers && req.headers['accept'] || '');
    if (accept.includes('text/html')) return [302, '', { location: '/api-reference' }];
    return openapi();
  });

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
    if (res.status === 'verified' || res.status === 'verified_late' || res.status === 'already_verified')
      return `Paiement confirme: ${Number(res.amount_confirmed).toLocaleString('fr-FR')} ${cur}. Merci!`;
    if (res.status === 'pending_review') return `Paiement en controle manuel. Ouvrez votre application KODA pour confirmer.`;
    if (res.status === 'not_found_yet') return `Paiement en route. Reessayez dans un instant.`;
    if (res.code === 'code_already_used') return `Code deja utilise. Verifiez la reference.`;
    if (res.code === 'sms_quarantined') return `SMS suspect (chaine de solde rompue). Non confirme.`;
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
    const text = String(b.text || '');
    // The key path for non-Android (iPhone / feature-phone) merchants: they FORWARD
    // the whole operator SMS to KODA's number. That forwarded SMS IS the merchant-side
    // proof — so we INGEST it (exactly like a Sentinel forward), then confirm it. A
    // bare code (from a merchant who already runs Sentinel) still works via verify().
    const asSms = parseSms(text);
    let res;
    if (asSms && asSms.ref && asSms.amount != null) {
      const ing = engine.ingestSms(m, { raw: text });
      // ingestSms now auto-verifies a clean walk-in (ing.auto) or auto-matches a
      // pending intent (ing.auto is null → it was claimed as verified).
      res = ing.quarantined ? { status: 'rejected', code: 'sms_quarantined' }
          : ing.auto ? ing.auto
          : { status: 'verified', amount_confirmed: asSms.amount };
    } else {
      const code = (text.toUpperCase().match(/[A-Z0-9][A-Z0-9.\-]{4,}/g) || []).find(t => /\d/.test(t));
      res = code ? engine.verify(m, null, code, { mode: 'sms' }) : { status: 'help' };
    }
    const reply = res.status === 'help'
      ? 'Transferez le SMS de paiement de l’operateur (ou envoyez le code) pour verifier.'
      : verdictText(res, m);
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
  // Referral engine — my share link + who I've brought + rewards earned.
  r.get('/app/referrals', auth((req, user, m) => m ? require('./lib/referrals').stats(m.id) : [400, { error: 'no_merchant' }]));
  r.post('/app/growth/:tool', auth(async (req, user, m) => {
    if (!m) return [400, { error: 'no_merchant' }];
    const toolId = req.params.tool;
    const tool = growth.TOOLS[toolId];
    if (!tool) return [404, { error: 'unknown_tool' }];
    const ai = require('./lib/ai');
    const promptFn = growth.AI_PROMPTS[toolId];
    // Content tools charge ONLY when a real model can run; data tools always run.
    const contentTool = !!promptFn;
    const willCharge = tool.acu > 0 && (!contentTool || ai.available());
    if (willCharge) {
      const gate = engine.gateAI(m, tool.acu, 'growth:' + toolId);
      if (gate.ok !== true) return gate; // gated by available ACU
    }
    // recommendations reads the merchant's real KODA data
    let input = req.body || {};
    if (toolId === 'recommendations') {
      const month = q.get(`SELECT COUNT(*) c FROM receipts WHERE merchant_id=? AND verified_at > date('now','start of month')`, m.id).c;
      const unmatched = q.get(`SELECT COUNT(*) c FROM sms_ledger WHERE merchant_id=? AND matched_intent_id IS NULL AND quarantined=0 AND ref_code IS NOT NULL`, m.id).c;
      const disputes = q.get(`SELECT COUNT(*) c FROM disputes WHERE merchant_id=? AND status='open'`, m.id).c;
      input = { acu: m.acu_balance, unmatched, disputes, monthVerifs: month, planQuota: (PLANS[m.plan] || {}).verifs };
    }
    const result = tool.run(m, input); // template = structure + honest fallback
    // Real AI generation (live, varies each run) when a provider key is configured.
    let aiUsed = false;
    if (contentTool && ai.available()) {
      try {
        result.ai_text = await ai.generate({ system: growth.AI_SYSTEM, prompt: promptFn(m, input) });
        result.ai_provider = ai.provider();
        aiUsed = true;
      } catch (e) { result.ai_text = null; result.ai_error = String(e && e.message || e); }
    }
    result.ai_available = ai.available();
    // Only charge when the model actually ran (content tools) or for real data tools.
    const charge = (aiUsed || (!contentTool && tool.acu > 0)) ? tool.acu : 0;
    if (charge > 0) engine.chargeAcu(m, tool.acu, 'growth:' + toolId, null);
    audit(m.id, user.id, 'growth_tool', { tool: toolId, acu: charge, ai: aiUsed });
    return { tool: toolId, acu_consumed: charge, result };
  }));

  // ---------- SEO agent (K-10) + autopilot ----------
  const seo = require('./lib/seo');
  // public: what the SEO agent has published (also handy for internal dashboards)
  r.get('/v1/seo/posts', () => ({
    site: seo.SITE,
    posts: seo.allPosts().map(p => ({ slug: p.slug, title: p.title, keyword: p.keyword,
      url: `${seo.SITE}/blog/${p.slug}`, tags: p.tags, internal_links: (p.links || []).length + (p.related || []).length })),
  }));
  // public: count a blog-post read (fired by a same-origin beacon on each post page).
  // Only known slugs are accepted, so it can never create arbitrary rows. Returns the
  // running total so the page can display it. Aggregate only — no PII.
  const BLOG_SLUGS = new Set(seo.allPosts().map(p => p.slug));
  r.post('/v1/blog/view', (req) => {
    const slug = String((req.body && req.body.slug) || '').trim();
    if (!BLOG_SLUGS.has(slug)) return [404, { error: 'unknown_post' }];
    q.run(`INSERT INTO blog_views (slug, views, updated_at) VALUES (?, 1, datetime('now'))
           ON CONFLICT(slug) DO UPDATE SET views = views + 1, updated_at = datetime('now')`, slug);
    const row = q.get('SELECT views FROM blog_views WHERE slug=?', slug);
    return { ok: true, slug, views: row ? row.views : 1 };
  });
  // admin: per-post SEO score (with an actionable checklist) + read counts, most-read first.
  r.get('/app/seo/posts', admin(() => {
    const views = Object.fromEntries(q.all('SELECT slug, views FROM blog_views').map(r => [r.slug, r.views]));
    const posts = seo.postsMeta()
      .map(p => ({ ...p, url: `${seo.SITE}/blog/${p.slug}`, views: views[p.slug] || 0 }))
      .sort((a, b) => b.views - a.views || b.score - a.score);
    const avg = posts.length ? Math.round(posts.reduce((a, p) => a + p.score, 0) / posts.length) : 0;
    return { posts, total_views: posts.reduce((a, p) => a + p.views, 0), avg_score: avg };
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
    const pay_to = buildPayTo(i.merchant_id, m.msisdn, JSON.parse(i.operators), i.currency);
    return {
      intent_id: i.id, status: i.status, amount: i.amount, currency: i.currency,
      merchant: { name: m.logo_text || m.name, brand_color: m.brand_color },
      metadata: JSON.parse(i.metadata || '{}'),
      pay_to,
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
function createIntent(m, body, idemKey, livemode = 1) {
  if (m.status !== 'active') return [403, { error: { code: 'merchant_suspended' } }];
  if (m.acu_balance <= -100) return [402, { error: { code: 'insufficient_credit' } }];
  // Idempotency (spec §26): a repeat create with the same key returns the ORIGINAL
  // verification instead of creating a second one. Scoped per merchant.
  idemKey = (typeof idemKey === 'string' && idemKey.trim()) ? idemKey.trim().slice(0, 128) : null;
  if (idemKey) {
    const prev = q.get('SELECT response FROM idempotency_keys WHERE merchant_id=? AND key=?', m.id, idemKey);
    if (prev) return JSON.parse(prev.response);
  }
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
  q.run(`INSERT INTO intents (id,merchant_id,amount,currency,operators,customer_msisdn,metadata,purpose,client_secret,success_url,cancel_url,livemode,expires_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?, datetime('now','+' || ? || ' seconds'))`,
    iid, m.id, amount, currency, JSON.stringify(ops),
    body.customer_msisdn || null, JSON.stringify(body.metadata || {}),
    body.purpose === 'topup' ? 'topup' : 'sale', clientSecret, okUrl(body.success_url), okUrl(body.cancel_url),
    livemode ? 1 : 0,
    Math.min(3600, Number(body.expires_in) || 900));
  const intent = q.get('SELECT * FROM intents WHERE id=?', iid);
  // Network Intelligence: the resolver returns only the merchant's active,
  // verified, healthy networks for this country/currency/door. Falls back to the
  // legacy operators list (pay_to) when no network accounts are configured yet.
  const resolved = networks.resolve(m, { country: body.country || m.country, currency, amount, door: 'API' });
  const resp = {
    intent_id: iid, status: intent.status,
    client_secret: clientSecret,
    checkout_url: `${SITE_BASE()}/pay/${iid}?cs=${clientSecret}`,
    network_selection: ['AUTO', 'CUSTOMER', 'FIXED'].includes(body.network_selection) ? body.network_selection : 'CUSTOMER',
    available_networks: resolved.available,
    pay_to: buildPayTo(m.id, m.msisdn, ops, currency),
    expires_at: intent.expires_at,
  };
  // store the idempotent result (unique PK guards a same-key race)
  if (idemKey) { try { q.run('INSERT INTO idempotency_keys (merchant_id,key,intent_id,response) VALUES (?,?,?,?)', m.id, idemKey, iid, JSON.stringify(resp)); } catch { /* concurrent same-key insert */ } }
  return resp;
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
    // A suspended MERCHANT revokes session access for all its users (admins exempt).
    if (merchant && merchant.status !== 'active' && !user.is_admin) return [403, { error: { code: 'account_suspended' } }];
    return handler(req, user, merchant);
  };
}
/*
 * The pay-to list for a checkout: the merchant's ACTIVE receiving accounts that can
 * take this currency — each network showing ITS OWN full number. With none enrolled,
 * the profile number is offered only for the operator its prefix belongs to; a number
 * matching none of the offered operators yields an empty list, and the checkout page
 * says the merchant is not ready. One implementation for both the hosted checkout GET
 * and the intent-creation response — they must never disagree about where money goes.
 */
function buildPayTo(merchantId, msisdn, operators, currency) {
  // Per-operator USSD dial code from the registry (correct across countries) — NOT a
  // hardcoded DRC guess: Afrimoney DRC is *144# (not *150#), and a Kenyan/Senegalese
  // operator must not be handed a Congolese code. null when the registry has no code.
  const opsLib = require('../shared/operators');
  const ussd = (o) => opsLib.DIAL[o] || null;
  const activeAll = q.all(
    `SELECT network_code, account_identifier, receive_currencies FROM merchant_network_accounts
     WHERE merchant_id=? AND submerchant_id IS NULL AND activation_status='ACTIVE' ORDER BY priority`, merchantId);
  // Prefer accounts whose currency tag lists this order's currency, but NEVER hide a real
  // per-network account behind the profile fallback just because its tag omits it: in DRC
  // the same M-Pesa / Orange / Airtel / Africell number receives both CDF and USD. This
  // also covers accounts stored before the dual-currency default (tagged ["CDF"] only) —
  // they still show on a USD order without needing a data migration.
  const curMatch = activeAll.filter(a => { try { const c = JSON.parse(a.receive_currencies || '[]'); return !c.length || !currency || c.includes(currency); } catch { return true; } });
  const active = curMatch.length ? curMatch : activeAll;
  if (active.length) {
    return active.map(a => ({ operator: a.network_code, number: a.account_identifier || msisdn || '', ussd_hint: ussd(a.network_code) }));
  }
  const owner = msisdn ? opsLib.operatorByMsisdn(msisdn) : null;
  return owner && operators.includes(owner)
    ? [{ operator: owner, number: msisdn, ussd_hint: ussd(owner) }]
    : [];
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
    description: 'Trust score for a payer, derived deterministically from this merchant’s own ledger history (verified payments, quarantines, disputes, tenure, velocity).',
    run: (m, body) => trustLookup(m, body) },
  { type: 'dispute-evidence', id: 'K-06', label: 'DisputeAgent', acu: 3,
    description: 'Assemble an audit-grade evidence file for a contested reference.',
    run: (m, body) => ({
      reference: body.reference || null,
      ledger_scan: q.get('SELECT id FROM sms_ledger WHERE merchant_id=? AND UPPER(ref_code)=UPPER(?)', m.id, body.reference || '') ? 'found_in_ledger' : 'no_matching_sms',
      replay_index: q.get('SELECT receipt_id FROM replay_index WHERE merchant_id=? AND reference=UPPER(?)', m.id, body.reference || '') ? 'code_consumed' : 'code_unused',
      recommendation: 'request payer-number confirmation from customer',
    }) },
  { type: 'vision', id: 'K-04', label: 'VisionAgent', acu: 3,
    description: 'Cross-check a reference/amount read from a payment screenshot against the operator SMS on the merchant’s own device — the authoritative proof a screenshot can never be on its own.',
    run: (m, body) => visionCrossCheck(m, body) },
];

// ---- K-03 TrustAgent: deterministic trust score from the merchant's own ledger ----
// No black-box ML: every point is traceable to a real row this merchant owns.
function trustLookup(m, body) {
  const raw = String(body.subject || body.payer || body.msisdn || '').trim();
  if (!raw) return { subject: null, trust_score: null, confidence: 'none', signals: [], note: 'Provide `subject` — a payer number (or its last digits) to score.' };
  // Match on the trailing digits we actually store (payer_suffix / counterparty_suffix).
  const digits = raw.replace(/\D/g, '');
  const suffix = digits.slice(-4) || digits;
  const like = '%' + suffix;

  const successes = q.get(`SELECT COUNT(*) c, MIN(verified_at) first_seen, MAX(verified_at) last_seen
    FROM receipts WHERE merchant_id=? AND payer_suffix LIKE ?`, m.id, like);
  const quarantined = q.get(`SELECT COUNT(*) c FROM sms_ledger
    WHERE merchant_id=? AND quarantined=1 AND counterparty_suffix LIKE ?`, m.id, like).c;
  const chainBreaks = q.get(`SELECT COUNT(*) c FROM sms_ledger
    WHERE merchant_id=? AND chain_ok=0 AND counterparty_suffix LIKE ?`, m.id, like).c;
  const disputes = q.get(`SELECT COUNT(*) c FROM disputes d
    WHERE d.merchant_id=? AND UPPER(d.reference) IN
      (SELECT UPPER(reference) FROM receipts WHERE merchant_id=? AND payer_suffix LIKE ?)`, m.id, m.id, like).c;
  const recent24h = q.get(`SELECT COUNT(*) c FROM receipts
    WHERE merchant_id=? AND payer_suffix LIKE ? AND verified_at > datetime('now','-1 day')`, m.id, like).c;

  const sightings = successes.c + quarantined + disputes;
  // Deterministic scoring — start neutral, reward clean history & tenure, punish fraud markers.
  let score = 0.5;
  score += Math.min(successes.c, 10) * 0.03;            // up to +0.30 for a track record
  score -= quarantined * 0.15;                          // spoofed/quarantined SMS from this payer
  score -= chainBreaks * 0.10;                          // balance-chain breaks
  score -= disputes * 0.20;                             // disputes hurt most
  score -= Math.max(0, recent24h - 5) * 0.05;           // velocity spike
  if (successes.first_seen) {
    const ageDays = (Date.now() - new Date(successes.first_seen + 'Z').getTime()) / 86400000;
    if (ageDays > 30) score += 0.10; else if (ageDays > 7) score += 0.05;
  }
  score = Math.max(0, Math.min(1, score));

  const confidence = sightings >= 5 ? 'high' : sightings >= 1 ? 'medium' : 'none';
  // ADD-ON B: layer the cross-merchant network aggregate on top of the merchant's
  // own view — counts only, no identities, no other merchant's data.
  let network = null;
  try { network = trustNet.lookup(raw); } catch { network = null; }
  return {
    subject_suffix: suffix,
    trust_score: sightings ? Math.round(score * 100) / 100 : null,
    confidence,
    signals: {
      verified_payments: successes.c,
      quarantined_sms: quarantined,
      chain_breaks: chainBreaks,
      disputes: disputes,
      payments_last_24h: recent24h,
      first_seen: successes.first_seen || null,
      last_seen: successes.last_seen || null,
    },
    network,   // { available, seen, network_trust_score, signals:{ verified_across_network, ... } }
    note: sightings
      ? 'Score from this merchant’s own ledger; `network` adds the KODA-wide aggregate (no other merchant’s data is exposed).'
      : 'No prior history for this payer on your account. See `network` for any KODA-wide signal.',
  };
}

// ---- K-04 VisionAgent: the honest forensic is the operator-SMS cross-check ----
// A screenshot is never proof on its own; we verify the claimed reference/amount
// against the operator SMS captured on the merchant's own device.
function visionCrossCheck(m, body) {
  const ref = String(body.screenshot_ref || body.reference || '').trim();
  const claimedAmount = body.amount != null ? Number(body.amount) : null;
  if (!ref) return { extracted_reference: null, verdict: 'no_reference', note: 'Provide `screenshot_ref` — the reference code read from the screenshot.' };

  const sms = q.get(`SELECT amount, currency, operator, counterparty_suffix, balance_after,
      chain_ok, quarantined, received_at FROM sms_ledger
    WHERE merchant_id=? AND UPPER(ref_code)=UPPER(?) ORDER BY received_at DESC LIMIT 1`, m.id, ref);
  const consumed = q.get('SELECT receipt_id, used_at FROM replay_index WHERE merchant_id=? AND reference=UPPER(?)', m.id, ref);

  let verdict, ok = false;
  if (!sms) {
    verdict = 'no_operator_sms_backs_this_screenshot';   // the classic forged/edited screenshot
  } else if (sms.quarantined || !sms.chain_ok) {
    verdict = 'matching_sms_is_quarantined';              // spoof caught by the chain defence
  } else if (claimedAmount != null && Number(sms.amount) !== claimedAmount) {
    verdict = 'amount_mismatch';                          // edited amount on a real reference
  } else if (consumed) {
    verdict = 'code_already_used';                        // replay of a spent code
  } else {
    verdict = 'backed_by_operator_sms'; ok = true;        // real, unspent, chain-clean
  }

  return {
    extracted_reference: ref,
    claimed_amount: claimedAmount,
    verdict,
    backed_by_operator_sms: ok,
    ledger_match: sms ? {
      amount: sms.amount, currency: sms.currency, operator: sms.operator,
      payer_suffix: sms.counterparty_suffix, received_at: sms.received_at,
      quarantined: !!sms.quarantined, chain_ok: !!sms.chain_ok,
    } : null,
    replay_status: consumed ? { state: 'already_consumed', used_at: consumed.used_at } : { state: 'unused' },
    image_forensics: { available: false,
      note: 'Pixel-level forgery analysis (ELA / font metrics) is not enabled on this instance. The verdict above is derived from the operator-SMS ledger cross-check, which is authoritative — a screenshot with no matching operator SMS on your device cannot be trusted regardless of how clean the pixels look.' },
    note: 'A screenshot is never proof on its own. KODA checks the claimed reference against the operator SMS captured on your own device — that is the truth.',
  };
}
function safeUser(u) { const { pass_hash, ...rest } = u; return rest; }

function openapi() {
  return {
    openapi: '3.1.0',
    info: { title: 'KODA API', version: VERSION.api, description: 'Payment verification for mobile money — the SMS is the API.' },
    servers: [{ url: 'https://kodajnn.com/v1', description: 'Production. Use koda_live_ keys; koda_test_ keys run in sandbox on the same host.' }],
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

// Test-friendly exports for the deterministic AI agents (K-03 / K-04). These are
// pure DB-derived functions; exposing them lets the test suite assert real values.
module.exports.trustLookup = trustLookup;
module.exports.visionCrossCheck = visionCrossCheck;
