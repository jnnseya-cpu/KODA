# KODA Sentinel — distribution & Play Store

Two ways to get Sentinel onto Kinshasa testers' phones. Start with **A** (today),
do **B** in parallel (takes days–weeks because of the SMS permission review).

---

## A. Direct download (side-load) — live now, no review

Every push to `sentinel/**` runs the **Build Sentinel APK** GitHub Action, which
builds the app and attaches the APK to the **`sentinel-latest`** GitHub Release.
The public download page is **https://kodajnn.com/sentinel** (linked in the site
footer and from the merchant app's *Sentinel devices* screen).

Testers just: open the page → **Download** → allow "unknown sources" → install →
pair with the `dvk_…` token from their KODA account. Done.

Until you add a signing keystore (below), the APK is **debug-signed** — installable
and fine for a pilot, but a proper upload key is cleaner and is required for Play.

### Add your upload signing key (one-time)

On your laptop (needs the JDK's `keytool`):

```bash
keytool -genkeypair -v -keystore koda-upload.jks -alias koda \
  -keyalg RSA -keysize 2048 -validity 10000
# set a store password + key password; keep this file + passwords SAFE and BACKED UP.
# Losing it means you can never update the Play listing.

base64 -w0 koda-upload.jks > koda-upload.b64   # (macOS: base64 -i koda-upload.jks -o koda-upload.b64)
```

In GitHub → the KODA repo → **Settings → Secrets and variables → Actions → New
repository secret**, add:

| Secret | Value |
|---|---|
| `KEYSTORE_BASE64` | contents of `koda-upload.b64` |
| `KEYSTORE_PASSWORD` | the store password |
| `KEY_ALIAS` | `koda` |
| `KEY_PASSWORD` | the key password |

Re-run the workflow — the Release APK/AAB are now signed with your upload key.

---

## B. Google Play Store

The build already produces the Play bundle: `koda-sentinel.aab` (in the workflow's
`koda-sentinel` artifact).

1. **Play Console** (one-time $25): create the app `africa.koda.sentinel`.
2. Use **Play App Signing** (recommended); upload the AAB to **Internal testing**
   first, add your Kinshasa testers by email — they install from a Play link,
   no "unknown sources" needed.
3. **Store listing:** name, short/long description, icon, screenshots, category
   *Finance*; link the **privacy policy** `https://kodajnn.com/privacy`.
4. **Data safety form:** declare that the app reads SMS and forwards operator
   payment messages to KODA for verification; no data sold; encrypted in transit.
5. **⚠️ The real gate — SMS Permissions Declaration.** Play restricts
   `RECEIVE_SMS`/`READ_SMS`. You must submit the **Permissions Declaration form**
   and justify the use. Be precise and truthful:
   - Core purpose: *"Transaction/payment verification for the merchant's own
     mobile-money account. The app reads only operator payment-confirmation SMS
     (sender-filtered on-device by `OperatorFilter`) and forwards them to the
     merchant's KODA account. It is not the default SMS handler and does not read
     personal messages."*
   - Expect back-and-forth; approval is not guaranteed and can take days–weeks.
     This is why direct download (A) is the pilot path.
6. **Play Integrity** (optional): set `IntegrityGate.CLOUD_PROJECT_NUMBER` to your
   Play project number for device attestation.
7. Roll **Internal → Closed → Production** once tested on a real SIM phone.

### Versioning
Bump `versionCode` / `versionName` in `sentinel/app/build.gradle.kts` for each
Play upload (Play rejects a duplicate `versionCode`).
