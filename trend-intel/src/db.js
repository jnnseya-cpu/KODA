// Trend Intelligence AI — persistence & tenant isolation (node:sqlite, zero deps).
//
// Stack note (spec §15 adaptation): the spec's reference uses Postgres row-level
// security. On KODA's SQLite stack there is no per-role RLS, so isolation is
// enforced at the DATA-ACCESS LAYER: every private read/write goes through a
// `scoped(installation_id)` accessor that binds installation_id into each query.
// No raw DB handle is handed to callers, so a private row cannot be selected
// without resolving installation authority first (spec §15 "Never select a
// private row before resolving installation authority").
'use strict';
const { DatabaseSync } = require('node:sqlite');
const crypto = require('node:crypto');

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS installations (
  installation_id TEXT PRIMARY KEY,
  org             TEXT NOT NULL,
  platform_slug   TEXT NOT NULL,
  environment     TEXT NOT NULL DEFAULT 'prod',
  default_market  TEXT,
  default_locale  TEXT,
  mode            TEXT NOT NULL DEFAULT 'draft_only',
  created_at      TEXT NOT NULL DEFAULT (${NOW}),
  disabled_at     TEXT,
  UNIQUE(org, platform_slug, environment)
);

CREATE TABLE IF NOT EXISTS source_registry (
  installation_id TEXT NOT NULL REFERENCES installations(installation_id),
  source_id       TEXT NOT NULL,
  access_path     TEXT NOT NULL CHECK(access_path IN ('public_keyless','host_mediated','file_import')),
  source_family   TEXT NOT NULL,
  quality         REAL NOT NULL DEFAULT 50,
  stale_after_sec INTEGER,
  terms_version   TEXT,
  status          TEXT NOT NULL DEFAULT 'active',
  PRIMARY KEY (installation_id, source_id)
);

CREATE TABLE IF NOT EXISTS observations (
  installation_id  TEXT NOT NULL,
  source_id        TEXT NOT NULL,
  source_family    TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  revision         INTEGER NOT NULL DEFAULT 1,
  observed_at      TEXT NOT NULL,
  window_start     TEXT,
  window_end       TEXT,
  ingested_at      TEXT NOT NULL DEFAULT (${NOW}),
  geography        TEXT,
  locale           TEXT,
  segment          TEXT,
  metric           TEXT,
  value            REAL,
  unit             TEXT,
  scaling_scope    TEXT,
  coverage         REAL,
  evidence_uri     TEXT,
  evidence_hash    TEXT NOT NULL,
  terms_version    TEXT,
  PRIMARY KEY (installation_id, source_id, source_record_id, revision),
  FOREIGN KEY (installation_id, source_id) REFERENCES source_registry(installation_id, source_id)
);
CREATE INDEX IF NOT EXISTS obs_window ON observations(installation_id, source_id, window_end);
`;

function open(path = ':memory:') {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  return db;
}

// canonical content hash of an observation's semantic payload (for dedup/conflict).
function evidenceHash(rec) {
  const canon = JSON.stringify([
    rec.observed_at, rec.window_start ?? null, rec.window_end ?? null,
    rec.geography ?? null, rec.locale ?? null, rec.segment ?? null,
    rec.metric ?? null, rec.value ?? null, rec.unit ?? null,
    rec.scaling_scope ?? null, rec.coverage ?? null,
  ]);
  return crypto.createHash('sha256').update(canon).digest('hex');
}

// admin/unscoped: create installations and public reference setup only.
function admin(db) {
  return {
    createInstallation(o) {
      const id = o.installation_id || ('inst_' + crypto.randomBytes(6).toString('hex'));
      db.prepare(`INSERT INTO installations (installation_id,org,platform_slug,environment,default_market,default_locale,mode)
                  VALUES (?,?,?,?,?,?,?)`).run(
        id, o.org, o.platform_slug, o.environment || 'prod',
        o.default_market || null, o.default_locale || null, o.mode || 'draft_only');
      return id;
    },
    getInstallation(id) { return db.prepare('SELECT * FROM installations WHERE installation_id=?').get(id); },
  };
}

// Tenant-scoped accessor: EVERY method binds installation_id. This is the only
// way module code touches private rows, so cross-tenant reads are structurally
// impossible (a query for A can never return B's rows).
function scoped(db, installationId) {
  if (!installationId) throw new Error('installation scope required');
  const self = installationId;
  return {
    installationId: self,

    registerSource(src) {
      db.prepare(`INSERT INTO source_registry (installation_id,source_id,access_path,source_family,quality,stale_after_sec,terms_version,status)
                  VALUES (?,?,?,?,?,?,?,?)
                  ON CONFLICT(installation_id,source_id) DO UPDATE SET
                    access_path=excluded.access_path, source_family=excluded.source_family,
                    quality=excluded.quality, stale_after_sec=excluded.stale_after_sec,
                    terms_version=excluded.terms_version, status=excluded.status`).run(
        self, src.source_id, src.access_path, src.source_family,
        src.quality ?? 50, src.stale_after_sec ?? null, src.terms_version ?? null, src.status ?? 'active');
      return this.getSource(src.source_id);
    },
    getSource(sourceId) {
      return db.prepare('SELECT * FROM source_registry WHERE installation_id=? AND source_id=?').get(self, sourceId);
    },

    getObservation(sourceId, recordId, revision = 1) {
      return db.prepare(`SELECT * FROM observations WHERE installation_id=? AND source_id=? AND source_record_id=? AND revision=?`)
        .get(self, sourceId, recordId, revision);
    },
    insertObservation(sourceId, rec) {
      const hash = rec.evidence_hash || evidenceHash(rec);
      db.prepare(`INSERT INTO observations
        (installation_id,source_id,source_family,source_record_id,revision,observed_at,window_start,window_end,
         geography,locale,segment,metric,value,unit,scaling_scope,coverage,evidence_uri,evidence_hash,terms_version)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        self, sourceId, rec.source_family, rec.source_record_id, rec.revision ?? 1, rec.observed_at,
        rec.window_start ?? null, rec.window_end ?? null, rec.geography ?? null, rec.locale ?? null,
        rec.segment ?? null, rec.metric ?? null, rec.value ?? null, rec.unit ?? null,
        rec.scaling_scope ?? null, rec.coverage ?? null, rec.evidence_uri ?? null, hash, rec.terms_version ?? null);
      return hash;
    },
    listObservations(sourceId) {
      return db.prepare('SELECT * FROM observations WHERE installation_id=? AND source_id=? ORDER BY window_end')
        .all(self, sourceId);
    },
    countObservations() {
      return db.prepare('SELECT COUNT(*) c FROM observations WHERE installation_id=?').get(self).c;
    },
  };
}

module.exports = { open, admin, scoped, evidenceHash };
