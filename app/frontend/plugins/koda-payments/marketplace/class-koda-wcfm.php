<?php
/**
 * KODA ↔ WCFM Marketplace adapter.
 *
 * Same "one intent → one merchant account" rule as the Dokan adapter, applied to
 * WCFM Marketplace (WC Frontend Manager). A KODA payment intent settles against a
 * single merchant's mobile-money line — whoever's operator SMS confirms the cash —
 * so a cart that spans multiple WCFM vendors cannot be verified as one intent.
 *
 *   • Single-vendor cart → KODA offered normally.
 *   • Mixed-vendor cart  → KODA withdrawn with a clear notice.
 *
 * WCFM creates per-vendor commission/sub-order records; each resulting order carries
 * its own KODA intent id, keeping verification and reconciliation 1:1.
 *
 * Additive and self-contained: if WCFM is not active, nothing here runs.
 *
 * @package koda-payments
 */

if ( ! defined( 'ABSPATH' ) ) { exit; }

class KODA_WCFM_Adapter {

	public static function init() {
		add_action( 'plugins_loaded', array( __CLASS__, 'maybe_hook' ), 20 );
	}

	public static function maybe_hook() {
		if ( ! self::wcfm_active() ) { return; }
		add_filter( 'woocommerce_available_payment_gateways', array( __CLASS__, 'filter_gateways' ) );
		// WCFM vendor tagging on sub-order creation.
		add_action( 'wcfm_vendor_suborder_created', array( __CLASS__, 'tag_suborder_vendor' ), 10, 2 );
	}

	public static function wcfm_active() {
		return class_exists( 'WCFMmp' ) || function_exists( 'wcfm_get_vendor_id_by_post' );
	}

	/**
	 * Distinct WCFM vendors in the cart. Uses wcfm_get_vendor_id_by_post() when
	 * available, else falls back to post_author.
	 */
	public static function cart_vendor_count() {
		if ( ! function_exists( 'WC' ) || ! WC()->cart ) { return 0; }
		$vendors = array();
		foreach ( WC()->cart->get_cart() as $item ) {
			$product_id = isset( $item['product_id'] ) ? (int) $item['product_id'] : 0;
			if ( ! $product_id ) { continue; }
			if ( function_exists( 'wcfm_get_vendor_id_by_post' ) ) {
				$vendor = (int) wcfm_get_vendor_id_by_post( $product_id );
			} else {
				$vendor = (int) get_post_field( 'post_author', $product_id );
			}
			if ( $vendor ) { $vendors[ $vendor ] = true; }
		}
		return count( $vendors );
	}

	public static function filter_gateways( $gateways ) {
		if ( is_admin() || ! isset( $gateways['koda'] ) ) { return $gateways; }
		if ( self::cart_vendor_count() > 1 ) {
			unset( $gateways['koda'] );
			if ( function_exists( 'wc_add_notice' ) && function_exists( 'is_checkout' ) && is_checkout()
				&& ! wc_has_notice( self::mixed_notice(), 'notice' ) ) {
				wc_add_notice( self::mixed_notice(), 'notice' );
			}
		}
		return $gateways;
	}

	private static function mixed_notice() {
		return __( 'Mobile-money via KODA is available when your cart is from a single seller. Please check out one seller at a time to pay by mobile money.', 'koda-payments' );
	}

	/**
	 * @param int $order_id  WCFM sub-order id.
	 * @param int $vendor_id Vendor user id.
	 */
	public static function tag_suborder_vendor( $order_id, $vendor_id ) {
		$order = wc_get_order( $order_id );
		if ( ! $order ) { return; }
		$order->update_meta_data( '_koda_vendor_id', (int) $vendor_id );
		$order->save();
	}
}
