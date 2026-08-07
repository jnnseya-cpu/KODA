// KODA — ADD-ON B: cross-merchant trust / fraud network.
//
// A strict ADD-ON that builds a moat no single-country processor can copy: a
// privacy-preserving, network-wide view of counterparty behaviour. As merchants
// verify (and quarantine, and dispute) payments, we accrete an AGGREGATE per
// payer — keyed by a SALTED HASH of the payer's trailing digits, never a raw
// number, name, or which merchant. A merchant only ever reads the aggregate
// SIGNAL ("this counterparty has N verified payments and D disputes across the
// KODA network"), never another merchant's rows.
//
// It changes NOTHING about today's verification decision by default: recording is
// harmless (writes to its own tables), the Trust API is new surface, and the
// optional fraud-scoring feed is OFF unless KODA_TRUST_NETWORK_SCORING=1.
'use strict';
const crypto = require('node:crypto');
const { q } = require('./db');
const { id } = require('./util');

// Recording + Trust API are on by default (privacy-safe aggregates); set
// KODA_TRUST_NETWORK=0 to disable entirely. The SCORING feed into fraud is off by
// default so verification decisions stay byte-identical to today.
const ENABLED = process.env.KODA_TRUST_NETWORK !== '0';
const SCORE_FEED = process.env.KODA_TRUST_NETWORK_SCORING === '1';
const SALT = process.env.KODA_TRUST_NETWORK_SALT || process.env.KODA_JWT_SECRET || 'koda-dev-network-salt';

function norm(subject) {
  const digits = String(subject || '').replace(/\D/g, '');
  return digits.slice(-4) || digits; // we only ever key on trailing digits
}
function payerHash(subject) {
  const s = norm(subject);
  if (!s) return null;
  return crypto.createHmac('sha256', SALT).update('payer:' + s).digest('hex').slice(0, 32);
}
function refHash(reference) {
  const r = String(reference || '').trim().toUpperCase();
  if (!r) return null;
  return crypto.createHmac('sha256', SALT).update('ref:' + r).digest('hex').slice(0, 32);
}

// Passive learning — called from the engine on verify/quarantine/dispute. Never
// throws (wrapped by callers too): the money path must never depend on this.
function record({ subject, kind }) {
  if (!ENABLED) return;
  const h = payerHash(subject);
  if (!h) return;
  const col = kind === 'verified' ? 'verified_count'
    : kind === 'quarantined' ? 'quarantine_count'
    : kind === 'disputed' ? 'dispute_count' : null;
  if (!col) return;
  q.run(`INSERT INTO network_trust (payer_hash, ${col}) VALUES (?, 1)
         ON CONFLICT(payer_hash) DO UPDATE SET ${col} = ${col} + 1, last_seen = datetime('now')`, h);
}

// Explicit fraud flag a merchant can contribute (chargeback, confirmed scam).
function flag({ kind = 'payer', value, reason, merchantId }) {
  if (!ENABLED) return;
  const vh = kind === 'reference' ? refHash(value) : payerHash(value);
  if (!vh) return;
  q.run(`INSERT INTO network_flags (id, kind, value_hash, reason, merchant_id) VALUES (?,?,?,?,?)`,
    id('nfl'), kind, vh, String(reason || 'flagged').slice(0, 120), merchantId || null);
}

// Network aggregate for a payer — counts only, no identities. Deterministic score.
function lookup(subject) {
  if (!ENABLED) return { available: false };
  const h = payerHash(subject);
  if (!h) return { available: true, seen: false };
  const row = q.get('SELECT * FROM network_trust WHERE payer_hash=?', h);
  const flags = q.get('SELECT COUNT(*) c FROM network_flags WHERE kind=? AND value_hash=?', 'payer', h).c;
  if (!row && !flags) return { available: true, seen: false, network_trust_score: null };
  const v = row ? row.verified_count : 0, quar = row ? row.quarantine_count : 0, disp = row ? row.dispute_count : 0;
  // start neutral; reward a clean network track record, punish network fraud markers.
  let score = 0.5 + Math.min(v, 20) * 0.02 - quar * 0.1 - disp * 0.2 - flags * 0.25;
  score = Math.max(0, Math.min(1, Number(score.toFixed(3))));
  return {
    available: true, seen: true,
    network_trust_score: score,
    signals: { verified_across_network: v, quarantined_across_network: quar,
               disputes_across_network: disp, explicit_flags: flags,
               first_seen: row ? row.first_seen : null, last_seen: row ? row.last_seen : null },
  };
}

// Optional ADDITIVE fraud signal for scoreMatch. Returns a small non-negative
// risk delta + reason, or {delta:0}. Zero unless the scoring feed is enabled AND
// the network actually has adverse history for this payer — so with the feed off
// (default) it is provably a no-op and existing scoring is unchanged.
function riskDelta(subject) {
  if (!ENABLED || !SCORE_FEED) return { delta: 0 };
  const n = lookup(subject);
  if (!n.seen) return { delta: 0 };
  const s = n.signals;
  let delta = 0; const why = [];
  if (s.explicit_flags > 0) { delta += Math.min(0.4, s.explicit_flags * 0.2); why.push('network_flagged'); }
  if (s.disputes_across_network > 0) { delta += Math.min(0.2, s.disputes_across_network * 0.05); why.push('network_disputes'); }
  if (s.quarantined_across_network > 2) { delta += 0.05; why.push('network_quarantines'); }
  return { delta: Number(delta.toFixed(3)), reason: why.join(',') || null };
}

module.exports = { record, flag, lookup, riskDelta, payerHash, refHash, ENABLED, SCORE_FEED };
