# KODA — Door 2 (WhatsApp Chat Mode) Setup Runbook

> **Door 2** lets a customer WhatsApp their mobile-money transaction code to your
> business number and get an instant ✅/❌ verification reply, in-thread.
>
> **The code is already built and live-ready.** There is nothing to write or deploy —
> Door 2 only needs credentials from your Meta account plus one webhook subscription.
> Until those are set, KODA runs Door 2 in **sandbox** (it computes the reply and logs
> it, but does not send a WhatsApp message).
>
> Endpoints: `GET /webhooks/whatsapp` (Meta handshake) · `POST /webhooks/whatsapp`
> (inbound messages). Source: `app/backend/routes.js` (§ "WhatsApp Cloud API webhook")
> and `app/backend/comms/meta.js`.

---

## 0. Who is who (read this first)

| Term | What it means | Whose number |
|---|---|---|
| **Phone Number ID** (`META_WA_PHONE_ID`) | The numeric ID Meta assigns to **your business sender number** — the number customers *send to*. **Not** the phone string (`+243…`); an ID like `109876543210987`. | **Your business / KODA sender** |
| **Customer number** | The payer messaging you. **Never configured** — it arrives at runtime as `msg.from` (their `wa_id`) and KODA replies to it automatically. | The customer |
| **App Secret** (`META_APP_SECRET`) | Proves an inbound webhook truly came from Meta (not a forger). | — |
| **Access token** (`META_WA_TOKEN`) | Lets KODA call the Graph API to send the reply. | — |
| **Verify token** (`META_WA_VERIFY_TOKEN`) | A string **you invent**, pasted in two places so Meta's handshake matches. | — |

> ⚠️ **Fail-closed rule.** The moment `META_WA_TOKEN` **and** `META_WA_PHONE_ID` are set,
> KODA treats Door 2 as *live* and **rejects every inbound call with `401` unless
> `META_APP_SECRET` is also set** (`comms/meta.js`, `verifySignature`). So set all three
> together. Token + phone ID **without** the app secret makes the door stop working, not
> start.

---

## 1. Prerequisites

1. A **Meta Business account** — <https://business.facebook.com>.
2. A **Meta App** with the **WhatsApp** product added — <https://developers.facebook.com>
   → *My Apps* → *Create App* → type **Business** → *Add Product* → **WhatsApp** → *Set up*.
3. Access to the **KODA server** to edit `/root/koda/app/.env` and redeploy.

---

## 2. Obtain each value

### 2.1 `META_WA_PHONE_ID` — Phone Number ID (your sender)
1. developers.facebook.com → your App → **WhatsApp → API Setup**.
2. Under **"Send and receive messages"**, the **"From"** dropdown shows your business
   number. Directly beneath it is **"Phone number ID"** — copy that number.
   - Meta gives you a **free test number** here to try the flow first.
   - To go live, click **"Add phone number"**, verify your real business number, then use
     *its* Phone Number ID.

### 2.2 `META_WA_TOKEN` — permanent System-User token
The token shown on the API Setup page is **temporary (24 h)** — good for a first test only.
For production, generate a **permanent** one:
1. **business.facebook.com → Business Settings → Users → System Users**.
2. **Add** → name it e.g. `koda-whatsapp` → role **Admin** → Create.
3. **Add Assets** → assign your **WhatsApp Account** *and* the **App**, with full control.
4. **Generate New Token** → select your App → set **Token expiration: Never** → tick scopes:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
5. **Generate** → copy the token (**shown once**). That's `META_WA_TOKEN`.

### 2.3 `META_APP_SECRET` — App secret
1. developers.facebook.com → your App → **App Settings → Basic**.
2. **App Secret** → **Show** → copy. That's `META_APP_SECRET`.

### 2.4 `META_WA_VERIFY_TOKEN` — you invent it
Not obtained anywhere — **make up a random string** (e.g. `koda-9f3k2p7q`). You will paste
the *same* string in your `.env` **and** in the Meta webhook config (step 4). If you skip
it, both sides default to `koda-verify` — works, but set your own.

### 2.5 `META_API_VERSION` — leave default
Optional. Defaults to `v20.0`. Only change if Meta deprecates that version.

---

## 3. Set the env vars on the server

SSH to the KODA host and edit `/root/koda/app/.env`:

```dotenv
# ── WHATSAPP (Meta Cloud API) — Door 2 + notifications ──────────
META_WA_TOKEN=EAAG...your-permanent-system-user-token
META_WA_PHONE_ID=109876543210987
META_API_VERSION=v20.0
META_WA_VERIFY_TOKEN=koda-9f3k2p7q
META_APP_SECRET=1a2b3c4d5e6f...your-app-secret
```

> Keep real values **only** in the server `.env` — never commit them to the repo.

Then redeploy so the process picks up the new env:

```bash
cd /root/koda && docker compose up -d --build
# (or restart however this host runs KODA)
```

---

## 4. Configure the webhook in Meta

developers.facebook.com → your App → **WhatsApp → Configuration → Webhook** → **Edit**:

| Field | Value |
|---|---|
| **Callback URL** | `https://kodajnn.com/webhooks/whatsapp` |
| **Verify token** | the exact `META_WA_VERIFY_TOKEN` from your `.env` |

Click **Verify and save**. Meta immediately calls `GET /webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…`; KODA echoes the challenge when the token matches (`routes.js`, GET handler). A green check means the handshake passed.

Then, under **Webhook fields**, **Subscribe** to **`messages`**. (This is what makes Meta POST inbound customer messages to KODA.)

---

## 5. Verify it works

### 5.1 Handshake (proves the URL + verify token line up)
From anywhere with internet (use your **real** verify token):

```bash
curl -s "https://kodajnn.com/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=koda-9f3k2p7q&hub.challenge=PING123"
# Expect the body to be exactly:  PING123
```

A `403 verify_token_mismatch` means the token in the URL ≠ `META_WA_VERIFY_TOKEN`.

### 5.2 Door status in KODA (admin)
As an admin, load **Admin → Integrations / channels** (`GET /app/admin/rails`, `doors[]`).
Door 2 should read:

- `status: "live"` and `note: "app secret set"` → **fully live**.
- `status: "sandbox"` → token/phone ID not set yet (replies are logged, not sent).
- `note: "app secret NOT set — inbound door CLOSED until set"` → token + phone ID are
  set but the app secret is missing; **fix by setting `META_APP_SECRET`** (see §0 fail-closed).

The same view exposes a `config` block: `meta_wa_token`, `meta_wa_phone_id`,
`meta_wa_app_secret` — each `true` when that env var is present.

### 5.3 Signed test POST (proves the door opens & rejects forgeries)
Signature = `sha256=` + HMAC-SHA256 of the **raw body** with `META_APP_SECRET`
(Meta's `X-Hub-Signature-256`). Run this **on the server**, where the secret lives:

```bash
SECRET="$(grep -E '^META_APP_SECRET=' /root/koda/app/.env | cut -d= -f2-)"
BODY='{"entry":[{"changes":[{"value":{"metadata":{"display_phone_number":"243999999999"},"messages":[{"type":"text","from":"243810000000","text":{"body":"code: OM.240115.TESTPING"}}]}}]}]}'
SIG="sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')"

# Correct signature → 200 {"received":true}
curl -s -X POST https://kodajnn.com/webhooks/whatsapp \
  -H "content-type: application/json" \
  -H "x-hub-signature-256: $SIG" \
  --data "$BODY" -w '\n[http %{http_code}]\n'

# Tampered/absent signature → 401 invalid_signature  (proves forgeries are refused)
curl -s -X POST https://kodajnn.com/webhooks/whatsapp \
  -H "content-type: application/json" \
  -H "x-hub-signature-256: sha256=deadbeef" \
  --data "$BODY" -w '\n[http %{http_code}]\n'
```

> The test reference `OM.240115.TESTPING` won't match a real payment, so KODA will reply
> with the "couldn't confirm / send your code" message — that's expected. The point of
> this step is that a **correctly signed** call returns `200` and a **bad** one returns
> `401`. In sandbox (no app secret) the signed test isn't meaningful because the door is
> fail-closed on `META_WA_TOKEN`+`META_WA_PHONE_ID`.

### 5.4 Real end-to-end (the actual customer path)
From a normal phone, WhatsApp your **business number** with a real transaction code
(e.g. the code from a mobile-money confirmation for a payment the merchant expects).
Expected reply in-thread:

- ✅ `Paiement confirmé — <amount> <currency>. Merci !`
- ⏳ payment on its way (network hasn't shown it yet)
- ⚠️ code already used
- ❌ couldn't confirm (check code / amount / receiving number)

---

## 6. How Door 2 works (reference)

1. Customer sends a WhatsApp message to your business number.
2. Meta POSTs it to `POST /webhooks/whatsapp`, signed with your App Secret.
3. KODA verifies `X-Hub-Signature-256` (HMAC-SHA256 of the raw body). Bad/missing → `401`.
4. KODA extracts a **reference code** from the text — first token matching
   `[A-Z0-9][A-Z0-9.\-]{6,}` that contains a digit (case-insensitive).
   - No code found → KODA asks the customer to send their transaction code.
5. **Merchant routing (multi-tenant — one KODA number, many merchants).** KODA resolves
   which merchant the payment belongs to, in order:
   1. **Dedicated number** — a merchant running their *own* WhatsApp number: the inbound
      `display_phone_number` matches that merchant's registered `msisdn`.
   2. **Shared KODA number** — otherwise KODA routes by the **transaction code itself**.
      A mobile-money code lands in exactly one merchant's `sms_ledger` (the merchant whose
      device forwarded that confirmation SMS), so the code names the merchant
      (`engine.merchantForReference`).
   - If the code matches no merchant's ledger yet → KODA replies "payment on its way" and
     routes to **nobody** (no cross-posting to a fallback merchant).
6. KODA runs `engine.verify(merchant, null, ref, { mode: 'chat' })` and replies in-thread
   (via `meta.sendText`) with the ✅/⏳/⚠️/❌ result. Every reply is written to
   `comm_deliveries` (`provider: meta` when live, `sandbox` when not).

> **This is why one KODA WhatsApp number serves every merchant.** Customers of all
> merchants message the same number; the transaction code disambiguates. You do **not**
> need a separate number per merchant (though a merchant *may* bring their own — case 5.1).

**Language:** replies are French by default, English when the merchant's `language` is `en`.

**Business-initiated messages** (digests, alerts, receipts) are a *separate* concern from
Door 2. Those need **pre-approved WhatsApp templates** (names mapped in
`comms/meta.js → EVENT_TEMPLATES`, e.g. `koda_payment_verified`). **Chat-Mode replies do
NOT need templates** — they are free-form text allowed inside WhatsApp's 24-hour
customer-service window, so you can verify payments over chat before any template is
approved.

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Webhook "Verify and save" fails in Meta | Verify token mismatch, or URL not reachable over HTTPS | Ensure `META_WA_VERIFY_TOKEN` matches exactly; confirm `https://kodajnn.com/webhooks/whatsapp` is public |
| Every inbound POST returns `401` | `META_APP_SECRET` missing while token + phone ID are set (fail-closed) | Set `META_APP_SECRET`, redeploy |
| Handshake works but no replies sent | Not subscribed to the `messages` field, or still sandbox | Subscribe to `messages`; confirm Door 2 `status: live` in `/app/admin/rails` |
| Reply computed but customer gets nothing | `META_WA_TOKEN` invalid/expired, or wrong `META_WA_PHONE_ID` | Regenerate a **permanent** system-user token; recheck the Phone Number ID |
| `graph_http_401` / `graph_http_190` in logs | Access token expired or lacks scopes | Regenerate with `whatsapp_business_messaging` + `whatsapp_business_management`, expiry **Never** |
| Customer always told "payment on its way", never confirmed | The transaction code isn't in any merchant's `sms_ledger` — the merchant's device/SMS forwarding isn't reaching KODA | Confirm the merchant's SMS/device is registered and forwarding confirmations to KODA |
| A merchant wants their own dedicated number instead of the shared one | Optional | Add that number under the WABA and set the merchant's registered `msisdn` to it — routing case 5.1 takes over automatically |

---

## 8. Checklist

- [ ] Meta App created with **WhatsApp** product
- [ ] `META_WA_PHONE_ID` copied (business sender, not customer)
- [ ] `META_WA_TOKEN` = permanent System-User token (scopes + never-expire)
- [ ] `META_APP_SECRET` copied from App Settings → Basic
- [ ] `META_WA_VERIFY_TOKEN` invented and put in `.env`
- [ ] All vars in `/root/koda/app/.env`, KODA redeployed
- [ ] Webhook Callback URL + Verify token set in Meta, **Verify and save** green
- [ ] Subscribed to the **`messages`** field
- [ ] §5.1 handshake returns the challenge
- [ ] `/app/admin/rails` shows Door 2 **live / app secret set**
- [ ] §5.4 real message returns a ✅/❌ reply in WhatsApp
