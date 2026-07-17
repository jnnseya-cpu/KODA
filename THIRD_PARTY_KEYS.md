# KODA — Third-Party API Keys & Services

**Groupe Nseya Digital / BitriPay Ecosystem — Confidential**
**Companion to:** `KODA_UNIFIED_SPEC_v2.md`
**Purpose:** every external key KODA needs to run, what it powers, how to obtain it, and current acquisition status.

> **The punchline:** six third-party keys get KODA to a working P0–P1 MVP — and the two categories most fintechs need first are the two KODA deliberately avoids: **no telco API keys and no payment-gateway keys.** Verification reads the merchant's own SMS; top-ups are collected via KODA's own engine on KODA's own mobile-money accounts.

---

## 1. Must-have for MVP (P0–P1)

| # | Service | What it powers in KODA | Keys to install | Status |
|---|---|---|---|---|
| 1 | **AI model gateway** (Claude + Gemini + OpenAI behind one gateway) | Agent mesh LLM work: ParserAgent template generation, LinguaAgent dialogue, VisionAgent screenshot extraction/forensics, DisputeAgent evidence files | `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY` behind the gateway; KODA services see one gateway URL + key | ✅ **Have** — all three, gateway-fronted |
| 2 | **Meta WhatsApp Business Cloud API** | Door 2 (Chat Mode), KODA Lite SMS-forwarding ingestion, digests, receipts, alerts, dev support channel | Meta app ID + secret, WhatsApp Business Account (WABA) ID, permanent system-user token, webhook verify token | 🔲 **Needed** — see §3.1 |
| 3 | **Google Cloud Platform** | All of KODA Cloud: Cloud Run (NestJS), Cloud SQL (Postgres), Memorystore (Redis), Pub/Sub (Kafka-class eventing), Secret Manager | Per-environment service-account JSON keys | 🔲 **Needed** — see §3.2 |
| 4 | **Google Play Integrity API** | Sentinel device attestation — trust anchor for signed SMS records | Play Console app linked to a Google Cloud project | 🔶 **Partial** — developer account exists; see §3.3 |
| 5 | **Firebase Cloud Messaging** | Push to Sentinel (OTA template packs, sync nudges) + Console notifications | Firebase Admin SDK service-account JSON | 🔶 **Partial** — paid Firebase console exists; see §3.4 |
| 6 | **Transactional email — Brevo** | Invoices, statements, security mail (everything else is WhatsApp-first). Fully automated from the platform via API | One Brevo API key + verified sender domain | 🔲 **Needed** — see §3.5 |

**Cost-control reminder (spec §18):** rules engine → template parser → regex → lightweight local model → **external AI only for exceptions**. Key #1 is metered carefully; that discipline is what protects the 3×–10× ACU margin law (spec §9).

## 2. Deliberately NOT needed

- **Telco/operator API keys** — the entire product thesis.
- **Stripe/Flutterwave/PSP keys for collections** — `POST /billing/topup` creates a KODA intent on KODA's own mobile-money accounts, verified by the engine itself. Requirement instead: **real registered SIMs/wallets per operator** (M-Pesa, Orange, Airtel, Africell) in the company's name.
- **SMS-sending gateway** (Twilio SMS etc.) — KODA receives SMS on-device; outbound messaging is WhatsApp.

## 3. How to get each key (step-by-step)

### 3.1 Meta WhatsApp Business Cloud API

1. Go to **business.facebook.com** → create (or use) a **Meta Business Portfolio** for Groupe Nseya Digital. Complete **business verification** (registration document, website/domain, business email) — start this first; it gates production messaging limits and can take days.
2. Go to **developers.facebook.com** → *My Apps* → **Create App** → type **Business** → attach it to the Business Portfolio.
3. In the app dashboard, click **Add product → WhatsApp**. Meta auto-creates a **WhatsApp Business Account (WABA)** and gives you a **test number** immediately — Chat Mode development can start the same day.
4. Add the real KODA number: *WhatsApp → API Setup → Add phone number* (a number **not** currently registered on the WhatsApp consumer app; a dedicated SIM/virtual number is cleanest). Verify by SMS/voice code.
5. Create a permanent token: *Business Settings → Users → System Users* → add a system user (Admin) → **Generate Token** with `whatsapp_business_messaging` + `whatsapp_business_management` permissions, no expiry. **This is the key the backend uses.**
6. Configure the webhook: *WhatsApp → Configuration* → callback URL `https://api.koda.africa/webhooks/whatsapp` + a verify token you invent → subscribe to `messages`. This is how customer codes and KODA Lite forwarded SMS arrive.
7. Record: app ID, app secret, WABA ID, phone-number ID, system-user token, webhook verify token → Secret Manager (§4).

*Note:* messaging tiers scale automatically with quality (250 → 1k → 10k → 100k conversations/day). Business-initiated template messages (digests, alerts) require pre-approved templates — submit them early.

### 3.2 Google Cloud Platform

1. Go to **console.cloud.google.com** → sign in with the company Google account (the same one holding Firebase/Play makes IAM simpler) → accept terms. New accounts get ~$300 free credit.
2. **Set up a Billing Account** (*Billing* menu): card or bank details. One billing account funds all projects.
3. Create two **projects**: `koda-production` and `koda-sandbox` (Firebase already created one project — you can reuse it for sandbox or keep it separate for the app side).
4. Enable the services KODA Cloud uses (*APIs & Services → Enable APIs*): **Cloud Run** (NestJS containers), **Cloud SQL** (PostgreSQL), **Memorystore** (Redis), **Pub/Sub** (Kafka-class eventing to start; Confluent later if needed), **Secret Manager**, **Cloud Storage**, **Artifact Registry**.
5. Create a **service account** per environment (*IAM & Admin → Service Accounts*) with least-privilege roles (Cloud Run Admin, Cloud SQL Client, Pub/Sub Editor, Secret Manager Accessor) → *Keys → Add key → JSON* → download. **This JSON file is the credential the deploy pipeline and backend use.**
6. Set **budget alerts** (*Billing → Budgets*) at e.g. $50/$200/$500 so cost surprises page you before the invoice does.

### 3.3 Google Play Integrity API (developer account already in hand)

1. In **play.google.com/console** → create the **KODA Sentinel app** entry (internal/closed track is enough — this matches the managed-Play private channel strategy; no public listing needed).
2. In the app's console: **Release → App integrity → Play Integrity API → Link a Google Cloud project** → link `koda-production` from §3.2. That's the whole "get the key" step — Integrity is authorised through the linked Cloud project, not a copy-paste API key.
3. In the Sentinel Android code, call the Play Integrity API (standard request at enrolment + rolling checks); the backend verifies integrity verdicts server-side via the linked project's credentials (`playintegrity.googleapis.com`, using the §3.2 service account).
4. For the private channel: *Release → Testing → Internal testing* (up to 100 testers) now; **managed Google Play** via an EMM/organisation for fleet distribution at P1.

### 3.4 Firebase Cloud Messaging (Firebase console already in hand)

1. Open **console.firebase.google.com** → your existing (paid/Blaze) project. FCM is **already included, free, no extra signup** — it just needs credentials wired up.
2. *Project settings (gear) → Cloud Messaging*: confirm **Firebase Cloud Messaging API (V1)** is enabled.
3. *Project settings → Service accounts → Generate new private key* → downloads the **Firebase Admin SDK JSON**. **This is the key** the NestJS backend uses to send pushes (via `firebase-admin`).
4. In the Sentinel Android app: *Project settings → Your apps → Add app → Android* (package e.g. `africa.koda.sentinel`) → download `google-services.json` into the app module. Sentinel then receives OTA template-pack pushes and sync nudges.
5. Since Firebase runs on GCP: link/confirm the Firebase project sits under the same billing account as §3.2 for one consolidated bill.

### 3.5 Transactional email — Brevo (recommended over SendGrid here)

Why Brevo: free tier (300 emails/day) covers P0–P1 entirely, EU company (GDPR-clean), simple API, first-class French support and French email templates — matching KODA's FR-first posture. Fully automatable from the platform: the backend calls the API; nobody "sends" email by hand.

1. Sign up at **brevo.com** (free plan) with a company email.
2. **Authenticate the sending domain** (*Senders & Domains → Domains → Add domain* → `koda.africa`): add the DKIM/DMARC DNS records it shows you at your DNS host. Without this, invoices land in spam — do not skip.
3. Create a sender: `billing@koda.africa` (and `security@koda.africa`).
4. *Settings → SMTP & API → Generate API key* → **this is the key** the backend uses (`@getbrevo/brevo` Node SDK) for invoices, monthly statements, and security mail.
5. Build the three templates (invoice, statement, security alert) either in Brevo's template editor referenced by template ID, or render HTML in-app and send raw — either way the platform triggers them automatically on billing events (`billing.invoice.created` → email fires; no human step).

## 4. Secrets discipline (non-negotiable)

- Every key above lives in **GCP Secret Manager** — never in code, never in the repo, never in a chat.
- Separate sandbox and production values for every key; services read secrets at boot via the §3.2 service account.
- Rotation calendar: Meta system-user token and Brevo key every 90 days; service-account JSONs on staff change; instant revocation path tested once per quarter — the same discipline KODA's own API promises its customers (spec §7).

## 5. Add as you scale (P2+)

| Service | Purpose | When |
|---|---|---|
| Smile ID or Sumsub | KYB/KYC for sub-merchant onboarding (Plateforme tier) | First platform deal |
| Stripe or Flutterwave | Card/bank top-ups for Enterprise only | First enterprise contract |
| Cloudflare | DNS, CDN, DDoS in front of `api.koda.africa` | Before public launch |
| Sentry | Error monitoring across cloud + Sentinel | P1 |
| Better Stack / Instatus | Public status + parse-health pages | P1 exit |
| PagerDuty (or Better Stack alerts) | OpsPilot human-escalation paging | P1 |
| PostHog | Product analytics — measures the <10-min first-verification north star | P1 |
| BSP (360dialog/Wati/Twilio WhatsApp) | Only if a Platform customer brings their own BSP | As needed |
