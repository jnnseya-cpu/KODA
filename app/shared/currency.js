// KODA — currency units. One answer to "is 589 five dollars or five hundred?"
'use strict';

// API amounts are MINOR units end to end (Unified Spec: "no float crosses this
// boundary"). Operator SMS, by contrast, write amounts the way a human reads them —
// "5.89 USD", "25000 FC". These two conventions coincide exactly when a currency has
// no minor subdivision in mobile-money practice (CDF, XOF, UGX…, factor 1), which is
// why a 100× mismatch on USD hid behind months of correct CDF traffic: a
// TicketRoyality order for 589 minor ($5.89) rendered as "589 USD" at checkout, and
// verification would have compared the SMS's 5.89 against the intent's 589 and
// rejected every honest USD payment as amount_mismatch.
//
// Every display and every comparison must cross through these functions.
//
// The world's default is 2 decimals (ISO 4217), so we DEFAULT to 2 and name only the
// exceptions. Treating an unknown currency as 2-decimal is the safe failure: it can
// never silently re-introduce the 100× bug the way an allowlist would for the many
// 2-decimal rails KODA expands into (EGP, MAD, TZS, MZN, ZMW, BDT, PKR, INR, LKR, …).

// Zero-decimal in mobile-money practice — the amount IS the whole number. Includes
// the African-franc rails (where CDF's nominal ISO centimes are never used) and the
// true zero-decimal ISO currencies.
const ZERO_DECIMAL = new Set([
  'CDF', 'FC', 'XAF', 'XOF', 'XPF', 'GNF', 'RWF', 'BIF', 'KMF', 'DJF', 'UGX',
  'JPY', 'KRW', 'VND', 'CLP', 'PYG', 'ISK', 'VUV'
]);
// Three-decimal ISO currencies.
const THREE_DECIMAL = new Set(['BHD', 'KWD', 'OMR', 'TND', 'JOD', 'IQD', 'LYD']);

function decimals(currency) {
  const c = String(currency || '').toUpperCase();
  if (ZERO_DECIMAL.has(c)) return 0;
  if (THREE_DECIMAL.has(c)) return 3;
  return 2; // ISO default
}

function factor(currency) {
  return 10 ** decimals(currency);
}

/** An amount as a human/operator SMS writes it → API minor units. */
function toMinor(displayAmount, currency) {
  return Math.round(Number(displayAmount || 0) * factor(currency));
}

/** API minor units → the number a human should see. */
function toDisplay(minorAmount, currency) {
  return Number(minorAmount || 0) / factor(currency);
}

module.exports = { decimals, factor, toMinor, toDisplay, ZERO_DECIMAL, THREE_DECIMAL };
