// KODA — Billing Orchestrator (System B). Sits between the billing domain and every
// external rail; the domain talks to this contract, never to a provider directly.
// Money is never a mutable column: every settlement posts a balanced, chained,
// idempotent double-entry into billing_ledger. Prices are SERVER-AUTHORITATIVE —
// the client's amount is never trusted; we quote from shared/billing.
'use strict';
const { q } = require('./db');
const U = require('./util');
const B = require('../../shared/billing');

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

// ── provider registry (sandbox adapters — real keys swap the send, not the shape) ──
const PROVIDERS = {};
function register(code, adapter) { PROVIDERS[code] = { providerCode: code, ...adapter }; }
// Card / MoR / aggregator rails: a hosted/push session; settlement arrives by webhook.
for (const code of ['stripe', 'paddle_mor', 'flutterwave', 'dlocal', 'bitripay', 'bank_transfer']) {
  register(code, {
    createSession(topup) {
      const provider = process.env[code.toUpperCase() + '_KEY'] ? code : 'sandbox';
      return { flow: B.RAILS[code].flow, provider, checkout_url: `sandbox://${code}/${topup.id}`, provider_ref: 'sb_' + U.token(4) };
    },
  });
}

// ── methods for a merchant context (routing + server-side quote per rail) ──────
function methods(merchant, ctx = {}) {
  const country = (ctx.country || merchant.country || '').toUpperCase();
  const acu = Math.max(1, Math.round(Number(ctx.amount_acu) || 0));
  const ranked = B.routeProviders({ country, amount_acu: acu, recurring: !!ctx.recurring });
  return {
    country, amount_acu: acu,
    methods: ranked.map(r => ({ ...r, quote: B.quote(acu, r.rail, { currency: ctx.currency }) })),
  };
}

// ── create a top-up (server-authoritative price; idempotent) ──────────────────
function createTopup(merchant, body = {}) {
  const acu = Math.round(Number(body.amount_acu) || 0);
  if (!(acu > 0)) return [400, { error: { code: 'invalid_amount', message: 'amount_acu must be a positive integer' } }];
  const rail = String(body.rail || body.method || 'stripe');
  if (!B.RAILS[rail] || B.RAILS[rail].live === false) return [422, { error: { code: 'rail_unavailable', message: `rail ${rail} not available` } }];
  const idem = body.idempotency_key || null;
  if (idem) {
    const dup = q.get('SELECT * FROM topups WHERE idempotency_key=?', idem);
    if (dup) return topupView(dup); // retry-safe: same key returns the same topup
  }
  const quote = B.quote(acu, rail, { currency: body.currency });
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
  const idem = 'settle:' + t.id;
  // double-entry: issuer −acu, merchant +acu (Σ = 0). Merchant wallet stays authoritative in engine.creditAcu.
  post([
    { account_key: issuer, entry_type: entryType, acu_delta: -t.acu_amount },
    { account_key: 'merchant:' + merchant.id, entry_type: 'topup_credit', acu_delta: t.acu_amount },
  ], { topupId: t.id, idempotencyKey: idem, ref: t.rail });
  require('./engine').creditAcu(merchant, t.acu_amount, 'topup', t.id);
  q.run(`UPDATE topups SET status='settled', settled_at=datetime('now') WHERE id=?`, t.id);
  require('./engine').notifyOwners(merchant, 'billing.topup.verified', { acu: t.acu_amount });
  return { ok: true, topup_id: t.id, acu_credited: t.acu_amount };
}

// ── DISTRIBUTOR RAIL (Rail 4b) — the engine is the escrow ─────────────────────
function distributorFloat(kdId) {
  const d = q.get('SELECT float_acu FROM distributors WHERE id=?', kdId);
  return d ? d.float_acu : 0;
}
// KD prepurchases wholesale inventory (paid via card/aggregator externally) → float credit.
function wholesalePurchase(kdId, acuBlock) {
  const d = q.get('SELECT * FROM distributors WHERE id=?', kdId);
  if (!d) return [404, { error: { code: 'distributor_not_found' } }];
  const acu = Math.round(Number(acuBlock) || 0);
  if (!(acu > 0)) return [400, { error: { code: 'invalid_block' } }];
  q.run('UPDATE distributors SET float_acu = float_acu + ? WHERE id=?', acu, kdId);
  post([
    { account_key: 'koda:treasury', entry_type: 'wholesale_credit', acu_delta: -acu },
    { account_key: 'distributor:' + kdId, entry_type: 'wholesale_credit', acu_delta: acu },
  ], { idempotencyKey: 'wholesale:' + kdId + ':' + U.token(4), ref: 'wholesale' });
  return { ok: true, distributor_id: kdId, float_acu: distributorFloat(kdId), purchased: acu };
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
  q.run('UPDATE distributors SET float_acu = float_acu - ? WHERE id=?', t.acu_amount, kd.id);
  post([
    { account_key: 'distributor:' + kd.id, entry_type: 'kd_float_debit', acu_delta: -t.acu_amount },
    { account_key: 'merchant:' + merchant.id, entry_type: 'topup_credit', acu_delta: t.acu_amount },
  ], { topupId: t.id, idempotencyKey: 'settle:' + t.id, ref: 'distributor' });
  require('./engine').creditAcu(merchant, t.acu_amount, 'topup', t.id);
  q.run(`UPDATE topups SET status='settled', settled_at=datetime('now') WHERE id=?`, t.id);
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

// double-entry health: the whole ledger must sum to zero.
function reconcile() {
  const s = q.get('SELECT COALESCE(SUM(acu_delta),0) s FROM billing_ledger').s;
  return { balanced: s === 0, sum: s };
}

module.exports = {
  methods, createTopup, settleTopup, topupView, reconcile, post, acctBalance,
  distributorFloat, wholesalePurchase, createDistributorTopup, settleDistributorTopup, matchDistributorPayment,
};
