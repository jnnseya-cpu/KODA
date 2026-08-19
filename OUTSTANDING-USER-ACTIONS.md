# KODA — outstanding items that need YOUR access

The 20-day deep-review cleared everything fixable in code (see the branch history:
sandbox-ref security gate, CI money-path coverage, WhatsApp fail-closed, USSD codes,
i18n backfill, deploy consolidation). The items below can't be done from the codebase —
they need your keystore, Google Play Console, or DNS/host access. Each is self-contained.

---

## 1. Sign the Sentinel release (P1 — unblocks pilot installs)

**Why:** the side-load APKs currently ship **debug-signed**, so Google Play Protect blocks
install and every Kinshasa tester has to disable Play Protect. The CI workflow
(`.github/workflows/sentinel-apk.yml`) already signs with your upload key **the moment the
four GitHub secrets exist** — otherwise it falls back to the debug key. So this is purely
"create a key + paste 4 secrets."

**Do once, on your machine:**
```bash
# 1) generate an upload keystore (answer the prompts; remember the passwords)
keytool -genkeypair -v -keystore koda-upload.jks -keyalg RSA -keysize 2048 \
        -validity 10000 -alias koda-upload

# 2) base64-encode it for GitHub
base64 -w0 koda-upload.jks > koda-upload.jks.b64      # macOS: base64 -i koda-upload.jks -o koda-upload.jks.b64
```

**Then set the 4 repository secrets** (GitHub → repo → Settings → Secrets and variables →
Actions → New repository secret), names exactly as the workflow expects:

| Secret name | Value |
|---|---|
| `KEYSTORE_BASE64` | the contents of `koda-upload.jks.b64` |
| `KEYSTORE_PASSWORD` | the keystore password you set |
| `KEY_ALIAS` | `koda-upload` (or the alias you chose) |
| `KEY_PASSWORD` | the key password you set |

Re-run the **Build Sentinel APK** workflow. The release notes will read
`Signed: release upload key` instead of `debug key`. Keep `koda-upload.jks` safe and
backed up — you must reuse the SAME key for every future update.

---

## 2. Publish to Google Play (P1 — depends on #1)

**Why:** CI already produces `koda-sentinel-play.aab` (the Play-compliant notification
build) on every run, but it's only attached to the GitHub release — never uploaded. The
site still says "coming soon."

**Steps:**
1. Sign into the Google Play Console, create the app "KODA Sentinel".
2. Upload `koda-sentinel-play.aab` (download it from the latest **Build Sentinel APK**
   workflow artifacts / the `sentinel-latest` GitHub release) to a testing track first
   (Internal testing), then Production.
3. Fill the store listing + the Data safety form (declare Notification access usage).
4. Once live, update the "coming soon" copy: `app/frontend/build-site.js` (~line 580) and
   `app/frontend/site/sentinel.html` — replace "Google Play Store … coming soon" with the
   store link. (Tell me the URL and I'll make that change.)

---

## 3. Confirm the host redirects (P3 — SEO hygiene)

The canonical `<link rel="canonical">` tags are in the code, but the actual
`www → apex` and `http → https` redirects live at the DNS/host layer, not in the repo.
Verify they return a real 301 to the canonical host:
```bash
curl -sI https://www.kodajnn.com/ | grep -i location    # expect 301 → https://kodajnn.com/
curl -sI http://kodajnn.com/      | grep -i location     # expect 301 → https://kodajnn.com/
```
If either doesn't redirect, add the rule in the Hostinger panel / reverse proxy so the host
and the canonical tags agree.

---

## Deliberately dormant (no action — just so it's not "forgotten")

- **Paystack / Flutterwave / Bitripay billing rails** are fully built and tested but
  switched off (`live:false` in `app/shared/billing.js`). Flip the flag per market when you
  want to offer them. This is intentional, not a gap.
- **USSD / inbound-SMS doors** go "live" only when their aggregator shortcode / gateway key
  is configured — expected, and honestly shown as "sandbox" in the doors admin until then.
