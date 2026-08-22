// KODA — the verification engine (MatchMaker + billing + webhooks + comms glue).
// Shared by all five doors: Manual (console), WhatsApp, API, USSD, inbound SMS.
'use strict';
const { q } = require('./db');
const { id } = require('./util');
const { scoreMatch, chainCheck } = require('./fraud');
const trustNet = require('./trust_network'); // ADD-ON B: cross-merchant trust/fraud network
const { parseSms } = require('../../shared/parser');
const { toMinor } = require('../../shared/currency');
const webhooks = require('./webhooks');
const notify = require('../comms/notify');
const analytics = require('./analytics');   // server-side conversion forwarding (env-gated)

// Fire the "first payment verified" conversion exactly once per merchant — only when
// analytics is configured, so the extra COUNT never touches the hot path otherwise.
function maybeFirstVerified(merchantId) {
  if (!analytics.enabled()) return;
  try {
    if (q.get('SELECT COUNT(*) c FROM receipts WHERE merchant_id=?', merchantId).c === 1) {
      analytics.firstPaymentVerified(merchantId);
    }
  } catch (_) { /* never disturb verification */ }
}

const { ACU, TOPUP_PACKS, PLANS } = require('../../shared/plans');

// Verifications within the plan's monthly quota are FREE — they consume no ACU.
// ACU is spent only on AI features (Vision, agents, disputes) and on verifications
// BEYOND the quota (overage). Unlimited plans (verifs=null) are always within quota.
// A merchant owned by a KODA staff-admin is ACU-UNLIMITED: never charged, never
// gated, always "within quota". This encodes the platform rule "admin has no ACU
// limit" — the operator's own accounts are exempt from metering.
function acuUnlimited(merchant) {
  if (!merchant || !merchant.id) return false;
  return !!q.get('SELECT 1 FROM users WHERE merchant_id=? AND is_admin=1 LIMIT 1', merchant.id);
}
function withinQuota(merchant) {
  if (acuUnlimited(merchant)) return true;
  const plan = PLANS[merchant.plan] || PLANS.marche;
  if (plan.verifs == null) return true;
  const used = q.get(`SELECT COUNT(*) c FROM receipts WHERE merchant_id=? AND verified_at > date('now','start of month')`, merchant.id).c;
  return used < plan.verifs;
}
const VERSION = require('../../shared/version');

function getMerchant(mid) { return q.get('SELECT * FROM merchants WHERE id=?', mid); }
function metric(k) { try { require('./metrics').inc(k); } catch { /* metrics optional */ } }

// ACU mutations MUST be relative + read-back, never absolute from an in-memory
// snapshot. A handler loads `merchant` early, then charges later; if two requests
// interleave, both would compute a balance from the same stale snapshot and the
// last absolute write would clobber the other's charge — leaving acu_balance out
// of step with the ledger's balance_after. node:sqlite runs each statement here
// synchronously with no interleaving, so a relative UPDATE + SELECT + INSERT is
// atomic w.r.t. other requests and always self-consistent.
function chargeAcu(merchant, amount, kind, ref) {
  if (acuUnlimited(merchant)) return merchant.acu_balance; // admin-owned: never metered
  q.run('UPDATE merchants SET acu_balance = acu_balance - ? WHERE id=?', amount, merchant.id);
  const bal = q.get('SELECT acu_balance FROM merchants WHERE id=?', merchant.id).acu_balance;
  q.run(`INSERT INTO acu_transactions (id,merchant_id,delta,kind,ref,balance_after)
         VALUES (?,?,?,?,?,?)`, id('acu'), merchant.id, -amount, kind, ref || null, bal);
  merchant.acu_balance = bal;
  if (bal <= 0) notifyOwners(merchant, 'billing.grace_started', {});
  else if (bal < 100) notifyOwners(merchant, 'billing.low_balance', {});
  return bal;
}
function creditAcu(merchant, amount, kind, ref) {
  q.run('UPDATE merchants SET acu_balance = acu_balance + ? WHERE id=?', amount, merchant.id);
  const bal = q.get('SELECT acu_balance FROM merchants WHERE id=?', merchant.id).acu_balance;
  q.run(`INSERT INTO acu_transactions (id,merchant_id,delta,kind,ref,balance_after)
         VALUES (?,?,?,?,?,?)`, id('acu'), merchant.id, amount, kind, ref || null, bal);
  merchant.acu_balance = bal;
  return bal;
}
// ── AI METERING GATE ────────────────────────────────────────────────────────
// Policy: EVERY AI action is metered and gated by available ACU. No AI action is
// free (min cost enforced), and none runs when the balance cannot cover it.
// Returns {ok:true} or a 402-shaped [status, body] to return directly.
const AI_MIN = 0.25; // no AI operation may be free or cost less than this
function gateAI(merchant, cost, label) {
  const c = Number(cost);
  if (!Number.isFinite(c) || c < AI_MIN) {
    return [500, { error: { code: 'ai_action_not_metered', message: `AI action "${label}" has no valid ACU price` } }];
  }
  if (acuUnlimited(merchant)) return { ok: true, cost: 0 }; // admin-owned: no limit
  if (!merchant || merchant.acu_balance < c) {
    return [402, { error: { code: 'insufficient_credit', required_acu: c, balance: merchant ? merchant.acu_balance : 0,
      message: 'Top up ACU to run this AI action.' } }];
  }
  return { ok: true, cost: c };
}

function notifyOwners(merchant, eventKey, data) {
  // deferred off the money path: the verification response never waits on comms
  setImmediate(() => {
    try { notify.fireMerchant(eventKey, merchant, data); } catch { /* comms must never break the money path */ }
  });
}

// ownership proof: a network account is VERIFIED when a forwarded SMS carries
// its one-time verify_ref (the merchant made a controlled test transfer).
function checkOwnershipProof(merchantId, raw) {
  try {
    const up = String(raw || '').toUpperCase();
    const pend = q.all(`SELECT id, verify_ref, device_id, network_code FROM merchant_network_accounts
      WHERE merchant_id=? AND ownership_status='UNVERIFIED' AND verify_ref IS NOT NULL`, merchantId);
    for (const p of pend) {
      if (p.verify_ref && up.includes(String(p.verify_ref).toUpperCase())) {
        q.run(`UPDATE merchant_network_accounts SET ownership_status='VERIFIED' WHERE id=?`, p.id);
        const nm = (require('../../shared/operators').byId[p.network_code] || {}).name || p.network_code;
        notifyOwners({ id: merchantId }, 'networks.ownership_verified', { network: nm });
      }
    }
  } catch { /* non-fatal */ }
}

// ingest an SMS (from Sentinel push, KODA Lite forward, or sandbox simulator)
function ingestSms(merchant, { raw, operator, device_id }) {
  checkOwnershipProof(merchant.id, raw);
  const parsed = parseSms(raw, operator);
  const smsId = id('sms');
  if (!parsed) {
    q.run(`INSERT INTO sms_ledger (id,merchant_id,device_id,operator,raw,chain_ok,quarantined)
           VALUES (?,?,?,?,?,1,0)`, smsId, merchant.id, device_id || null, operator || 'unknown', raw);
    return { id: smsId, parsed: false };
  }
  const chain = chainCheck(merchant.id, parsed.operator, parsed.amount, parsed.balance);
  // The balance-chain anti-forgery test only makes sense for a CONTINUOUS device (Sentinel)
  // stream, where every operator SMS is captured in order so balances must add up. A
  // device-less MANUAL PASTE / WhatsApp forward is occasional — the merchant relays one
  // receipt, not every transaction — so a balance "gap" is normal and must NOT quarantine
  // an otherwise-valid operator SMS. Chain-gating therefore applies only to device streams.
  const quarantine = device_id ? !chain.ok : false;
  q.run(`INSERT INTO sms_ledger (id,merchant_id,device_id,operator,raw,ref_code,amount,currency,
         counterparty_name,counterparty_suffix,balance_after,chain_ok,quarantined)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    smsId, merchant.id, device_id || null, parsed.operator, raw, parsed.ref, parsed.amount,
    parsed.currency, parsed.name || null, parsed.suffix || null, parsed.balance,
    chain.ok ? 1 : 0, quarantine ? 1 : 0);

  if (quarantine) {
    notifyOwners(merchant, 'fraud.chain_break', { operator: parsed.operator });
    metric('quarantines');
    recordNetwork({ counterparty_suffix: parsed.suffix }, 'quarantined'); // ADD-ON B
    return { id: smsId, parsed: true, quarantined: true, chain };
  }
  // DOOR 3 — FULLY AUTOMATIC online order. When the payment SMS lands, KODA matches
  // it to an awaiting checkout intent and verifies the order itself — the customer
  // types NOTHING. Match rules (safe against amount collisions):
  //   · prefer an order whose known payer number matches the SMS payer suffix
  //   · else, if exactly ONE order awaits this amount, it's unambiguous → match it
  //   · else (several same-amount orders, no payer match) → HOLD for the code to disambiguate
  const match = matchAwaitingIntent(merchant.id, parsed);
  if (match.intent) {
    const r = verify(getMerchant(merchant.id), match.intent, parsed.ref, { mode: 'api' });
    return { id: smsId, parsed: true, quarantined: false, fields: parsed, auto: r };
  }

  // Distributor rail (System B): if this merchant is a KODA distributor, a verified
  // incoming payment may settle a pending merchant top-up — the engine IS the escrow.
  try { require('./billing').matchDistributorPayment(merchant.id, parsed.amount); } catch { /* billing optional */ }
  // KODA self-collection: if this SIM is KODA's own collection phone, a verified
  // incoming payment auto-settles a matching pending plan/top-up (exact local amount).
  try { if (require('./settings').collectMerchantId() === merchant.id) require('./billing').matchKodaCollection(parsed.amount); } catch { /* billing optional */ }

  // FULLY-AUTOMATIC walk-in verification — the merchant does NOTHING. A clean operator
  // SMS on the merchant's own device that no order is awaiting is a counter sale: verify
  // it immediately and issue the receipt. The fraud engine still gates (generic → review,
  // quarantine never reaches here). Skipped for the KODA treasury SIM (collections above)
  // and when orders of this amount are awaiting but ambiguous (held for the code).
  let auto = null;
  if (require('./settings').collectMerchantId() !== merchant.id && !match.ambiguous) {
    const still = q.get('SELECT matched_intent_id FROM sms_ledger WHERE id=?', smsId);
    if (still && !still.matched_intent_id) auto = confirmLedgerPayment(merchant, smsId, {});
  }
  return { id: smsId, parsed: true, quarantined: false, fields: parsed, auto };
}

// Match an incoming payment to an awaiting checkout order, safely (Door 3 auto).
// Returns { intent } to auto-verify, { ambiguous:true } to hold for the code, or {} if none.
function matchAwaitingIntent(merchantId, parsed) {
  // Same units bridge as the verify guard: the SMS says "5.89", the intent stores 589
  // minor. Compared raw, no USD order could ever auto-match its own payment. The
  // currency filter is part of the same correctness: 5 000 CDF and 50.00 USD are the
  // same stored number and must never match each other's orders.
  const waiting = q.all(
    `SELECT * FROM intents WHERE merchant_id=? AND status='awaiting_payment' AND amount=? AND currency=?
     ORDER BY created_at ASC`, merchantId, toMinor(parsed.amount, parsed.currency), String(parsed.currency || '').toUpperCase());
  if (!waiting.length) return {};
  if (parsed.suffix) {
    const bySuffix = waiting.find(i => i.customer_msisdn && String(i.customer_msisdn).replace(/\D/g, '').slice(-4) === String(parsed.suffix));
    if (bySuffix) return { intent: bySuffix };
    // any order pins a payer number that does NOT match → don't guess; hold.
    if (waiting.some(i => i.customer_msisdn)) return { ambiguous: true };
  }
  if (waiting.length === 1) return { intent: waiting[0] };  // unambiguous
  return { ambiguous: true };                                // several same-amount orders → hold
}

// ADD-ON B: fetch the optional cross-merchant network risk signal for this payer.
// Safe + zero by default (scoring feed off) so it never changes today's decision.
function netDelta(sms) {
  try { return sms && sms.counterparty_suffix ? trustNet.riskDelta(sms.counterparty_suffix) : { delta: 0 }; }
  catch { return { delta: 0 }; }
}
// ADD-ON B: after a verified receipt, contribute the (hashed) payer to the network.
function recordNetwork(sms, kind) {
  try { if (sms && sms.counterparty_suffix) trustNet.record({ subject: sms.counterparty_suffix, kind }); } catch { /* never break the money path */ }
}

// the core verify — one truth for all five doors
// Spec §14: emit the canonical verification.* webhook for an outcome. ADDITIVE —
// payment.verified still fires on success for existing subscribers. Never throws
// (a webhook must never break the verify path).
function emitOutcome(merchantId, status, code, ctx = {}) {
  const ev = (status === 'verified' || status === 'verified_late') ? 'verification.succeeded'
    : status === 'pending_review' ? 'verification.manual_review_required'
    : status === 'expired' ? 'verification.expired'
    : status === 'rejected' ? (code === 'code_already_used' ? 'verification.duplicate_detected'
        : code === 'amount_mismatch' ? 'verification.amount_mismatch' : 'verification.failed')
    : null;
  if (!ev) return;
  try {
    webhooks.dispatch(merchantId, ev, {
      verification_id: ctx.receipt_id || null, reference: ctx.reference || null,
      status, reason: code || null, amount: ctx.amount ?? null, currency: ctx.currency ?? null,
      metadata: ctx.metadata || {}, // enables destination routing (§15) on verification.* too
    });
  } catch { /* a webhook must never break verification */ }
}

function verify(merchant, intent, reference, { mode = 'api', userId = null, viaScreenshot = false, late = false } = {}) {
  reference = String(reference || '').trim().toUpperCase();
  const trace = { steps: [], template_version: VERSION.trace_template, model_version: VERSION.fraud_model };

  // magic sandbox references (TEST-OK-*, TEST-REPLAY, TEST-SUFFIX) — a verification
  // convenience that must NEVER fire on a live customer order. A customer holding only
  // an intent's client_secret could otherwise type "TEST-OK-25000" at a real checkout and
  // get a verified receipt for nothing. Honour them ONLY in a sandbox context:
  //   · the intent was created by a koda_test key (intent.livemode === 0), or
  //   · KODA_ALLOW_SANDBOX_REFS is set (dev / CI — never in production).
  // Otherwise a TEST- reference falls through and is treated as an ordinary (unknown) code.
  if (/^TEST-/.test(reference)) {
    const sandboxOk = (intent && Number(intent.livemode) === 0) || process.env.KODA_ALLOW_SANDBOX_REFS === '1';
    if (sandboxOk) return sandboxVerify(merchant, intent, reference, { mode, userId, trace });
  }

  // 1. replay index
  const used = q.get('SELECT * FROM replay_index WHERE merchant_id=? AND reference=? AND receipt_id IS NOT NULL',
    merchant.id, reference);
  if (used) {
    // Claiming a NEW order with an already-consumed code is a replay attack → reject.
    if (intent) {
      trace.steps.push('replay_index: HIT — code already consumed');
      notifyOwners(merchant, 'replay.blocked', { reference });
      emitOutcome(merchant.id, 'rejected', 'code_already_used', { reference });
      return { status: 'rejected', code: 'code_already_used', trace };
    }
    // No intent = a status re-check (USSD / SMS / manual console). The payment already
    // verified (auto or earlier); return it positively — no new receipt is created.
    const rec = q.get('SELECT amount, currency FROM receipts WHERE id=?', used.receipt_id);
    trace.steps.push('replay_index: HIT — already confirmed (status re-check)');
    return { status: 'already_verified', code: 'already_confirmed',
             amount_confirmed: rec ? rec.amount : null, currency: rec ? rec.currency : null, trace };
  }

  // 2. ledger lookup (with fuzzy repair ≤2 edits against candidate set)
  let sms = q.get(`SELECT * FROM sms_ledger WHERE merchant_id=? AND UPPER(ref_code)=? AND quarantined=0`,
    merchant.id, reference);
  if (!sms) {
    const candidates = q.all(
      `SELECT * FROM sms_ledger WHERE merchant_id=? AND quarantined=0 AND matched_intent_id IS NULL
       AND received_at > datetime('now','-1 day')`, merchant.id);
    sms = candidates.find(c => c.ref_code && editDistance(String(c.ref_code).toUpperCase(), reference) <= 2) || null;
    if (sms) trace.steps.push(`fuzzy_repair: matched ${sms.ref_code} (edit distance ≤2)`);
  }
  if (!sms) {
    trace.steps.push('ledger: no matching SMS yet — watching the window');
    q.run(`INSERT OR IGNORE INTO replay_index (reference, merchant_id, receipt_id) VALUES (?,?,NULL)`,
      reference, merchant.id);
    return { status: 'not_found_yet', code: 'code_not_found_yet', trace };
  }

  // 2b. amount guard (spec §24): the code exists, but the operator SMS confirms a
  // DIFFERENT amount than this order expected → reject as amount_mismatch (never
  // verify a wrong-amount payment against an order). Only when an intent is known.
  //
  // Units matter here: the intent carries API MINOR units, the SMS is written for a
  // human ("5.89 USD"). Comparing them raw rejected every honest USD payment 100×
  // over while CDF (factor 1) sailed through — see shared/currency.js.
  // DUAL-CURRENCY SAFETY: DRC (and every target market) runs the local and an
  // international currency side by side, so 589 CDF and 5.89 USD are the SAME stored
  // minor number. Comparing minor units alone, a 589 FC payment (~$0.21) would satisfy
  // a $5.89 (589-minor USD) order. The currency must match too — auto-match already
  // filters on it; this guards the customer-submitted-code path (Door 1 / API verify).
  const curOk = !intent || !intent.currency || !sms.currency
    || String(sms.currency).toUpperCase() === String(intent.currency).toUpperCase();
  const smsMinor = intent ? toMinor(sms.amount, sms.currency || intent.currency) : null;
  if (intent && intent.amount != null && (!curOk || smsMinor !== Number(intent.amount))) {
    trace.steps.push(!curOk
      ? `amount_mismatch: order in ${intent.currency}, SMS confirms ${sms.currency}`
      : `amount_mismatch: expected ${intent.amount} minor, SMS confirms ${sms.amount} (${smsMinor} minor)`);
    notifyOwners(merchant, 'payment.pending_review', { reference });
    emitOutcome(merchant.id, 'rejected', 'amount_mismatch', { reference, amount: sms.amount, currency: sms.currency });
    return { status: 'rejected', code: 'amount_mismatch', expected_amount: intent.amount, expected_currency: intent.currency, received_amount: sms.amount, received_currency: sms.currency, trace };
  }

  // 3. fraud scoring (+ optional cross-merchant network signal — 0 by default)
  const risk = scoreMatch({ merchant, intent, sms, reference, networkDelta: netDelta(sms) });
  trace.steps.push(`fraud_score: ${risk.score} (${risk.band}) ${risk.reasons.join(',') || 'clean'}`);
  if (risk.band === 'reject') {
    notifyOwners(merchant, 'fraud.high_risk_blocked', { reference });
    emitOutcome(merchant.id, 'rejected', 'high_risk', { reference });
    metric('rejects');     return { status: 'rejected', code: 'high_risk', risk, trace };
  }
  if (risk.band === 'challenge') {
    if (intent) q.run(`UPDATE intents SET status='pending_review' WHERE id=?`, intent.id);
    notifyOwners(merchant, 'payment.pending_review', { reference });
    emitOutcome(merchant.id, 'pending_review', 'msisdn_suffix_mismatch', { reference });
    return { status: 'pending_review', code: 'msisdn_suffix_mismatch', risk, trace };
  }

  // 4. verified — receipt, replay lock, billing, webhook, comms
  const rcp = id('rcp');
  // free within quota; Vision (AI) always metered; code-path overage charged.
  const acuCost = viaScreenshot ? ACU.vision : (withinQuota(merchant) ? 0 : ACU.code);
  const masked = sms.counterparty_name
    ? sms.counterparty_name.split(' ').map((w, i) => i === 0 ? w[0] + '***' : w[0] + '.').join(' ') : null;
  q.run(`INSERT INTO receipts (id,merchant_id,intent_id,sms_id,reference,amount,currency,operator,
         payer_name_masked,payer_suffix,risk_score,mode,decision_trace,acu_cost,verified_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    rcp, merchant.id, intent ? intent.id : 'int_manual', sms.id, sms.ref_code || reference,
    sms.amount, sms.currency, sms.operator, masked, sms.counterparty_suffix,
    risk.score, mode, JSON.stringify(trace), acuCost, userId);
  q.run(`INSERT OR REPLACE INTO replay_index (reference, merchant_id, receipt_id) VALUES (?,?,?)`,
    String(sms.ref_code || reference).toUpperCase(), merchant.id, rcp);
  q.run(`UPDATE sms_ledger SET matched_intent_id=? WHERE id=?`, intent ? intent.id : 'manual', sms.id);
  if (intent) q.run(`UPDATE intents SET status=? WHERE id=?`, late ? 'verified_late' : 'verified', intent.id);
  if (acuCost > 0) chargeAcu(merchant, acuCost, viaScreenshot ? 'vision' : 'verification', rcp);

  recordNetwork(sms, 'verified'); // ADD-ON B: contribute the hashed payer to the network
  maybeFirstVerified(merchant.id);
  const event = late ? 'payment.verified.late' : 'payment.verified';
  const payload = {
    intent_id: intent?.id || null, receipt_id: rcp, amount: sms.amount, currency: sms.currency,
    operator: sms.operator, reference: sms.ref_code || reference, payer_name_masked: masked,
    matched_msisdn_suffix: sms.counterparty_suffix ? `***${sms.counterparty_suffix}` : null,
    risk_score: risk.score, mode, confirmation_level: 'sms_anchored', // ADD-ON A: default label
    metadata: intent?.metadata ? JSON.parse(intent.metadata) : {},
  };
  webhooks.dispatch(merchant.id, event, payload);
  emitOutcome(merchant.id, late ? 'verified_late' : 'verified', null, { receipt_id: rcp, reference: payload.reference, amount: sms.amount, currency: sms.currency, metadata: payload.metadata });
  notifyOwners(merchant, event, { amount: `${fmtAmt(sms.amount)} ${sms.currency}`, reference: payload.reference });

  // top-up intents credit the wallet on verification — the product bills itself with itself
  if (intent && intent.purpose === 'topup') {
    const meta = JSON.parse(intent.metadata || '{}');
    const pack = TOPUP_PACKS.find(p => p.usd === meta.usd) || { acu: Math.round((meta.usd || 10) * 10) };
    creditAcu(merchant, pack.acu, 'topup', intent.id);
    notifyOwners(merchant, 'billing.topup.verified', { acu: pack.acu });
  }

  metric('verifications');
  try { require('./referrals').qualify(merchant.id); } catch { /* growth optional */ } // first verify rewards the referrer
  return { status: late ? 'verified_late' : 'verified', receipt_id: rcp, risk, trace,
           confirmation_level: 'sms_anchored',
           amount_confirmed: sms.amount, operator: sms.operator, match_confidence: 1 - risk.score };
}

// One-tap confirm from the Live Feed: the SMS is ALREADY captured by Sentinel on
// the merchant's own SIM, so there is nothing to type — the merchant just claims
// this counter sale. Runs the SAME fraud policy and issues the SAME receipt as
// verify(); the only difference is the SMS is looked up by id, not by a typed code.
function confirmLedgerPayment(merchant, smsId, { userId = null } = {}) {
  const trace = { steps: ['feed_confirm: merchant tapped a Sentinel-captured payment'],
    template_version: VERSION.trace_template, model_version: VERSION.fraud_model };
  const sms = q.get('SELECT * FROM sms_ledger WHERE id=? AND merchant_id=?', smsId, merchant.id);
  if (!sms) return { status: 'error', code: 'sms_not_found', trace };
  if (sms.quarantined) return { status: 'rejected', code: 'sms_quarantined', trace };
  if (!sms.ref_code || sms.amount == null) return { status: 'error', code: 'unparseable_sms', trace };
  if (sms.matched_intent_id) return { status: 'error', code: 'already_matched', trace };

  const reference = String(sms.ref_code).toUpperCase();
  const used = q.get('SELECT * FROM replay_index WHERE merchant_id=? AND reference=? AND receipt_id IS NOT NULL',
    merchant.id, reference);
  if (used) { notifyOwners(merchant, 'replay.blocked', { reference }); emitOutcome(merchant.id, 'rejected', 'code_already_used', { reference }); return { status: 'rejected', code: 'code_already_used', trace }; }

  const risk = scoreMatch({ merchant, intent: null, sms, reference, networkDelta: netDelta(sms) });
  trace.steps.push(`fraud_score: ${risk.score} (${risk.band}) ${risk.reasons.join(',') || 'clean'}`);
  if (risk.band === 'reject') { notifyOwners(merchant, 'fraud.high_risk_blocked', { reference }); emitOutcome(merchant.id, 'rejected', 'high_risk', { reference }); return { status: 'rejected', code: 'high_risk', risk, trace }; }
  if (risk.band === 'challenge') { notifyOwners(merchant, 'payment.pending_review', { reference }); emitOutcome(merchant.id, 'pending_review', 'needs_review', { reference }); return { status: 'pending_review', code: 'needs_review', risk, trace }; }

  const rcp = id('rcp');
  const acuCost = withinQuota(merchant) ? 0 : ACU.code;
  const masked = sms.counterparty_name
    ? sms.counterparty_name.split(' ').map((w, i) => i === 0 ? w[0] + '***' : w[0] + '.').join(' ') : null;
  q.run(`INSERT INTO receipts (id,merchant_id,intent_id,sms_id,reference,amount,currency,operator,
         payer_name_masked,payer_suffix,risk_score,mode,decision_trace,acu_cost,verified_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    rcp, merchant.id, 'int_manual', sms.id, sms.ref_code, sms.amount, sms.currency, sms.operator,
    masked, sms.counterparty_suffix, risk.score, 'manual', JSON.stringify(trace), acuCost, userId);
  q.run(`INSERT OR REPLACE INTO replay_index (reference, merchant_id, receipt_id) VALUES (?,?,?)`, reference, merchant.id, rcp);
  q.run(`UPDATE sms_ledger SET matched_intent_id='manual' WHERE id=?`, sms.id);
  if (acuCost > 0) chargeAcu(merchant, acuCost, 'verification', rcp);

  recordNetwork(sms, 'verified'); // ADD-ON B
  maybeFirstVerified(merchant.id);
  const payload = { intent_id: null, receipt_id: rcp, amount: sms.amount, currency: sms.currency,
    operator: sms.operator, reference: sms.ref_code, payer_name_masked: masked,
    matched_msisdn_suffix: sms.counterparty_suffix ? `***${sms.counterparty_suffix}` : null,
    risk_score: risk.score, mode: 'manual', confirmation_level: 'sms_anchored', metadata: {} };
  webhooks.dispatch(merchant.id, 'payment.verified', payload);
  emitOutcome(merchant.id, 'verified', null, { receipt_id: rcp, reference: sms.ref_code, amount: sms.amount, currency: sms.currency });
  notifyOwners(merchant, 'payment.verified', { amount: `${fmtAmt(sms.amount)} ${sms.currency}`, reference: sms.ref_code });

  metric('verifications'); metric('verifications_auto');
  try { require('./referrals').qualify(merchant.id); } catch { /* growth optional */ }
  return { status: 'verified', receipt_id: rcp, risk, trace, confirmation_level: 'sms_anchored',
           amount_confirmed: sms.amount, operator: sms.operator, match_confidence: 1 - risk.score };
}

function sandboxVerify(merchant, intent, reference, { mode, userId, trace }) {
  trace.steps.push('sandbox: magic reference');
  if (reference === 'TEST-REPLAY') { emitOutcome(merchant.id, 'rejected', 'code_already_used', { reference }); return { status: 'rejected', code: 'code_already_used', trace }; }
  if (reference === 'TEST-SUFFIX') { emitOutcome(merchant.id, 'pending_review', 'msisdn_suffix_mismatch', { reference }); return { status: 'pending_review', code: 'msisdn_suffix_mismatch', trace }; }
  const m = reference.match(/^TEST-OK-(\d+)/);
  const amount = m ? Number(m[1]) : (intent ? intent.amount : 0);
  const rcp = id('rcp');
  q.run(`INSERT INTO receipts (id,merchant_id,intent_id,sms_id,reference,amount,currency,operator,
         payer_name_masked,risk_score,mode,decision_trace,acu_cost,verified_by)
         VALUES (?,?,?,NULL,?,?,?,?,?,0.01,?,?,0,?)`,
    rcp, merchant.id, intent ? intent.id : 'int_sandbox', reference, amount,
    intent?.currency || merchant.currency, 'sandbox', 'T*** U.', mode, JSON.stringify(trace), userId);
  if (intent) {
    q.run(`UPDATE intents SET status='verified' WHERE id=?`, intent.id);
    if (intent.purpose === 'topup') {
      const meta = JSON.parse(intent.metadata || '{}');
      const pack = TOPUP_PACKS.find(p => p.usd === meta.usd) || { acu: Math.round((meta.usd || 10) * 10) };
      creditAcu(merchant, pack.acu, 'topup', intent.id);
      notifyOwners(merchant, 'billing.topup.verified', { acu: pack.acu });
    }
  }
  const sbMeta = intent?.metadata ? JSON.parse(intent.metadata) : {};
  webhooks.dispatch(merchant.id, 'payment.verified', {
    intent_id: intent?.id || null, receipt_id: rcp, amount, sandbox: true, reference, metadata: sbMeta,
  });
  emitOutcome(merchant.id, 'verified', null, { receipt_id: rcp, reference, amount, currency: intent?.currency || null, metadata: sbMeta });
  notifyOwners(merchant, 'payment.verified', { amount: `${fmtAmt(amount)} ${intent?.currency || ''}`, reference });
  try { require('./referrals').qualify(merchant.id); } catch { /* growth optional */ }
  return { status: 'verified', receipt_id: rcp, sandbox: true, amount_confirmed: amount, trace };
}

function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 99;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}
function fmtAmt(n) { return Number(n || 0).toLocaleString('fr-FR'); }

module.exports = { verify, confirmLedgerPayment, ingestSms, chargeAcu, creditAcu, ACU, TOPUP_PACKS, getMerchant, notifyOwners, gateAI, AI_MIN, acuUnlimited, withinQuota, emitOutcome };
