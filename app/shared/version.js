// KODA — single source of truth for versioning + build identity.
// UMD: Node require + browser global. Everything that stamps a version
// (API contract, status page, widget, service worker, decision traces)
// reads from here so the OS reports ONE coherent version everywhere.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KODA_VERSION = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const V = {
    // product release line — matches package.json "version"
    app: '2.1.0',
    // public REST contract version — the /v1 surface
    api: '1.0.0',
    // drop-in checkout widget (koda.js)
    widget: '1.0.0',
    // fraud model + decision-trace template (audit provenance)
    fraud_model: 'fraud-2026-07',
    trace_template: 'v2.0',
    // channel: 'stable' | 'beta' | 'canary'
    channel: 'stable',
  };

  // build stamp is injected at deploy time (git sha / CI date); falls back
  // to a fixed date so local + reproducible builds are deterministic.
  function build() {
    const env = (typeof process !== 'undefined' && process.env) || {};
    return {
      commit: env.KODA_BUILD_SHA || 'dev',
      date: env.KODA_BUILD_DATE || '2026-08-03T08:00:00Z',
    };
  }

  return { ...V, build };
});
