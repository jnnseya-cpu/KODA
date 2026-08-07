=== KODA Payments for WooCommerce ===
Contributors: kodajnn
Tags: woocommerce, payment gateway, mobile money, orange money, m-pesa, airtel money, africa, drc
Requires at least: 5.8
Tested up to: 6.6
Requires PHP: 7.4
Stable tag: 1.2.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Accept mobile-money payments and verify them automatically with KODA — the SMS is the API. No telco contract required.

== Description ==

KODA Payments lets any WooCommerce store accept **mobile-money payments** (Orange Money, M-Pesa, Airtel Money, Africell Money, MTN MoMo, Wave and more) and have them **verified automatically** — no manual checking, no human in the loop.

This is **Door 3 (API mode)** of the KODA payment-verification platform, packaged as a drop-in gateway:

1. At checkout the plugin creates a KODA payment **intent**.
2. The customer is sent to the KODA checkout to pay by mobile money and submit their transaction code.
3. KODA verifies the code **against the operator's own confirmation SMS**, scores it for fraud and replay, and fires a **signed `payment.verified` webhook**.
4. The plugin completes the WooCommerce order automatically.

**KODA never holds or moves money.** Funds travel directly from the customer to the merchant over the operator's network. KODA only *verifies* that the payment happened.

= Features =

* One checkout option for many mobile-money operators
* Automatic order completion on verified payment (signed webhook)
* HMAC-SHA256 signature verification — orders only complete from authentic KODA webhooks
* Idempotent — a replayed webhook never double-completes an order
* Test/sandbox mode with magic references (e.g. `TEST-OK-25000`)
* HPOS (High-Performance Order Storage) compatible
* Cart & Checkout **Blocks** support
* **One-click connect** — provision a scoped, revocable key + webhook without pasting secrets by hand (no master secret is shared)
* Reliability reconciler (wp-cron) that catches any missed webhook from the server-of-record
* **Multivendor** (Dokan / WCFM) aware — enforces KODA's one-intent-per-merchant rule; withdraws mobile-money on mixed-vendor carts so no ambiguous payment is ever created

== Installation ==

1. Upload the `koda-payments` folder to `/wp-content/plugins/`, or install the ZIP via **Plugins → Add New → Upload Plugin**.
2. Activate the plugin through the **Plugins** menu in WordPress.
3. Go to **WooCommerce → Settings → Payments → KODA (Mobile Money)** and click **Manage**.

**Recommended — one-click connect:**

4. Click **Connect with KODA**. You are taken to your KODA account to approve the connection, then returned automatically. A scoped, revocable API key and a webhook (with its signing secret) are provisioned for you — nothing to copy by hand, and no master secret is shared. Revoke anytime from your KODA dashboard.

**Or connect manually:**

4. Create API keys in your KODA dashboard (**Developers → Create key**) and paste the `sk_test_` and/or `sk_live_` key.
5. In KODA (**Developers → Add webhook**) create a webhook pointing at:
   `https://YOUR-STORE.com/wp-json/koda/v1/webhook`
   Copy its **signing secret** and paste it into the plugin's **Webhook signing secret** field.
6. Toggle **Test mode** off for live payments. Save.

== Frequently Asked Questions ==

= Does KODA hold my money? =
No. KODA is a payment *verification* service, not a wallet, processor or escrow. Payments go directly to your mobile-money account; KODA confirms them.

= How do I test it without a real payment? =
Enable **Test mode**, use an `sk_test_` key, and on the KODA checkout submit a magic reference such as `TEST-OK-25000` to simulate an instant verified payment.

= What if the webhook is delayed? =
The order stays **On hold** until KODA verifies the payment, then completes automatically. KODA retries webhook delivery with backoff.

= Which currencies/decimals are supported? =
The plugin sends the amount in minor units using your store's configured decimals (e.g. CDF with 0 decimals, USD with 2).

== Changelog ==

= 1.2.0 =
* One-click connect (OAuth-style install): provisions a scoped, revocable key + webhook via a secure server-to-server code exchange — no master secret shared.
* Multivendor adapters for Dokan and WCFM Marketplace: enforce one-intent-per-merchant; withdraw KODA on mixed-vendor carts.
* Note: the one-click connect and marketplace adapters are lint-verified; validate against your live WordPress + marketplace plugins before go-live.

= 1.1.0 =
* Cart & Checkout Blocks support; wp-cron reliability reconciler; is_available() key check.

= 1.0.0 =
* Initial release: gateway, hosted checkout redirect, signed webhook receiver, HPOS support.
