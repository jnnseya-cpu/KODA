<?php
/**
 * KODA — WooCommerce Cart & Checkout Blocks payment-method integration.
 * Registers the KODA gateway for the React-based Blocks checkout. The server-side
 * payment still runs through WC_Gateway_KODA::process_payment(); this only makes the
 * method appear and be selectable in Blocks.
 */

if ( ! defined( 'ABSPATH' ) ) { exit; }

use Automattic\WooCommerce\Blocks\Payments\Integrations\AbstractPaymentMethodType;

final class KODA_Blocks_Support extends AbstractPaymentMethodType {

	protected $name = 'koda';

	public function initialize() {
		$this->settings = get_option( 'woocommerce_koda_settings', array() );
	}

	public function is_active() {
		// Mirror WC_Gateway_KODA::is_available(): enabled AND a usable key for the
		// current mode — never offer KODA in the Blocks checkout if process_payment()
		// would fail with "missing API key".
		if ( empty( $this->settings['enabled'] ) || 'yes' !== $this->settings['enabled'] ) {
			return false;
		}
		$testmode = isset( $this->settings['testmode'] ) && 'yes' === $this->settings['testmode'];
		$key = trim( (string) ( $testmode ? ( $this->settings['test_api_key'] ?? '' ) : ( $this->settings['live_api_key'] ?? '' ) ) );
		return '' !== $key;
	}

	public function get_payment_method_script_handles() {
		$handle = 'koda-blocks';
		wp_register_script(
			$handle,
			plugins_url( 'koda-blocks.js', __FILE__ ),
			array( 'wc-blocks-registry', 'wc-settings', 'wp-element', 'wp-html-entities', 'wp-i18n' ),
			defined( 'KODA_WC_VERSION' ) ? KODA_WC_VERSION : '1.0.0',
			true
		);
		return array( $handle );
	}

	public function get_payment_method_data() {
		return array(
			'title'       => $this->settings['title'] ?? __( 'Mobile Money — verified by KODA', 'koda-payments' ),
			'description' => $this->settings['description'] ?? '',
			'supports'    => array( 'products' ),
		);
	}
}
