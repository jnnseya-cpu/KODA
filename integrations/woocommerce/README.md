# KODA — Door 3 (API) integrations

Door 3 is plain HTTPS. It works in **any** website or app — WooCommerce, Flutter,
native Android/iOS, Node, PHP/Laravel, Python. This folder holds the official
drop-ins and copy-paste snippets.

The flow is always the same three steps:

1. **Create an intent** (server-side, secret key) → get back a `checkout_url`.
2. **Send the customer to `checkout_url`** — they pay by mobile money and submit
   their transaction code; KODA verifies it against the operator SMS.
3. **Receive the signed `payment.verified` webhook** → fulfil the order.

Base URL: `https://kodajnn.com/v1` · Auth: `Authorization: Bearer sk_live_…`
(use an `sk_test_` key for sandbox). Full reference: https://kodajnn.com/api-reference

---

## 1. WooCommerce plugin (`koda-payments/`)

A complete WooCommerce payment gateway — no code required for the store owner.

**Install & publish**

- Zip the folder for distribution:
  ```bash
  cd integrations/woocommerce && zip -r koda-payments.zip koda-payments
  ```
- Store owner: **Plugins → Add New → Upload Plugin** → activate.
- Configure: **WooCommerce → Settings → Payments → KODA (Mobile Money)** — paste
  the API key and the webhook signing secret (webhook URL:
  `https://STORE/wp-json/koda/v1/webhook`).
- To publish on WordPress.org: submit `koda-payments/` to the plugin directory
  (SVN); `readme.txt` is already in the required format. For a private/managed
  rollout, distribute the ZIP directly.

**How it verifies** — the webhook receiver checks
`x-koda-signature == HMAC-SHA256(raw_body, webhook_secret)` and is idempotent
(`$order->is_paid()` guard), so a replayed webhook never double-completes an order.

---

## 2. Flutter / Dart

Create the intent from **your backend** (never ship a secret key in the app),
return the `checkout_url`, and open it in a WebView:

```dart
// backend returns { "checkout_url": "https://kodajnn.com/pay/int_…?cs=…" }
final res = await http.post(
  Uri.parse('https://your-backend.com/create-koda-intent'),
  headers: {'Content-Type': 'application/json'},
  body: jsonEncode({'amount': 25000, 'currency': 'CDF', 'orderId': 'CMD-1042'}),
);
final checkoutUrl = jsonDecode(res.body)['checkout_url'];

// open the hosted checkout
Navigator.push(context, MaterialPageRoute(builder: (_) =>
  WebViewScreen(url: checkoutUrl)));   // package:webview_flutter
```

Your backend does the actual intent call and later receives the webhook to mark
the order paid.

---

## 3. Native Android / iOS

Same pattern — the **backend** creates the intent; the app opens `checkout_url`:

- **Android**: Chrome Custom Tab → `CustomTabsIntent.Builder().build().launchUrl(ctx, Uri.parse(url))`
- **iOS**: `SFSafariViewController(url: URL(string: url)!)`

Fulfilment is driven by the webhook to your backend, not by the app.

---

## 4. Node / PHP — the two calls that matter

**Create the intent (Node):**

```js
const r = await fetch('https://kodajnn.com/v1/intents', {
  method: 'POST',
  headers: { authorization: `Bearer ${process.env.KODA_KEY}`, 'content-type': 'application/json' },
  body: JSON.stringify({ amount: 25000, currency: 'CDF',
    operators: ['orange_cd','mpesa_cd'], metadata: { order_id: 'CMD-1042' },
    success_url: 'https://shop/thanks' }),
});
const { checkout_url } = await r.json();   // redirect the customer here
```

**Verify the webhook (PHP):**

```php
$raw = file_get_contents('php://input');
$expected = hash_hmac('sha256', $raw, $KODA_WEBHOOK_SECRET);
if (!hash_equals($expected, $_SERVER['HTTP_X_KODA_SIGNATURE'] ?? '')) { http_response_code(401); exit; }
$e = json_decode($raw, true);
if ($e['event'] === 'payment.verified') { fulfil_order($e['metadata']['order_id']); }
http_response_code(200);
```

---

## Webhook contract

- Header: `x-koda-signature: <hex HMAC-SHA256 of the raw request body>`
- Secret: the per-endpoint signing secret shown when you add the webhook in KODA.
- Body (`payment.verified`):
  ```json
  {
    "event": "payment.verified",
    "intent_id": "int_…", "receipt_id": "rcp_…",
    "amount": 25000, "currency": "CDF", "operator": "orange_cd",
    "reference": "OM.260806.1432.A88213",
    "metadata": { "order_id": "CMD-1042" },
    "created_at": "2026-08-06T11:00:00.000Z"
  }
  ```
- Always **verify the signature** and treat delivery as **at-least-once** (idempotent fulfilment).
