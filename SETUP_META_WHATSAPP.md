# KODA — Set up the WhatsApp door (Door 2 · Chat Mode)

The code is **done and tested**: KODA verifies Meta's handshake, checks every
webhook's signature, reads inbound messages, extracts the transaction code, runs
it through the verify engine, and replies in-thread. This guide is the **Meta
dashboard side** — the clicks that connect your WhatsApp number to KODA.

**What it gives you:** a customer (or you) sends the payment code to your WhatsApp
Business number → KODA replies "✅ Paiement confirmé" (or the right error) — no app,
no website needed.

> Prerequisites: a Facebook account, a phone number for WhatsApp Business (one
> that is **not** already on a personal/normal WhatsApp), and KODA already live at
> `https://kodajnn.com`.

---

## Endpoints KODA exposes (already running)

| Method | URL | Purpose |
|---|---|---|
| GET | `https://kodajnn.com/webhooks/whatsapp` | Meta verification handshake |
| POST | `https://kodajnn.com/webhooks/whatsapp` | Inbound messages (signature-checked) |

---

## Step 1 — Create a Meta app
1. Go to **developers.facebook.com** → **My Apps** → **Create App**.
2. Use case: **Other** → type: **Business**.
3. Name it (e.g. "KODA"), pick your Business portfolio, create.

## Step 2 — Add the WhatsApp product
1. In the app dashboard → **Add product** → **WhatsApp** → **Set up**.
2. It creates a **test number** automatically (fine for testing). Note the
   **Phone number ID** and the **temporary access token** on this screen.

## Step 3 — Put the first three secrets into KODA
On the VPS, edit `koda/app/.env` and set:
```
META_WA_PHONE_ID=<the Phone number ID from Step 2>
META_WA_TOKEN=<the access token from Step 2>
META_WA_VERIFY_TOKEN=koda-verify        # any word you choose; must match Step 4
```
Then reload: `cd /root/koda/app && docker compose up -d`.

## Step 4 — Connect the webhook
1. App dashboard → **WhatsApp → Configuration → Webhook** → **Edit**.
2. **Callback URL:** `https://kodajnn.com/webhooks/whatsapp`
3. **Verify token:** `koda-verify` (exactly what you put in `.env`).
4. Click **Verify and save** — Meta calls the GET endpoint; it should go green.
5. Under **Webhook fields**, **Subscribe** to **messages**.

## Step 5 — Turn on signature verification (security)
1. App dashboard → **App settings → Basic** → copy the **App secret**.
2. On the VPS, add to `.env`:
   ```
   META_APP_SECRET=<the App secret>
   ```
   `docker compose up -d` again. Now KODA rejects any forged/unsigned webhook
   call with 401 — only genuinely Meta-signed messages are processed.

## Step 6 — Test it
- From your personal WhatsApp, message the Business/test number a payment code
  (e.g. a code that's in your ledger). KODA replies with the verdict.
- With **no code**, it replies asking for one (FR/EN by merchant language).

## Step 7 — Go from test number to your real number (production)
1. **WhatsApp → API Setup → Add phone number** → register your business number
   (SMS/voice verification).
2. Create a **permanent token**: **Business Settings → Users → System users** →
   add a system user (Admin) → **Generate token** → app = your app, scopes =
   `whatsapp_business_messaging`, `whatsapp_business_management`. Put this
   permanent token in `META_WA_TOKEN` (replace the temporary one).
3. Submit the app for **App Review** for those two permissions (required to
   message people who haven't messaged you first).

## Step 8 — Message templates (for business-initiated messages)
Replies inside 24 h of a customer message are free text (already handled). To
*start* a conversation (receipts, digests, alerts), Meta requires pre-approved
templates. In **WhatsApp Manager → Message templates**, create these names (KODA
already maps events to them):

| Template name | Used for |
|---|---|
| `koda_payment_verified` | payment confirmed / confirmed-late |
| `koda_topup_verified` | ACU top-up confirmed |
| `koda_low_balance` | low ACU balance |
| `koda_sentinel_offline` | a merchant device went offline |
| `koda_security_alert` | fraud / chain-break alert |
| `koda_daily_digest` | daily summary |

---

## Env vars summary

| Var | From | Required |
|---|---|---|
| `META_WA_PHONE_ID` | WhatsApp product screen | to send/receive |
| `META_WA_TOKEN` | temporary (test) → permanent system-user token (prod) | to send |
| `META_WA_VERIFY_TOKEN` | you choose; matches the webhook config | to connect webhook |
| `META_APP_SECRET` | App settings → Basic | **production** (rejects forgeries) |
| `META_API_VERSION` | default `v20.0` | optional |

**Without these**, the door stays in sandbox — KODA still boots and every other
channel works; only real WhatsApp send/receive is inert.
