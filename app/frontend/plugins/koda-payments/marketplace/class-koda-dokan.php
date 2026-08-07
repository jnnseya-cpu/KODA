<?php
/**
 * KODA ↔ Dokan multivendor adapter.
 *
 * KODA's verification model is "one intent → one merchant account": a payment
 * intent is settled against exactly one KODA merchant's mobile-money line, because
 * that is whose operator SMS confirms the cash. A multivendor cart that spans two
 * sellers cannot be verified as a single KODA intent without silently crediting the
 * wrong merchant. This adapter enforces that rule for Dokan:
 *
 *   • Single-vendor cart  → KODA is offered normally. The order is tagged with the
 *     vendor so KODA's per-installation credentials (if the vendor connected their
 *     own KODA account) are used.
 *   • Mixed-vendor cart   → KODA is withdrawn as a payment option, with a clear
 *     notice, so no ambiguous intent is ever created.
 *
 * When Dokan sub-orders are created (one per vendor at split time), each sub-order
 * carries its own KODA intent id, so verification and reconciliation remain 1:1.
 *
 * Additive and self-contained: if Dokan is not active, nothing here runs.
 *
 * @package koda-payments
 */

if ( ! defined( 'ABSPATH' ) ) { exit; }

class KODA_Dokan_Adapter {

	public static function init() {
		// only wire up when Dokan is present
		add_action( 'plugins_loaded', array( __CLASS__, 'maybe_hook' ), 20 );
	}

	public static function maybe_hook() {
		if ( ! self::dokan_active() ) { return; }

		// Withdraw KODA from mixed-vendor carts (classic + blocks both read available_gateways).
		add_filter( 'woocommerce_available_payment_gateways', array( __CLASS__, 'filter_gateways' ) );
		// Tag each Dokan sub-order with its vendor so downstream logic stays 1:1.
		add_action( 'dokan_checkout_update_order_meta', array( __CLASS__, 'tag_suborder_vendor' ), 10, 2 );
	}

	public static function dokan_active() {
		return function_exists( 'dokan' ) || class_exists( 'WeDevs_Dokan' );
	}

	/**
	 * Count the distinct vendors represented in the current cart.
	 */
	public static function cart_vendor_count() {
		if ( ! function_exists( 'WC' ) || ! WC()->cart ) { return 0; }
		$vendors = array();
		foreach ( WC()->cart->get_cart() as $item ) {
			$product_id = isset( $item['product_id'] ) ? (int) $item['product_id'] : 0;
			if ( ! $product_id ) { continue; }
			$author = (int) get_post_field( 'post_author', $product_id );
			if ( $author ) { $vendors[ $author ] = true; }
		}
		return count( $vendors );
	}

	/**
	 * Remove KODA from the offered gateways when the cart mixes vendors.
	 */
	public static function filter_gateways( $gateways ) {
		if ( is_admin() || ! isset( $gateways['koda'] ) ) { return $gateways; }
		if ( self::cart_vendor_count() > 1 ) {
			unset( $gateways['koda'] );
			// surface why, once, on the checkout
			if ( function_exists( 'wc_add_notice' ) && ! wc_has_notice( self::mixed_notice(), 'notice' ) ) {
				// Only add on the checkout page to avoid noise elsewhere.
				if ( function_exists( 'is_checkout' ) && is_checkout() ) {
					wc_add_notice( self::mixed_notice(), 'notice' );
				}
			}
		}
		return $gateways;
	}

	private static function mixed_notice() {
		return __( 'Mobile-money via KODA is available when your cart is from a single seller. Please check out one seller at a time to pay by mobile money.', 'koda-payments' );
	}

	/**
	 * Record the vendor id on each Dokan sub-order. KODA intents are then created
	 * per sub-order in process_payment(), keeping one intent → one merchant.
	 *
	 * @param int $order_id  Dokan sub-order id.
	 * @param int $seller_id Vendor user id.
	 */
	public static function tag_suborder_vendor( $order_id, $seller_id ) {
		$order = wc_get_order( $order_id );
		if ( ! $order ) { return; }
		$order->update_meta_data( '_koda_vendor_id', (int) $seller_id );
		$order->save();
	}
}
