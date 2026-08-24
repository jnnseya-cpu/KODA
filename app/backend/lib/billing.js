// KODA — Billing Orchestrator (System B). Sits between the billing domain and every
// external rail; the domain talks to this contract, never to a provider directly.
// Money is never a mutable column: every settlement posts a balanced, chained,
// idempotent double-entry into billing_ledger. Prices are SERVER-AUTHORITATIVE —
// the client's amount is never trusted; we quote from shared/billing.
'use strict';
const crypto = require('node:crypto');
const { q, tx } = require('./db');
const U = require('./util');
const B = require('../../shared/billing');
const settings = require('./settings');   // admin-managed KODA collection config (DB → env → default)

// Webhook authenticity — a provider callback settles real money, so it MUST prove
// itself. FAIL CLOSED: no configured secret or a bad/absent signature ⇒ reject and
// settle nothing. Real adapters map their own header/scheme onto this HMAC check.
function verifyWebhook(provider, req) {
  provider = String(provider || '').toLowerCase();
  const raw = req.rawBody != null ? req.rawBody : Buffer.from(JSON.stringify(req.body || {}));
  const body = req.body || safeJson(raw);
  // Real provider schemes: each activates ONLY when that provider's own secret is set,
  // so an environment configured for real Stripe/Paystack/Flutterwave verifies natively.
  if (provider === 'stripe' && process.env.STRIPE_WEBHOOK_SECRET) return verifyStripe(req, raw, body);
  if (provider === 'paystack' && process.env.PAYSTACK_KEY) return verifyPaystack(req, raw, body);
  if (provider === 'flutterwave' && process.env.FLUTTERWAVE_WEBHOOK_HASH) return verifyFlutterwave(req, body);
  // Generic KODA-signed scheme (sandbox, tests, bank_transfer, admin tools). FAIL CLOSED.
  const secret = process.env['KODA_WEBHOOK_SECRET_' + provider.toUpperCase()] || process.env.KODA_WEBHOOK_SECRET;
  if (!secret) return { ok: false, reason: 'no_secret_configured' };   // never settle from an unsigned/unconfigured webhook
  const sig = String(req.headers['x-koda-signature'] || req.headers['x-webhook-signature'] || '');
  const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  const a = Buffer.from(sig), e = Buffer.from(expected);
  const ok = a.length === e.length && crypto.timingSafeEqual(a, e);
  return { ok, topup_id: (body && body.topup_id) || null };
}
function safeJson(raw) { try { return JSON.parse(raw.toString()); } catch { return {}; } }
function timingEqHex(aHex, bHex) {
  const a = Buffer.from(String(aHex)), b = Buffer.from(String(bHex));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
// Stripe: header `Stripe-Signature: t=<ts>,v1=<hmac>`; HMAC-SHA256 of `${t}.${rawBody}`
// with the endpoint's whsec. Settle only on checkout.session.completed (paid).
function verifyStripe(req, raw, body) {
  const header = String(req.headers['stripe-signature'] || '');
  const parts = Object.fromEntries(header.split(',').map(kv => kv.split('=').map(s => s.trim())));
  if (!parts.t || !parts.v1) return { ok: false, reason: 'bad_signature_header' };
  const expected = crypto.createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET).update(`${parts.t}.${raw.toString()}`).digest('hex');
  if (!timingEqHex(parts.v1, expected)) return { ok: false, reason: 'bad_signature' };
  const obj = (body && body.data && body.data.object) || {};
  const tid = obj.client_reference_id || (obj.metadata && obj.metadata.topup_id) || null;
  const paid = body.type === 'checkout.session.completed' && (obj.payment_status ? obj.payment_status === 'paid' : true);
  return { ok: true, topup_id: tid, paid, event: body.type };
}
// Paystack: header `x-paystack-signature` = HMAC-SHA512 of the raw body with the secret key.
function verifyPaystack(req, raw, body) {
  const sig = String(req.headers['x-paystack-signature'] || '');
  const expected = crypto.createHmac('sha512', process.env.PAYSTACK_KEY).update(raw).digest('hex');
  if (!timingEqHex(sig, expected)) return { ok: false, reason: 'bad_signature' };
  const data = (body && body.data) || {};
  const tid = data.reference || (data.metadata && data.metadata.topup_id) || null;
  const paid = body.event === 'charge.success' && (data.status ? data.status === 'success' : true);
  return { ok: true, topup_id: tid, paid, event: body.event };
}
// Flutterwave: header `verif-hash` must equal the configured secret hash (constant compare).
function verifyFlutterwave(req, body) {
  const sig = String(req.headers['verif-hash'] || '');
  if (!timingEqHex(sig, process.env.FLUTTERWAVE_WEBHOOK_HASH)) return { ok: false, reason: 'bad_signature' };
  const data = (body && body.data) || {};
  const tid = data.tx_ref || (data.meta && data.meta.topup_id) || null;
  const paid = (data.status || '').toLowerCase() === 'successful';
  return { ok: true, topup_id: tid, paid, event: body.event || 'charge.completed' };
}

// ── ledger: append-only, double-entry, balance_after chained per account ──────
function acctBalance(key) {
  const r = q.get('SELECT balance_acu FROM billing_accounts WHERE account_key=?', key);
  return r ? r.balance_acu : 0;
}
function post(entries, { topupId, idempotencyKey, ref } = {}) {
  // entries: [{ account_key, entry_type, acu_delta }, ...] — MUST sum to zero
  const sum = entries.reduce((a, e) => a + e.acu_delta, 0);
  if (sum !== 0) throw new Error(`double-entry not balanced: Σ=${sum}`);
  // idempotency: if this key already posted, do nothing (retry-safe)
  if (idempotencyKey && q.get('SELECT 1 FROM billing_ledger WHERE idempotency_key=? LIMIT 1', idempotencyKey))
    return { idempotent: true };
  for (const e of entries) {
    q.run('INSERT INTO billing_accounts (account_key,balance_acu) VALUES (?,0) ON CONFLICT(account_key) DO NOTHING', e.account_key);
    q.run('UPDATE billing_accounts SET balance_acu = balance_acu + ? WHERE account_key=?', e.acu_delta, e.account_key);
    const bal = acctBalance(e.account_key);
    q.run(`INSERT INTO billing_ledger (account_key,entry_type,acu_delta,balance_after,topup_id,ref,idempotency_key)
           VALUES (?,?,?,?,?,?,?)`, e.account_key, e.entry_type, e.acu_delta, bal, topupId || null, ref || null, idempotencyKey || null);
  }
  return { idempotent: false };
}

// ── provider registry ────────────────────────────────────────────────────────
// createSession stays SYNCHRONOUS (the money-path and its tests call it inline).
// When a provider's API key is configured, we return a KODA redirect URL
// (/billing/go/:id); clicking it mints the REAL hosted checkout in the async
// startProviderSession() below. When no key is set we keep the sandbox URL, so
// tests and un-configured environments behave exactly as before.
const PROVIDER_KEY_ENV = { stripe: 'STRIPE_KEY', paddle_mor: 'PADDLE_KEY', flutterwave: 'FLUTTERWAVE_KEY', dlocal: 'DLOCAL_KEY', bitripay: 'BITRIPAY_KEY', paystack: 'PAYSTACK_KEY' };
function publicBase() { return (process.env.KODA_PUBLIC_URL || 'http://localhost:4600').replace(/\/$/, ''); }
const LIVE_ADAPTER = new Set(['stripe', 'paystack', 'flutterwave']); // rails with a real REST adapter
const PROVIDERS = {};
function register(code, adapter) { PROVIDERS[code] = { providerCode: code, ...adapter }; }
// Card / MoR / aggregator rails: a hosted/push session; settlement arrives by webhook.
for (const code of ['stripe', 'paystack', 'paddle_mor', 'flutterwave', 'dlocal', 'bitripay', 'bank_transfer']) {
  register(code, {
    createSession(topup) {
      const keyEnv = PROVIDER_KEY_ENV[code];
      const flow = (B.RAILS[code] && B.RAILS[code].flow) || 'HOSTED_CHECKOUT';
      if (keyEnv && process.env[keyEnv] && LIVE_ADAPTER.has(code)) {
        // real rail: defer the provider call to the /billing/go redirect (kept async there)
        return { flow, provider: code, checkout_url: `${publicBase()}/billing/go/${topup.id}`, provider_ref: null };
      }
      return { flow, provider: 'sandbox', checkout_url: `sandbox://${code}/${topup.id}`, provider_ref: 'sb_' + U.token(4) };
    },
  });
}

// Async: mint the REAL provider checkout for a pending top-up/plan and return its URL.
// Called only from the /billing/go/:id redirect route — never from the sync money-path.
async function startProviderSession(topupId) {
  const t = q.get('SELECT * FROM topups WHERE id=?', topupId);
  if (!t) return { error: 'topup_not_found' };
  if (t.status === 'settled') return { url: `${appBase()}/app/#billing?paid=1` };
  const providers = require('./rail_providers');
  const ctx = {
    success_url: `${appBase()}/app/#${t.purpose === 'plan' ? 'billing?paid=1' : 'billing?topup=1'}`,
    cancel_url: `${appBase()}/app/#billing?cancelled=1`,
  };
  const r = await providers.createCheckout(t.rail, t, ctx);
  if (r && r.provider_ref) q.run('UPDATE topups SET provider_ref=? WHERE id=?', r.provider_ref, t.id);
  return r;
}
function appBase() { return (process.env.KODA_APP_URL || process.env.KODA_PUBLIC_URL || 'http://localhost:4600').replace(/\/$/, ''); }

// ── methods for a merchant context (routing + server-side quote per rail) ──────
function methods(merchant, ctx = {}) {
  const country = (ctx.country || merchant.country || '').toUpperCase();
  const acu = Math.max(1, Math.round(Number(ctx.amount_acu) || 0));
  const ranked = B.routeProviders({ country, amount_acu: acu, recurring: !!ctx.recurring });
  // Retail base price: the pack price (ctx.usd) is authoritative when given (e.g.
  // $10 → 100 ACU); otherwise fall back to the per-ACU rate. The rail's collection
  // fee is added on top (passed through to the buyer, never absorbed).
  const retail = Number(ctx.usd) > 0 ? Number(ctx.usd) : Math.round(acu * B.ACU_PRICE_USD * 100) / 100;
  const withFee = (railCode) => {
    const fee = Math.round(retail * ((B.RAILS[railCode] && B.RAILS[railCode].fee_pct) || 0) * 100) / 100;
    return { rail: railCode, acu, subtotal_usd: retail, collection_fee_usd: fee, total_usd: Math.round((retail + fee) * 100) / 100, currency: ctx.currency || 'USD' };
  };
  // a rail is only offered as clickable when its provider is really configured;
  // otherwise it's shown greyed as 'not set up' (never a broken sandbox checkout).
  const PROVIDER_ENV = { stripe: 'STRIPE_KEY', paystack: 'PAYSTACK_KEY', paddle_mor: 'PADDLE_KEY', flutterwave: 'FLUTTERWAVE_KEY', dlocal: 'DLOCAL_KEY', bitripay: 'BITRIPAY_KEY' };
  const railAvailable = (code) => code === 'bank_transfer' || code === 'distributor'
    ? true
    : PROVIDER_ENV[code] ? !!process.env[PROVIDER_ENV[code]] : false;
  const koda = { rail: 'koda', label: 'Mobile money — verified by KODA (Orange · M-Pesa · Airtel)', flow: 'MOBILE_MONEY_TO_KODA_SIM', fee_pct: 0,
    available: settings.collectConfigured(),
    quote: { rail: 'koda', acu, subtotal_usd: retail, collection_fee_usd: 0, total_usd: retail, currency: ctx.currency || 'USD' } };
  // ACU top-ups use the SAME two consumer rails as plan checkout: mobile money
  // (KODA's own engine, Door 3) + card (Stripe). Paystack/Flutterwave are switched
  // off (live:false in shared/billing.js) — flip them on there to re-offer them.
  // (Distributor + voucher top-ups have their own dedicated flows/endpoints.)
  void ranked; void railAvailable; void PROVIDER_ENV;
  const stripe = { rail: 'stripe', label: 'Card (Visa · Mastercard) — Stripe', flow: 'HOSTED_CHECKOUT', fee_pct: (B.RAILS.stripe.fee_pct || 0),
    available: !!process.env.STRIPE_KEY, quote: withFee('stripe') };
  return {
    country, amount_acu: acu,
    methods: [koda, stripe],
  };
}

// ── create a top-up (server-authoritative price; idempotent) ──────────────────
function createTopup(merchant, body = {}) {
  const acu = Math.round(Number(body.amount_acu) || 0);
  if (!(acu > 0)) return [400, { error: { code: 'invalid_amount', message: 'amount_acu must be a positive integer' } }];
  const rail = String(body.rail || body.method || 'koda');
  // KODA self-collect: pay by mobile money to KODA's own DRC SIM, verified by KODA.
  if (rail === 'koda') {
    const subtotal = Number(body.usd) > 0 ? Number(body.usd) : Math.round(acu * B.ACU_PRICE_USD * 100) / 100;
    const idem = body.idempotency_key || null;
    if (idem) { const dup = q.get('SELECT * FROM topups WHERE idempotency_key=?', idem); if (dup) return topupView(dup); }
    const expected = assignExpectedLocal(subtotal);
    const cur = localCurrency();
    const id = U.id('top');
    q.run(`INSERT INTO topups (id,merchant_id,acu_amount,subtotal_usd,collection_fee_usd,tax_usd,total_usd,currency,rail,purpose,idempotency_key,routing_snapshot,status)
           VALUES (?,?,?,?,?,?,?,?,?, 'acu', ?, ?, 'pending')`,
      id, merchant.id, acu, subtotal, 0, 0, subtotal, 'USD', 'koda', idem, JSON.stringify({ rail: 'koda', expected_local: expected }));
    const num = settings.primaryNumber() || '(no KODA receiving number set — add one in Admin → Collection)';
    const numbers = settings.activeNumbers().map(n => ({ operator: n.operator || '', msisdn: n.msisdn, label: n.label || '' }));
    return {
      ...topupView(q.get('SELECT * FROM topups WHERE id=?', id)),
      session: { flow: 'MOBILE_MONEY_TO_KODA_SIM', pay_to: num, pay_to_numbers: numbers, amount_usd: subtotal, amount_local: expected, currency: cur, reference: id,
        instructions: `Pay EXACTLY ${expected} ${cur} (≈ $${subtotal}) by mobile money to any KODA number below. Your ${acu} ACU are credited automatically once KODA sees the payment.` },
    };
  }
  if (!B.RAILS[rail] || B.RAILS[rail].live === false) return [422, { error: { code: 'rail_unavailable', message: `rail ${rail} not available` } }];
  const idem = body.idempotency_key || null;
  if (idem) {
    const dup = q.get('SELECT * FROM topups WHERE idempotency_key=?', idem);
    if (dup) return topupView(dup); // retry-safe: same key returns the same topup
  }
  const quote = B.quote(acu, rail, { currency: body.currency });
  // honor a retail pack price when given: subtotal = pack usd, fee added per rail
  if (Number(body.usd) > 0) {
    const sub = Number(body.usd);
    quote.subtotal_usd = sub;
    quote.collection_fee_usd = Math.round(sub * (B.RAILS[rail].fee_pct || 0) * 100) / 100;
    quote.total_usd = Math.round((sub + quote.collection_fee_usd) * 100) / 100;
  }
  const id = U.id('top');
  q.run(`INSERT INTO topups (id,merchant_id,acu_amount,subtotal_usd,collection_fee_usd,tax_usd,total_usd,currency,rail,idempotency_key,routing_snapshot,status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    id, merchant.id, acu, quote.subtotal_usd, quote.collection_fee_usd, quote.tax_usd, quote.total_usd,
    quote.currency, rail, idem, JSON.stringify({ rail, quote }), 'initiated');
  const topup = q.get('SELECT * FROM topups WHERE id=?', id);
  const session = PROVIDERS[rail] ? PROVIDERS[rail].createSession(topup) : { flow: B.RAILS[rail].flow };
  q.run('UPDATE topups SET status=?, provider_ref=? WHERE id=?', 'pending', session.provider_ref || null, id);
  return { ...topupView(q.get('SELECT * FROM topups WHERE id=?', id)), session };
}

function topupView(t) {
  return {
    topup_id: t.id, status: t.status, rail: t.rail, acu_amount: t.acu_amount,
    subtotal_usd: t.subtotal_usd, collection_fee_usd: t.collection_fee_usd, tax_usd: t.tax_usd,
    total_usd: t.total_usd, currency: t.currency,
  };
}

// ── settle a top-up: credit the merchant wallet + post double-entry (idempotent) ──
// issuing account is KODA treasury for card/aggregator/voucher rails.
function settleTopup(topupId, { issuer = 'koda:treasury', entryType = 'koda_issuance' } = {}) {
  const t = q.get('SELECT * FROM topups WHERE id=?', topupId);
  if (!t) return [404, { error: { code: 'topup_not_found' } }];
  if (t.status === 'settled') return { ok: true, already: true, topup_id: t.id };
  if (t.status !== 'pending' && t.status !== 'initiated') return [409, { error: { code: 'bad_state', status: t.status } }];
  const merchant = q.get('SELECT * FROM merchants WHERE id=?', t.merchant_id);
  // Plan-subscription collection: activate the plan (30-day period) instead of
  // crediting ACU. Same exactly-once CAS gate.
  if (t.purpose === 'plan') {
    const res = tx(() => {
      const cas = q.run(`UPDATE topups SET status='settled', settled_at=datetime('now') WHERE id=? AND status IN ('pending','initiated')`, t.id);
      if (cas.changes !== 1) return { already: true };
      q.run(`UPDATE merchants SET plan=?, is_platform=?, plan_expires_at=datetime('now','+30 days') WHERE id=?`,
        t.plan_key, t.plan_key === 'plateforme' ? 1 : merchant.is_platform, merchant.id);
      return { activated: true };
    });
    if (res.already) return { ok: true, already: true, topup_id: t.id };
    require('./engine').notifyOwners(q.get('SELECT * FROM merchants WHERE id=?', merchant.id), 'plan.upgraded', { plan: t.plan_key });
    return { ok: true, topup_id: t.id, plan_activated: t.plan_key };
  }
  // Exactly-once + all-or-nothing: the CAS status flip is the atomic gate (a retry
  // finds changes=0 and credits nothing); the transaction rolls back the whole
  // settlement if any step throws, so the wallet can never diverge from the ledger.
  const res = tx(() => {
    const cas = q.run(`UPDATE topups SET status='settled', settled_at=datetime('now') WHERE id=? AND status IN ('pending','initiated')`, t.id);
    if (cas.changes !== 1) return { already: true };
    post([
      { account_key: issuer, entry_type: entryType, acu_delta: -t.acu_amount },
      { account_key: 'merchant:' + merchant.id, entry_type: 'topup_credit', acu_delta: t.acu_amount },
    ], { topupId: t.id, idempotencyKey: 'settle:' + t.id, ref: t.rail });
    require('./engine').creditAcu(merchant, t.acu_amount, 'topup', t.id);
    return { settled: true };
  });
  if (res.already) return { ok: true, already: true, topup_id: t.id };
  require('./engine').notifyOwners(merchant, 'billing.topup.verified', { acu: t.acu_amount });
  return { ok: true, topup_id: t.id, acu_credited: t.acu_amount };
}

// ── DISTRIBUTOR RAIL (Rail 4b) — the engine is the escrow ─────────────────────
function distributorFloat(kdId) {
  const d = q.get('SELECT float_acu FROM distributors WHERE id=?', kdId);
  return d ? d.float_acu : 0;
}
// KD prepurchases wholesale inventory (paid via card/aggregator externally) → float credit.
function wholesalePurchase(kdId, acuBlock, idemKey) {
  const d = q.get('SELECT * FROM distributors WHERE id=?', kdId);
  if (!d) return [404, { error: { code: 'distributor_not_found' } }];
  const acu = Math.round(Number(acuBlock) || 0);
  if (!(acu > 0)) return [400, { error: { code: 'invalid_block' } }];
  // Idempotency is keyed on the caller's payment reference (NOT a random token), so a
  // double-submitted "I paid for a block" credits float exactly once. The ledger key
  // is the source of truth: if it already posted, the float update must not run either.
  const key = 'wholesale:' + kdId + ':' + (idemKey || 'k' + acu + ':' + (d.float_acu));
  const res = tx(() => {
    const r = post([
      { account_key: 'koda:treasury', entry_type: 'wholesale_credit', acu_delta: -acu },
      { account_key: 'distributor:' + kdId, entry_type: 'wholesale_credit', acu_delta: acu },
    ], { idempotencyKey: key, ref: 'wholesale' });
    if (r.idempotent) return { already: true };
    q.run('UPDATE distributors SET float_acu = float_acu + ? WHERE id=?', acu, kdId);
    return { credited: true };
  });
  return { ok: true, already: !!res.already, distributor_id: kdId, float_acu: distributorFloat(kdId), purchased: res.already ? 0 : acu };
}

// Merchant asks to top up via a KD → creates a pending top-up + pay-to instructions.
function createDistributorTopup(merchant, body = {}) {
  const acu = Math.round(Number(body.amount_acu) || 0);
  if (!(acu > 0)) return [400, { error: { code: 'invalid_amount' } }];
  const kd = body.distributor_id
    ? q.get(`SELECT * FROM distributors WHERE id=? AND status='active'`, body.distributor_id)
    : q.get(`SELECT * FROM distributors WHERE country=? AND status='active' AND float_acu>=? ORDER BY float_acu DESC LIMIT 1`, merchant.country, acu);
  if (!kd) return [409, { error: { code: 'no_distributor', message: 'no active distributor with float in this market' } }];
  if (kd.float_acu < acu) return [409, { error: { code: 'insufficient_float', message: 'distributor float too low' } }];
  const quote = B.quote(acu, 'distributor', { currency: merchant.currency });
  const id = U.id('top');
  q.run(`INSERT INTO topups (id,merchant_id,acu_amount,subtotal_usd,collection_fee_usd,tax_usd,total_usd,currency,rail,distributor_id,status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    id, merchant.id, acu, quote.subtotal_usd, quote.collection_fee_usd, quote.tax_usd, quote.total_usd,
    quote.currency, 'distributor', kd.id, 'pending');
  return {
    ...topupView(q.get('SELECT * FROM topups WHERE id=?', id)),
    pay_to: kd.msisdn, distributor_name: kd.name,
    expected_amount_usd: quote.total_usd, expires_in: 900,
    instruction: `Pay ${quote.total_usd} to ${kd.name} (${kd.msisdn}) by mobile money. Your ACU credits automatically once their KODA Sentinel confirms it.`,
  };
}

// The escrow moment: a KD's verified incoming payment settles the merchant top-up.
// Atomic: KD float −acu, merchant wallet +acu, double-entry posted, top-up settled.
function settleDistributorTopup(topupId, { verifiedAmountUsd } = {}) {
  const t = q.get('SELECT * FROM topups WHERE id=?', topupId);
  if (!t) return [404, { error: { code: 'topup_not_found' } }];
  if (t.rail !== 'distributor') return [400, { error: { code: 'not_distributor_topup' } }];
  if (t.status === 'settled') return { ok: true, already: true, topup_id: t.id };
  const kd = q.get('SELECT * FROM distributors WHERE id=?', t.distributor_id);
  if (!kd) return [404, { error: { code: 'distributor_not_found' } }];
  // server-side amount authority: a verified payment must match the quoted total
  if (verifiedAmountUsd != null && Math.abs(Number(verifiedAmountUsd) - t.total_usd) > 0.011)
    return [409, { error: { code: 'amount_mismatch', expected: t.total_usd, got: verifiedAmountUsd } }];
  // a KD can never mint ACU it hasn't prepaid for
  if (kd.float_acu < t.acu_amount) return [409, { error: { code: 'insufficient_float' } }];
  const merchant = q.get('SELECT * FROM merchants WHERE id=?', t.merchant_id);
  // CAS-first status flip gates the whole move; tx makes float-debit + ledger +
  // wallet-credit all-or-nothing. A retry after any crash re-enters at changes=0.
  const res = tx(() => {
    const cas = q.run(`UPDATE topups SET status='settled', settled_at=datetime('now') WHERE id=? AND status='pending'`, t.id);
    if (cas.changes !== 1) return { already: true };
    const fd = q.run('UPDATE distributors SET float_acu = float_acu - ? WHERE id=? AND float_acu >= ?', t.acu_amount, kd.id, t.acu_amount);
    if (fd.changes !== 1) throw new Error('float_underflow'); // rolls back the status flip
    post([
      { account_key: 'distributor:' + kd.id, entry_type: 'kd_float_debit', acu_delta: -t.acu_amount },
      { account_key: 'merchant:' + merchant.id, entry_type: 'topup_credit', acu_delta: t.acu_amount },
    ], { topupId: t.id, idempotencyKey: 'settle:' + t.id, ref: 'distributor' });
    require('./engine').creditAcu(merchant, t.acu_amount, 'topup', t.id);
    return { settled: true };
  });
  if (res.already) return { ok: true, already: true, topup_id: t.id };
  require('./engine').notifyOwners(merchant, 'billing.topup.verified', { acu: t.acu_amount });
  return { ok: true, topup_id: t.id, acu_credited: t.acu_amount, kd_float_after: distributorFloat(kd.id) };
}

// Called from the engine when a KD's Sentinel SMS verifies a payment: match the
// oldest pending distributor top-up on that KD by amount and settle it.
function matchDistributorPayment(kdMerchantId, amountUsd) {
  const kd = q.get('SELECT * FROM distributors WHERE merchant_id=?', kdMerchantId);
  if (!kd) return null;
  const rows = q.all(`SELECT * FROM topups WHERE distributor_id=? AND rail='distributor' AND status='pending' ORDER BY created_at ASC`, kd.id);
  const match = rows.find(t => Math.abs(t.total_usd - Number(amountUsd)) <= 0.011);
  if (!match) return null;
  const r = settleDistributorTopup(match.id, { verifiedAmountUsd: amountUsd });
  return Array.isArray(r) ? null : r;
}

// ── RESELLER RAIL (Rail 4a) — prepaid voucher inventory is the escrow ─────────
// Symmetric with the distributor rail: a reseller prepurchases inventory (paying
// KODA the wholesale rate off-rail), then self-issues voucher batches that draw it
// down. A voucher can never credit ACU the reseller hasn't paid for.
function resellerInventory(rid) {
  const r = q.get('SELECT inventory_acu FROM resellers WHERE id=?', rid);
  return r ? r.inventory_acu : 0;
}
// Reseller prepurchases voucher inventory (card/aggregator cleared upstream) → inventory
// credit + a reseller ledger balance that later backs each redemption.
function resellerBuyInventory(rid, acuBlock, idemKey) {
  const r = q.get('SELECT * FROM resellers WHERE id=?', rid);
  if (!r) return [404, { error: { code: 'reseller_not_found' } }];
  const acu = Math.round(Number(acuBlock) || 0);
  if (!(acu > 0)) return [400, { error: { code: 'invalid_block' } }];
  const key = 'reseller_wholesale:' + rid + ':' + (idemKey || 'k' + acu + ':' + r.inventory_acu);
  const res = tx(() => {
    const p = post([
      { account_key: 'koda:treasury', entry_type: 'reseller_wholesale', acu_delta: -acu },
      { account_key: 'reseller:' + rid, entry_type: 'reseller_wholesale', acu_delta: acu },
    ], { idempotencyKey: key, ref: 'reseller_wholesale' });
    if (p.idempotent) return { already: true };
    q.run('UPDATE resellers SET inventory_acu = inventory_acu + ? WHERE id=?', acu, rid);
    return { credited: true };
  });
  return { ok: true, already: !!res.already, reseller_id: rid, inventory_acu: resellerInventory(rid), purchased: res.already ? 0 : acu };
}
// Inventory-gated batch issuance: draws down prepaid inventory atomically so a
// reseller can never issue ACU they haven't paid for. Returns the batch (+PINs) or
// a [status, error] tuple. `activate` flips the batch live in the same breath.
function issueResellerBatch(reseller, opts = {}) {
  const vouchers = require('./vouchers');
  const acu = Math.round(Number(opts.acu_amount) || 0);
  const qty = Math.min(1000, Math.max(1, Math.round(Number(opts.quantity) || 1)));
  const total = acu * qty;
  if (total > 0 && resellerInventory(reseller.id) < total)
    return [409, { error: { code: 'insufficient_inventory', required_acu: total, inventory_acu: resellerInventory(reseller.id), message: 'Top up voucher inventory before issuing this batch.' } }];
  return tx(() => {
    if (total > 0) {
      const u = q.run('UPDATE resellers SET inventory_acu = inventory_acu - ? WHERE id=? AND inventory_acu >= ?', total, reseller.id, total);
      if (u.changes !== 1) throw new Error('inventory_underflow');
    }
    const batch = vouchers.issueBatch(reseller, { ...opts, acu_amount: acu, quantity: qty });
    if (opts.activate) vouchers.activateBatch(batch.batch_id);
    return batch;
  });
}
// Void a batch AND return its unredeemed ACU to the reseller's issuable inventory —
// but only for inventory-backed resellers (a positive reseller ledger balance), so
// legacy treasury-funded batches never create phantom inventory.
function voidResellerBatch(batchId) {
  const vouchers = require('./vouchers');
  const sample = q.get('SELECT reseller_id, acu_amount FROM vouchers WHERE batch_id=? LIMIT 1', batchId);
  const r = vouchers.voidBatch(batchId);
  if (sample && sample.reseller_id && r.voided > 0 && sample.acu_amount > 0 && acctBalance('reseller:' + sample.reseller_id) > 0)
    q.run('UPDATE resellers SET inventory_acu = inventory_acu + ? WHERE id=?', sample.acu_amount * r.voided, sample.reseller_id);
  return { ...r, inventory_acu: sample ? resellerInventory(sample.reseller_id) : null };
}

// double-entry health: the whole ledger must sum to zero.
function reconcile() {
  const s = q.get('SELECT COALESCE(SUM(acu_delta),0) s FROM billing_ledger').s;
  return { balanced: s === 0, sum: s };
}

// ── PLAN subscriptions: KODA collects its OWN plan revenue through the mesh ──
// Rails offered for a plan: 'koda' (mobile money to KODA's DRC merchant SIM,
// verified by KODA's own engine — the product bills itself), 'stripe' (card),
// 'bitripay' (when its live flag flips). A free plan needs no payment.
function planRailDef(rail) {
  if (rail === 'koda') return { fee_pct: 0, flow: 'MOBILE_MONEY_TO_KODA_SIM', live: true, label: 'KODA Mobile Money (DRC)' };
  return B.RAILS[rail];
}
function planQuote(planKey, rail) {
  const PLANS = require('../../shared/plans').PLANS;
  const plan = PLANS[planKey];
  if (!plan || !(plan.usd > 0)) return null;
  const rd = planRailDef(rail);
  if (!rd || rd.live === false) return null;
  const subtotal = plan.usd;
  const fee = Math.round(subtotal * rd.fee_pct * 100) / 100;
  const total = Math.round((subtotal + fee) * 100) / 100;
  return { plan: planKey, plan_label: plan.label, period: 'month', subtotal_usd: subtotal, collection_fee_usd: fee, total_usd: total, rail, flow: rd.flow, label: rd.label };
}
function planMethods(planKey) {
  const PLANS = require('../../shared/plans').PLANS;
  const plan = PLANS[planKey];
  if (!plan) return { plan: planKey, methods: [] };
  // Plan collection is intentionally two rails (per product decision):
  //  • Mobile money  → KODA's OWN engine (Door 3): pay our number, KODA's Sentinel
  //    auto-verifies the operator SMS and settles the plan — no third party, no fee.
  //  • Card          → Stripe hosted checkout.
  return {
    plan: planKey, plan_label: plan.label, monthly_usd: plan.usd, free: !(plan.usd > 0),
    methods: [
      { rail: 'koda', label: 'Mobile money — verified by KODA (Orange · M-Pesa · Airtel)', available: settings.collectConfigured(), quote: planQuote(planKey, 'koda') },
      { rail: 'stripe', label: 'Card (Visa · Mastercard) — Stripe', available: !!process.env.STRIPE_KEY, quote: planQuote(planKey, 'stripe') },
    ],
  };
}
function planCheckoutView(t) {
  return { topup_id: t.id, plan: t.plan_key, purpose: 'plan', status: t.status, total_usd: t.total_usd, rail: t.rail };
}
function createPlanCheckout(merchant, planKey, rail = 'koda', opts = {}) {
  const PLANS = require('../../shared/plans').PLANS;
  const plan = PLANS[planKey];
  if (!plan) return [400, { error: { code: 'unknown_plan' } }];
  if (!(plan.usd > 0)) return [400, { error: { code: 'plan_is_free', message: 'the free plan needs no payment' } }];
  const quote = planQuote(planKey, rail);
  if (!quote) return [422, { error: { code: 'rail_unavailable', message: `rail ${rail} not available for plans` } }];
  const idem = opts.idempotency_key || ('plan:' + merchant.id + ':' + planKey + ':' + rail);
  const dup = q.get('SELECT * FROM topups WHERE idempotency_key=?', idem);
  if (dup && dup.status !== 'settled') { const s = sessionFor(dup, rail, quote); return { ...planCheckoutView(dup), session: s }; }
  const id = U.id('top');
  q.run(`INSERT INTO topups (id,merchant_id,acu_amount,subtotal_usd,collection_fee_usd,tax_usd,total_usd,currency,rail,purpose,plan_key,idempotency_key,routing_snapshot,status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?, 'initiated')`,
    id, merchant.id, 0, quote.subtotal_usd, quote.collection_fee_usd, 0, quote.total_usd, 'USD', rail, 'plan', planKey, dup ? idem + ':' + id : idem, JSON.stringify({ rail, quote }));
  const topup = q.get('SELECT * FROM topups WHERE id=?', id);
  const session = sessionFor(topup, rail, quote);
  q.run('UPDATE topups SET status=?, provider_ref=? WHERE id=?', 'pending', session.provider_ref || null, id);
  return { ...planCheckoutView(q.get('SELECT * FROM topups WHERE id=?', id)), session };
}
function sessionFor(topup, rail, quote) {
  if (rail === 'koda') {
    const num = settings.primaryNumber() || '(no KODA receiving number set — add one in Admin → Collection)';
    const cur = localCurrency();
    // assign the exact local amount once, persist it for auto-matching
    let expected;
    try { expected = JSON.parse(topup.routing_snapshot || '{}').expected_local; } catch { expected = null; }
    if (expected == null) {
      expected = assignExpectedLocal(quote.total_usd);
      q.run('UPDATE topups SET routing_snapshot=? WHERE id=?', JSON.stringify({ rail: 'koda', quote, expected_local: expected }), topup.id);
    }
    return { flow: 'MOBILE_MONEY_TO_KODA_SIM', pay_to: num, pay_to_numbers: settings.activeNumbers().map(n => ({ operator: n.operator || '', msisdn: n.msisdn, label: n.label || '' })), amount_usd: quote.total_usd, amount_local: expected, currency: cur, reference: topup.id,
      instructions: `Pay EXACTLY ${expected} ${cur} (≈ $${quote.total_usd}) by mobile money to KODA at ${num}. Your ${quote.plan_label} plan activates automatically once KODA sees the payment.` };
  }
  if (PROVIDERS[rail]) return PROVIDERS[rail].createSession(topup);
  return { flow: quote.flow };
}

// ── KODA self-collection auto-settle ──────────────────────────────────────────
// KODA's own DRC merchant SIM runs Sentinel. When a merchant pays a 'koda'-rail
// plan/top-up by mobile money to that SIM, the confirmation SMS is forwarded to
// KODA and this settles the matching pending collection automatically — no manual
// admin confirm. Matching is by an EXACT unique local amount assigned at creation
// (base from KODA_USD_TO_LOCAL, plus a small offset so two pending payments never
// collide). Only runs for the collection merchant (KODA_COLLECT_MERCHANT), so a
// normal merchant's customer SMS can never settle a KODA collection.
function localRate() { return settings.usdToLocal(); } // admin-managed (DB → KODA_USD_TO_LOCAL → 2800)
function localCurrency() { return settings.collectCurrency(); }
function assignExpectedLocal(usd) {
  const base = Math.round(Number(usd) * localRate());
  const used = new Set(q.all(`SELECT routing_snapshot FROM topups WHERE rail='koda' AND status='pending'`)
    .map(r => { try { return JSON.parse(r.routing_snapshot || '{}').expected_local; } catch { return null; } })
    .filter(x => x != null));
  for (let off = 0; off < 100; off++) if (!used.has(base + off)) return base + off;
  return base;
}
function matchKodaCollection(amountLocal) {
  const amt = Math.round(Number(amountLocal));
  const rows = q.all(`SELECT * FROM topups WHERE rail='koda' AND status='pending' ORDER BY created_at ASC`);
  const match = rows.find(t => { try { return JSON.parse(t.routing_snapshot || '{}').expected_local === amt; } catch { return false; } });
  if (!match) return null;
  const r = settleTopup(match.id);   // plan → activate · acu → credit
  return Array.isArray(r) ? null : r;
}

module.exports = {
  methods, createTopup, settleTopup, topupView, reconcile, post, acctBalance, verifyWebhook,
  distributorFloat, wholesalePurchase, createDistributorTopup, settleDistributorTopup, matchDistributorPayment,
  resellerInventory, resellerBuyInventory, issueResellerBatch, voidResellerBatch,
  planMethods, planQuote, createPlanCheckout, startProviderSession,
  matchKodaCollection, assignExpectedLocal, localCurrency,
};
