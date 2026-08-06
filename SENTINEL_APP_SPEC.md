# KODA Sentinel — Android app build specification (v1)

**Sentinel is the phone-edge of KODA.** Each **merchant** installs it on **their
own phone** — the one holding **their own mobile-money SIM** — where it reads the
payment-confirmation SMS the operators send and forwards them, signed and
attested, to KODA, which fills the live ledger every verification is matched
against.

> **KODA holds no SIMs and never touches the money.** Customers pay the merchant's
> own mobile-money number directly; the funds land in the merchant's own account.
> Sentinel + KODA only *verify* that the payment happened. This is why onboarding a
> merchant needs no hardware from KODA — just the merchant's phone and their number.

Without Sentinel, KODA verifies only sandbox/manually-entered codes. **With
Sentinel, real customer payments become verifiable.** This is the single piece
that turns the public beta into real money.

> The KODA backend for Sentinel is **already built and tested** (enrollment,
> per-device token auth, the SMS-forward endpoint, fleet telemetry). This spec
> defines the Android app that talks to it.

---

## 1. What it does (in one loop)

```
Customer pays merchant's mobile-money number
        │
        ▼
Operator sends "Vous avez reçu 25 000 FC … Ref: OM.…"  ──▶  the SIM in the Sentinel phone
        │
        ▼
Sentinel reads the SMS  →  attaches Play Integrity attestation  →  POST /v1/device/sms
        │                                                              (Bearer device_token)
        ▼
KODA parses + chain-checks + stores it in sms_ledger  ──▶  now matchable by any door
        │
        ▼
Customer/merchant submits the code (checkout, WhatsApp, console) → VERIFIED
```

---

## 2. Backend contract (already live — build the app to these)

### 2.1 Enrollment (merchant does this in the KODA app)
`POST /app/devices/enroll` returns:
```json
{
  "device_id": "dev_…",
  "enrol_code": "A1B2C3D4",
  "device_token": "dvk_…",                       // secret — shown ONCE
  "qr": "koda://enroll/A1B2C3D4?t=dvk_…"          // Sentinel scans this
}
```
The merchant opens **Dashboard → Devices → Enroll**, and the phone **scans the QR**.
Sentinel extracts `device_token` from the QR (`t=`) and stores it in the Android
**Keystore/EncryptedSharedPreferences**. That token is the phone's identity.

### 2.2 Forward an SMS (the hot path)
```
POST https://kodajnn.com/v1/device/sms
Authorization: Bearer dvk_…
Content-Type: application/json

{
  "raw": "Vous avez recu 25 000 FC de JEANNE (+243890001122). Ref: OM.260805.1701.A88213.",
  "operator": "orange_cd",        // optional; defaults to the device's operator
  "battery": 88,                  // optional telemetry (0–100)
  "attested": true               // set true once Play Integrity passed
}
```
Response:
```json
{ "received": true, "sms_id": "sms_…", "parsed": true, "quarantined": false }
```
- `401` → bad/missing device token (re-enroll).
- Auth is the **device token only** — a phone can forward SMS and nothing else.
- KODA updates `last_seen`, `battery`, `attested` on every call (fleet view).

### 2.3 Revocation
The merchant can revoke a device (`POST /app/devices/:id/revoke`); the token
stops working immediately. Sentinel should detect repeated `401`s → show
"re-pair this phone".

---

## 3. App architecture (recommended)

| Concern | Recommendation |
|---|---|
| Language/UI | **Kotlin**, minimal Jetpack Compose UI (this is a background utility, not a rich app) |
| Min SDK | Android 8.0 (API 26)+; target latest |
| SMS read | `RECEIVE_SMS` + a `BroadcastReceiver` on `SMS_RECEIVED`; `READ_SMS` for a startup backfill of missed messages |
| Sender filter | Only forward SMS whose sender is in the operator allowlist (OrangeMoney, M-PESA, Airtel Money, …) — mirror KODA's `shared/parser.js` sender lists. Never forward personal SMS. |
| Networking | Plain `HttpURLConnection`/OkHttp; JSON bodies as in §2.2 |
| Queue | **Room** (SQLite) outbox: persist each SMS, mark sent on 200, retry with backoff otherwise. Guarantees no lost payment if offline. |
| Background | A **foreground Service** with a persistent notification ("KODA Sentinel is protecting payments") so Android won't kill it; `WorkManager` for retry drains |
| Attestation | **Play Integrity API** token attached/refreshed periodically; send `attested:true` once verified |
| Secret storage | `device_token` in Android **Keystore**-backed EncryptedSharedPreferences |
| Battery | Request **ignore battery optimizations**; the outbox + foreground service survive Doze |
| Config | Operator + SIM label come from enrollment; support **dual-SIM** (one Sentinel, multiple operators) by tagging each SMS with its `operator` |

### Screens (3 is enough)
1. **Pair** — scan the enrollment QR → store token → "Paired to <merchant>".
2. **Status** — connection OK, last SMS forwarded, outbox depth, battery, attestation state.
3. **Log** — recent forwarded SMS (masked) with sent/failed state; a "re-pair" button.

---

## 4. Security model

- **Least privilege:** the device token authorises *only* `POST /v1/device/sms`.
- **Attestation:** Play Integrity proves the SMS came from a genuine, unrooted
  Android device running your app — the trust anchor for "this SMS is real."
- **Signature-in-depth (v2):** optionally HMAC each forward with a per-device
  key so the backend can reject replays even if a token leaks. (v1 relies on
  TLS + token + KODA's own replay index, which already blocks double-spend.)
- **Privacy:** forward *only* operator-sender SMS; never read or transmit
  personal messages. State this in the store listing + a first-run consent.
- **Revocation & rotation:** merchant-initiated revoke kills the token; app
  handles `401` gracefully.

---

## 5. Reliability requirements

- **At-least-once delivery:** every operator SMS is persisted before ack; retried
  until KODA returns 200. KODA's replay index makes duplicates harmless.
- **Cold-start backfill:** on launch, scan the last N hours of SMS for any the
  operator sent while the app was down, and enqueue them.
- **Offline:** queue locally; drain when connectivity returns. The merchant's
  customers can still be verified *late* (KODA emits `payment.verified.late`).
- **Heartbeat:** a lightweight periodic forward (even empty) keeps `last_seen`
  fresh so the fleet view / `sentinel.offline` alert is accurate.

---

## 6. Build roadmap

| Phase | Scope | Outcome | Status |
|---|---|---|---|
| **P0 — Walking skeleton** | Pair via QR, read SMS, POST to `/v1/device/sms`, foreground service | Real payments hit the live ledger | ✅ done |
| **P1 — Reliability** | Room outbox + retry/backoff (WorkManager), cold-start backfill, boot restart, battery-optimisation opt-out | No lost payments | ✅ done |
| **P2 — Trust** | Play Integrity attestation (`attested:true`, fail-open), global sender allowlist from `/v1/device/config` | Verifiable device trust | ✅ done |
| **P3 — Fleet UX** | Merchant status + re-pair on 401, queue-depth notification, ~5-min heartbeat + 15-min WorkManager backstop | Operable at scale | ✅ done |
| **P4 — Store** | Privacy policy, consent, Play Store listing (or MDM side-load for owned fleet); optional per-device HMAC | Distributable | ▫ remaining |

**Implemented (P1–P3):** `Outbox`/`OutboxDb` (Room), `DrainWorker` +
`HeartbeatWorker` (WorkManager), `Backfill`, `BootReceiver`, `IntegrityGate`
(Play Integrity), `DeviceConfig` (+ backend `GET /v1/device/config` serving the
global allowlist), heartbeat in `ForwardService` inside the resolver's 10-minute
health window. See `sentinel/README.md`.

**Fastest path to real money:** P0 + P1 on **one** phone with the merchant SIM.
That alone closes the loop end-to-end; P2–P4 harden and scale it.

---

## 7. How to test against KODA today (no app yet)

The backend path is already exercisable — the app just replaces this curl:
```bash
# simulate what Sentinel will POST, using a device token from enrollment
curl -X POST https://kodajnn.com/v1/device/sms \
  -H "Authorization: Bearer dvk_…" \
  -H "Content-Type: application/json" \
  -d '{"raw":"Vous avez recu 25 000 FC de JEANNE (+243890001122). Ref: OM.260805.1701.A88213.","operator":"orange_cd","battery":90,"attested":true}'
```
See `backend/tools/test-doors.js` for the full enroll → forward → verify cycle.
