// KODA — operator registry (the addressable mobile-money landscape).
// This is METADATA for recognition, routing and coverage reporting — country,
// currency, region, sender-id hints. It is NOT a parser: precise field
// extraction still needs a per-operator pack in parser.js built from a REAL
// sample SMS (`packed: true` marks operators that already have one). Everything
// else is handled by the generic fallback parser at reduced trust until a pack
// is added. UMD: Node require + browser global.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KODA_OPERATORS = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // region: CENTRAL | WEST | EAST | SOUTHERN | NORTH
  // senders: brand tokens seen in the SMS sender field (uppercased match, tune from real traffic)
  const OPS = [
    // ── Central Africa ────────────────────────────────────────────────────
    { id: 'orange_cd', name: 'Orange Money', country: 'CD', region: 'CENTRAL', currency: 'CDF', senders: ['ORANGEMONEY', 'ORANGE'], packed: true },
    { id: 'mpesa_cd', name: 'M-Pesa (Vodacom)', country: 'CD', region: 'CENTRAL', currency: 'CDF', senders: ['M-PESA', 'MPESA', 'VODACOM'], packed: true },
    { id: 'airtel_cd', name: 'Airtel Money', country: 'CD', region: 'CENTRAL', currency: 'CDF', senders: ['AIRTELMONEY', 'AIRTEL'], packed: true },
    { id: 'africell_cd', name: 'Afrimoney (Africell)', country: 'CD', region: 'CENTRAL', currency: 'CDF', senders: ['AFRICELL', 'AFRIMONEY'], packed: true },
    { id: 'illicocash_cd', name: 'Illicocash', country: 'CD', region: 'CENTRAL', currency: 'CDF', senders: ['ILLICOCASH', 'ILLICO'] },
    { id: 'orange_cm', name: 'Orange Money', country: 'CM', region: 'CENTRAL', currency: 'XAF', senders: ['ORANGEMONEY', 'ORANGE'] },
    { id: 'mtn_cm', name: 'MTN MoMo', country: 'CM', region: 'CENTRAL', currency: 'XAF', senders: ['MTNMOMO', 'MTN', 'MOBILEMONEY'] },
    { id: 'airtel_cg', name: 'Airtel Money', country: 'CG', region: 'CENTRAL', currency: 'XAF', senders: ['AIRTELMONEY', 'AIRTEL'] },
    { id: 'mtn_cg', name: 'MTN MoMo', country: 'CG', region: 'CENTRAL', currency: 'XAF', senders: ['MTNMOMO', 'MTN'] },
    { id: 'moov_ga', name: 'Moov Money', country: 'GA', region: 'CENTRAL', currency: 'XAF', senders: ['MOOV', 'MOOVMONEY'] },
    { id: 'airtel_ga', name: 'Airtel Money', country: 'GA', region: 'CENTRAL', currency: 'XAF', senders: ['AIRTELMONEY', 'AIRTEL'] },
    { id: 'airtel_td', name: 'Airtel Money', country: 'TD', region: 'CENTRAL', currency: 'XAF', senders: ['AIRTELMONEY', 'AIRTEL'] },
    { id: 'moov_td', name: 'Moov Money', country: 'TD', region: 'CENTRAL', currency: 'XAF', senders: ['MOOV'] },
    { id: 'orange_cf', name: 'Orange Money', country: 'CF', region: 'CENTRAL', currency: 'XAF', senders: ['ORANGE'] },

    // ── West Africa (WAEMU = XOF, plus GHS/NGN/GNF/SLE/LRD/GMD) ────────────
    { id: 'wave', name: 'Wave', country: 'SN', region: 'WEST', currency: 'XOF', senders: ['WAVE'], packed: true },
    { id: 'orange_sn', name: 'Orange Money', country: 'SN', region: 'WEST', currency: 'XOF', senders: ['ORANGEMONEY', 'ORANGE'] },
    { id: 'free_sn', name: 'Free Money', country: 'SN', region: 'WEST', currency: 'XOF', senders: ['FREEMONEY', 'FREE'] },
    { id: 'wizall_sn', name: 'Wizall Money', country: 'SN', region: 'WEST', currency: 'XOF', senders: ['WIZALL'] },
    { id: 'orange_ci', name: 'Orange Money', country: 'CI', region: 'WEST', currency: 'XOF', senders: ['ORANGEMONEY', 'ORANGE'] },
    { id: 'mtn_ci', name: 'MTN MoMo', country: 'CI', region: 'WEST', currency: 'XOF', senders: ['MTNMOMO', 'MTN'] },
    { id: 'moov_ci', name: 'Moov Money', country: 'CI', region: 'WEST', currency: 'XOF', senders: ['MOOV'] },
    { id: 'wave_ci', name: 'Wave', country: 'CI', region: 'WEST', currency: 'XOF', senders: ['WAVE'] },
    { id: 'orange_ml', name: 'Orange Money', country: 'ML', region: 'WEST', currency: 'XOF', senders: ['ORANGE'] },
    { id: 'moov_ml', name: 'Moov Money', country: 'ML', region: 'WEST', currency: 'XOF', senders: ['MOOV'] },
    { id: 'orange_bf', name: 'Orange Money', country: 'BF', region: 'WEST', currency: 'XOF', senders: ['ORANGE'] },
    { id: 'moov_bf', name: 'Moov Money', country: 'BF', region: 'WEST', currency: 'XOF', senders: ['MOOV'] },
    { id: 'coris_bf', name: 'Coris Money', country: 'BF', region: 'WEST', currency: 'XOF', senders: ['CORIS'] },
    { id: 'mtn_bj', name: 'MTN MoMo', country: 'BJ', region: 'WEST', currency: 'XOF', senders: ['MTNMOMO', 'MTN'] },
    { id: 'moov_bj', name: 'Moov Money', country: 'BJ', region: 'WEST', currency: 'XOF', senders: ['MOOV', 'CELTIIS'] },
    { id: 'tmoney_tg', name: 'T-Money', country: 'TG', region: 'WEST', currency: 'XOF', senders: ['TMONEY', 'TOGOCOM'] },
    { id: 'flooz_tg', name: 'Flooz (Moov)', country: 'TG', region: 'WEST', currency: 'XOF', senders: ['FLOOZ', 'MOOV'] },
    { id: 'airtel_ne', name: 'Airtel Money', country: 'NE', region: 'WEST', currency: 'XOF', senders: ['AIRTEL'] },
    { id: 'moov_ne', name: 'Moov Money', country: 'NE', region: 'WEST', currency: 'XOF', senders: ['MOOV'] },
    { id: 'orange_gw', name: 'Orange Money', country: 'GW', region: 'WEST', currency: 'XOF', senders: ['ORANGE'] },
    { id: 'mtn_gh', name: 'MTN MoMo', country: 'GH', region: 'WEST', currency: 'GHS', senders: ['MTNMOMO', 'MTN', 'MOBILEMONEY'], packed: true },
    { id: 'telecel_gh', name: 'Telecel Cash', country: 'GH', region: 'WEST', currency: 'GHS', senders: ['TELECEL', 'VODAFONE'] },
    { id: 'atmoney_gh', name: 'AT Money', country: 'GH', region: 'WEST', currency: 'GHS', senders: ['ATMONEY', 'AIRTELTIGO'] },
    { id: 'opay_ng', name: 'OPay', country: 'NG', region: 'WEST', currency: 'NGN', senders: ['OPAY'] },
    { id: 'palmpay_ng', name: 'PalmPay', country: 'NG', region: 'WEST', currency: 'NGN', senders: ['PALMPAY'] },
    { id: 'momopsb_ng', name: 'MoMo PSB', country: 'NG', region: 'WEST', currency: 'NGN', senders: ['MOMO', 'MTN'] },
    { id: 'moniepoint_ng', name: 'Moniepoint', country: 'NG', region: 'WEST', currency: 'NGN', senders: ['MONIEPOINT'] },
    { id: 'orange_gn', name: 'Orange Money', country: 'GN', region: 'WEST', currency: 'GNF', senders: ['ORANGE'] },
    { id: 'mtn_gn', name: 'MTN MoMo', country: 'GN', region: 'WEST', currency: 'GNF', senders: ['MTN'] },
    { id: 'orange_sl', name: 'Orange Money', country: 'SL', region: 'WEST', currency: 'SLE', senders: ['ORANGE'] },
    { id: 'afrimoney_sl', name: 'Afrimoney', country: 'SL', region: 'WEST', currency: 'SLE', senders: ['AFRIMONEY', 'AFRICELL'] },
    { id: 'mtn_lr', name: 'MTN MoMo', country: 'LR', region: 'WEST', currency: 'LRD', senders: ['MTN'] },
    { id: 'orange_lr', name: 'Orange Money', country: 'LR', region: 'WEST', currency: 'LRD', senders: ['ORANGE'] },
    { id: 'qmoney_gm', name: 'QMoney', country: 'GM', region: 'WEST', currency: 'GMD', senders: ['QMONEY'] },
    { id: 'wave_gm', name: 'Wave', country: 'GM', region: 'WEST', currency: 'GMD', senders: ['WAVE'] },

    // ── East Africa ───────────────────────────────────────────────────────
    { id: 'mpesa_ke', name: 'M-Pesa', country: 'KE', region: 'EAST', currency: 'KES', senders: ['MPESA', 'M-PESA', 'SAFARICOM'] },
    { id: 'airtel_ke', name: 'Airtel Money', country: 'KE', region: 'EAST', currency: 'KES', senders: ['AIRTELMONEY', 'AIRTEL'] },
    { id: 'tkash_ke', name: 'T-Kash', country: 'KE', region: 'EAST', currency: 'KES', senders: ['TKASH', 'TELKOM'] },
    { id: 'mpesa_tz', name: 'M-Pesa', country: 'TZ', region: 'EAST', currency: 'TZS', senders: ['MPESA', 'M-PESA', 'VODACOM'] },
    { id: 'airtel_tz', name: 'Airtel Money', country: 'TZ', region: 'EAST', currency: 'TZS', senders: ['AIRTELMONEY', 'AIRTEL'] },
    { id: 'mixx_tz', name: 'Mixx by Yas (Tigo)', country: 'TZ', region: 'EAST', currency: 'TZS', senders: ['MIXX', 'YAS', 'TIGOPESA'] },
    { id: 'halopesa_tz', name: 'HaloPesa', country: 'TZ', region: 'EAST', currency: 'TZS', senders: ['HALOPESA', 'HALOTEL'] },
    { id: 'azampesa_tz', name: 'AzamPesa', country: 'TZ', region: 'EAST', currency: 'TZS', senders: ['AZAMPESA', 'AZAM'] },
    { id: 'mtn_ug', name: 'MTN MoMo', country: 'UG', region: 'EAST', currency: 'UGX', senders: ['MTNMOMO', 'MTN'] },
    { id: 'airtel_ug', name: 'Airtel Money', country: 'UG', region: 'EAST', currency: 'UGX', senders: ['AIRTELMONEY', 'AIRTEL'] },
    { id: 'wave_ug', name: 'Wave', country: 'UG', region: 'EAST', currency: 'UGX', senders: ['WAVE'] },
    { id: 'mtn_rw', name: 'MTN MoMo', country: 'RW', region: 'EAST', currency: 'RWF', senders: ['MTNMOMO', 'MTN'] },
    { id: 'airtel_rw', name: 'Airtel Money', country: 'RW', region: 'EAST', currency: 'RWF', senders: ['AIRTELMONEY', 'AIRTEL'] },
    { id: 'telebirr_et', name: 'Telebirr', country: 'ET', region: 'EAST', currency: 'ETB', senders: ['TELEBIRR', 'ETHIOTELECOM'] },
    { id: 'mpesa_et', name: 'M-Pesa', country: 'ET', region: 'EAST', currency: 'ETB', senders: ['MPESA', 'SAFARICOM'] },
    { id: 'cbebirr_et', name: 'CBE Birr', country: 'ET', region: 'EAST', currency: 'ETB', senders: ['CBEBIRR', 'CBE'] },

    // ── Southern Africa ───────────────────────────────────────────────────
    { id: 'mpesa_mz', name: 'M-Pesa', country: 'MZ', region: 'SOUTHERN', currency: 'MZN', senders: ['MPESA', 'M-PESA', 'VODACOM'] },
    { id: 'emola_mz', name: 'e-Mola', country: 'MZ', region: 'SOUTHERN', currency: 'MZN', senders: ['EMOLA', 'MOVITEL'] },
    { id: 'mkesh_mz', name: 'mKesh', country: 'MZ', region: 'SOUTHERN', currency: 'MZN', senders: ['MKESH', 'TMCEL'] },
    { id: 'ecocash_zw', name: 'EcoCash', country: 'ZW', region: 'SOUTHERN', currency: 'ZWL', senders: ['ECOCASH', 'ECONET'] },
    { id: 'onemoney_zw', name: 'OneMoney', country: 'ZW', region: 'SOUTHERN', currency: 'ZWL', senders: ['ONEMONEY', 'NETONE'] },
    { id: 'airtel_zm', name: 'Airtel Money', country: 'ZM', region: 'SOUTHERN', currency: 'ZMW', senders: ['AIRTELMONEY', 'AIRTEL'] },
    { id: 'mtn_zm', name: 'MTN MoMo', country: 'ZM', region: 'SOUTHERN', currency: 'ZMW', senders: ['MTNMOMO', 'MTN'] },
    { id: 'zamtel_zm', name: 'Zamtel Kwacha', country: 'ZM', region: 'SOUTHERN', currency: 'ZMW', senders: ['ZAMTEL', 'KWACHA'] },
    { id: 'airtel_mw', name: 'Airtel Money', country: 'MW', region: 'SOUTHERN', currency: 'MWK', senders: ['AIRTELMONEY', 'AIRTEL'] },
    { id: 'mpamba_mw', name: 'TNM Mpamba', country: 'MW', region: 'SOUTHERN', currency: 'MWK', senders: ['MPAMBA', 'TNM'] },
    { id: 'mvola_mg', name: 'MVola', country: 'MG', region: 'SOUTHERN', currency: 'MGA', senders: ['MVOLA', 'TELMA'] },
    { id: 'orange_mg', name: 'Orange Money', country: 'MG', region: 'SOUTHERN', currency: 'MGA', senders: ['ORANGE'] },
    { id: 'airtel_mg', name: 'Airtel Money', country: 'MG', region: 'SOUTHERN', currency: 'MGA', senders: ['AIRTEL'] },
    { id: 'momo_za', name: 'MTN MoMo', country: 'ZA', region: 'SOUTHERN', currency: 'ZAR', senders: ['MTNMOMO', 'MTN'] },
    { id: 'orange_bw', name: 'Orange Money', country: 'BW', region: 'SOUTHERN', currency: 'BWP', senders: ['ORANGE'] },
    { id: 'myzaka_bw', name: 'Mascom MyZaka', country: 'BW', region: 'SOUTHERN', currency: 'BWP', senders: ['MYZAKA', 'MASCOM'] },
    { id: 'mpesa_ls', name: 'M-Pesa', country: 'LS', region: 'SOUTHERN', currency: 'LSL', senders: ['MPESA', 'VODACOM'] },
    { id: 'ecocash_ls', name: 'EcoCash', country: 'LS', region: 'SOUTHERN', currency: 'LSL', senders: ['ECOCASH'] },
    { id: 'momo_sz', name: 'MTN MoMo', country: 'SZ', region: 'SOUTHERN', currency: 'SZL', senders: ['MTNMOMO', 'MTN'] },
    { id: 'unitel_ao', name: 'Unitel Money', country: 'AO', region: 'SOUTHERN', currency: 'AOA', senders: ['UNITEL'] },

    // ── North Africa ──────────────────────────────────────────────────────
    { id: 'vodafone_cash_eg', name: 'Vodafone Cash', country: 'EG', region: 'NORTH', currency: 'EGP', senders: ['VODAFONE', 'VODAFONECASH'] },
    { id: 'orange_cash_eg', name: 'Orange Cash', country: 'EG', region: 'NORTH', currency: 'EGP', senders: ['ORANGE'] },
    { id: 'etisalat_cash_eg', name: 'e& Cash (Etisalat)', country: 'EG', region: 'NORTH', currency: 'EGP', senders: ['ETISALAT', 'E&'] },
    { id: 'instapay_eg', name: 'InstaPay', country: 'EG', region: 'NORTH', currency: 'EGP', senders: ['INSTAPAY'] },
    { id: 'inwi_ma', name: 'inwi money', country: 'MA', region: 'NORTH', currency: 'MAD', senders: ['INWI'] },
    { id: 'orange_ma', name: 'Orange Money', country: 'MA', region: 'NORTH', currency: 'MAD', senders: ['ORANGE'] },
    { id: 'mtcash_ma', name: 'MT Cash', country: 'MA', region: 'NORTH', currency: 'MAD', senders: ['MTCASH', 'MAROCTELECOM'] },
    { id: 'd17_tn', name: 'D17', country: 'TN', region: 'NORTH', currency: 'TND', senders: ['D17', 'LAPOSTE'] },
    { id: 'orange_tn', name: 'Orange Money', country: 'TN', region: 'NORTH', currency: 'TND', senders: ['ORANGE'] },

    // ── South Asia (SMS-based mobile financial services; India is UPI/bank-SMS) ─
    { id: 'bkash_bd', name: 'bKash', country: 'BD', region: 'SOUTH_ASIA', currency: 'BDT', senders: ['BKASH'] },
    { id: 'nagad_bd', name: 'Nagad', country: 'BD', region: 'SOUTH_ASIA', currency: 'BDT', senders: ['NAGAD'] },
    { id: 'rocket_bd', name: 'Rocket', country: 'BD', region: 'SOUTH_ASIA', currency: 'BDT', senders: ['ROCKET', 'DBBL'] },
    { id: 'upay_bd', name: 'Upay', country: 'BD', region: 'SOUTH_ASIA', currency: 'BDT', senders: ['UPAY'] },
    { id: 'easypaisa_pk', name: 'Easypaisa', country: 'PK', region: 'SOUTH_ASIA', currency: 'PKR', senders: ['EASYPAISA'] },
    { id: 'jazzcash_pk', name: 'JazzCash', country: 'PK', region: 'SOUTH_ASIA', currency: 'PKR', senders: ['JAZZCASH', 'JAZZ'] },
    { id: 'upaisa_pk', name: 'UPaisa', country: 'PK', region: 'SOUTH_ASIA', currency: 'PKR', senders: ['UPAISA', 'UFONE'] },
    { id: 'esewa_np', name: 'eSewa', country: 'NP', region: 'SOUTH_ASIA', currency: 'NPR', senders: ['ESEWA'] },
    { id: 'khalti_np', name: 'Khalti', country: 'NP', region: 'SOUTH_ASIA', currency: 'NPR', senders: ['KHALTI'] },
    { id: 'imepay_np', name: 'IME Pay', country: 'NP', region: 'SOUTH_ASIA', currency: 'NPR', senders: ['IMEPAY', 'IME'] },
    { id: 'ezcash_lk', name: 'Dialog eZ Cash', country: 'LK', region: 'SOUTH_ASIA', currency: 'LKR', senders: ['EZCASH', 'DIALOG'] },
    { id: 'mcash_lk', name: 'Mobitel mCash', country: 'LK', region: 'SOUTH_ASIA', currency: 'LKR', senders: ['MCASH', 'MOBITEL'] },
    { id: 'upi_in', name: 'UPI (bank credit SMS)', country: 'IN', region: 'SOUTH_ASIA', currency: 'INR', senders: ['UPI', 'PHONEPE', 'PAYTM', 'GPAY'] },
    { id: 'mbob_bt', name: 'mBoB', country: 'BT', region: 'SOUTH_ASIA', currency: 'BTN', senders: ['MBOB', 'BOB'] },
    { id: 'tpay_bt', name: 'TPay', country: 'BT', region: 'SOUTH_ASIA', currency: 'BTN', senders: ['TPAY', 'TASHICELL'] },
    { id: 'dhiraagupay_mv', name: 'DhiraaguPay', country: 'MV', region: 'SOUTH_ASIA', currency: 'MVR', senders: ['DHIRAAGU'] },
    { id: 'mfaisaa_mv', name: 'Ooredoo m-Faisaa', country: 'MV', region: 'SOUTH_ASIA', currency: 'MVR', senders: ['MFAISAA', 'OOREDOO'] },
    { id: 'bml_mv', name: 'BML MobilePay', country: 'MV', region: 'SOUTH_ASIA', currency: 'MVR', senders: ['BML'] },
    { id: 'mpaisa_af', name: 'M-Paisa', country: 'AF', region: 'SOUTH_ASIA', currency: 'AFN', senders: ['MPAISA', 'ROSHAN'] },
    { id: 'hesabpay_af', name: 'HesabPay', country: 'AF', region: 'SOUTH_ASIA', currency: 'AFN', senders: ['HESABPAY', 'HESAB'] },

    // ── Southeast Asia (wallets; national QR/rails like QRIS/PayNow are separate) ─
    { id: 'gcash_ph', name: 'GCash', country: 'PH', region: 'SEA', currency: 'PHP', senders: ['GCASH'] },
    { id: 'maya_ph', name: 'Maya', country: 'PH', region: 'SEA', currency: 'PHP', senders: ['MAYA', 'PAYMAYA'] },
    { id: 'coinsph_ph', name: 'Coins.ph', country: 'PH', region: 'SEA', currency: 'PHP', senders: ['COINS'] },
    { id: 'grabpay_ph', name: 'GrabPay', country: 'PH', region: 'SEA', currency: 'PHP', senders: ['GRABPAY', 'GRAB'] },
    { id: 'gopay_id', name: 'GoPay', country: 'ID', region: 'SEA', currency: 'IDR', senders: ['GOPAY', 'GOJEK'] },
    { id: 'ovo_id', name: 'OVO', country: 'ID', region: 'SEA', currency: 'IDR', senders: ['OVO'] },
    { id: 'dana_id', name: 'DANA', country: 'ID', region: 'SEA', currency: 'IDR', senders: ['DANA'] },
    { id: 'linkaja_id', name: 'LinkAja', country: 'ID', region: 'SEA', currency: 'IDR', senders: ['LINKAJA'] },
    { id: 'shopeepay_id', name: 'ShopeePay', country: 'ID', region: 'SEA', currency: 'IDR', senders: ['SHOPEEPAY', 'SHOPEE'] },
    { id: 'tng_my', name: "Touch 'n Go eWallet", country: 'MY', region: 'SEA', currency: 'MYR', senders: ['TNG', 'TOUCHNGO'] },
    { id: 'boost_my', name: 'Boost', country: 'MY', region: 'SEA', currency: 'MYR', senders: ['BOOST'] },
    { id: 'grabpay_my', name: 'GrabPay', country: 'MY', region: 'SEA', currency: 'MYR', senders: ['GRABPAY', 'GRAB'] },
    { id: 'bigpay_my', name: 'BigPay', country: 'MY', region: 'SEA', currency: 'MYR', senders: ['BIGPAY'] },
    { id: 'grabpay_sg', name: 'GrabPay', country: 'SG', region: 'SEA', currency: 'SGD', senders: ['GRABPAY', 'GRAB'] },
    { id: 'paylah_sg', name: 'DBS PayLah!', country: 'SG', region: 'SEA', currency: 'SGD', senders: ['PAYLAH', 'DBS'] },
    { id: 'dash_sg', name: 'Singtel Dash', country: 'SG', region: 'SEA', currency: 'SGD', senders: ['DASH', 'SINGTEL'] },
  ];

  const byId = Object.fromEntries(OPS.map(o => [o.id, o]));

  // attribute a raw sender string to an operator (best-effort, substring on upper)
  function findBySender(sender, countryHint) {
    const s = (sender || '').toUpperCase();
    if (!s) return null;
    const pool = countryHint ? OPS.filter(o => o.country === countryHint).concat(OPS) : OPS;
    for (const o of pool) if (o.senders.some(k => s.includes(k))) return o;
    return null;
  }

  function coverage() {
    const byRegion = {}, byCountry = {};
    for (const o of OPS) {
      byRegion[o.region] = (byRegion[o.region] || 0) + 1;
      byCountry[o.country] = (byCountry[o.country] || 0) + 1;
    }
    return {
      total: OPS.length,
      packed: OPS.filter(o => o.packed).length,       // precise parser exists
      generic: OPS.filter(o => !o.packed).length,     // handled by fallback until a pack is added
      countries: Object.keys(byCountry).length,
      byRegion,
    };
  }

  return { OPERATORS: OPS, byId, findBySender, coverage };
});
