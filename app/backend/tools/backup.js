// KODA — online backup: consistent SQLite snapshot via VACUUM INTO.
// Cron it (e.g. every 6h) and ship the file to GCS/S3. Zero downtime.
'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { db, DATA_DIR } = require('../lib/db');
const out = process.argv[2] || path.join(DATA_DIR, `backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.db`);
fs.mkdirSync(path.dirname(out), { recursive: true });
db.exec(`VACUUM INTO '${out.replace(/'/g, "''")}'`);
console.log('backup written:', out, `(${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
