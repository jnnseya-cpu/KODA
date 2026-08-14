# KODA — Auto-deploy on push (GitHub → VPS)

**What this does:** every time work lands on `claude/koda-unified-spec-v2-vh5xtx`, GitHub
runs the full test gate and — only if it's green — SSHes into your Hostinger VPS, pulls,
rebuilds, and health-checks the container. New blog/city pages are announced to IndexNow
automatically on the new container's boot. **You stop touching the console to ship.**

> Until you add the 4 secrets below, the deploy job **safely no-ops** (prints a warning, stays
> green). Nothing breaks — you just keep deploying by hand until you're ready.

The pipeline is already committed:
- `.github/workflows/ci.yml` → job **`deploy`** (`needs: gate`) — runs only after tests pass.
- `app/deploy/vps-deploy.sh` → the VPS-side build + health-check step.

You only need to do the **one-time setup** below (~5 minutes).

---

## Step 1 — Make a dedicated SSH deploy key (on your laptop or the Hostinger web console)

```bash
ssh-keygen -t ed25519 -C "koda-github-deploy" -f koda_deploy -N ""
```
This creates two files: `koda_deploy` (private) and `koda_deploy.pub` (public).
Use a **separate** key for CI — never your personal SSH key.

## Step 2 — Authorise the key on the VPS

Add the **public** key to the VPS so GitHub can log in:

```bash
# on the VPS (ssh root@187.124.117.159), paste the CONTENTS of koda_deploy.pub:
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo "ssh-ed25519 AAAA...koda-github-deploy" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

## Step 3 — Add 4 repository secrets on GitHub

**GitHub → your repo → Settings → Secrets and variables → Actions → New repository secret.**
Add each of these:

| Secret name | Value |
|---|---|
| `VPS_SSH_KEY` | the **entire private** key — the full contents of `koda_deploy` (include the `-----BEGIN…` and `-----END…` lines) |
| `VPS_HOST` | `187.124.117.159`  *(or `kodajnn.com`)* |
| `VPS_USER` | `root` |
| `VPS_APP_DIR` | *(optional)* `/root/koda/app` — only if your clone lives somewhere else |

## Step 4 — Confirm the VPS clone tracks the deploy branch

The workflow runs `git pull` on the VPS, so the clone must exist and be on the right branch
(you did this in `DEPLOY_HOSTINGER.md` Step 2):

```bash
cd /root/koda/app && git rev-parse --abbrev-ref HEAD    # → claude/koda-unified-spec-v2-vh5xtx
```
If it prints something else: `git checkout claude/koda-unified-spec-v2-vh5xtx`.

Also make sure the VPS git can fetch (it clones over HTTPS; a read is enough — no push token
needed for pulls of a public repo, or the token you already used to clone).

---

## Step 5 — Ship

Push anything to the branch (or use **Actions → KODA CI → Run workflow**). You'll see two jobs:

1. **gate** — the full test suite.
2. **deploy** — SSH → `git pull` → `docker compose up -d --build` → health check.

Watch it live in **GitHub → Actions**. On success the VPS is already running the new build,
and IndexNow has been re-pinged with any new URLs.

---

## Deploy on demand (no push needed)

**GitHub → Actions → KODA CI → Run workflow** → pick the
`claude/koda-unified-spec-v2-vh5xtx` branch → **Run workflow**. This runs the gate and then
deploys, exactly like a push — handy for re-deploying without a code change.

## Deploy notifications

None to set up. **GitHub automatically emails you if a deploy fails** — no keys, no config.

---

## Safety notes
- **Tests gate the deploy.** If `gate` fails, `deploy` never runs — a broken build can't reach production.
- **Health-checked.** `vps-deploy.sh` waits for `/healthz`; if it never comes up, the job goes red and prints the container logs. Your **old container keeps serving** until the new one is healthy (Docker only swaps on a successful start).
- **One at a time.** `concurrency: vps-deploy` stops two releases from overlapping.
- **Ledger is safe.** The SQLite volume (`koda_data`) is untouched by rebuilds.
- **Rollback:** on the VPS, `cd /root/koda/app && git checkout <previous-good-sha> && bash deploy/vps-deploy.sh`.

## Turning it off
Remove the `VPS_SSH_KEY` secret (the job reverts to a harmless no-op), or delete the `deploy`
job from `.github/workflows/ci.yml`.
