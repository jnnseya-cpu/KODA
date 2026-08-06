// Functional test for the deterministic AI agents (K-03 TrustAgent, K-04 VisionAgent).
// Proves both return real, ledger-derived values — not hardcoded constants.
process.env.KODA_DATA_DIR = require('node:fs').mkdtempSync('/tmp/koda-agents-');
const { q } = require('../lib/db');
const { trustLookup, visionCrossCheck } = require('../routes');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra != null ? JSON.stringify(extra) : ''); } };

// --- seed a merchant + real ledger history for payer suffix 1234 ---
const M = 'mch_test';
q.run(`INSERT INTO merchants (id, name, plan) VALUES (?, 'Test', 'plateforme')`, M);
const putReceipt = (ref, amt, suffix, when) => q.run(
  `INSERT INTO receipts (id, merchant_id, intent_id, reference, amount, currency, payer_suffix, verified_at)
   VALUES (?,?,?,?,?,?,?,?)`, 'rcp_' + ref, M, 'int_x', ref, amt, 'CDF', suffix, when);
const putSms = (ref, amt, suffix, { quar = 0, chain = 1 } = {}) => q.run(
  `INSERT INTO sms_ledger (id, merchant_id, operator, raw, ref_code, amount, currency, counterparty_suffix, quarantined, chain_ok)
   VALUES (?,?,?,?,?,?,?,?,?,?)`, 'sms_' + ref, M, 'orange_cd', 'raw', ref, amt, 'CDF', suffix, quar, chain);

// good payer: 6 clean verified payments spread over the last ~40 days
const days = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 19).replace('T', ' ');
for (let i = 0; i < 6; i++) putReceipt('GOOD' + i, 25000, '1234', days(40 - i));
putSms('GOOD0', 25000, '1234');

// bad payer 9999: one quarantined spoof + one dispute
putSms('SPOOF1', 999999, '9999', { quar: 1, chain: 0 });
putReceipt('DISP1', 5000, '9999', days(2));
q.run(`INSERT INTO disputes (id, merchant_id, reference, reason) VALUES ('dsp1', ?, 'DISP1', 'chargeback')`, M);

console.log('K-03 TrustAgent (deterministic, ledger-derived):');
const t1 = trustLookup({ id: M }, { subject: '+243 900 001234' });
ok('good payer scored from real history', t1.trust_score > 0.6 && t1.confidence === 'high', t1);
ok('good payer signals count real verified payments', t1.signals.verified_payments === 6, t1.signals);
const t2 = trustLookup({ id: M }, { subject: '9999' });
ok('bad payer scored lower (quarantine + dispute)', t2.trust_score < t1.trust_score, { bad: t2.trust_score, good: t1.trust_score });
ok('bad payer surfaces the quarantine', t2.signals.quarantined_sms === 1, t2.signals);
ok('bad payer surfaces the dispute', t2.signals.disputes === 1, t2.signals);
const t3 = trustLookup({ id: M }, { subject: '5555' });
ok('unknown payer → no score, honest note', t3.trust_score === null && t3.confidence === 'none', t3);
ok('two different payers get two different scores (not a constant)', t1.trust_score !== t2.trust_score);

console.log('K-04 VisionAgent (operator-SMS cross-check):');
const v1 = visionCrossCheck({ id: M }, { screenshot_ref: 'GOOD0', amount: 25000 });
ok('real reference + amount → backed_by_operator_sms', v1.verdict === 'backed_by_operator_sms' && v1.backed_by_operator_sms, v1);
ok('backed verdict carries the real ledger amount', v1.ledger_match && v1.ledger_match.amount === 25000, v1.ledger_match);
const v2 = visionCrossCheck({ id: M }, { screenshot_ref: 'GHOST', amount: 25000 });
ok('no matching SMS → forged-screenshot verdict', v2.verdict === 'no_operator_sms_backs_this_screenshot' && !v2.backed_by_operator_sms, v2);
const v3 = visionCrossCheck({ id: M }, { screenshot_ref: 'GOOD0', amount: 999 });
ok('edited amount on a real ref → amount_mismatch', v3.verdict === 'amount_mismatch', v3);
const v4 = visionCrossCheck({ id: M }, { screenshot_ref: 'SPOOF1', amount: 999999 });
ok('quarantined SMS → matching_sms_is_quarantined', v4.verdict === 'matching_sms_is_quarantined', v4);
ok('no fabricated pixel forensics (honest: unavailable)', v1.image_forensics.available === false, v1.image_forensics);

console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAIL'} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
