# KODA Platform — developer-ready application

The full KODA merchant OS: public site, PWA app (three doors), verification engine,
communication event architecture, billing, fleet, disputes, sub-merchants and admin —
implementing `../KODA_UNIFIED_SPEC_v2.md`.

## Run it

```bash
cd app
npm start          # → http://localhost:4600  (Node ≥ 22.5, ZERO npm dependencies)
```

| Surface | URL | Login |
|---|---|---|
| Public site (12 pages) | `http://localhost:4600/` | — |
| App (SPA + PWA, installable) | `http://localhost:4600/app` | see accounts below |
| Public API | `http://localhost:4600/v1/ping` | Bearer API key (create in Developers) |
| OpenAPI 3.1 | `/v1/openapi.json` | — |

## Seeded accounts (all passwords `koda-demo` unless noted)

| Account | Email | Role -> dashboard |
|---|---|---|
| **KODA staff** | `admin@koda.africa` / `koda-admin` | Admin -> full control centre (fleet, parse health, suspend) |
| Maison Kivu - owner | `demo@koda.africa` | Owner -> everything (billing, team, developers) |
| Maison Kivu - manager | `manager@koda.africa` | Manager -> + disputes & devices, no billing/keys |
| Maison Kivu - cashier | `caisse@koda.africa` | Cashier -> till work only (verify, feed, receipts) |
| Tunakula (delivery) | `tunakula@koda.africa` | Owner, Commerce plan - portfolio day-one account |
| Scan & Go (retail) | `scango@koda.africa` | Owner, Boutique plan |
| StudYear (education) | `studyear@koda.africa` | Owner, Commerce plan |
| TicketRoyality (events) | `ticketroyality@koda.africa` | Owner, Commerce plan |
| Kinshasa Bots (BSP platform) | `platform@koda.africa` | Owner, Plateforme - 3 sub-merchants with scoped keys |

Role enforcement is two-layer: the SPA gates navigation per role, and the API
enforces it again server-side (owner-only: plan, webhooks, sub-merchants;
manager+: keys, device revoke; cashiers can never invite or configure).

Zero dependencies by design: `node:http`, `node:sqlite`, `node:crypto`. The DB layer
(`backend/lib/db.js`) is the single swap point for PostgreSQL in production.

## Structure — frontend / backend / shared

```
app/
├── backend/                  # the API + engine (deploy target: Cloud Run)
│   ├── server.js             #   HTTP server, router, static serving
│   ├── routes.js             #   /app/* session routes + /v1/* public API + webhooks
│   ├── seed.js               #   idempotent demo data
│   ├── lib/                  #   db · engine · fraud · util · webhooks
│   ├── comms/                #   notify (fan-out) · email (Brevo) · meta (WhatsApp)
│   └── tools/bench.js        #   performance benchmark (npm run bench)
├── frontend/                 # everything the browser gets
│   ├── app.html/app.js/styles.css   # the SPA (all dashboards, i18n)
│   ├── sw.js · manifest.webmanifest · icon.svg   # PWA
│   ├── build-site.js         #   generates the 12 public pages at boot
│   └── site/                 #   generated output (gitignored)
├── shared/                   # one source of truth for both sides + Sentinel
│   ├── plans.js              #   plan ladder, ACU costs, top-up packs (UMD — browser-ready at /shared/plans.js)
│   ├── parser.js             #   operator SMS template packs (also ships OTA to Sentinel)
│   └── events.js             #   the 128-event communication catalogue
└── data/                     # SQLite (gitignored)
```

The server also serves `shared/` to the browser at `/shared/*` so frontend and
backend can never drift on pricing or operator grammar.

## What's implemented

**Engine (`lib/`)** — ParserAgent template packs (6 operators, trailing-punctuation-safe),
MatchMaker with fuzzy repair (edit distance ≤ 2), FraudSentinel risk bands
(<0.15 confirm · ≤0.6 challenge · >0.6 reject), balance-chain defence with quarantine,
Global Replay Index (single-use codes across all doors), HMAC-SHA256 webhook dispatcher
with 5× exponential retry + DLQ, ACU billing with grace buffer, top-ups verified by the
engine itself.

**Communication Event Architecture (`lib/comms/`)** — one event engine, **128 catalogue
events in 15 categories**, 37 mandatory notices that bypass opt-outs, fan-out across
email · in-app · WhatsApp · push · SMS, per-user channel preferences, branded email
renderer (merchant logo + brand colour on every mail), sandbox-logged deliveries until
provider keys (Brevo / Meta / FCM) are set via env vars.

**App (`public/app.js`)** — login/signup (plan preselect from pricing CTAs), dashboard,
Verify Console (Door 1: code or screenshot path), Live Payments Feed with sandbox SMS
injector, receipts with audit-grade decision traces, disputes (DisputeAgent evidence
files), Sentinel device fleet (enrol/revoke/attestation), Billing & ACU (top-up loop,
plan ladder, invoices), Team with per-cashier audit trail, Developers (keys, webhooks +
signed test events, quickstart), Communications centre (catalogue, coverage, template QA
with live email preview + send-test, inbox, prefs), Sub-merchants (Plateforme),
Settings, and the KODA-staff admin control centre (fleet, parse health, suspend).

**i18n** — device-language auto-detection (LinguaAgent posture), FR/EN dictionaries,
per-user override, `Auto (device)` default.

**PWA** — `manifest.webmanifest`, service worker (offline shell, network-first API),
installable with KODA icon.

**Public site (`tools/build-site.js`)** — generated at boot: landing (the full prototype,
CTAs wired to `/app#signup?plan=…`), About, How it works, Industries, Developers (API
quickstart + endpoint/scope/limit tables), Growth & Influencers (reward ladder, Verified
Net Revenue, anti-fraud pipeline), Blog, Contact, Get started, Terms, Privacy,
All policies, and live Platform Status (pings `/healthz`).

## Performance (marketplace / e-commerce grade)

Measured with `npm run bench` (`tools/bench.js`) on a single node, full HTTP round
trips including intent creation:

| Path | Result |
|---|---|
| Full intent→verify cycle (2 HTTP calls) | **p50 ~2.3 ms · p95 ~4–7 ms** |
| Concurrent verification throughput | **~240 verifications/sec on one node** (pacing-limited, not engine-limited) |
| Read path (`GET /receipts`, marketplace polling) | **~1,900 req/s** |

How the hot path stays fast: prepared-statement cache (`lib/db.js`), WAL +
`synchronous=NORMAL` (no per-commit fsync), notifications and webhooks deferred
off the money path with `setImmediate` — a verification response never waits on
comms. Per-key rate limits protect the platform under burst (429 + `Retry-After`);
marketplace/Enterprise keys run at the 1,000 rps tier. Horizontal path: the engine
is stateless apart from SQLite — swap `lib/db.js` for Postgres + a Redis replay
index and scale Cloud Run instances linearly.

## Environment variables

| Var | Purpose |
|---|---|
| `PORT` | default 4600 |
| `KODA_JWT_SECRET` | session signing — set in production |
| `KODA_DATA_DIR` | SQLite location |
| `BREVO_API_KEY` | flips email deliveries from `sandbox` to live |
| `META_WA_TOKEN` | Meta system-user access token — flips WhatsApp sends to live (Graph API) |
| `META_WA_PHONE_ID` | WhatsApp Business phone-number ID (from Meta API Setup) |
| `META_API_VERSION` | Graph API version, default `v20.0` |
| `META_WA_VERIFY_TOKEN` | webhook verify token you set in Meta app config (default `koda-verify`) |
| `FCM_KEY` | flips push deliveries to live |

**WhatsApp (Door 2) wiring:** point the Meta app's webhook at
`https://api.koda.africa/webhooks/whatsapp` with your verify token and subscribe to
`messages`. Outbound: business-initiated events send pre-approved templates
(`koda_payment_verified`, `koda_topup_verified`, `koda_low_balance`,
`koda_sentinel_offline`, `koda_security_alert`, `koda_daily_digest` — create these in
WhatsApp Manager); in-window replies send plain text. Inbound: a customer message
containing a reference code is verified through the same engine (`mode: chat`) and
answered in-thread (✅ confirmed / ⏳ watching / ⚠️ already used / ❌ not matched).
Without the token everything runs and is recorded as sandbox deliveries.

## Production readiness

- `npm test` - 61-check end-to-end suite on a throwaway server + fresh DB (CI-able, zero deps)
- `NODE_ENV=production` refuses to boot with the default `KODA_JWT_SECRET`
- Security headers on every response (nosniff, frame-options, referrer-policy) + `x-request-id`
- Structured access log for `/v1`, `/app`, `/webhooks` (silence with `KODA_QUIET=1`)
- Graceful shutdown on SIGTERM/SIGINT with WAL checkpoint (Cloud Run friendly)
- `Dockerfile` (node:22-alpine, non-root, `/data` volume) + `.dockerignore` + `.env.example`
- Providers flip live per-channel the moment each key lands - no code changes

## Production path

Deployment target per `../THIRD_PARTY_KEYS.md`: Cloud Run + Cloud SQL (swap `lib/db.js`),
Secret Manager for keys, the Sentinel Android app feeding `/app/sandbox/sms`-shaped
ingestion via mTLS, and provider adapters activated by the env vars above.
