# WooCommerce plugin — live integration test

The KODA Payments plugin was tested against a **real WordPress + WooCommerce**
stack (not mocks), driven with WP-CLI and real HTTP, talking to a live KODA
backend. This records the environment, what was exercised, the results, and the
one real bug the test surfaced and fixed.

## Environment

| Component | Version / detail |
|-----------|------------------|
| WordPress | 6.7 (core from the official build repo) |
| WooCommerce | 9.4.2 (built release zip) |
| PHP | 8.4.19 |
| Database | SQLite (WordPress SQLite Database Integration 2.2.9) — no MySQL in the sandbox |
| KODA backend | this repo, `node app/backend/server.js`, real API |
| KODA plugin | `koda-woocommerce.zip` built from source by `build-site.js` |

WordPress core, WooCommerce, wp-cli, and the SQLite drop-in were all obtained
from GitHub (wordpress.org is blocked by the sandbox network policy). The plugin
installed and activated cleanly with **no PHP fatals** — including the new
`includes/class-koda-oauth.php` and `marketplace/` adapters.

## What was exercised, and the result

| # | Path | Method | Result |
|---|------|--------|--------|
| 1 | Plugin activation under real WP+WC | `wp plugin activate` | ✅ activates, no fatals |
| 2 | Gateway registration & availability | `WC()->payment_gateways()` | ✅ `koda` present, `is_available()` = yes with a key |
| 3 | REST routes registered | `rest_get_server()->get_routes()` | ✅ `/koda/v1/webhook` + `/koda/v1/oauth/callback` |
| 4 | Checkout → intent | real `process_payment()` on a real order | ✅ calls KODA `/v1/intents`, stores intent id, order → **on-hold** |
| 5 | Webhook — unsigned | `POST /koda/v1/webhook` no signature | ✅ **401** `missing_signature` |
| 6 | Webhook — bad signature | wrong HMAC | ✅ **401** `bad_signature` |
| 7 | Webhook — valid signed | correct HMAC-SHA256 of raw body | ✅ **200**, order → **processing/paid**, reference recorded |
| 8 | Webhook idempotency | replay the valid webhook | ✅ **200** `already_paid`, no double-completion |
| 9 | OAuth connect — authorize URL | `KODA_OAuth::authorize_url()` | ✅ points to `app.kodajnn.com/app#authorize` with all params |
| 10 | OAuth connect — callback exchange | real `handle_callback()` vs live KODA `/v1/oauth/token` | ✅ verifies state, exchanges code, stores **scoped `rk_live_` key + webhook secret**; `installation_id` matches KODA |
| 11 | Connect → pay loop | live-mode `process_payment()` with the OAuth key | ✅ creates a real intent with the scoped key |
| 12 | Marketplace rule — single vendor | real cart + `cart_vendor_count()` | ✅ count=1, KODA **offered** |
| 13 | Marketplace rule — mixed vendor | real 2-vendor cart | ✅ count=2, KODA **withdrawn** (Dokan + WCFM) |
| 14 | Reconciler (missed-webhook net) | verify intent on KODA, no webhook, run `koda_wc_reconcile_orders()` | ✅ order → **processing/paid**, note "caught a missed webhook" |

Two KODA-side safety behaviours also fired correctly during testing (proving the
engine, not just the plugin): the **balance-chain fraud check** quarantined a
synthetic SMS whose balance was inconsistent, and the **amount-collision guard**
held two same-amount orders for disambiguation instead of matching blindly.

## Bug found and fixed: zero-decimal currencies (v1.2.1)

The integration test caught a real production bug. The plugin computed the KODA
amount as `total × 10^(store decimals)`. KODA verifies against the amount the
operator SMS shows — for CDF and the CFA-franc zone that is **whole units**. But
a fresh WooCommerce store defaults to **2 decimals**, so a CDF store left on the
default would send **100× the amount** (a 50 000 FC order → `5000000`) and *every*
payment would fail to match.

Fix: `koda_wc_is_zero_decimal_currency()` forces whole units for KODA's
zero-decimal currencies (CDF, XOF, XAF, XPF, GNF, KMF, RWF, UGX, BIF, DJF, MGA +
the ISO-4217 zero-decimal set), regardless of the store's decimal setting;
fractional currencies still honour store decimals. Verified: on a default
2-decimal store, a 50 000 CDF order now sends `amount = 50000` (was `5000000`);
USD still honours store decimals.

## Residual (unchanged)

Dokan and WCFM themselves were **not installed** (their own plugins weren't
available in the sandbox), so the adapter *hooks* couldn't be wired in a live
mixed-vendor checkout — instead the adapters' one-intent-per-merchant decision
logic was exercised directly against a real WooCommerce multi-vendor cart. A
final pass on a WordPress instance with Dokan/WCFM actually installed is still
recommended before promoting the marketplace path, but the core rule is proven.

## How to reproduce

The full driver lives in this session's scratchpad; the shape is:
`wp core download` (from GitHub) → SQLite drop-in → `wp core install` →
`wp plugin install woocommerce.zip --activate` →
`wp plugin install koda-woocommerce.zip --activate` → configure gateway →
`wp eval-file` scripts that create orders and call `process_payment()`,
plus `curl` for signed webhooks and the OAuth token exchange.
