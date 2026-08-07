// KODA — FraudSentinel: risk scoring for every match attempt.
// Simplified feature set of the ~40-feature production model; bands per spec §8:
// <0.15 auto-confirm · 0.15–0.6 challenge (pending_review) · >0.6 reject
'use strict';
const { q } = require('./db');

function scoreMatch({ merchant, intent, sms, reference, suffixProvided, networkDelta }) {
  const reasons = [];
  let score = 0.02; // base

  // ADD-ON B (optional): a cross-merchant network risk signal. Defaults to 0, so
  // with the network scoring feed off (the default) scoring is byte-identical to
  // before. Only a positive delta from proven network-wide adverse history nudges
  // the score up — it can never lower risk or override the deterministic bands.
  if (networkDelta && networkDelta.delta > 0) {
    score += networkDelta.delta;
    reasons.push('network:' + (networkDelta.reason || 'adverse_history'));
  }

  // Velocity is a fraud signal only when it comes from ONE payer hammering —
  // a merchant taking many DIFFERENT legitimate payments is a healthy business,
  // never suspicious. So we look at same-payer burst, not merchant total volume.
  if (sms && sms.counterparty_suffix) {
    const samePayer = q.get(
      `SELECT COUNT(*) c FROM sms_ledger
       WHERE merchant_id=? AND counterparty_suffix=? AND received_at > datetime('now','-5 minutes')`,
      merchant.id, sms.counterparty_suffix).c;
    if (samePayer > 8) { score += 0.12; reasons.push('same_payer_burst'); } // mild; won't alone force review
  }

  if (!sms) { score += 0.5; reasons.push('no_merchant_side_confirmation'); }
  else {
    // parsed by the generic fallback (no precise pack for this operator yet) →
    // lower trust: nudge into the challenge band so a human confirms it.
    if (sms.operator === 'generic') { score += 0.2; reasons.push('generic_operator_low_trust'); }
    if (sms.quarantined) { score += 0.9; reasons.push('sms_quarantined_chain_break'); }
    if (intent && sms.amount !== intent.amount) { score += 0.45; reasons.push('amount_mismatch'); }
    if (intent) {
      const created = new Date(intent.created_at + 'Z').getTime();
      const received = new Date((sms.received_at || intent.created_at) + 'Z').getTime();
      const driftMin = Math.abs(received - created) / 60000;
      if (driftMin > 45) { score += 0.2; reasons.push('outside_time_window'); }
    }
    if (intent && intent.customer_msisdn && sms.counterparty_suffix) {
      const want = String(intent.customer_msisdn).slice(-4);
      if (want !== sms.counterparty_suffix) { score += 0.3; reasons.push('msisdn_suffix_mismatch'); }
    }
  }
  if (suffixProvided === false && intent && !intent.customer_msisdn) {
    score += 0.05; reasons.push('no_payer_identity_signal');
  }

  score = Math.min(0.99, Number(score.toFixed(3)));
  const band = score < 0.15 ? 'confirm' : score <= 0.6 ? 'challenge' : 'reject';
  return { score, band, reasons };
}

// balance-chain defence: does this SMS keep the running arithmetic intact?
function chainCheck(merchantId, operator, amount, balanceAfter) {
  if (balanceAfter == null || amount == null) return { ok: true, reason: 'no_balance_in_grammar' };
  const prev = q.get(
    `SELECT balance_after FROM sms_ledger
     WHERE merchant_id=? AND operator=? AND balance_after IS NOT NULL AND quarantined=0
     ORDER BY received_at DESC, rowid DESC LIMIT 1`, merchantId, operator);
  if (!prev || prev.balance_after == null) return { ok: true, reason: 'chain_start' };
  const expected = prev.balance_after + amount;
  const ok = Math.abs(expected - balanceAfter) < 0.01;
  return ok ? { ok: true, reason: 'chain_ok' }
            : { ok: false, reason: `chain_break expected ${expected} got ${balanceAfter}` };
}

module.exports = { scoreMatch, chainCheck };
