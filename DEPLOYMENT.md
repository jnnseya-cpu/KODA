# KODA — Deployment, Architecture & Provider Guide

**One coherent OS: a zero-dependency Node runtime that serves the API, the
merchant app (SPA/PWA), the public site, and the drop-in checkout — from a
single container, backed by one durable SQLite ledger.**

This document proposes the best architecture for the backend, shared, and
frontend layers, gives a copy-paste deploy runbook, and lists **every external
provider** needed for a fully working OS (required vs optional, launch vs scale).

---

## 1. What KODA actually is (as built)

| Layer | What it is | How it ships |
|---|---|---|
| **backend/** | Node 22 core only — `node:http` + `node:sqlite` + `node:crypto`. The verify engine, fraud engine, billing/ACU, webhooks, comms, agents, growth tools, SEO. **No npm dependencies.** | One process, one container |
| **shared/** | UMD modules that are the single source of truth for *both* backend and browser: `parser.js` (operator SMS grammars), `plans.js`, `costs.js`, `events.js`, `version.js`, `seo-content.js` | Required by backend; served to the browser at `/shared/*` |
| **frontend/** | Merchant SPA (`app.js` + `app.html`), PWA (`manifest.webmanifest` + `sw.js`), the public marketing/SEO site (generated at boot into `site/`), and the customer checkout (`checkout/pay.html` + `checkout/koda.js`) | Served as static files by the same Node process |

**Design consequence:** there is nothing to `npm install`, no build step, no
bundler, no separate frontend host. The whole OS is `node backend/server.js`.
That is the architecture's biggest operational advantage — **keep it.**

### The one hard constraint: SQLite is single-writer

The entire ledger (intents, receipts, replay index, SMS ledger, audit log)
lives in one SQLite file under `KODA_DATA_DIR`. This is fast and simple, but it
means:

- **Exactly one instance may write.** Do **not** run 2+ replicas against the
  same volume, and do **not** autoscale horizontally.
- **The data directory must be a persistent, low-latency block volume.**
  Network filesystems (GCS FUSE, EFS, NFS) can corrupt SQLite under load — avoid
  them for `/data`.
- Vertical scaling (more CPU/RAM on one machine) is the scale lever until you
  migrate to Postgres (see §7).

This single fact drives the hosting recommendation below.

---

## 2. Recommended architecture

```
                         ┌─────────────────────────────────────────┐
        Customers  ─────▶│  Cloudflare (DNS · TLS · CDN · DDoS)     │  optional but recommended
        Merchants        └───────────────────┬─────────────────────┘
                                             │ HTTPS
                              ┌──────────────▼───────────────┐
                              │   KODA container (Node 22)    │   ← ONE instance
                              │  ┌──────────┬──────────────┐  │
                              │  │ /v1 API  │ /app SPA+PWA │  │
                              │  │ /pay     │ / public site│  │
                              │  │ /shared  │ /js/koda.js  │  │
                              │  └────┬─────┴──────────────┘  │
                              │       │ prepared statements   │
                              │  ┌────▼─────────────────────┐ │
                              │  │  SQLite (WAL)  /data      │ │ ← persistent volume
                              │  └───────────────────────────┘ │
                              └───┬───────────┬───────────┬────┘
                       webhooks   │  AI gateway│   WhatsApp│  email/push
                        (HMAC) ───▼    (Claude/ ▼  (Meta    ▼  (Brevo/FCM)
                       to merchant   Gemini/OpenAI) Cloud API)
```

- **Backend + shared + frontend = one deploy.** No microservices to launch. The
  shared modules are imported by the backend and served verbatim to the browser,
  so the operator grammars and plan/price constants can never drift between
  server and client.
- **Front it with Cloudflare** for DNS, free TLS, a CDN cache on the static site
  and `/shared/*` + `/js/koda.js`, and DDoS protection. Point `koda.africa` and
  `pay.koda.africa` at the container.
- **Money path stays synchronous and local**; everything outbound (webhooks,
  WhatsApp, email, push) is fired off the hot path via `setImmediate`.

### Best host for this shape

| Host | Persistent disk for SQLite | Africa latency | Verdict |
|---|---|---|---|
| **Fly.io** ✅ *primary* | Fly Volumes (real block device) | **jnb region = Johannesburg** | Best fit — `fly.toml` included |
| **Render** ✅ alt | Persistent Disk | Frankfurt (nearest) | Solid — `render.yaml` included |
| **VPS (Hetzner/DigitalOcean) + Docker** | Local SSD | EU/varies | Cheapest, most control, more ops work |
| **Cloud Run** ⚠️ | **Ephemeral by default** — needs a mounted volume; network FS risks SQLite | Low (europe/africa) | Only after migrating to Postgres (§7). Avoid for SQLite. |

**Recommendation: deploy on Fly.io in `jnb`, front it with Cloudflare.** Both
config files are in `app/` (`fly.toml`, `render.yaml`).

---

## 3. Deploy runbook (Fly.io)

```bash
cd app

# 1. one-time: install flyctl, log in, create the app (don't deploy yet)
fly launch --no-deploy --copy-config --name koda

# 2. create the durable SQLite volume in Johannesburg
fly volumes create koda_data --region jnb --size 3

# 3. set secrets (never commit these)
fly secrets set \
  KODA_JWT_SECRET=$(openssl rand -hex 32) \
  KODA_ADMIN_EMAIL=you@koda.africa \
  KODA_ADMIN_PASSWORD='<strong-password>' \
  KODA_PUBLIC_URL=https://pay.koda.africa \
  ANTHROPIC_API_KEY=... \
  BREVO_API_KEY=... \
  META_WA_TOKEN=... META_WA_PHONE_ID=... META_WA_VERIFY_TOKEN=koda-verify

# 4. deploy with a build stamp (surfaces at GET /version)
fly deploy \
  --build-arg KODA_BUILD_SHA=$(git rev-parse --short HEAD) \
  --build-arg KODA_BUILD_DATE=$(date -u +%FT%TZ)

# 5. verify
curl https://koda.fly.dev/healthz     # liveness
curl https://koda.fly.dev/readyz      # DB-backed readiness
curl https://koda.fly.dev/version     # coherent version identity
```

Then point Cloudflare DNS for `koda.africa` / `pay.koda.africa` at the Fly app
and set `KODA_PUBLIC_URL` to the custom domain (so `checkout_url` links are
correct).

**Backups:** `npm run backup` does a zero-downtime `VACUUM INTO` snapshot. Cron
it every 6h and ship the file off-box:
```bash
# fly.io: a scheduled machine, or a cron on a small worker, running:
node backend/tools/backup.js /data/backup.db && <upload /data/backup.db to GCS/S3>
```

### Production readiness — what's already built in

- **Boot guard:** production refuses to start on the default `KODA_JWT_SECRET`;
  warns if `KODA_PUBLIC_URL` is unset (checkout links would be localhost).
- **No demo accounts in prod:** the seed bootstraps only one admin from
  `KODA_ADMIN_EMAIL` / `KODA_ADMIN_PASSWORD`.
- **Health surface:** `/healthz` (liveness), `/readyz` (DB check → 503 if down),
  `/version` (app/api/widget/fraud-model/build).
- **Security headers** on every response: HSTS (prod), `x-content-type-options`,
  `x-frame-options`, `referrer-policy`, `permissions-policy`; HTTP→HTTPS 301
  behind the proxy.
- **Graceful shutdown:** SIGTERM stops accepting, checkpoints the WAL
  (`wal_checkpoint(TRUNCATE)`), exits — no half-written ledger.
- **Signed webhooks** (HMAC-SHA256) with retry + DLQ; per-key rate limiting.
- **Startup channel report:** the banner prints `ai / whatsapp / email / push /
  sms = live|sandbox` so you can see at a glance what's wired.

---

## 4. External & dependent providers — the complete list

Legend: **P0** = required to boot & take real money · **P1** = required for the
full public experience · **P2+** = add as you scale. An empty provider var keeps
that channel in safe **sandbox** mode; the OS still boots and the money path
still works.

### 4.1 Required for a fully working OS

| Provider | Powers | Env var(s) | Tier | Cost (indicative) |
|---|---|---|---|---|
| **Host with persistent disk** (Fly.io / Render / VPS) | Runs the container; durable SQLite volume | — | **P0** | $5–15/mo to start |
| **Domain + DNS/TLS/CDN** (Cloudflare) | `koda.africa`, `pay.koda.africa`; TLS; DDoS; caches static + `/shared` + `/js/koda.js` | — | **P0** | Domain ~$10/yr; Cloudflare free tier |
| **AI model gateway** (Claude **+** Gemini **+** OpenAI behind one gateway) | Growth Engine (10 tools), agent mesh, Vision screenshot extraction, dispute evidence, ParserAgent templates. *Any one key enables it; all AI is ACU-metered & gated.* | `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY` | **P0/P1** | Usage-based; margin law keeps every price ≥ 2× loaded cost |
| **Meta WhatsApp Business Cloud API** | Door 2 (Chat Mode), receipts, digests, alerts, KODA Lite SMS forwarding | `META_WA_TOKEN`, `META_WA_PHONE_ID`, `META_API_VERSION`, `META_WA_VERIFY_TOKEN` | **P1** | Free tier of conversations, then per-conversation |
| **Transactional email** (Brevo) | Invoices, statements, security & team-invite mail | `BREVO_API_KEY` | **P1** | Free ≤ 300/day, then cheap tiers |

> **Note on the AI gateway:** the three model keys sit behind a single gateway so
> KODA services see one URL + key. With **no** key set, every AI feature falls
> back to deterministic templates — but the actions are still ACU-metered and
> gated (no free AI action, ever), so behaviour and billing stay correct.

### 4.2 Required for the Sentinel phone-edge (fills the real SMS ledger)

The money path is only "real" once a device is forwarding operator SMS into the
ledger. That needs:

| Provider | Powers | Env var(s) | Tier |
|---|---|---|---|
| **Google Play Integrity API** | Sentinel Android device attestation — the trust anchor for signed SMS records | (service account on the linked GCP project) | **P0 for live money** |
| **Firebase Cloud Messaging** | Push to Sentinel (OTA parser packs, sync nudges) + Console notifications | `FCM_KEY` | **P1** |

> Until a Sentinel build ships and forwards SMS, run KODA in **public beta**
> scope: the sandbox door (`/v1/sandbox/sms`, `TEST-*` references) and the
> Verify Console/manual + WhatsApp doors work end-to-end for demos and pilots.

### 4.3 Add as you scale (P2+)

| Provider | Purpose | When |
|---|---|---|
| **Managed Postgres** (Neon / Cloud SQL / Fly Postgres) | Migrate off SQLite for write concurrency & HA (see §7) | When one writer isn't enough |
| **Object storage** (GCS / S3 / R2) | Off-box backups, Vision screenshot archive | P1 |
| **Sentry** | Error monitoring (cloud + Sentinel) | P1 |
| **Better Stack / Instatus** | Public status + parse-health page | P1 |
| **PostHog** | Product analytics — the <10-min-to-first-verification north star | P1 |
| **Smile ID / Sumsub** | KYB/KYC for sub-merchant onboarding (Plateforme tier) | First platform deal |
| **Stripe / Flutterwave** | Card/bank ACU top-ups (Enterprise) | First enterprise contract |
| **PagerDuty** (or Better Stack alerts) | Human escalation paging | P1 |

### 4.4 Deliberately NOT needed

- **No telco/operator API integration** — the SMS *is* the API. This is the moat.
- **No Kafka/Redis/queue cluster** to launch — eventing is in-process + webhooks;
  add a broker only at platform scale.
- **No separate frontend host / CDN origin** — one Node process serves it all.

See `THIRD_PARTY_KEYS.md` for step-by-step key-acquisition instructions for each
provider above.

---

## 5. Environment variables (single reference)

All variables, grouped, live in `app/.env.example`. The production-critical set:

| Var | Required | Purpose |
|---|---|---|
| `KODA_JWT_SECRET` | **yes (prod)** | Session signing; prod refuses the dev default |
| `KODA_PUBLIC_URL` | **yes (prod)** | Canonical origin for `checkout_url` links |
| `KODA_DATA_DIR` | yes | SQLite location — point at the mounted volume |
| `KODA_ADMIN_EMAIL` / `KODA_ADMIN_PASSWORD` | **yes (prod)** | First-admin bootstrap (no demo seed in prod) |
| `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` / `OPENAI_API_KEY` | for AI | Enables Growth/agents/Vision (else deterministic) |
| `META_WA_TOKEN` / `META_WA_PHONE_ID` / `META_WA_VERIFY_TOKEN` | for WhatsApp | Door 2 + notifications |
| `BREVO_API_KEY` | for email | Transactional email (else renders to log) |
| `FCM_KEY` | for push | Sentinel/console push |
| `KODA_BUILD_SHA` / `KODA_BUILD_DATE` | CI | Build identity at `/version` |

---

## 6. Harmonisation & stabilisation status

- **One version identity:** `shared/version.js` is the single source; the API
  contract, decision-trace template, startup banner, and `/version` all read
  from it.
- **One test base var:** every HTTP test suite targets `KODA_BASE` (PORT-aware
  default); `test.js` self-boots on an isolated port + temp DB.
- **Config is complete & consistent:** `.env.example`, `Dockerfile`, `fly.toml`,
  and `render.yaml` agree on `PORT`, `KODA_DATA_DIR=/data`, and the volume mount.
- **Design tokens are consistent** across CSS, SPA, site builder, checkout,
  manifest, and icon (single brand palette, verified).
- **Test gate: 160 checks green** — 61 unit + margin, 35 adversarial/security,
  13 growth, 11 AI-gating, 19 checkout e2e, 21 browser-UI — plus the
  busy-merchant and bench runs. `npm run test:all` is the CI gate.

---

## 7. Scale-up path (when SQLite isn't enough)

Signals to migrate: sustained write contention, need for >1 writer, or a
multi-region HA requirement.

1. **SQLite → Postgres.** Every query already funnels through the prepared-
   statement layer in `backend/lib/db.js` (the intended swap point). Port the
   schema, replace `DatabaseSync` with a Postgres client behind the same `q`
   interface, keep the rest of the OS unchanged.
2. **One instance → N.** With Postgres you can run multiple stateless KODA
   containers behind the load balancer and finally use **Cloud Run** or Fly
   autoscaling.
3. **In-process eventing → broker.** Introduce Pub/Sub or Kafka only when
   webhook fan-out volume or cross-service eventing demands it.

Until those signals appear, the single-container + SQLite design is the right
call: cheapest to run, simplest to operate, and fastest on the money path.
