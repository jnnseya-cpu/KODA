// KODA — the verification engine (MatchMaker + billing + webhooks + comms glue).
// Shared by all three doors: Manual (console), Chat, API.
'use strict';
const { q } = require('./db');
const { id } = require('./util');
const { scoreMatch, chainCheck } = require('./fraud');
const { parseSms } = require('./parser');
const webhooks = require('./webhooks');
const notify = require('./comms/notify');

const ACU = { code: 1, vision: 3, dispute: 3, trust: 0.5, submerchant: 5 };
const TOPUP_PACKS = [
  { usd: 10, acu: 300 }, { usd: 50, acu: 1750 }, { usd: 200, acu: 8000 },
];

function getMerchant(mid) { return q.get('SELECT * FROM merchants WHERE id=?', mid); }

function chargeAcu(merchant, amount, kind, ref) {
  const bal = merchant.acu_balance - amount;
  q.run('UPDATE merchants SET acu_balance=? WHERE id=?', bal, merchant.id);
  q.run(`INSERT INTO acu_transactions (id,merchant_id,delta,kind,ref,balance_after)
         VALUES (?,?,?,?,?,?)`, id('acu'), merchant.id, -amount, kind, ref || null, bal);
  merchant.acu_balance = bal;
  if (bal <= 0) notifyOwners(merchant, 'billing.grace_started', {});
  else if (bal < 100) notifyOwners(merchant, 'billing.low_balance', {});
  return bal;
}
function creditAcu(merchant, amount, kind, ref) {
  const bal = merchant.acu_balance + amount;
  q.run('UPDATE merchants SET acu_balance=? WHERE id=?', bal, merchant.id);
  q.run(`INSERT INTO acu_transactions (id,merchant_id,delta,kind,ref,balance_after)
         VALUES (?,?,?,?,?,?)`, id('acu'), merchant.id, amount, kind, ref || null, bal);
  merchant.acu_balance = bal;
  return bal;
}
function notifyOwners(merchant, eventKey, data) {
  try { notify.fireMerchant(eventKey, merchant, data); } catch { /* comms must never break the money path */ }
}

// ingest an SMS (from Sentinel push, KODA Lite forward, or sandbox simulator)
function ingestSms(merchant, { raw, operator, device_id }) {
  const parsed = parseSms(raw, operator);
  const smsId = id('sms');
  if (!parsed) {
    q.run(`INSERT INTO sms_ledger (id,merchant_id,device_id,operator,raw,chain_ok,quarantined)
           VALUES (?,?,?,?,?,1,0)`, smsId, merchant.id, device_id || null, operator || 'unknown', raw);
    return { id: smsId, parsed: false };
  }
  const chain = chainCheck(merchant.id, parsed.operator, parsed.amount, parsed.balance);
  q.run(`INSERT INTO sms_ledger (id,merchant_id,device_id,operator,raw,ref_code,amount,currency,
         counterparty_name,counterparty_suffix,balance_after,chain_ok,quarantined)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    smsId, merchant.id, device_id || null, parsed.operator, raw, parsed.ref, parsed.amount,
    parsed.currency, parsed.name || null, parsed.suffix || null, parsed.balance,
    chain.ok ? 1 : 0, chain.ok ? 0 : 1);

  if (!chain.ok) {
    notifyOwners(merchant, 'fraud.chain_break', { operator: parsed.operator });
    return { id: smsId, parsed: true, quarantined: true, chain };
  }
  // late-match: an awaiting intent watching for this reference?
  const sms = q.get('SELECT * FROM sms_ledger WHERE id=?', smsId);
  const waiting = q.all(
    `SELECT * FROM intents WHERE merchant_id=? AND status='awaiting_payment' AND amount=?
     ORDER BY created_at DESC`, merchant.id, parsed.amount);
  for (const intent of waiting) {
    const pendingRef = q.get(
      `SELECT reference FROM replay_index WHERE merchant_id=? AND reference=? AND receipt_id IS NULL`,
      merchant.id, parsed.ref);
    if (pendingRef) { // a customer already submitted this code (not_found_yet) → convert now
      verify(getMerchant(merchant.id), intent, parsed.ref, { mode: 'api', late: true });
      break;
    }
  }
  return { id: smsId, parsed: true, quarantined: false, fields: parsed };
}

// the core verify — one truth for all three doors
function verify(merchant, intent, reference, { mode = 'api', userId = null, viaScreenshot = false, late = false } = {}) {
  reference = String(reference || '').trim().toUpperCase();
  const trace = { steps: [], template_version: 'v2.0', model_version: 'fraud-2026-07' };

  // magic sandbox references
  if (/^TEST-/.test(reference)) return sandboxVerify(merchant, intent, reference, { mode, userId, trace });

  // 1. replay index
  const used = q.get('SELECT * FROM replay_index WHERE merchant_id=? AND reference=? AND receipt_id IS NOT NULL',
    merchant.id, reference);
  if (used) {
    trace.steps.push('replay_index: HIT — code already consumed');
    notifyOwners(merchant, 'replay.blocked', { reference });
    return { status: 'rejected', code: 'code_already_used', trace };
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

  // 3. fraud scoring
  const risk = scoreMatch({ merchant, intent, sms, reference });
  trace.steps.push(`fraud_score: ${risk.score} (${risk.band}) ${risk.reasons.join(',') || 'clean'}`);
  if (risk.band === 'reject') {
    notifyOwners(merchant, 'fraud.high_risk_blocked', { reference });
    return { status: 'rejected', code: 'high_risk', risk, trace };
  }
  if (risk.band === 'challenge') {
    if (intent) q.run(`UPDATE intents SET status='pending_review' WHERE id=?`, intent.id);
    notifyOwners(merchant, 'payment.pending_review', { reference });
    return { status: 'pending_review', code: 'msisdn_suffix_mismatch', risk, trace };
  }

  // 4. verified — receipt, replay lock, billing, webhook, comms
  const rcp = id('rcp');
  const acuCost = viaScreenshot ? ACU.vision : ACU.code;
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
  chargeAcu(merchant, acuCost, viaScreenshot ? 'vision' : 'verification', rcp);

  const event = late ? 'payment.verified.late' : 'payment.verified';
  const payload = {
    intent_id: intent?.id || null, receipt_id: rcp, amount: sms.amount, currency: sms.currency,
    operator: sms.operator, reference: sms.ref_code || reference, payer_name_masked: masked,
    matched_msisdn_suffix: sms.counterparty_suffix ? `***${sms.counterparty_suffix}` : null,
    risk_score: risk.score, mode,
    metadata: intent?.metadata ? JSON.parse(intent.metadata) : {},
  };
  webhooks.dispatch(merchant.id, event, payload);
  notifyOwners(merchant, event, { amount: `${fmtAmt(sms.amount)} ${sms.currency}`, reference: payload.reference });

  // top-up intents credit the wallet on verification — the product bills itself with itself
  if (intent && intent.purpose === 'topup') {
    const meta = JSON.parse(intent.metadata || '{}');
    const pack = TOPUP_PACKS.find(p => p.usd === meta.usd) || { acu: Math.round((meta.usd || 10) * 30) };
    creditAcu(merchant, pack.acu, 'topup', intent.id);
    notifyOwners(merchant, 'billing.topup.verified', { acu: pack.acu });
  }

  return { status: late ? 'verified_late' : 'verified', receipt_id: rcp, risk, trace,
           amount_confirmed: sms.amount, operator: sms.operator, match_confidence: 1 - risk.score };
}

function sandboxVerify(merchant, intent, reference, { mode, userId, trace }) {
  trace.steps.push('sandbox: magic reference');
  if (reference === 'TEST-REPLAY') return { status: 'rejected', code: 'code_already_used', trace };
  if (reference === 'TEST-SUFFIX') return { status: 'pending_review', code: 'msisdn_suffix_mismatch', trace };
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
      const pack = TOPUP_PACKS.find(p => p.usd === meta.usd) || { acu: Math.round((meta.usd || 10) * 30) };
      creditAcu(merchant, pack.acu, 'topup', intent.id);
      notifyOwners(merchant, 'billing.topup.verified', { acu: pack.acu });
    }
  }
  webhooks.dispatch(merchant.id, 'payment.verified', {
    intent_id: intent?.id || null, receipt_id: rcp, amount, sandbox: true, reference,
  });
  notifyOwners(merchant, 'payment.verified', { amount: `${fmtAmt(amount)} ${intent?.currency || ''}`, reference });
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

module.exports = { verify, ingestSms, chargeAcu, creditAcu, ACU, TOPUP_PACKS, getMerchant, notifyOwners };
