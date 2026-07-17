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
| App (SPA + PWA, installable) | `http://localhost:4600/app` | `demo@koda.africa` / `koda-demo` |
| Cashier seat | same | `caisse@koda.africa` / `koda-demo` |
| Admin control centre | same → ★ Control centre | `admin@koda.africa` / `koda-admin` |
| Public API | `http://localhost:4600/v1/ping` | Bearer API key (create in Developers) |
| OpenAPI 3.1 | `/v1/openapi.json` | — |

Zero dependencies by design: `node:http`, `node:sqlite`, `node:crypto`. The DB layer
(`lib/db.js`) is the single swap point for PostgreSQL in production.

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

## Environment variables

| Var | Purpose |
|---|---|
| `PORT` | default 4600 |
| `KODA_JWT_SECRET` | session signing — set in production |
| `KODA_DATA_DIR` | SQLite location |
| `BREVO_API_KEY` | flips email deliveries from `sandbox` to live |
| `META_WA_TOKEN` | flips WhatsApp deliveries to live |
| `FCM_KEY` | flips push deliveries to live |

## Production path

Deployment target per `../THIRD_PARTY_KEYS.md`: Cloud Run + Cloud SQL (swap `lib/db.js`),
Secret Manager for keys, the Sentinel Android app feeding `/app/sandbox/sms`-shaped
ingestion via mTLS, and provider adapters activated by the env vars above.
