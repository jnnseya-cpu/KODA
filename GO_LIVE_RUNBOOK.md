# KODA — Go-Live Runbook (real business)

Everything below runs on the VPS as `root`, repo at `/root/koda`, app at
`/root/koda/app`. `dc()` = `docker compose -f /root/koda/app/docker-compose.yml`.

---

## 1. Remove all demo/dummy data + become the real admin

**a. Make production permanent** so demo data never re-seeds. In `/root/koda/app/.env`:
```
NODE_ENV=production
KODA_ADMIN_EMAIL=koda@kodajnn.com
KODA_ADMIN_PASSWORD=<a strong password>
```
(With `NODE_ENV=production`, `seed.js` skips ALL demo/portfolio accounts and instead
bootstraps a single admin from those two env vars.)

**b. Purge the demo data already in the live DB** (it was seeded on the first deploy):
```bash
cd /root/koda/app
dc() { docker compose -f /root/koda/app/docker-compose.yml "$@"; }
dc exec -T koda node backend/tools/purge-demo.js            # DRY RUN — shows what it will delete
dc exec -T koda node backend/tools/purge-demo.js --commit   # actually delete
```
This removes every `@koda.africa` seed account (Maison Kivu, Tunakula, the platform +
sub-merchants, the demo distributor & reseller) and all their data. **Real merchants are
never touched.**

**c. Create your full admin** (if you didn't set the env bootstrap, or to add more):
```bash
dc exec -T koda node backend/tools/make-admin.js koda@kodajnn.com 'YourStrongPassword'
```
Then rebuild so the env + clean state take effect:
```bash
export KODA_BUILD_SHA=$(git -C /root/koda rev-parse --short HEAD); export KODA_BUILD_DATE=$(date -u +%FT%TZ)
dc up -d --build
```
Sign in at **https://kodajnn.com/app** → the admin console is at `#admin` (full access:
merchants, receipts, suspensions, fraud, config).

---

## 2. Automatic email (you already run a mailserver on the box)

You have a `mailserver` container. Create a sending mailbox (e.g. `no-reply@kodajnn.com`)
in it, then in `/root/koda/app/.env`:
```
KODA_COMMS_LIVE=1
KODA_SMTP_HOST=mailserver          # the container/host name reachable from the koda container
KODA_SMTP_PORT=465                 # implicit TLS
KODA_SMTP_USER=no-reply@kodajnn.com
KODA_SMTP_PASS=<mailbox password>
KODA_SMTP_FROM=KODA <no-reply@kodajnn.com>
```
`dc up -d --build`, then verify: sign up a test merchant → the welcome email sends.
Until these are set, email stays in safe sandbox (logged, not sent). WhatsApp/SMS/push
have the same pattern (`META_*`, `KODA_SMS_URL`, `FCM_KEY`).
> Networking note: the koda container must reach the mailserver — put both on the same
> docker network, or use `KODA_SMTP_HOST=host.docker.internal` / the server's LAN IP.

---

## 3. The doors — how each goes live + how to test

KODA is **one engine behind five doors**. Three are the headline "core doors"; two more
serve feature phones and low/no-internet. **Every door writes to the same ledger and uses
the same deterministic verification** — the difference is only *how the code reaches KODA*.

| Door | For | Live requires | Test now? |
|---|---|---|---|
| **1 · Manual (Verify Console)** | merchants verifying by hand | just an account + payments on the SIM (Sentinel, or sandbox) | ✅ yes |
| **2 · WhatsApp Chat** | sellers in the chat | Meta WhatsApp Cloud setup | after Meta keys |
| **3 · API** | developers / platforms | an API key | ✅ yes (sandbox) |
| **4 · USSD** | feature phones | a USSD gateway/shortcode (aggregator) | endpoint ready |
| **5 · Inbound SMS** | feature phones / no data | an SMS long-code (aggregator) | endpoint ready |

### Door 3 — API (test it right now)
```bash
# 1. In the app (Developers → Create API key) make an sk_test key, then:
KEY=sk_test_xxx
BASE=https://kodajnn.com/v1
# 2. create an intent
curl -s -X POST $BASE/intents -H "Authorization: Bearer $KEY" -H 'content-type: application/json' \
  -d '{"amount":25000,"currency":"CDF","operators":["orange_cd"],"metadata":{"order_id":"TEST-1"}}'
# → returns intent_id + client_secret + checkout_url
# 3. verify with a sandbox magic reference (no real payment needed)
curl -s -X POST $BASE/intents/<intent_id>/verify -H "Authorization: Bearer $KEY" -H 'content-type: application/json' \
  -d '{"reference":"TEST-OK-25000"}'
# → {"status":"verified", ...}  and a signed payment.verified webhook fires to your endpoint
```
Sandbox magic refs: `TEST-OK-25000` (instant), `TEST-LATE-90` (verifies late),
`TEST-REPLAY` (already-used), `TEST-SUFFIX` (challenge). Go live by switching the key to
`sk_live_` and letting real Sentinel SMS fill the ledger.

### Door 1 — Manual (test it right now)
Sign in → **Verify** → paste a code. With no Sentinel yet, use the sandbox: **Live Feed →
inject** a sample operator SMS (or `POST /app/sandbox/sms`), then paste its reference in the
Console → green verdict in ~3s. **Go live:** install Sentinel on the SIM phone (§5) so real
confirmation SMS fill the feed automatically.

### Door 2 — WhatsApp
Follow `SETUP_META_WHATSAPP.md` (~30 min of Meta clicks): create a Meta app, a WhatsApp
number, set `META_WA_TOKEN`, `META_PHONE_ID`, `META_APP_SECRET`, `META_VERIFY_TOKEN` in
`.env`, point the Meta webhook at `https://kodajnn.com/webhooks/whatsapp`. Test: message the
number a code → KODA replies "✅ Paiement confirmé" in-thread. (The handshake + signature
verification are already coded and tested.)

### Doors 4 & 5 — USSD + inbound SMS (the answer to "what about USSD")
The marketing says "three doors" because those are the merchant-facing product tiers.
**USSD and inbound-SMS are two additional doors for feature-phone / no-internet users** —
the endpoints (`/webhooks/ussd`, `/webhooks/sms`) are built and tested. They go live when
you contract a **USSD shortcode / SMS long-code from an aggregator** (Africa's Talking,
Infobip-class) and point it at those webhooks. Until then, Manual + Sentinel already cover
feature-phone merchants over the counter.

---

## 4. Verify the whole thing is clean + working
```bash
dc exec -T koda node backend/tools/purge-demo.js          # should now show 0 demo rows
curl -s https://kodajnn.com/readyz                         # {"ok":true,"db":"up"}
curl -s https://kodajnn.com/v1/openapi.json | head -c 120  # servers: kodajnn.com/v1
```

---

## 5. Sentinel → Google Play (publish from your Play account)

The app (`sentinel/`) is built through P3. To publish:

1. **Build machine** (your laptop with Android Studio, or a CI runner) — this is the one
   thing that needs the Android SDK. Open `sentinel/`, let Gradle sync.
2. **App signing:** create an upload keystore (`keytool`), add a `release` signingConfig in
   `sentinel/app/build.gradle.kts`, build an **AAB**: `./gradlew bundleRelease`.
3. **Package + version:** id `africa.koda.sentinel`, bump `versionCode`/`versionName` per release.
4. **Play Console:** create the app, upload the AAB to internal testing first.
5. **Data safety + permissions (critical — SMS):** Google restricts `RECEIVE_SMS`/`READ_SMS`.
   Declare the **core use case = "transaction/payment confirmation for the merchant's own
   account"**, link the **privacy policy** (`https://kodajnn.com/privacy`), and state that
   only operator payment SMS are read (never personal messages — enforced in `OperatorFilter`).
   You may need the **Permissions Declaration form**; be precise and truthful.
6. **Play Integrity:** set `IntegrityGate.CLOUD_PROJECT_NUMBER` to your Play project number
   to enable device attestation (optional; works without it).
7. Roll internal → closed → production once tested on a real SIM phone.

*Fastest path to real money: side-load a signed APK on ONE merchant's SIM phone today
(`./gradlew assembleRelease`), close the loop end-to-end, then do the Play listing.*

---

## Order of operations (recommended)
1. §1 purge + admin + `NODE_ENV=production` → **you own a clean live system.**
2. §3 Door 3 (API) + Door 1 (Manual) sandbox tests → **prove the engine end-to-end.**
3. §5 side-load Sentinel on one SIM phone → **first real verified payment.**
4. §2 email, §3 Door 2 (WhatsApp), Doors 4/5 (aggregator) → **turn on the rest.**
5. Play Store listing → **scale distribution.**
