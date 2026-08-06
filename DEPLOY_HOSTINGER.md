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

## Step 1 — Open the server terminal & install Docker
**No laptop install needed** — use Hostinger's built-in browser terminal.

In Hostinger: **VPS → your server → "Web console"**. A terminal opens in your
browser, already logged in as `root`. Everything in this guide is typed there.
*(Prefer a real SSH client? `ssh root@187.124.117.159` also works — but the Web
console needs nothing installed.)*

Install Docker (this runs on the **server**, not your laptop):
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
- Real **verified payments** → needs the **Sentinel Android app** (see
  `SENTINEL_APP_SPEC.md`). Each merchant installs it on **their own phone** and
  links **their own mobile-money number**. KODA holds no SIMs and never touches
  the money — customers pay the merchant directly; KODA only verifies.
- Real **WhatsApp** messages → do `SETUP_META_WHATSAPP.md` (~30 min of clicks)
- Real **emails** → add a Brevo key (until then they log)

So: launch as a **public beta** today; the **Sentinel app** is the one piece that
switches real payments on — no SIMs, no payment gateway, no money held by KODA.
Merchants pay you for the service via manual/prepaid top-ups at first (add a card
gateway later only if you want it).

---

## Auto-deploy (no more manual redeploys)

CI (`.github/workflows/ci.yml`) only **tests** each push — it never touches the
VPS. To make pushes go live on their own, run the poll-and-deploy script from
cron. It pulls the tracked branch, rebuilds, health-checks, and does nothing when
there's nothing new. Your `.env` and the `koda_data` ledger volume are untouched.

**One-time setup on the VPS** (as the deploy user, e.g. `koda`):
```bash
chmod +x ~/KODA/deploy/vps-autodeploy.sh
# edit the branch it tracks if needed (default is the current feature branch):
#   KODA_DEPLOY_BRANCH=main  at the top, or export it in the cron line
( crontab -l 2>/dev/null; echo '*/2 * * * * /home/koda/KODA/deploy/vps-autodeploy.sh' ) | crontab -
```

**Watch / operate:**
```bash
tail -f ~/koda-deploy.log            # see each deploy as it happens
~/KODA/deploy/vps-autodeploy.sh      # force a deploy right now
crontab -l                           # confirm the schedule
```

Every push to the tracked branch is now live within ~2 minutes. To point
production at `main` instead, set `KODA_DEPLOY_BRANCH=main` (recommended once the
feature branch is merged).

---

## Backups, disaster recovery & rollback

Three operational safeguards. All zero-dependency; the `koda_data` volume holds
the SQLite ledger.

### 1. Automated offsite backups
`backend/tools/backup.js` takes a consistent snapshot (`VACUUM INTO`, zero
downtime), writes it **off the data volume** (`KODA_BACKUP_DIR`), optionally ships
it offsite (`KODA_BACKUP_SHIP_CMD`, which can reference `$KODA_BACKUP_FILE`), and
prunes old copies (`KODA_BACKUP_KEEP`, default 14). Cron it every 6h **inside the
container** so it sees the DB:

```bash
# every 6 hours: snapshot to a host path bind-mounted off the data volume, ship offsite
0 */6 * * * docker compose -f /root/koda/app/docker-compose.yml exec -T koda \
  env KODA_BACKUP_DIR=/data/../koda-backups \
      KODA_BACKUP_SHIP_CMD='rclone copy "$KODA_BACKUP_FILE" remote:koda-backups' \
  node backend/tools/backup.js
```
(Or run `node backend/tools/backup.js` on a host checkout pointed at a copy of the DB.)

### 2. Restore (and the drill that proves it works)
```bash
# validate a backup is sound + restorable (never touches live data):
node backend/tools/restore.js /path/to/koda-YYYY-....db
# actually install it as the live DB (stop the app first):
node backend/tools/restore.js /path/to/backup.db --commit && docker compose restart koda
```
`npm run test:backup` runs an **automated backup→restore→verify drill** every test
run (seed → snapshot → reopen as a fresh DB → integrity_check + row-count match +
point-in-time proof). A backup you have never restored is not a backup — this
verifies one on every gate.

**RPO** = your backup interval (6h above). **RTO** = time to `restore.js --commit`
+ `docker compose restart` (~1 min). Keep at least one copy offsite.

### 3. Rollback
Code rollback never touches data (the volume persists):
```bash
KODA_REPO_DIR=/root/koda /root/koda/deploy/rollback.sh          # → previous commit
KODA_REPO_DIR=/root/koda /root/koda/deploy/rollback.sh <sha>    # → a specific commit
```
It checks out the target, rebuilds, and **health-checks** the result (fails loudly
if the rolled-back build is unhealthy). Return to latest with
`git checkout claude/koda-unified-spec-v2-vh5xtx && docker compose up -d --build`
(or just let the auto-deploy cron catch up).

### Uptime alerting
`deploy/healthcheck-cron.sh` (host-side, independent of the app process) probes
`/readyz` each minute and posts to `KODA_ALERT_WEBHOOK` on down/recovery. The app
also self-monitors: 500s, readiness failures, and any ledger imbalance page the
same webhook.
