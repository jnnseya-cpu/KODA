// KODA — FraudSentinel: risk scoring for every match attempt.
// Simplified feature set of the ~40-feature production model; bands per spec §8:
// <0.15 auto-confirm · 0.15–0.6 challenge (pending_review) · >0.6 reject
'use strict';
const { q } = require('./db');

function scoreMatch({ merchant, intent, sms, reference, suffixProvided }) {
  const reasons = [];
  let score = 0.02; // base

  // replay is checked before scoring (hard reject) — velocity features here
  const recentAttempts = q.get(
    `SELECT COUNT(*) c FROM receipts WHERE merchant_id=? AND verified_at > datetime('now','-10 minutes')`,
    merchant.id).c;
  if (recentAttempts > 30) { score += 0.15; reasons.push('velocity_merchant_high'); }

  if (!sms) { score += 0.5; reasons.push('no_merchant_side_confirmation'); }
  else {
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
