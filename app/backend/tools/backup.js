// KODA — online backup: consistent SQLite snapshot via VACUUM INTO (zero downtime).
// Writes OFF the data volume by default (KODA_BACKUP_DIR), optionally ships offsite
// (KODA_BACKUP_SHIP_CMD, which can reference $KODA_BACKUP_FILE), and prunes old
// local copies. Cron it — see DEPLOY_HOSTINGER.md.
//   node backend/tools/backup.js [outfile]
'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { execSync } = require('node:child_process');
const { db, DATA_DIR } = require('../lib/db');

// Default destination is OFF the data volume — a backup on the disk you're backing
// up protects nothing against volume loss. Override with KODA_BACKUP_DIR.
const dir = process.env.KODA_BACKUP_DIR || path.join(path.dirname(DATA_DIR.replace(/\/$/, '')), 'koda-backups');
const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
const out = process.argv[2] || path.join(dir, `koda-${stamp}.db`);
fs.mkdirSync(path.dirname(out), { recursive: true });

db.exec(`VACUUM INTO '${out.replace(/'/g, "''")}'`);
console.log('backup written:', out, `(${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);

// Ship offsite if configured. The command may reference $KODA_BACKUP_FILE.
// e.g. KODA_BACKUP_SHIP_CMD='rclone copy "$KODA_BACKUP_FILE" remote:koda-backups'
if (process.env.KODA_BACKUP_SHIP_CMD) {
  try {
    execSync(process.env.KODA_BACKUP_SHIP_CMD, { env: { ...process.env, KODA_BACKUP_FILE: out }, stdio: 'inherit', shell: '/bin/sh' });
    console.log('shipped offsite ✓');
  } catch (e) { console.error('ship failed:', e.message); }
}

// Prune: keep the most recent KODA_BACKUP_KEEP (default 14) local snapshots.
const keep = Number(process.env.KODA_BACKUP_KEEP) || 14;
try {
  const files = fs.readdirSync(path.dirname(out)).filter(f => /^koda-.*\.db$/.test(f)).sort().reverse();
  for (const f of files.slice(keep)) fs.unlinkSync(path.join(path.dirname(out), f));
  if (files.length > keep) console.log(`pruned ${files.length - keep} old backup(s), kept ${keep}`);
} catch { /* prune is best-effort */ }
