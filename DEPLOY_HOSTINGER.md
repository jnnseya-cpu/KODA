# KODA — Go live on your Hostinger VPS today (with a fast global frontend)

This is the whole launch, using only what you already have:

- **Hostinger** — domain + VPS (runs the one container: frontend + backend + ledger)
- **Your AI keys** — OpenAI + Gemini + Claude (all AI features run live)
- **Firebase FCM** — push (optional today)
- **Cloudflare (free)** — CDN in front for a fast frontend worldwide (no app split)

Two containers run on the VPS: **koda** (the whole OS) and **caddy** (auto‑HTTPS +
reverse proxy). Config lives in `app/docker-compose.yml`, `app/Caddyfile`.

> **Time:** ~15 min to live and public‑testable (Steps 1–6). Cloudflare speed
> layer (Step 7) finishes the same day.

---

## Before you start — have these ready

- Your Hostinger **VPS IP** and **root SSH** access (a KVM VPS plan, not shared hosting).
- Your **domain** (e.g. `koda.africa`) — decide the exact hostname you'll launch on.
- Your three **AI keys**.
- 5 minutes to generate a couple of secrets (commands below).

---

## Step 1 — SSH into the VPS and install Docker

```bash
ssh root@YOUR_VPS_IP

# install Docker + compose plugin (Ubuntu/Debian)
curl -fsSL https://get.docker.com | sh
docker version && docker compose version    # confirm both work
```

## Step 2 — Get the KODA code onto the VPS

```bash
# private repo: use a GitHub personal access token when prompted for a password
git clone https://github.com/jnnseya-cpu/koda.git
cd koda/app
git checkout claude/koda-unified-spec-v2-vh5xtx
```

## Step 3 — Create the secrets file (`.env`)

```bash
# in koda/app
cat > .env <<EOF
NODE_ENV=production
PORT=8080
KODA_DATA_DIR=/data

# your public site — MUST be the real domain (used for checkout links)
KODA_PUBLIC_URL=https://koda.africa
KODA_DOMAIN=koda.africa

# session signing — generate a strong one:
KODA_JWT_SECRET=$(openssl rand -hex 32)

# first admin (you) — created on first boot, then rotate
KODA_ADMIN_EMAIL=you@koda.africa
KODA_ADMIN_PASSWORD=CHANGE_ME_STRONG

# AI (live features) — paste your keys
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
OPENAI_API_KEY=

# leave these blank today = safe sandbox (WhatsApp/email add later)
BREVO_API_KEY=
META_WA_TOKEN=
META_WA_PHONE_ID=
META_WA_VERIFY_TOKEN=koda-verify
FCM_KEY=
EOF

nano .env    # paste your AI keys, set a real admin password
```

> `.env` is git‑ignored — it never leaves the VPS.

## Step 4 — Point your domain at the VPS

In **Hostinger → Domains → DNS Zone**, create an **A record**:

| Type | Name | Points to | TTL |
|---|---|---|---|
| A | `@` (or `koda`) | `YOUR_VPS_IP` | default |

Wait a few minutes, then confirm it resolves:
```bash
dig +short koda.africa    # should print YOUR_VPS_IP
```

## Step 5 — Launch KODA

```bash
# in koda/app
docker compose up -d --build
docker compose ps           # both koda + caddy should be "running"/"healthy"
docker compose logs -f koda # watch the boot banner, then Ctrl-C
```

Caddy automatically obtains a free HTTPS certificate for your domain on first request.

## Step 6 — Verify it's live (public can test now)

```bash
curl https://koda.africa/healthz     # {"ok":true,...}
curl https://koda.africa/readyz      # {"ok":true,"db":"up",...}
curl https://koda.africa/version     # your build + versions
```

Open it in a browser:
- `https://koda.africa/` — public site
- `https://koda.africa/app` — create an account, sign in
- Run a **sandbox verification** end‑to‑end (create intent → checkout → code → verified).

**You are live and publicly testable.** 🎉

---

## Step 7 — Add Cloudflare for a fast frontend (free, no app split)

This puts a global CDN in front so the site, `/shared/*`, and the checkout widget
load fast worldwide — while the app keeps running as one unit on your VPS.

1. Create a free **Cloudflare** account → **Add site** → enter your domain.
2. Cloudflare shows two **nameservers**. In **Hostinger → Domains → Nameservers**,
   switch from Hostinger's to the two Cloudflare ones. (Propagates in minutes–1 h.)
3. In Cloudflare **DNS**, make sure the A record → `YOUR_VPS_IP` is **Proxied**
   (orange cloud **on**).
4. In Cloudflare **SSL/TLS → Overview**, set mode to **Full (strict)**.
   (Caddy already holds a real Let's Encrypt cert on the VPS, so this is secure.)
5. **Speed:** Cloudflare caches static assets automatically. Optionally add a
   Cache Rule for `/*` static paths (`/shared/*`, `/js/*`, `/blog/*`, images).

> Order matters: bring the site up on the VPS first (Steps 1–6) so Caddy can issue
> its certificate, **then** flip Cloudflare's proxy on. Doing it in this order
> avoids the cert chicken‑and‑egg.

---

## Step 8 — Backups (5 minutes, keeps it all on Hostinger)

Zero‑downtime SQLite snapshot on a schedule:
```bash
# add to root's crontab (crontab -e) — snapshot every 6 hours
0 */6 * * * cd /root/koda/app && docker compose exec -T koda node backend/tools/backup.js /data/backup.db
```
Also enable **Hostinger's VPS Snapshots/Backups** add‑on for whole‑box recovery.

---

## Updating later (new code)

```bash
cd /root/koda/app
git pull
docker compose up -d --build     # ledger volume is preserved
```

## Day‑1 scope (be honest with testers)

Everything works today **except** the parts that need vendors/hardware you don't
have yet:

| Works today | Needs setup later |
|---|---|
| Public site, merchant app, all dashboards | — |
| Customer checkout (sandbox door), verify + fraud engine | Real customer money → **Sentinel Android app + mobile‑money SIMs** |
| All 10 AI Growth tools + agents (live, your keys) | — |
| Push (if FCM key set) | Real **WhatsApp** door → Meta setup |
| — | Real **emails** → Brevo key (until then they log) |

So: launch as a **public test / beta**. Testers can exercise the entire OS via the
sandbox door; the only thing that can't happen yet is a real stranger's real
payment landing in your bank — that waits on the Sentinel phone app + SIMs.
