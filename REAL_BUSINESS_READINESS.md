# KODA — Admin access & "ready for a real business" checklist

You are **live** at https://kodajnn.com. This is what to do next and exactly
what stands between today's working demo and a real business verifying **real**
money.

---

## 1. Get admin access

There are **two kinds of login**, don't mix them up:

| Who | Logs in with | Sees |
|---|---|---|
| **You (KODA operator / admin)** | `koda@kodajnn.com` + your `KODA_ADMIN_PASSWORD` | The **admin control centre** — every merchant, the Sentinel fleet, parse health, platform stats |
| **A merchant (a business)** | their own signup email/password | Their **own till** — verifications, receipts, devices, billing, growth tools |

**To log in as admin:** open **https://kodajnn.com/app** → sign in with
`koda@kodajnn.com` and the admin password you set in `.env`.

Forgot the password? On the VPS:
```bash
grep ADMIN ~/koda/app/.env         # shows KODA_ADMIN_EMAIL / KODA_ADMIN_PASSWORD
```
To change it: edit `~/koda/app/.env`, then `docker compose up -d`.

> **Note:** in production there are **no demo merchants** — only your admin
> account exists. To test "as a business" you create a merchant by signing up
> (see the test plan below).

---

## 2. What already works today (sandbox — test now)

- ✅ Public site, all dashboards (owner, manager, cashier, admin, platform)
- ✅ Full **checkout → verify → receipt → webhook** cycle via the sandbox door
  (`TEST-OK-25000`, `TEST-LATE-90`, `TEST-REPLAY`, `TEST-SUFFIX`)
- ✅ Fraud engine (matching, replay-block, balance-chain, quarantine)
- ✅ All 10 AI Growth tools + agents — **live on your real AI keys**
- ✅ Ops endpoints: `/healthz`, `/readyz`, `/version`
- ✅ HTTPS, auto-renewing cert, containers auto-restart on reboot

**This proves the software.** It does **not** yet verify a real stranger's real
payment — that needs the items below.

---

## 3. What's left for a REAL business — prioritised

### 🔴 P0 — turns sandbox into real money (do these first)
1. **Build & install the Sentinel app.** `sentinel/` is a ready Android project
   (P0). Open it in Android Studio → build the APK → install on the phone that
   holds the merchant's mobile-money SIM. Without this, **no real SMS enters the
   ledger**, so only sandbox codes verify. This is THE gap.
2. **Validate the parser against a REAL SMS.** Send yourself a real payment on
   your actual operator (Orange/M-Pesa/Airtel in your country) and confirm KODA
   parses that exact wording correctly. Real operator formats vary — if a field
   is off, the parser pack needs a small tweak. Test this with one real payment
   before onboarding anyone.

### 🟠 P1 — expected by a real business
3. **Email receipts (Brevo, or your existing mailserver).** Right now emails only
   log. You already run `docker-mailserver` on this VPS — we can point KODA's
   email through it via SMTP instead of paying for Brevo. A business expects a
   receipt email.
4. **WhatsApp door (Meta).** In your corridor, businesses live on WhatsApp.
   `SETUP_META_WHATSAPP.md` — ~30 min of dashboard clicks; the code is already
   built and tested.
5. **A way for merchants to pay you (ACU top-ups).** Can start **manual**: they
   send mobile-money/bank transfer to you, you credit their ACU in the admin.
   Add a card/mobile-money gateway later only if you want self-serve top-ups.

### 🟡 P2 — operational hygiene (before real volume)
6. **Rotate the keys** you pasted in chat (OpenAI/Anthropic/Gemini, JWT, admin pw).
7. **Backups** — set the `VACUUM INTO` cron + Hostinger daily snapshots.
8. **Cloudflare** in front for a fast global frontend (Step 7 in `DEPLOY_HOSTINGER.md`).
9. **Reboot the VPS once** to clear the "restart required" nag and confirm KODA
   auto-starts (it will — `restart: unless-stopped`).

---

## 4. The real end-to-end test (the one that proves the business)

Do this once the Sentinel app is installed on a phone with a real SIM:

1. **Sign up a merchant** at https://kodajnn.com/app (act as the business, or a
   pilot shop). Log in to its dashboard.
2. **Enroll a device:** Dashboard → Devices → Enroll → shows a QR + `dvk_` token.
3. **Pair Sentinel:** open the app on the merchant phone → scan the QR → grant
   SMS + notification permission.
4. **Take a real payment:** have someone pay a small amount to that phone's
   mobile-money number.
5. The operator SMS lands → Sentinel forwards it → it appears in the merchant's
   KODA ledger (Devices/Feed shows it).
6. **Verify it:** the customer enters the code in the checkout page (or WhatsApp,
   or the merchant types it in the Console) → **VERIFIED** → receipt → webhook.
7. **Confirm the money is in the merchant's own mobile-money account** (KODA never
   touched it — it only verified).

If that loop works with real money, **you have a real product** and can onboard
pilot merchants.

---

## 5. Definition of "ready for a real business"

- [ ] Sentinel APK built and installed on a real merchant phone
- [ ] One **real** operator SMS parsed + verified end-to-end
- [ ] Email receipts sending (mailserver or Brevo)
- [ ] A merchant can sign up, enroll a device, and self-serve
- [ ] Manual ACU top-up process agreed (how they pay you)
- [ ] Keys rotated, backups on, VPS reboot-tested

Everything above P0 is already done. **P0 (Sentinel + one real SMS) is the whole
difference between "great demo" and "real business."**
