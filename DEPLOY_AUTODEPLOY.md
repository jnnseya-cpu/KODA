# KODA — Automatic deployment (once and for all)

**How it works:** your VPS watches the deploy branch and updates itself. Every time work
lands on `claude/koda-unified-spec-v2-vh5xtx`, the server pulls, rebuilds, health-checks,
re-announces new pages to IndexNow, and emails you — within ~2 minutes. **No GitHub secrets,
no SSH keys, no dashboard config.** It survives reboots.

GitHub still runs the **test gate** on every push (`.github/workflows/ci.yml`); deployment lives
entirely on the server, so the two never fight.

---

## Turn it on — ONE command (run once on the VPS)

Open the Hostinger web console (or `ssh root@187.124.117.159`) and paste this **one** line:

```bash
systemctl stop koda-deploy.timer 2>/dev/null; cd /root/koda/app && git fetch origin && git checkout claude/koda-unified-spec-v2-vh5xtx && git pull --ff-only origin claude/koda-unified-spec-v2-vh5xtx && bash deploy/install-autopull.sh
```

*(The leading `systemctl stop …` pauses any already-installed timer so it can't fetch at the
same time as this pull — the installer re-arms it at the end. Safe to run even the first time.)*

This does everything in one go:
1. Pulls **all work so far** onto the server.
2. **Deploys it immediately** (builds, restarts, health-checks) — so the live site is caught up to the latest commit right now.
3. Arms auto-deploy, so every future push goes live within ~2 minutes.

You'll end on `✓ Live site is now on <sha>. Auto-deploy armed — no more manual updates.`
**That's the last manual command you ever run.**

> First time only: the installer checks the server can `git fetch` (it already can — that's the
> same auth your manual `git pull` uses). If it can't, it tells you to fix the clone's git token
> and re-run. Nothing else to configure.

---

## What each release does automatically
1. Detects the new commit on the deploy branch (checked every 2 min).
2. Fast-forwards the code (`git merge --ff-only` — refuses to deploy diverged history).
3. `docker compose up -d --build` — rebuilds and restarts.
4. Waits for `/healthz`; **fails loudly and keeps the old container serving** if the new one is unhealthy.
5. IndexNow re-announces only the URLs the release added.
6. Emails you "✅ KODA deployed" via **your own SMTP** (`KODA_SMTP_*`, already configured).

## Check / watch / stop it

```bash
systemctl status koda-deploy.timer          # is it active?
journalctl -u koda-deploy.service -f        # live deploy logs
bash /root/koda/app/deploy/vps-deploy.sh    # force a deploy right now, by hand
systemctl disable --now koda-deploy.timer   # turn auto-deploy OFF
```
*(If your VPS has no systemd, the installer uses cron instead — logs at `/var/log/koda-deploy.log`,
and you disable it with `crontab -e`.)*

---

## Safety
- **Health-checked:** an unhealthy build never replaces a working one — Docker only swaps on a good start.
- **Diverge-safe:** `--ff-only` refuses anything that isn't a clean fast-forward, so the server never auto-merges a mess.
- **Ledger-safe:** the SQLite volume (`koda_data`) is untouched by rebuilds.
- **No inbound exposure, no secrets stored:** the server pulls out to GitHub; nothing is opened up or handed to a third party.
- **Rollback:** `cd /root/koda/app && git checkout <previous-good-sha> && bash deploy/vps-deploy.sh`.

## Files (all versioned in the repo)
| File | Role |
|---|---|
| `app/deploy/install-autopull.sh` | one-time installer (systemd timer / cron) |
| `app/deploy/autopull-check.sh` | the 2-minute poll → deploy-on-change check |
| `app/deploy/vps-deploy.sh` | the build + health-check + IndexNow + email step |
