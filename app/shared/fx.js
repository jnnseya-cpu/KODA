// KODA — FX helpers for the self-collection settlement rate, across KODA's 90+
// country footprint. TWO separate concerns:
//
//  1. COUNTRY_CURRENCY  — which currency a country collects in. STABLE reference
//     data (doesn't drift); used to AUTO-SELECT the currency from the collector's
//     country so you never pick it by hand.
//  2. DEFAULT_RATES     — indicative local-units-per-USD used only to PRE-FILL the
//     rate field. NOT a live feed; KODA is NOT an FX provider. The admin always
//     confirms/overrides with the mobile-money cash rate they actually receive at.
//     Currencies without a default simply start blank for manual entry.
//
// Isomorphic (browser + node), same UMD shape as plans.js / billing.js.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KODA_FX = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ISO-2 country → collection currency. Comprehensive for KODA's markets
  // (all of Africa + major mobile-money markets in Asia/LatAm). Stable data.
  const COUNTRY_CURRENCY = {
    // ── Africa: CFA zones ──
    SN: 'XOF', CI: 'XOF', ML: 'XOF', BF: 'XOF', BJ: 'XOF', TG: 'XOF', NE: 'XOF', GW: 'XOF',
    CM: 'XAF', CG: 'XAF', GA: 'XAF', TD: 'XAF', CF: 'XAF', GQ: 'XAF',
    // ── Africa: other ──
    CD: 'CDF', NG: 'NGN', GH: 'GHS', KE: 'KES', TZ: 'TZS', UG: 'UGX', RW: 'RWF',
    ZM: 'ZMW', MW: 'MWK', ZA: 'ZAR', ET: 'ETB', MZ: 'MZN', GN: 'GNF', SL: 'SLL',
    LR: 'LRD', GM: 'GMD', SD: 'SDG', SS: 'SSP', SO: 'SOS', DJ: 'DJF', ER: 'ERN',
    AO: 'AOA', BI: 'BIF', BW: 'BWP', LS: 'LSL', SZ: 'SZL', NA: 'NAD', MG: 'MGA',
    MU: 'MUR', SC: 'SCR', CV: 'CVE', KM: 'KMF', ZW: 'ZWL', MR: 'MRU', ST: 'STN',
    EG: 'EGP', MA: 'MAD', DZ: 'DZD', TN: 'TND', LY: 'LYD',
    // ── Asia / mobile-money markets ──
    BD: 'BDT', PK: 'PKR', IN: 'INR', PH: 'PHP', ID: 'IDR', LK: 'LKR', NP: 'NPR',
    MM: 'MMK', KH: 'KHR', VN: 'VND', AF: 'AFN',
    // ── LatAm / other ──
    BR: 'BRL', MX: 'MXN', CO: 'COP', PE: 'PEN', BO: 'BOB', GT: 'GTQ', HT: 'HTG',
    // ── Reference / settlement ──
    US: 'USD', GB: 'GBP', FR: 'EUR', BE: 'EUR', DE: 'EUR',
  };

  // Indicative local units per 1 USD — EDITABLE defaults, review periodically.
  // Only a starting point; the received mobile-money rate is authoritative.
  const DEFAULT_RATES = {
    USD: 1, EUR: 0.92, GBP: 0.79,
    // African CFA + francs
    CDF: 2800, XOF: 600, XAF: 600, GNF: 8600, KMF: 450, MGA: 4500, BIF: 2900,
    RWF: 1350, DJF: 178, MRU: 40,
    // African other
    NGN: 1600, GHS: 15, KES: 130, TZS: 2600, UGX: 3800, ZMW: 27, MWK: 1700,
    ZAR: 18, ETB: 125, MZN: 64, SLL: 22000, LRD: 190, GMD: 68, SDG: 600,
    SOS: 570, AOA: 900, BWP: 13.5, LSL: 18, SZL: 18, NAD: 18, MUR: 46, SCR: 14,
    CVE: 101, ZWL: 30, EGP: 48, MAD: 10, DZD: 135, TND: 3.1, LYD: 4.8, STN: 22,
    ERN: 15, SSP: 1300,
    // Asia
    BDT: 118, PKR: 278, INR: 84, PHP: 58, IDR: 15800, LKR: 300, NPR: 134,
    MMK: 2100, KHR: 4050, VND: 25400, AFN: 70,
    // LatAm
    BRL: 5.4, MXN: 18, COP: 4200, PEN: 3.8, BOB: 6.9, GTQ: 7.8, HTG: 132,
  };

  function defaultRate(currency) {
    const c = String(currency || '').toUpperCase();
    return Object.prototype.hasOwnProperty.call(DEFAULT_RATES, c) ? DEFAULT_RATES[c] : null;
  }
  function currencyForCountry(cc) {
    return COUNTRY_CURRENCY[String(cc || '').toUpperCase()] || null;
  }

  return { DEFAULT_RATES, COUNTRY_CURRENCY, defaultRate, currencyForCountry };
});
