/* KODA drop-in checkout widget — zero dependencies.
 *
 * Load it from your KODA instance:
 *   <script src="https://pay.koda.africa/js/koda.js"></script>
 *
 * Two ways to use it, both end with an automatic hand-off once the customer's
 * mobile-money code is verified:
 *
 * 1) Server-created intent (recommended). Your backend calls POST /v1/intents
 *    with your SECRET key and gets back { checkout_url }. Pass it to the widget:
 *
 *      Koda.checkout({
 *        checkoutUrl: '<checkout_url from your server>',
 *        onVerified: function (r) {  // { intent_id, receipt_id, amount, status }
 *          // money confirmed — advance the order, unlock the download, etc.
 *          window.location = '/order/success';
 *        }
 *      });
 *
 * 2) Publishable key (quick front-end only). The widget creates the intent for
 *    you using a pk_ key, which can ONLY create intents (never read your data):
 *
 *      Koda.pay({
 *        key: 'pk_live_xxx',
 *        amount: 25000, currency: 'CDF',
 *        operators: ['orange_cd', 'mpesa_cd'],
 *        orderId: 'CMD-1042',
 *        metadata: { order_id: 'CMD-1042' },
 *        successUrl: 'https://shop.example.com/order/success',
 *        onVerified: function (r) { window.location = '/order/success'; }
 *      });
 *
 * The customer sees a KODA overlay: pick operator → pay → paste the SMS code →
 * KODA verifies it → onVerified fires (and, if successUrl was set, the top
 * window is redirected there automatically).
 */
(function (global) {
  'use strict';

  // Derive the KODA origin from THIS script's own src, so the widget always
  // talks to the instance that served it (falls back to same origin).
  function selfOrigin() {
    try {
      var cur = document.currentScript;
      if (!cur) {
        var ss = document.getElementsByTagName('script');
        for (var i = ss.length - 1; i >= 0; i--) {
          if (ss[i].src && /\/js\/koda\.js(\?|$)/.test(ss[i].src)) { cur = ss[i]; break; }
        }
      }
      if (cur && cur.src) return new URL(cur.src).origin;
    } catch (e) {}
    return location.origin;
  }
  var ORIGIN = selfOrigin();

  function req(method, path, body, headers) {
    return fetch(ORIGIN + path, {
      method: method,
      headers: Object.assign({ 'content-type': 'application/json' }, headers || {}),
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (r) { return r.json().then(function (d) { return { status: r.status, data: d }; }); });
  }

  // ---- overlay + iframe ----
  var STYLE_ID = 'koda-widget-style';
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent =
      '.koda-ov{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;' +
      'justify-content:center;background:rgba(8,24,19,.62);backdrop-filter:blur(3px);' +
      'opacity:0;transition:opacity .18s ease}' +
      '.koda-ov.on{opacity:1}' +
      '.koda-fr{position:relative;width:100%;max-width:440px;height:100%;max-height:680px;' +
      'background:#F5EFDF;border-radius:18px;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.45);' +
      'transform:translateY(12px);transition:transform .18s ease}' +
      '.koda-ov.on .koda-fr{transform:none}' +
      '.koda-fr iframe{width:100%;height:100%;border:0;display:block}' +
      '.koda-x{position:absolute;top:10px;right:12px;z-index:2;width:32px;height:32px;border:0;' +
      'border-radius:50%;background:rgba(8,24,19,.08);color:#081813;font-size:18px;line-height:1;' +
      'cursor:pointer}' +
      '.koda-x:hover{background:rgba(8,24,19,.16)}' +
      '@media(max-width:480px){.koda-fr{max-width:100%;max-height:100%;border-radius:0}}';
    document.head.appendChild(s);
  }

  function openOverlay(url, cbs) {
    ensureStyle();
    var ov = document.createElement('div');
    ov.className = 'koda-ov';
    var fr = document.createElement('div');
    fr.className = 'koda-fr';
    var x = document.createElement('button');
    x.className = 'koda-x'; x.type = 'button'; x.setAttribute('aria-label', 'Fermer'); x.innerHTML = '&times;';
    var iframe = document.createElement('iframe');
    iframe.setAttribute('allow', 'clipboard-write');
    iframe.src = url;
    fr.appendChild(x); fr.appendChild(iframe); ov.appendChild(fr);
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add('on'); });

    var done = false;
    function close(reason) {
      if (done) return; done = true;
      window.removeEventListener('message', onMsg);
      ov.classList.remove('on');
      setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 200);
      if (reason === 'user' && typeof cbs.onClose === 'function') { try { cbs.onClose(); } catch (e) {} }
    }

    function onMsg(ev) {
      // Only trust messages from the KODA-served checkout iframe.
      if (ev.origin !== ORIGIN) return;
      var d = ev.data;
      if (!d || d.source !== 'koda') return;
      if (d.type === 'verified') {
        if (typeof cbs.onVerified === 'function') { try { cbs.onVerified(d); } catch (e) {} }
        if (d.redirect && cbs.redirect !== false) {
          // Same origin as the merchant page → allowed to move the top window forward.
          setTimeout(function () { try { window.location.href = d.redirect; } catch (e) {} }, 1200);
        } else {
          // No redirect: close the overlay so the merchant's onVerified can take over.
          setTimeout(function () { close('verified'); }, 1400);
        }
      } else if (d.type === 'failed') {
        if (typeof cbs.onFailed === 'function') { try { cbs.onFailed(d); } catch (e) {} }
      } else if (d.type === 'close') {
        close('user');
      }
    }
    window.addEventListener('message', onMsg);
    x.addEventListener('click', function () { close('user'); });
    ov.addEventListener('click', function (e) { if (e.target === ov) close('user'); });

    return { close: function () { close('user'); } };
  }

  // ---- public API ----
  var Koda = {
    /** Open an already-created checkout URL (server-created intent). */
    checkout: function (opts) {
      opts = opts || {};
      if (!opts.checkoutUrl) throw new Error('Koda.checkout: checkoutUrl is required');
      return openOverlay(opts.checkoutUrl, opts);
    },

    /** Create an intent from the browser with a publishable key, then open it. */
    pay: function (opts) {
      opts = opts || {};
      if (!opts.key) throw new Error('Koda.pay: key (publishable pk_ key) is required');
      if (!(Number(opts.amount) > 0)) throw new Error('Koda.pay: amount must be a positive number');
      var handle = { close: function () {} };
      var pending = openLoading(opts);
      req('POST', '/v1/intents', {
        amount: Number(opts.amount),
        currency: opts.currency,
        operators: opts.operators,
        metadata: Object.assign({}, opts.metadata, opts.orderId ? { order_id: opts.orderId } : null),
        customer_msisdn: opts.customerMsisdn || undefined,
        success_url: opts.successUrl || undefined,
        cancel_url: opts.cancelUrl || undefined,
        expires_in: opts.expiresIn || undefined,
      }, { authorization: 'Bearer ' + opts.key }).then(function (r) {
        pending.close();
        if (r.status !== 200 || !r.data.checkout_url) {
          var msg = (r.data && r.data.error && (r.data.error.message || r.data.error.code)) || 'intent_failed';
          if (typeof opts.onError === 'function') opts.onError(new Error(msg));
          else console.error('KODA:', msg);
          return;
        }
        handle = openOverlay(r.data.checkout_url, opts);
      }).catch(function (e) {
        pending.close();
        if (typeof opts.onError === 'function') opts.onError(e); else console.error('KODA:', e);
      });
      return { close: function () { pending.close(); handle.close(); } };
    },

    /** Attach the widget to any element with data-koda-* attributes (no JS needed). */
    autoAttach: function () {
      var nodes = document.querySelectorAll('[data-koda-key],[data-koda-checkout-url]');
      Array.prototype.forEach.call(nodes, function (el) {
        if (el._kodaBound) return; el._kodaBound = true;
        el.addEventListener('click', function (ev) {
          ev.preventDefault();
          var url = el.getAttribute('data-koda-checkout-url');
          if (url) return Koda.checkout({ checkoutUrl: url });
          Koda.pay({
            key: el.getAttribute('data-koda-key'),
            amount: Number(el.getAttribute('data-koda-amount')),
            currency: el.getAttribute('data-koda-currency') || undefined,
            operators: (el.getAttribute('data-koda-operators') || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean),
            orderId: el.getAttribute('data-koda-order') || undefined,
            successUrl: el.getAttribute('data-koda-success-url') || undefined,
          });
        });
      });
    },

    origin: ORIGIN,
    version: '1.0.0',
  };

  // brief loading overlay while the intent is created
  function openLoading() {
    ensureStyle();
    var ov = document.createElement('div');
    ov.className = 'koda-ov on';
    ov.innerHTML = '<div style="color:#F5EFDF;font:600 15px system-ui,sans-serif;letter-spacing:.02em">KODA · ouverture du paiement…</div>';
    document.body.appendChild(ov);
    return { close: function () { if (ov.parentNode) ov.parentNode.removeChild(ov); } };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { Koda.autoAttach(); });
  } else { Koda.autoAttach(); }

  global.Koda = Koda;
})(typeof window !== 'undefined' ? window : this);
