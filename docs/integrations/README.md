# KODA Web Integration specs

Design-of-record for how external platforms integrate with KODA. These specs are
the target; the **Harmonisation map** below tracks what exists in KODA today vs.
what each spec still needs, so we build additively without duplicating.

## Specs
- `WOOCOMMERCE_GATEWAY.md` — full WooCommerce gateway plugin spec (thin plugin + KODA Cloud).
- (planned) `WEB_INTEGRATION.md` — universal layer: plain PHP recipe, drop-in widget
  (`detect:true`), mobile apps, and the operator Detection Cascade.

## The core equation (shared by every surface)
```
Payable operators =
    merchant's enrolled & ONLINE Sentinel accounts
  ∩ operators live in the customer's country
  ranked by the customer's own network (MSISDN prefix → operator, "votre réseau" badge)
```
Detection degrades safely: prefix → billing country → IP geo → locale → country dropdown.
Detection failure NEVER blocks checkout. Cross-border (e.g. FR IP on a DRC store) is a
first-class diaspora flow, not an error.

## Non-negotiable server-of-record rule
Fulfilment triggers ONLY on an HMAC-verified webhook or a server-side status check.
Client events (redirects, polling, "I have paid") are display sugar — never proof.

## Harmonisation map — spec ↔ KODA today
| Spec concept | KODA today | Action |
|---|---|---|
| `POST /v1/payment-methods/resolve` | `/v1/merchants/me/payment-methods`, `/v1/merchant-network-accounts` | ADD a `resolve` endpoint that composes existing data + Sentinel health + country/amount filter |
| OAuth merchant auth | `sk_`/`pk_` API keys | ADD OAuth-style install flow later; ship key-based `manual secret` mode first (spec's enterprise fallback) |
| `POST /v1/payment-intents` | `POST /v1/intents` (+ auto-verify Door 3) | MAP: reuse `/v1/intents`; extend shape (branch, merchant_account_token, external_order) |
| `customer-claim` | checkout `/verify` (idempotent) | MAP to existing checkout verify |
| Signed `payment_intent.verified` | `payment.verified` webhook (HMAC) | ALIGN event names; ADD `payment.reversed` |
| MSISDN-prefix → operator | operator registry (235 ops, no prefixes) | ADD a dial-prefix column to the registry to power detection |
| Installations table | — | ADD if/when OAuth install flow is built |

## Install-scoped credentials (built — the spec's #1 security rule)
No master secret pasted into a plugin. From the KODA dashboard, `POST /app/integrations`
provisions an **installation** with its own **scoped restricted key** (`rk_live_…`,
scopes `write:intents, read:receipts, read:usage`) + a **webhook endpoint secret**
(shown once), both **revocable in one call** (`DELETE /app/integrations/:id` kills the
key and deactivates the webhook). `GET /app/integrations` lists them. Verified
end-to-end: scoped key creates intents, is denied out-of-scope calls (403), and is
rejected the instant the install is revoked. The manual `sk_`-key paste remains as the
spec's enterprise fallback.

**Genuinely still deferred (need a real WordPress + marketplace plugins to build/test):**
the browser OAuth-redirect UI inside the plugin, and Dokan/WCFM marketplace adapters.

## Build order (from the specs' own phasing)
1. **Detection + resolve** — the shared foundation (`/v1/payment-methods/resolve` +
   prefix→operator dataset). Unblocks widget, plain-PHP, WooCommerce and apps at once.
2. **Evolve the existing plugin** (`app/frontend/plugins/koda-payments`) to the spec's
   gateway/Blocks/HPOS/webhook/`payment_complete()` structure.
3. **Order state machine + reconciler cron + reversal handling.**
4. **OAuth install flow** (replace manual key mode).
5. Shopify app, Laravel package, marketplace (Dokan/WCFM).
