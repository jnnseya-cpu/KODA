<?php
/**
 * Plugin Name: KODA Payments for WooCommerce
 * Plugin URI: https://kodajnn.com/developers
 * Description: Accept mobile-money payments and verify them automatically with KODA — the SMS is the API. Customers pay by mobile money, KODA confirms the operator SMS, and the order completes with no human in the loop.
 * Author: KODA (Groupe Nseya Digital)
 * Author URI: https://kodajnn.com
 * Version: 1.2.1
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * WC requires at least: 6.0
 * WC tested up to: 9.5
 * Text Domain: koda-payments
 * License: GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 *
 * KODA verifies mobile-money payments deterministically against the operator's
 * own confirmation SMS. This gateway creates a KODA payment intent at checkout,
 * sends the customer to the KODA checkout to submit their transaction code, and
 * completes the WooCommerce order when KODA fires a signed `payment.verified`
 * webhook. Door 3 (API mode) of the KODA platform.
 */

if ( ! defined( 'ABSPATH' ) ) { exit; }

define( 'KODA_WC_VERSION', '1.2.1' );

/**
 * Whether a currency is verified by KODA in whole units (no minor subunit shown in the
 * operator SMS). Covers KODA's mobile-money currencies (CDF and the CFA-franc zone) plus
 * the ISO-4217 zero-decimal currencies. Filterable so a deployment can add its own.
 *
 * @param string $currency ISO-4217 code.
 * @return bool
 */
function koda_wc_is_zero_decimal_currency( $currency ) {
	$zero = array(
		// KODA mobile-money currencies (whole units in the operator SMS)
		'CDF', 'XOF', 'XAF', 'XPF', 'GNF', 'KMF', 'RWF', 'UGX', 'BIF', 'DJF', 'MGA',
		// ISO-4217 zero-decimal currencies
		'CLP', 'JPY', 'KRW', 'PYG', 'VND', 'VUV', 'ISK',
	);
	$zero = apply_filters( 'koda_zero_decimal_currencies', $zero );
	return in_array( strtoupper( (string) $currency ), $zero, true );
}

/**
 * One-click connect (OAuth-style install) + multivendor marketplace adapters.
 * All additive: the manual key fields and single-vendor flow are unchanged.
 */
require_once __DIR__ . '/includes/class-koda-oauth.php';
require_once __DIR__ . '/marketplace/class-koda-dokan.php';
require_once __DIR__ . '/marketplace/class-koda-wcfm.php';
KODA_OAuth::init();
KODA_Dokan_Adapter::init();
KODA_WCFM_Adapter::init();

/**
 * Declare compatibility with WooCommerce High-Performance Order Storage (HPOS).
 */
add_action( 'before_woocommerce_init', function () {
	if ( class_exists( \Automattic\WooCommerce\Utilities\FeaturesUtil::class ) ) {
		\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', __FILE__, true );
	}
} );

/**
 * Register the gateway once WooCommerce has loaded (so WC_Payment_Gateway exists).
 */
add_action( 'plugins_loaded', 'koda_wc_init_gateway' );

function koda_wc_init_gateway() {
	if ( ! class_exists( 'WC_Payment_Gateway' ) ) {
		add_action( 'admin_notices', function () {
			echo '<div class="notice notice-error"><p><strong>KODA Payments</strong> requires WooCommerce to be installed and active.</p></div>';
		} );
		return;
	}

	/**
	 * The KODA payment gateway.
	 */
	class WC_Gateway_KODA extends WC_Payment_Gateway {

		public function __construct() {
			$this->id                 = 'koda';
			$this->has_fields         = false;
			$this->method_title       = __( 'KODA (Mobile Money)', 'koda-payments' );
			$this->method_description = __( 'Accept mobile-money payments verified automatically by KODA. The customer pays by mobile money and submits their transaction code; KODA confirms it against the operator SMS and completes the order.', 'koda-payments' );
			$this->icon               = '';
			$this->supports           = array( 'products' );

			$this->init_form_fields();
			$this->init_settings();

			$this->title       = $this->get_option( 'title' );
			$this->description = $this->get_option( 'description' );
			$this->testmode    = 'yes' === $this->get_option( 'testmode' );

			add_action( 'woocommerce_update_options_payment_gateways_' . $this->id, array( $this, 'process_admin_options' ) );
		}

		/**
		 * Only offer KODA when it is enabled AND has a usable API key for the current
		 * mode — never show a gateway that would fail at process_payment().
		 */
		public function is_available() {
			if ( 'yes' !== $this->enabled ) {
				return false;
			}
			if ( '' === trim( (string) $this->api_key() ) ) {
				return false;
			}
			return parent::is_available();
		}

		/**
		 * Base URL of the KODA API (test and live share the same host; the key prefix decides the mode).
		 */
		private function api_base() {
			$base = trim( $this->get_option( 'api_base', 'https://kodajnn.com/v1' ) );
			return untrailingslashit( $base ? $base : 'https://kodajnn.com/v1' );
		}

		/**
		 * The API key to use for the current mode.
		 */
		private function api_key() {
			return $this->testmode ? trim( $this->get_option( 'test_api_key' ) ) : trim( $this->get_option( 'live_api_key' ) );
		}

		public function init_form_fields() {
			$webhook_url = esc_url_raw( rest_url( 'koda/v1/webhook' ) );
			$this->form_fields = array(
				'enabled' => array(
					'title'   => __( 'Enable/Disable', 'koda-payments' ),
					'type'    => 'checkbox',
					'label'   => __( 'Enable KODA mobile-money payments', 'koda-payments' ),
					'default' => 'no',
				),
				'title' => array(
					'title'       => __( 'Title', 'koda-payments' ),
					'type'        => 'text',
					'description' => __( 'What the customer sees at checkout.', 'koda-payments' ),
					'default'     => __( 'Mobile Money (Orange, M-Pesa, Airtel…)', 'koda-payments' ),
					'desc_tip'    => true,
				),
				'description' => array(
					'title'       => __( 'Description', 'koda-payments' ),
					'type'        => 'textarea',
					'default'     => __( 'Pay by mobile money. You will confirm your payment with the transaction code from the operator SMS.', 'koda-payments' ),
				),
				'testmode' => array(
					'title'       => __( 'Test mode', 'koda-payments' ),
					'type'        => 'checkbox',
					'label'       => __( 'Use sandbox (sk_test_ key). Use magic references like TEST-OK-25000 to simulate a paid order.', 'koda-payments' ),
					'default'     => 'yes',
				),
				'test_api_key' => array(
					'title'       => __( 'Test API key (sk_test_…)', 'koda-payments' ),
					'type'        => 'password',
					'description' => __( 'From your KODA dashboard → Developers → Create key.', 'koda-payments' ),
					'default'     => '',
				),
				'live_api_key' => array(
					'title'       => __( 'Live API key (sk_live_…)', 'koda-payments' ),
					'type'        => 'password',
					'description' => __( 'From your KODA dashboard → Developers → Create key (live).', 'koda-payments' ),
					'default'     => '',
				),
				'webhook_secret' => array(
					'title'       => __( 'Webhook signing secret', 'koda-payments' ),
					'type'        => 'password',
					/* translators: %s: the webhook URL to register in KODA */
					'description' => sprintf( __( 'In KODA → Developers → Add webhook, point it at <code>%s</code> and paste its signing secret here. Payments are only accepted from correctly-signed webhooks.', 'koda-payments' ), $webhook_url ),
					'default'     => '',
				),
				'operators' => array(
					'title'       => __( 'Operators (optional)', 'koda-payments' ),
					'type'        => 'text',
					'description' => __( 'Comma-separated operator codes to offer, e.g. orange_cd,mpesa_cd,airtel_cd. Leave blank for your account default.', 'koda-payments' ),
					'default'     => '',
				),
			);
		}

		/**
		 * Create a KODA intent and send the customer to the KODA checkout.
		 */
		public function process_payment( $order_id ) {
			$order = wc_get_order( $order_id );
			if ( ! $order ) {
				wc_add_notice( __( 'Order not found.', 'koda-payments' ), 'error' );
				return array( 'result' => 'failure' );
			}

			$key = $this->api_key();
			if ( empty( $key ) ) {
				wc_add_notice( __( 'KODA is not fully configured (missing API key). Please choose another payment method or contact the store.', 'koda-payments' ), 'error' );
				return array( 'result' => 'failure' );
			}

			// Amount KODA verifies against the operator SMS. KODA matches the amount the
			// operator's confirmation SMS shows — for its mobile-money currencies that is
			// whole units (CDF shows "40 000 FC", no centimes). A default WooCommerce store
			// is configured with 2 decimals, so trusting the store's decimal setting would
			// send 100× the real amount for a zero-decimal currency and every payment would
			// mismatch. We therefore force whole units for KODA's zero-decimal currencies,
			// regardless of the store's "Number of decimals" setting, and honour the store
			// decimals only for genuinely fractional currencies.
			$currency = $order->get_currency();
			if ( koda_wc_is_zero_decimal_currency( $currency ) ) {
				$amount = (int) round( (float) $order->get_total() );
			} else {
				$decimals = wc_get_price_decimals();
				$amount   = (int) round( (float) $order->get_total() * pow( 10, $decimals ) );
			}

			$body = array(
				'amount'      => $amount,
				'currency'    => $currency,
				'metadata'    => array(
					'order_id' => (string) $order_id,
					'source'   => 'woocommerce',
					'site'     => home_url(),
				),
				'success_url' => $this->get_return_url( $order ),
				'cancel_url'  => wc_get_checkout_url(),
				'expires_in'  => 1800,
			);
			$operators = array_filter( array_map( 'trim', explode( ',', (string) $this->get_option( 'operators' ) ) ) );
			if ( ! empty( $operators ) ) {
				$body['operators'] = array_values( $operators );
			}

			$response = wp_remote_post( $this->api_base() . '/intents', array(
				'timeout' => 30,
				'headers' => array(
					'Authorization' => 'Bearer ' . $key,
					'Content-Type'  => 'application/json',
				),
				'body'    => wp_json_encode( $body ),
			) );

			if ( is_wp_error( $response ) ) {
				wc_add_notice( __( 'Could not reach KODA. Please try again.', 'koda-payments' ), 'error' );
				$order->add_order_note( 'KODA: intent request failed — ' . $response->get_error_message() );
				return array( 'result' => 'failure' );
			}

			$code = wp_remote_retrieve_response_code( $response );
			$data = json_decode( wp_remote_retrieve_body( $response ), true );

			if ( $code < 200 || $code >= 300 || empty( $data['checkout_url'] ) ) {
				$msg = isset( $data['error']['message'] ) ? $data['error']['message'] : ( isset( $data['error']['code'] ) ? $data['error']['code'] : 'unknown_error' );
				wc_add_notice( __( 'KODA could not create the payment: ', 'koda-payments' ) . esc_html( $msg ), 'error' );
				$order->add_order_note( 'KODA: intent creation failed (' . intval( $code ) . ') — ' . wp_strip_all_tags( wp_remote_retrieve_body( $response ) ) );
				return array( 'result' => 'failure' );
			}

			// Record the intent and mark the order as awaiting payment.
			$order->update_meta_data( '_koda_intent_id', sanitize_text_field( $data['intent_id'] ) );
			$order->save();
			$order->update_status( 'on-hold', __( 'Awaiting mobile-money verification via KODA.', 'koda-payments' ) );

			wc_reduce_stock_levels( $order_id );
			WC()->cart->empty_cart();

			return array(
				'result'   => 'success',
				'redirect' => esc_url_raw( $data['checkout_url'] ),
			);
		}
	}

	// Register the gateway with WooCommerce.
	add_filter( 'woocommerce_payment_gateways', function ( $gateways ) {
		$gateways[] = 'WC_Gateway_KODA';
		return $gateways;
	} );
}

/**
 * Register the signed-webhook receiver: POST /wp-json/koda/v1/webhook
 */
add_action( 'rest_api_init', function () {
	register_rest_route( 'koda/v1', '/webhook', array(
		'methods'             => 'POST',
		'callback'            => 'koda_wc_handle_webhook',
		'permission_callback' => '__return_true', // authenticated by HMAC signature, not cookies
	) );
} );

function koda_wc_handle_webhook( WP_REST_Request $request ) {
	// Load the gateway settings to get the signing secret.
	$settings = get_option( 'woocommerce_koda_settings', array() );
	$secret   = isset( $settings['webhook_secret'] ) ? trim( $settings['webhook_secret'] ) : '';
	if ( empty( $secret ) ) {
		return new WP_REST_Response( array( 'error' => 'webhook_not_configured' ), 400 );
	}

	$raw = $request->get_body();
	$sig = $request->get_header( 'x-koda-signature' );
	if ( empty( $sig ) ) {
		return new WP_REST_Response( array( 'error' => 'missing_signature' ), 401 );
	}

	$expected = hash_hmac( 'sha256', $raw, $secret );
	if ( ! hash_equals( $expected, (string) $sig ) ) {
		return new WP_REST_Response( array( 'error' => 'bad_signature' ), 401 );
	}

	$payload = json_decode( $raw, true );
	if ( ! is_array( $payload ) || empty( $payload['event'] ) ) {
		return new WP_REST_Response( array( 'error' => 'bad_payload' ), 400 );
	}

	$event = $payload['event'];
	if ( 'payment.verified' !== $event && 'payment.verified.late' !== $event ) {
		return new WP_REST_Response( array( 'ok' => true, 'ignored' => $event ), 200 );
	}

	$order_id = isset( $payload['metadata']['order_id'] ) ? $payload['metadata']['order_id'] : null;
	if ( ! $order_id ) {
		return new WP_REST_Response( array( 'ok' => true, 'note' => 'no_order_id' ), 200 );
	}

	$order = wc_get_order( $order_id );
	if ( ! $order ) {
		return new WP_REST_Response( array( 'ok' => true, 'note' => 'order_not_found' ), 200 );
	}

	// Idempotency: if already paid, acknowledge and do nothing.
	if ( $order->is_paid() ) {
		return new WP_REST_Response( array( 'ok' => true, 'note' => 'already_paid' ), 200 );
	}

	$reference = isset( $payload['reference'] ) ? sanitize_text_field( $payload['reference'] ) : '';
	$receipt   = isset( $payload['receipt_id'] ) ? sanitize_text_field( $payload['receipt_id'] ) : '';

	$order->add_order_note( sprintf(
		/* translators: 1: KODA reference, 2: receipt id */
		__( 'KODA verified this payment. Reference %1$s · receipt %2$s.', 'koda-payments' ),
		$reference ? $reference : '—',
		$receipt ? $receipt : '—'
	) );
	$order->payment_complete( $reference );

	return new WP_REST_Response( array( 'ok' => true ), 200 );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * RELIABILITY: dual-path completion. The signed webhook above is authoritative,
 * but webhooks can be missed (outage, transient 5xx). A wp-cron reconciler polls
 * KODA for any order still awaiting payment and completes/expires it from the
 * server-of-record status — never from a client event. Idempotent on is_paid().
 * ──────────────────────────────────────────────────────────────────────────── */

add_filter( 'cron_schedules', function ( $s ) {
	if ( ! isset( $s['koda_2min'] ) ) {
		$s['koda_2min'] = array( 'interval' => 120, 'display' => 'Every 2 minutes (KODA)' );
	}
	return $s;
} );

/**
 * Ensure the reconciler is scheduled — idempotently, on every load. A plugin UPDATE
 * (1.0.0 → 1.1.0) does NOT re-run the activation hook, so scheduling only there would
 * leave upgraded sites without the reliability job. Registering on `init` guarantees
 * the event exists on fresh installs and updates alike.
 */
function koda_wc_ensure_cron() {
	if ( ! wp_next_scheduled( 'koda_reconcile_orders' ) ) {
		wp_schedule_event( time() + 120, 'koda_2min', 'koda_reconcile_orders' );
	}
}
add_action( 'init', 'koda_wc_ensure_cron' );
register_activation_hook( __FILE__, 'koda_wc_ensure_cron' );
register_deactivation_hook( __FILE__, function () {
	wp_clear_scheduled_hook( 'koda_reconcile_orders' );
} );

add_action( 'koda_reconcile_orders', 'koda_wc_reconcile_orders' );

function koda_wc_reconcile_orders() {
	$settings = get_option( 'woocommerce_koda_settings', array() );
	if ( empty( $settings['enabled'] ) || 'yes' !== $settings['enabled'] ) { return; }
	$testmode = isset( $settings['testmode'] ) && 'yes' === $settings['testmode'];
	$key      = trim( $testmode ? ( $settings['test_api_key'] ?? '' ) : ( $settings['live_api_key'] ?? '' ) );
	$base     = untrailingslashit( trim( $settings['api_base'] ?? 'https://kodajnn.com/v1' ) ?: 'https://kodajnn.com/v1' );
	if ( empty( $key ) ) { return; }

	// Orders still awaiting KODA verification (on-hold with an intent id), last 24h.
	$orders = wc_get_orders( array(
		'status'       => array( 'wc-on-hold' ),
		'limit'        => 30,
		'date_created' => '>' . ( time() - DAY_IN_SECONDS ),
		'meta_key'     => '_koda_intent_id',
		'meta_compare' => 'EXISTS',
	) );
	foreach ( $orders as $order ) {
		if ( $order->is_paid() ) { continue; }
		$intent = $order->get_meta( '_koda_intent_id' );
		if ( ! $intent ) { continue; }
		$res = wp_remote_get( $base . '/intents/' . rawurlencode( $intent ), array(
			'timeout' => 15,
			'headers' => array( 'Authorization' => 'Bearer ' . $key ),
		) );
		if ( is_wp_error( $res ) ) { continue; }
		$data = json_decode( wp_remote_retrieve_body( $res ), true );
		$status = is_array( $data ) ? ( $data['status'] ?? '' ) : '';
		if ( 'verified' === $status || 'verified_late' === $status ) {
			$order->add_order_note( __( 'KODA reconciler: payment verified (caught a missed webhook).', 'koda-payments' ) );
			$order->payment_complete( isset( $data['reference'] ) ? sanitize_text_field( $data['reference'] ) : '' );
		} elseif ( in_array( $status, array( 'expired', 'cancelled' ), true ) ) {
			$order->update_status( 'cancelled', __( 'KODA reconciler: payment intent expired/cancelled.', 'koda-payments' ) );
		} elseif ( 'rejected' === $status ) {
			$order->update_status( 'failed', __( 'KODA reconciler: payment rejected.', 'koda-payments' ) );
		}
		// pending_review / awaiting_payment → leave on-hold (still in flight).
	}
}

/* ─────────────────────────────────────────────────────────────────────────────
 * WooCommerce Cart & Checkout Blocks support. The classic gateway above handles
 * the server side (process_payment); Blocks additionally needs a client-side
 * payment-method registration. This registers it so KODA appears in the Blocks
 * checkout too. The block simply selects the gateway; the redirect-to-KODA flow
 * is identical to classic checkout.
 * ──────────────────────────────────────────────────────────────────────────── */

add_action( 'woocommerce_blocks_loaded', function () {
	if ( ! class_exists( 'Automattic\\WooCommerce\\Blocks\\Payments\\Integrations\\AbstractPaymentMethodType' ) ) {
		return;
	}
	require_once __DIR__ . '/blocks/class-koda-blocks.php';
	add_action(
		'woocommerce_blocks_payment_method_type_registration',
		function ( $registry ) {
			$registry->register( new KODA_Blocks_Support() );
		}
	);
} );
