# KODA — Go live on your Hostinger VPS (step by step)

Your server & domain (already in hand):

| Thing | Value |
|---|---|
| VPS IP | `187.124.117.159` |
| SSH | `ssh root@187.124.117.159` |
| OS | Ubuntu 24.04 LTS (KVM 1 · 1 CPU · 4 GB · 50 GB) — plenty for KODA |
| Location | UK, Manchester (fine latency to your corridors) |
| Domain | `kodajnn.com` |
| Admin email | `koda@kodajnn.com` |

One container runs the whole OS (frontend + backend + ledger); a second (Caddy)
gives automatic HTTPS. **~15 minutes to live.** Do the steps in order.

---

## Step 1 — Connect to the server & install Docker
**Opens a command line on your VPS and installs Docker.**

On your computer, open **Terminal** (Mac) or **PowerShell** (Windows):
```bash
ssh root@187.124.117.159
```
Enter the **root password** from Hostinger when asked. Then:
```bash
curl -fsSL https://get.docker.com | sh
docker version
```
✅ You should see version numbers, no errors.

---

## Step 2 — Download KODA
```bash
git clone https://github.com/jnnseya-cpu/koda.git
cd koda/app
git checkout claude/koda-unified-spec-v2-vh5xtx
```
- If asked for a password: it's a **GitHub token**, not your login password. Ask me and I'll walk you through making one (2 clicks).

✅ You should see `Switched to branch 'claude/koda-unified-spec-v2-vh5xtx'`.

---

## Step 3 — Add your settings (`.env`)
**The only file you edit.** First generate a secret and copy what it prints:
```bash
openssl rand -hex 32
```
Open the file:
```bash
nano .env
```
Paste this and replace the CAPS values (secret from above, a strong password, your 3 AI keys):
```
NODE_ENV=production
PORT=8080
KODA_DATA_DIR=/data
KODA_PUBLIC_URL=https://kodajnn.com
KODA_DOMAIN=kodajnn.com
KODA_JWT_SECRET=PASTE_THE_LONG_STRING_FROM_ABOVE
KODA_ADMIN_EMAIL=koda@kodajnn.com
KODA_ADMIN_PASSWORD=PICK_A_STRONG_PASSWORD
ANTHROPIC_API_KEY=PASTE_YOUR_CLAUDE_KEY
GEMINI_API_KEY=PASTE_YOUR_GEMINI_KEY
OPENAI_API_KEY=PASTE_YOUR_OPENAI_KEY
```
Save: **Ctrl+O**, **Enter**, **Ctrl+X**.

*(WhatsApp & email stay blank today — safe test mode. Add them later with
`SETUP_META_WHATSAPP.md`.)*

---

## Step 4 — Point the domain at the server
In **Hostinger → Domains → kodajnn.com → DNS Zone**, add an **A record**:

| Type | Name | Points to | TTL |
|---|---|---|---|
| A | `@` | `187.124.117.159` | default |

*(Optional: add a second A record, Name `www`, same IP.)* Then check on the VPS:
```bash
dig +short kodajnn.com
```
✅ You should see `187.124.117.159` (may take a few minutes).

---

## Step 5 — Launch (one command)
In `koda/app`:
```bash
docker compose up -d --build
docker compose ps
```
✅ Both **koda** and **caddy** show *running*. Caddy fetches a free HTTPS
certificate for `kodajnn.com` on the first request.

---

## Step 6 — Confirm it's live (public can test now)
```bash
curl https://kodajnn.com/healthz
```
✅ `{"ok":true,...}`

In a browser:
- **https://kodajnn.com/** — the public site
- **https://kodajnn.com/app** — sign in with `koda@kodajnn.com` + your password,
  then run a **sandbox test payment** (create intent → checkout → enter code → verified).

🎉 **You're live.**

---

## Step 7 — Fast frontend worldwide (Cloudflare, free) — *after Step 6*
Adds a global CDN in front. No change to the app.

1. Create a free **Cloudflare** account → **Add a site** → `kodajnn.com`.
2. Cloudflare gives you **2 nameservers**. In **Hostinger → Domains → kodajnn.com
   → Nameservers**, replace Hostinger's with those two.
3. In Cloudflare **DNS**, the A record → `187.124.117.159` must be **Proxied**
   (orange cloud ON).
4. Cloudflare **SSL/TLS → Overview** → **Full (strict)**.

✅ Site now loads fast globally. Do it after Step 6 so the certificate is already
issued.

---

## Step 8 — Backups (5 minutes)
```bash
crontab -e
```
Add this line (snapshot every 6 h):
```
0 */6 * * * cd /root/koda/app && docker compose exec -T koda node backend/tools/backup.js /data/backup.db
```
Then in Hostinger, turn on **Snapshots & backups** (you're currently on *Weekly*;
the £2.99/mo automated-daily add-on is worth it for a payments product).

---

## Updating later
```bash
cd /root/koda/app && git pull && docker compose up -d --build
```
Your ledger volume is preserved across updates.

---

## Day-1 scope (tell testers)

**Works today ✅**
- Public site + every dashboard (owner, manager, cashier, admin, platform)
- Full **checkout → verify → receipt → webhook** cycle (sandbox door)
- All **10 AI Growth tools + agents**, live on your own AI keys
- The **WhatsApp door** and **Sentinel device forward** are coded & tested — they
  switch on the moment you add the Meta keys / pair a phone

**Not yet 🔴 (none block a public beta)**
- Real customer money in your bank → needs the **Sentinel Android app** (see
  `SENTINEL_APP_SPEC.md`) **+ mobile-money SIMs**
- Real **WhatsApp** messages → do `SETUP_META_WHATSAPP.md` (~30 min of clicks)
- Real **emails** → add a Brevo key (until then they log)

So: launch as a **public beta** today; add Sentinel + SIMs to see money land.
