# KODA Sentinel — Android app (P0–P3)

The phone-edge of KODA. A **merchant** installs this on **their own phone** (the one
holding their mobile-money SIM). It reads the operator payment-confirmation SMS and
forwards them to KODA's live ledger, where any door (checkout, WhatsApp, console)
can verify them. **KODA holds no SIMs and never touches the money.**

See `../SENTINEL_APP_SPEC.md` for the full spec. This build covers **P0–P3**:
durable at-least-once delivery, cold-start backfill, heartbeat health, device
attestation, and a global operator allowlist — everything needed to run real
payments at fleet scale.

## What it does
1. **Pair** — scan the QR from KODA (Dashboard → Devices → Enroll), or paste the
   `dvk_…` token. It's validated via `GET /v1/device/config` and stored in the
   Android Keystore (EncryptedSharedPreferences).
2. **Configure** — on pair (and periodically) it pulls the merchant name, its
   enrolled operator, and the **global sender allowlist** from KODA, so the
   privacy filter tracks the 200+-operator registry with no new APK.
3. **Listen** — a `BroadcastReceiver` catches every incoming SMS; only messages
   from known operators are kept. Personal SMS are never read or transmitted.
4. **Persist → forward** — each operator SMS is written to a **Room outbox**
   *before* any network call, then a foreground `Service` drains it to
   `POST {server}/v1/device/sms`. Nothing is lost if the phone is offline.
5. **Stay healthy** — a ~5-minute heartbeat to `POST /v1/device/heartbeat` keeps
   the device inside the resolver's 10-minute health window, so the merchant's
   payment methods stay visible at checkout.

## Reliability (P1)
- **At-least-once delivery** — Room `outbox` table; a row is persisted before
  sending and marked sent only on HTTP 200. KODA's replay index makes any
  duplicate harmless. A de-dupe guard drops the same sender+body within 60s.
- **Retry/backoff** — the in-service drain handles the happy path; whatever it
  can't send is handed to **WorkManager** (`DrainWorker`) for OS-managed
  exponential backoff that survives Doze, reboot and process death.
- **Cold-start backfill** — on launch/boot, `Backfill` scans the last 24h of the
  SMS inbox and enqueues any operator SMS missed while the app was down (verified
  *late* via `payment.verified.late`).
- **Survives reboot** — `BootReceiver` restarts the service on `BOOT_COMPLETED`
  and app update; the app requests battery-optimisation exemption so it drains
  during idle.

## Trust (P2)
- **Play Integrity** — `IntegrityGate` attaches an attestation token to forwards
  and heartbeats (`attested:true`) once a cloud project number is configured.
  **Fail-open:** side-loaded fleets without Play services still forward; KODA's
  device token + replay index remain the hard gates.
- **Least privilege** — the device token authorises *only* the SMS-forward and
  heartbeat/config endpoints. Losing/revoking the device 401s it immediately and
  the app shows **re-pair**.

## Fleet UX (P3)
- Status shows the paired merchant and a re-pair banner on revocation.
- Notification shows live queue depth ("Protecting <merchant> · N queued").
- `HeartbeatWorker` (15-min periodic) is the backstop that refreshes config,
  heartbeats, and drains stragglers even if the service was killed.

## Build & run
1. Install **Android Studio** (Hedgehog+), open the `sentinel/` folder.
2. Let Gradle sync (it downloads the Android SDK + deps automatically).
   - CLI alternative: `gradle wrapper` then `./gradlew assembleDebug`.
   - Build plugins: AGP 8.5.2, Kotlin 1.9.24, KSP (Room), WorkManager, Play Integrity.
3. Connect an Android phone (USB debugging on) → **Run**.
4. In the app: set the server (default `https://kodajnn.com`), tap **Scan pairing
   QR**, grant SMS + notification permissions, allow battery exemption.
5. Send a test operator-style SMS to the phone → it appears in **Recent forwards**
   and lands in the merchant's KODA ledger.

> Emulator note: emulators can't receive real carrier SMS. Use a real phone with
> the mobile-money SIM, or the extended-controls SMS injector for smoke tests.

## Config
- Default server `https://kodajnn.com` — change it on the pair screen.
- Package id `africa.koda.sentinel`, `minSdk 26`, `targetSdk 34`, `versionName 0.2.0`.
- Enable attestation by setting `IntegrityGate.CLOUD_PROJECT_NUMBER` to your Play
  Integrity project number (0 disables it, the default).
- The `device_token` is shown once at enrollment; re-enroll to rotate. Revoking the
  device in KODA invalidates the token immediately (the app will get 401s).

## Remaining (P4)
- Play Store packaging, store listing, and the first-run privacy consent screen
  (or MDM side-load for an owned fleet).
- Optional per-device HMAC signing of forwards (signature-in-depth).
