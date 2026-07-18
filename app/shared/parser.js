// KODA — ParserAgent: operator template packs (calibration grammars, OTA-updatable in production)
'use strict';

// Each pack: operator id, sender allowlist, regex grammar → canonical fields.
// Production ships these OTA to Sentinel; here they run server-side for the
// sandbox simulator and KODA Lite (forwarded SMS) ingestion.
const PACKS = [
  {
    operator: 'orange_cd', label: 'Orange Money (DRC)', senders: ['OrangeMoney', 'ORANGE'],
    re: /vous avez recu\s+([\d\s.,]+)\s*(FC|CDF|USD)?\s*de\s+([A-Za-zÀ-ÿ.\s]+?)\s*\(?(?:\+?243)?\d*?(\d{4})\)?\.?\s*ref\s*:?\s*([A-Z0-9.\-]+)\.?\s*(?:solde\s*:?\s*([\d\s.,]+))?/i,
    map: (m) => ({ amount: num(m[1]), currency: m[2] === 'USD' ? 'USD' : 'CDF', name: m[3].trim(), suffix: m[4], ref: m[5], balance: num(m[6]) }),
  },
  {
    operator: 'mpesa_cd', label: 'M-Pesa (Vodacom DRC)', senders: ['M-PESA', 'MPESA'],
    re: /([A-Z0-9.]+)\s+confirm[eé]\.?\s*vous avez re[cç]u\s+([\d\s.,]+)\s*(FC|CDF|USD)?\s*de\s+([A-Za-zÀ-ÿ.\s]+?)\s+(?:\+?243)?\d*?(\d{4})\b.*?(?:nouveau solde\s*:?\s*([\d\s.,]+))?$/is,
    map: (m) => ({ ref: m[1], amount: num(m[2]), currency: m[3] === 'USD' ? 'USD' : 'CDF', name: m[4].trim(), suffix: m[5], balance: num(m[6]) }),
  },
  {
    operator: 'airtel_cd', label: 'Airtel Money (DRC)', senders: ['AirtelMoney', 'AIRTEL'],
    re: /txn\s*id\s*:?\s*([A-Z0-9.\-]+)\.?\s*re[cç]u\s+([\d\s.,]+)\s*(FC|CDF|USD)?\s*de\s+(?:\+?243)?\d*?(\d{4})\s+([A-Za-zÀ-ÿ.\s]+?)\.?\s*(?:solde\s*:?\s*([\d\s.,]+))?$/is,
    map: (m) => ({ ref: m[1], amount: num(m[2]), currency: m[3] === 'USD' ? 'USD' : 'CDF', suffix: m[4], name: m[5].trim(), balance: num(m[6]) }),
  },
  {
    operator: 'africell_cd', label: 'Africell Money (DRC)', senders: ['Africell', 'AfricellMoney'],
    re: /([A-Z0-9.\-]+)\s*:\s*reception de\s+([\d\s.,]+)\s*(FC|CDF|USD)?\s*de la part de\s+([A-Za-zÀ-ÿ.\s]+)/i,
    map: (m) => ({ ref: m[1], amount: num(m[2]), currency: m[3] === 'USD' ? 'USD' : 'CDF', name: m[4].trim(), suffix: null, balance: null }),
  },
  {
    operator: 'mtn_momo', label: 'MTN MoMo', senders: ['MTNMoMo', 'MobileMoney'],
    re: /payment received\s*:?\s*([\d\s.,]+)\s*(GHS|UGX|XOF|RWF|USD)?\s*from\s+([A-Za-zÀ-ÿ.\s]+?)\.?\s*ref\s+([A-Z0-9.\-]+)\.?\s*(?:current balance\s+([\d\s.,]+))?/i,
    map: (m) => ({ amount: num(m[1]), currency: m[2] || 'GHS', name: m[3].trim(), ref: m[4], suffix: null, balance: num(m[5]) }),
  },
  {
    operator: 'wave', label: 'Wave', senders: ['Wave'],
    re: /vous avez re[cç]u\s+([\d\s.,]+)\s*(XOF|F)?\s*de\s+([A-Za-zÀ-ÿ.\s]+?)\.?\s*id\s*:?\s*([A-Z0-9.\-]+)/i,
    map: (m) => ({ amount: num(m[1]), currency: 'XOF', name: m[3].trim(), ref: m[4], suffix: null, balance: null }),
  },
];

function num(s) {
  if (!s) return null;
  const n = Number(String(s).replace(/[\s.,](?=\d{3}\b)/g, '').replace(',', '.').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

// parse a raw SMS; returns {operator, ref, amount, currency, name, suffix, balance} or null
function parseSms(raw, operatorHint) {
  const candidates = operatorHint ? PACKS.filter(p => p.operator === operatorHint).concat(PACKS) : PACKS;
  for (const pack of candidates) {
    const m = String(raw).match(pack.re);
    if (m) {
      const f = pack.map(m);
      if (f.ref) f.ref = String(f.ref).replace(/[.\s]+$/, ''); // strip trailing punctuation
      if (f.ref && f.amount) return { operator: pack.operator, ...f };
    }
  }
  return null;
}

const OPERATORS = PACKS.map(p => ({ id: p.operator, label: p.label }));

module.exports = { parseSms, OPERATORS, PACKS };
