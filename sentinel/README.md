# KODA Sentinel — Android app (P0 walking skeleton)

The phone-edge of KODA. A **merchant** installs this on **their own phone** (the one
holding their mobile-money SIM). It reads the operator payment-confirmation SMS and
forwards them to KODA's live ledger, where any door (checkout, WhatsApp, console)
can verify them. **KODA holds no SIMs and never touches the money.**

See `../SENTINEL_APP_SPEC.md` for the full spec and roadmap. This is **P0**:
scan-to-pair → read operator SMS → forward → foreground service.

## What it does
1. **Pair** — scan the QR from KODA (Dashboard → Devices → Enroll), or paste the
   `dvk_…` token. The token is validated against `POST /v1/device/sms` and stored
   in the Android Keystore.
2. **Listen** — a `BroadcastReceiver` catches every incoming SMS; only messages
   from known operators (Orange, M-Pesa, Airtel, Africell, MTN, Wave) are kept.
3. **Forward** — a foreground `Service` POSTs each one to
   `POST {server}/v1/device/sms` with `Authorization: Bearer dvk_…`.

## Build & run
1. Install **Android Studio** (Hedgehog+), open the `sentinel/` folder.
2. Let Gradle sync (it downloads the Android SDK + deps automatically).
   - CLI alternative: `gradle wrapper` then `./gradlew assembleDebug`.
3. Connect an Android phone (USB debugging on) → **Run**.
4. In the app: set the server (default `https://kodajnn.com`), tap **Scan pairing
   QR**, grant SMS + notification permissions.
5. Send a test operator-style SMS to the phone → it appears in **Recent forwards**
   and lands in the merchant's KODA ledger.

> Emulator note: emulators can't receive real carrier SMS. Use a real phone with
> the mobile-money SIM, or the extended-controls SMS injector for smoke tests.

## Config
- Default server `https://kodajnn.com` — change it on the pair screen.
- Package id `africa.koda.sentinel`, `minSdk 26`, `targetSdk 34`.
- The `device_token` is shown once at enrollment; re-enroll to rotate. Revoking the
  device in KODA invalidates the token immediately (the app will get 401s).

## Not in P0 (see spec)
- P1 Room outbox + retry/backoff + cold-start backfill (offline durability)
- P2 Play Integrity attestation (`attested:true`)
- P3 dual-SIM tagging, heartbeat, re-pair-on-401 UX
- P4 Play Store packaging + privacy policy
