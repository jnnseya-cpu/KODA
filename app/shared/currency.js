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
// Every display and every comparison must cross through these two functions.
const DECIMALS = { USD: 2, EUR: 2, GBP: 2, GHS: 2, KES: 2, ZAR: 2, NGN: 2 };

function decimals(currency) {
  const d = DECIMALS[String(currency || '').toUpperCase()];
  return d == null ? 0 : d;
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

module.exports = { decimals, factor, toMinor, toDisplay };
