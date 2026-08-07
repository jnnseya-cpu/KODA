/**
 * KODA — WooCommerce Blocks checkout registration (no build step: uses the wp/wc
 * globals and wp.element.createElement, so it ships as plain JS). Selecting KODA in
 * the Blocks checkout routes through the same server-side process_payment() that the
 * classic checkout uses — the customer is redirected to the KODA checkout to confirm
 * their mobile-money payment, and a signed webhook completes the order.
 */
(function () {
  'use strict';
  if (!window.wc || !window.wc.wcBlocksRegistry || !window.wp) return;
  var registerPaymentMethod = window.wc.wcBlocksRegistry.registerPaymentMethod;
  var getSetting = (window.wc.wcSettings && window.wc.wcSettings.getSetting) || function (k, d) { return d; };
  var el = window.wp.element.createElement;
  var decode = (window.wp.htmlEntities && window.wp.htmlEntities.decodeEntities) || function (s) { return s; };
  var __ = (window.wp.i18n && window.wp.i18n.__) || function (s) { return s; };

  var data = getSetting('koda_data', {});
  var title = decode(data.title || 'Mobile Money — verified by KODA');

  var Content = function () {
    return el('div', { className: 'koda-blocks-desc' },
      decode(data.description || __('Pay by mobile money. KODA verifies your operator confirmation automatically.', 'koda-payments')));
  };

  registerPaymentMethod({
    name: 'koda',
    label: el('span', null, title),
    content: el(Content, null),
    edit: el(Content, null),
    ariaLabel: title,
    canMakePayment: function () { return true; },
    supports: { features: (data.supports || ['products']) },
  });
})();
