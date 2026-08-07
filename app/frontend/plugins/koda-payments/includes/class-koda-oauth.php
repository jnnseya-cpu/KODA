<?php
/**
 * KODA one-click connect (OAuth-style install flow).
 *
 * Instead of asking the merchant to paste API keys and a webhook secret by hand,
 * this drives the install the way the KODA spec describes it:
 *
 *   1. Merchant clicks "Connect with KODA" in WooCommerce → Settings → Payments → KODA.
 *   2. We mint a single-use `state` nonce and redirect them to the KODA app's
 *      #authorize screen, passing our callback URL, the store URL and the webhook URL.
 *   3. The merchant approves in KODA. KODA provisions a *scoped, revocable* key +
 *      webhook and 302s the browser back to our callback with a one-time `code`.
 *   4. Our callback verifies the `state`, then exchanges the `code` server-to-server
 *      at POST /v1/oauth/token. KODA returns the scoped access token and the webhook
 *      signing secret, which we store in the gateway settings. No master secret is
 *      ever shared; the token can be revoked from KODA at any time.
 *
 * This is additive: the manual key fields still work for anyone who prefers them.
 *
 * @package koda-payments
 */

if ( ! defined( 'ABSPATH' ) ) { exit; }

class KODA_OAuth {

	const STATE_TTL      = 900; // 15 minutes
	const OPTION_SETTINGS = 'woocommerce_koda_settings';

	/**
	 * Base URL of the KODA merchant app (where #authorize lives). Filterable so a
	 * self-hosted / staging KODA can be targeted.
	 */
	public static function app_base() {
		$base = apply_filters( 'koda_app_base', 'https://app.kodajnn.com/app' );
		return untrailingslashit( (string) $base );
	}

	/**
	 * Base URL of the KODA API (token exchange). Mirrors the gateway's api_base option.
	 */
	public static function api_base() {
		$settings = get_option( self::OPTION_SETTINGS, array() );
		$base = isset( $settings['api_base'] ) && trim( (string) $settings['api_base'] ) !== ''
			? trim( (string) $settings['api_base'] )
			: 'https://kodajnn.com/v1';
		return untrailingslashit( apply_filters( 'koda_api_base', $base ) );
	}

	/**
	 * Our own REST callback URL that KODA redirects back to after approval.
	 */
	public static function callback_url() {
		return esc_url_raw( rest_url( 'koda/v1/oauth/callback' ) );
	}

	/**
	 * The webhook URL KODA should call for this store.
	 */
	public static function webhook_url() {
		return esc_url_raw( rest_url( 'koda/v1/webhook' ) );
	}

	/**
	 * Register hooks. Called once from the main plugin file.
	 */
	public static function init() {
		// admin-post handler that kicks off the connect redirect
		add_action( 'admin_post_koda_connect', array( __CLASS__, 'handle_connect_start' ) );
		// the REST callback KODA returns to
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
		// a "Connect / Connected" banner rendered at the top of the gateway settings form
		add_action( 'woocommerce_settings_checkout', array( __CLASS__, 'maybe_render_notice' ) );
	}

	public static function register_routes() {
		register_rest_route( 'koda/v1', '/oauth/callback', array(
			'methods'             => 'GET',
			'callback'            => array( __CLASS__, 'handle_callback' ),
			'permission_callback' => '__return_true', // state nonce + admin-cap check inside
			'args'                => array(
				'code'  => array( 'required' => false ),
				'state' => array( 'required' => false ),
				'error' => array( 'required' => false ),
			),
		) );
	}

	/**
	 * Build the #authorize URL the merchant is sent to.
	 */
	public static function authorize_url( $state ) {
		$params = array(
			'platform'     => 'woocommerce',
			'store_url'    => home_url(),
			'redirect_uri' => self::callback_url(),
			'webhook_url'  => self::webhook_url(),
			'state'        => $state,
		);
		// The app reads params from the hash fragment: .../app#authorize?<query>
		return self::app_base() . '#authorize?' . http_build_query( $params );
	}

	/**
	 * admin-post: mint state, remember it, redirect the merchant to KODA to approve.
	 */
	public static function handle_connect_start() {
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			wp_die( esc_html__( 'You do not have permission to connect KODA.', 'koda-payments' ) );
		}
		check_admin_referer( 'koda_connect' );

		$state = wp_generate_password( 32, false );
		// bind the state to the current admin so only they can complete it
		set_transient( 'koda_oauth_state_' . $state, get_current_user_id(), self::STATE_TTL );

		wp_redirect( self::authorize_url( $state ) );
		exit;
	}

	/**
	 * REST callback: verify state, exchange code, store the scoped token + webhook secret.
	 */
	public static function handle_callback( WP_REST_Request $request ) {
		// The merchant's browser lands here logged into WP; require the capability so a
		// leaked code cannot be redeemed by an anonymous visitor.
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			return self::finish_redirect( 'error', __( 'Please sign in to WordPress as a shop manager, then reconnect KODA.', 'koda-payments' ) );
		}

		$error = $request->get_param( 'error' );
		if ( ! empty( $error ) ) {
			return self::finish_redirect( 'error', sprintf( __( 'KODA connection was cancelled (%s).', 'koda-payments' ), sanitize_text_field( $error ) ) );
		}

		$code  = (string) $request->get_param( 'code' );
		$state = (string) $request->get_param( 'state' );
		if ( '' === $code || '' === $state ) {
			return self::finish_redirect( 'error', __( 'KODA connection is missing its code or state.', 'koda-payments' ) );
		}

		// one-time state check
		$owner = get_transient( 'koda_oauth_state_' . $state );
		delete_transient( 'koda_oauth_state_' . $state );
		if ( false === $owner || (int) $owner !== get_current_user_id() ) {
			return self::finish_redirect( 'error', __( 'KODA connection state was invalid or expired. Please try again.', 'koda-payments' ) );
		}

		// server-to-server exchange
		$res = wp_remote_post( self::api_base() . '/oauth/token', array(
			'timeout' => 30,
			'headers' => array( 'Content-Type' => 'application/json' ),
			'body'    => wp_json_encode( array(
				'code'         => $code,
				'redirect_uri' => self::callback_url(),
			) ),
		) );

		if ( is_wp_error( $res ) ) {
			return self::finish_redirect( 'error', __( 'Could not reach KODA to complete the connection: ', 'koda-payments' ) . $res->get_error_message() );
		}
		$status = wp_remote_retrieve_response_code( $res );
		$data   = json_decode( wp_remote_retrieve_body( $res ), true );
		if ( $status < 200 || $status >= 300 || empty( $data['access_token'] ) ) {
			$msg = is_array( $data ) && isset( $data['error'] ) ? ( is_array( $data['error'] ) ? ( $data['error']['message'] ?? $data['error']['code'] ?? 'error' ) : $data['error'] ) : 'error';
			return self::finish_redirect( 'error', __( 'KODA rejected the connection: ', 'koda-payments' ) . sanitize_text_field( $msg ) );
		}

		// persist into the gateway settings (additive — leaves other fields intact)
		$settings = get_option( self::OPTION_SETTINGS, array() );
		if ( ! is_array( $settings ) ) { $settings = array(); }
		$settings['enabled']         = 'yes';
		$settings['testmode']        = 'no';
		$settings['live_api_key']    = sanitize_text_field( $data['access_token'] );
		if ( ! empty( $data['webhook_secret'] ) ) {
			$settings['webhook_secret'] = sanitize_text_field( $data['webhook_secret'] );
		}
		if ( ! empty( $data['installation_id'] ) ) {
			$settings['installation_id'] = sanitize_text_field( $data['installation_id'] );
		}
		if ( ! empty( $data['merchant_id'] ) ) {
			$settings['merchant_id'] = sanitize_text_field( $data['merchant_id'] );
		}
		update_option( self::OPTION_SETTINGS, $settings );

		return self::finish_redirect( 'connected', __( 'KODA is connected. Mobile-money payments are ready.', 'koda-payments' ) );
	}

	/**
	 * Bounce the browser back to the WooCommerce → KODA settings screen with a flag.
	 */
	private static function finish_redirect( $result, $message ) {
		set_transient( 'koda_oauth_flash_' . get_current_user_id(), array( 'result' => $result, 'message' => $message ), 60 );
		$url = admin_url( 'admin.php?page=wc-settings&tab=checkout&section=koda&koda_oauth=' . rawurlencode( $result ) );
		wp_safe_redirect( $url );
		exit;
	}

	/**
	 * Render the Connect button / connected banner + any flash message at the top of
	 * the KODA gateway settings form.
	 */
	public static function maybe_render_notice() {
		if ( ! is_admin() ) { return; }
		// only on our gateway's settings section
		$section = isset( $_GET['section'] ) ? sanitize_text_field( wp_unslash( $_GET['section'] ) ) : '';
		$tab     = isset( $_GET['tab'] ) ? sanitize_text_field( wp_unslash( $_GET['tab'] ) ) : '';
		if ( 'checkout' !== $tab || 'koda' !== $section ) { return; }

		$flash = get_transient( 'koda_oauth_flash_' . get_current_user_id() );
		if ( $flash ) {
			delete_transient( 'koda_oauth_flash_' . get_current_user_id() );
			$cls = 'connected' === $flash['result'] ? 'notice-success' : 'notice-error';
			echo '<div class="notice ' . esc_attr( $cls ) . '"><p><strong>KODA:</strong> ' . esc_html( $flash['message'] ) . '</p></div>';
		}

		$settings  = get_option( self::OPTION_SETTINGS, array() );
		$connected = ! empty( $settings['live_api_key'] ) && 0 === strpos( (string) $settings['live_api_key'], 'rk_live_' );
		$connect   = wp_nonce_url( admin_url( 'admin-post.php?action=koda_connect' ), 'koda_connect' );

		echo '<div class="notice notice-info" style="padding:14px 16px"><p style="margin:0 0 8px">';
		if ( $connected ) {
			echo '<strong>' . esc_html__( '✓ Connected to KODA', 'koda-payments' ) . '</strong> — ';
			echo esc_html__( 'a scoped, revocable key is installed. Reconnect to re-provision, or revoke from your KODA dashboard.', 'koda-payments' );
		} else {
			echo '<strong>' . esc_html__( 'One-click setup', 'koda-payments' ) . '</strong> — ';
			echo esc_html__( 'connect your KODA account instead of pasting keys by hand. A scoped, revocable key and webhook are provisioned automatically.', 'koda-payments' );
		}
		echo '</p><p style="margin:0"><a class="button button-primary" href="' . esc_url( $connect ) . '">';
		echo $connected ? esc_html__( 'Reconnect with KODA', 'koda-payments' ) : esc_html__( 'Connect with KODA', 'koda-payments' );
		echo '</a></p></div>';
	}
}
