// KODA — ParserAgent: operator template packs (calibration grammars, OTA-updatable in production)
'use strict';

// Each pack: operator id, sender allowlist, regex grammar → canonical fields.
// Production ships these OTA to Sentinel; here they run server-side for the
// sandbox simulator and KODA Lite (forwarded SMS) ingestion.
const PACKS = [
  {
    operator: 'orange_cd', label: 'Orange Money (DRC)', senders: ['OrangeMoney', 'ORANGE'],
    re: /vous avez recu\s+([\d\s.,]+)\s*(FC|CDF|USD)?\s*de\s+([A-Za-zÀ-ÿ0-9.'\- ]+?)\s*\(?(?:\+?243)?\d*?(\d{4})\)?\.?\s*ref\s*:?\s*([A-Z0-9.\-]+)\.?\s*(?:solde\s*:?\s*([\d\s.,]+))?/i,
    map: (m) => ({ amount: num(m[1]), currency: m[2] === 'USD' ? 'USD' : 'CDF', name: m[3].trim(), suffix: m[4], ref: m[5], balance: num(m[6]) }),
  },
  {
    operator: 'mpesa_cd', label: 'M-Pesa (Vodacom DRC)', senders: ['M-PESA', 'MPESA'],
    re: /([A-Z0-9.]+)\s+confirm[eé]\.?\s*vous avez re[cç]u\s+([\d\s.,]+)\s*(FC|CDF|USD)?\s*de\s+([A-Za-zÀ-ÿ0-9.'\- ]+?)\s+(?:\+?243)?\d*?(\d{4})\b.*?(?:nouveau solde\s*:?\s*([\d\s.,]+))?$/is,
    map: (m) => ({ ref: m[1], amount: num(m[2]), currency: m[3] === 'USD' ? 'USD' : 'CDF', name: m[4].trim(), suffix: m[5], balance: num(m[6]) }),
  },
  {
    operator: 'airtel_cd', label: 'Airtel Money (DRC)', senders: ['AirtelMoney', 'AIRTEL'],
    re: /txn\s*id\s*:?\s*([A-Z0-9.\-]+)\.?\s*re[cç]u\s+([\d\s.,]+)\s*(FC|CDF|USD)?\s*de\s+(?:\+?243)?\d*?(\d{4})\s+([A-Za-zÀ-ÿ0-9.'\- ]+?)\.?\s*(?:solde\s*:?\s*([\d\s.,]+))?$/is,
    map: (m) => ({ ref: m[1], amount: num(m[2]), currency: m[3] === 'USD' ? 'USD' : 'CDF', suffix: m[4], name: m[5].trim(), balance: num(m[6]) }),
  },
  {
    operator: 'africell_cd', label: 'Africell Money (DRC)', senders: ['Africell', 'AfricellMoney'],
    re: /([A-Z0-9.\-]+)\s*:\s*reception de\s+([\d\s.,]+)\s*(FC|CDF|USD)?\s*de la part de\s+([A-Za-zÀ-ÿ0-9.'\- ]+)/i,
    map: (m) => ({ ref: m[1], amount: num(m[2]), currency: m[3] === 'USD' ? 'USD' : 'CDF', name: m[4].trim(), suffix: null, balance: null }),
  },
  {
    operator: 'mtn_momo', label: 'MTN MoMo', senders: ['MTNMoMo', 'MobileMoney'],
    re: /payment received\s*:?\s*([\d\s.,]+)\s*(GHS|UGX|XOF|RWF|USD)?\s*from\s+([A-Za-zÀ-ÿ0-9.'\- ]+?)\.?\s*ref\s+([A-Z0-9.\-]+)\.?\s*(?:current balance\s+([\d\s.,]+))?/i,
    map: (m) => ({ amount: num(m[1]), currency: m[2] || 'GHS', name: m[3].trim(), ref: m[4], suffix: null, balance: num(m[5]) }),
  },
  {
    operator: 'wave', label: 'Wave', senders: ['Wave'],
    re: /vous avez re[cç]u\s+([\d\s.,]+)\s*(XOF|F)?\s*de\s+([A-Za-zÀ-ÿ0-9.'\- ]+?)\.?\s+ID\s*:?\s*([A-Z0-9.\-]+)/i,
    map: (m) => ({ amount: num(m[1]), currency: 'XOF', name: m[3].trim(), ref: m[4], suffix: null, balance: null }),
  },
];

function num(s) {
  if (!s) return null;
  const n = Number(String(s).replace(/[\s.,](?=\d{3}\b)/g, '').replace(',', '.').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

// Currencies KODA recognises across the mobile-money landscape (for the generic pass).
const CUR = 'FC|CDF|USD|XOF|XAF|GHS|NGN|KES|TZS|UGX|RWF|ZAR|EGP|MAD|TND|EUR|MZN|ZMW|MWK|SLE|SLL|GMD|GNF|LRD|BIF|ETB|SOS|AOA|MGA|LSL|SZL|BWP|INR|BDT|PKR|LKR|NPR|BTN|MVR|AFN|PHP|IDR|MYR|SGD|THB|VND|KHR|MMK|LAK|BND|KZT|UZS|KGS|TJS|MNT|GEL|AMD|AZN|BRL|ARS|CLP|COP|MXN|PEN|UYU|PYG|BOB|VES|GTQ|HNL|NIO|CRC|PAB|DOP|HTG|JMD|TTD|BBD|GYD|SRD|FJD|WST|TOP|VUV|PGK|SBD';

// Generic, multilingual fallback (FR/EN/PT). Fires ONLY when no precise pack
// matches. It extracts amount+currency, a reference code, and the payer name
// from the common "you received X from Y, ref Z" shape. It is deliberately
// lower-trust: results carry generic:true, and FraudSentinel routes them to
// manual review (challenge) instead of auto-confirm until a real pack is added.
function genericParse(raw) {
  const s = String(raw);
  const VERB = 'vous avez re[cç]u|avez re[cç]u|re[cç]u|received|payment received|paiement re[cç]u|recebeu|transfert re[cç]u|credit(?:ed|é)?|menerima|diterima|terima|natanggap|nakatanggap';
  // amount: the number right after a receive verb (a currency code/symbol prefix is allowed)
  let amount = null;
  const vm = s.match(new RegExp(`(?:${VERB})\\s*:?\\s*([A-Za-z₦₵₹৳₨$.]{0,6}\\s?\\d[\\d\\s.,]*)`, 'i'));
  if (vm) amount = num(vm[1]);
  if (!amount) { // fallback: a number adjacent to a known currency anywhere
    const cm = s.match(new RegExp(`(?:(${CUR})\\s*([\\d][\\d\\s.,]*)|([\\d][\\d\\s.,]*)\\s*(${CUR}))`, 'i'));
    if (cm) amount = num(cm[2] || cm[3]);
  }
  if (!amount) return null;
  // reference — \b-anchored keywords so "Transaction" can't leak "action"
  const ref = (s.match(/\b(?:ref(?:erence)?|txn|tx\s*id|trx(?:n?\s*id)?|tid|transaction|id|re[cç]u\s*n[°o])\b\s*[:.#]?\s*([A-Z0-9][A-Z0-9.\-]{3,})/i) || [])[1];
  if (!ref) return null;
  // currency (optional): ISO code, else a colloquial symbol/abbrev
  let currency = (s.match(new RegExp(`\\b(${CUR})\\b`, 'i')) || [])[1];
  if (!currency) currency = (s.match(/\b(Ksh|Ush|Tsh|Br|MT|Rs|Tk|Taka|Rp|RM|Nu|Php)\b/i) || [])[1];
  if (!currency && /R\$/.test(s)) currency = 'BRL';
  if (currency) currency = currency.toUpperCase()
    .replace(/^FC$/, 'CDF').replace(/^KSH$/, 'KES').replace(/^USH$/, 'UGX').replace(/^TSH$/, 'TZS')
    .replace(/^TK$|^TAKA$/, 'BDT').replace(/^RP$/, 'IDR').replace(/^RM$/, 'MYR').replace(/^NU$/, 'BTN');
  const name = (s.match(/(?:\bde\b|\bfrom\b|da parte de|\bpar\b|\bby\b)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9.'\- ]{1,40}?)(?=\s*(?:[.,(]|\bref|\btxn|\bid\b|solde|balance|saldo|\+?\d|$))/i) || [])[1];
  const suffix = (s.match(/(\d{4})(?!\d)/) || [])[1] || null;
  const balance = num((s.match(/(?:solde|balance|saldo)\s*[:.]?\s*([\d][\d\s.,]*)/i) || [])[1]);
  return {
    operator: 'generic', generic: true, ref: String(ref).replace(/[.\s]+$/, ''),
    amount, currency: currency || null, name: name ? name.trim() : null, suffix, balance,
  };
}

// parse a raw SMS; returns {operator, ref, amount, currency, name, suffix, balance} or null.
// A generic match carries generic:true (lower trust) — precise packs always win first.
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
  return genericParse(raw); // graceful degradation for operators without a pack yet
}

const OPERATORS = PACKS.map(p => ({ id: p.operator, label: p.label }));

module.exports = { parseSms, genericParse, OPERATORS, PACKS };
