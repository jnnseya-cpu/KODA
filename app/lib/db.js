// KODA — database layer (node:sqlite, zero dependencies)
// Swap-to-Postgres path: every query goes through prepared statements here;
// replace this module with a pg adapter without touching route code.
'use strict';
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DATA_DIR = process.env.KODA_DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, 'koda.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS merchants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'CD',
  currency TEXT NOT NULL DEFAULT 'CDF',
  plan TEXT NOT NULL DEFAULT 'marche',          -- marche|boutique|commerce|plateforme|enterprise
  msisdn TEXT,
  brand_color TEXT DEFAULT '#E8A11F',
  logo_text TEXT,
  acu_balance REAL NOT NULL DEFAULT 50,          -- Marché monthly grant
  language TEXT NOT NULL DEFAULT 'fr',
  is_platform INTEGER NOT NULL DEFAULT 0,
  parent_id TEXT,                                -- sub-merchants point at platform merchant
  status TEXT NOT NULL DEFAULT 'active',         -- active|suspended
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  merchant_id TEXT REFERENCES merchants(id),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  pass_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner',            -- owner|manager|cashier
  is_admin INTEGER NOT NULL DEFAULT 0,           -- KODA staff
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  prefix TEXT NOT NULL,                          -- sk_live|pk_live|sk_test|pk_test|sk_live_sub|rk_live
  key_hash TEXT NOT NULL,
  last4 TEXT NOT NULL,
  label TEXT,
  submerchant_id TEXT,
  revoked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  label TEXT NOT NULL,
  operator TEXT NOT NULL,
  sim_msisdn TEXT,
  enrol_code TEXT,
  status TEXT NOT NULL DEFAULT 'pending',        -- pending|active|revoked
  attested INTEGER NOT NULL DEFAULT 0,
  last_seen TEXT,
  battery INTEGER DEFAULT 100,
  parse_health REAL DEFAULT 1.0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sms_ledger (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  device_id TEXT,
  operator TEXT NOT NULL,
  raw TEXT NOT NULL,
  ref_code TEXT,
  amount REAL,
  currency TEXT,
  counterparty_name TEXT,
  counterparty_suffix TEXT,
  balance_after REAL,
  direction TEXT NOT NULL DEFAULT 'in',          -- in|reversal
  chain_ok INTEGER NOT NULL DEFAULT 1,
  quarantined INTEGER NOT NULL DEFAULT 0,
  matched_intent_id TEXT,
  received_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS intents (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  submerchant_id TEXT,
  amount REAL NOT NULL,
  currency TEXT NOT NULL,
  operators TEXT NOT NULL,                       -- JSON array
  customer_msisdn TEXT,
  metadata TEXT,                                 -- JSON
  status TEXT NOT NULL DEFAULT 'awaiting_payment',
  -- awaiting_payment|verified|verified_late|pending_review|rejected|expired|cancelled
  purpose TEXT NOT NULL DEFAULT 'sale',          -- sale|topup
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS receipts (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  intent_id TEXT NOT NULL,        -- intent id, or 'int_manual'/'int_sandbox' pseudo-ids
  sms_id TEXT,
  reference TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL,
  operator TEXT,
  payer_name_masked TEXT,
  payer_suffix TEXT,
  risk_score REAL NOT NULL DEFAULT 0,
  mode TEXT NOT NULL DEFAULT 'api',              -- manual|chat|api
  decision_trace TEXT,                           -- JSON audit trace
  acu_cost REAL NOT NULL DEFAULT 1,
  verified_by TEXT,                              -- user id for manual mode
  verified_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS replay_index (
  reference TEXT NOT NULL,
  merchant_id TEXT NOT NULL,
  receipt_id TEXT,
  used_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (reference, merchant_id)
);

CREATE TABLE IF NOT EXISTS disputes (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  intent_id TEXT,
  reference TEXT,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',           -- open|accepted|rejected|escalated
  evidence TEXT,                                 -- JSON evidence file (DisputeAgent)
  recommendation TEXT,
  resolved_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT NOT NULL DEFAULT '["*"]',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id TEXT PRIMARY KEY,
  endpoint_id TEXT NOT NULL REFERENCES webhook_endpoints(id),
  merchant_id TEXT NOT NULL,
  event TEXT NOT NULL,
  payload TEXT NOT NULL,
  signature TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',        -- pending|sent|failed|dead
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  delivered_at TEXT
);

CREATE TABLE IF NOT EXISTS acu_transactions (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  delta REAL NOT NULL,                           -- + topup, - consumption
  kind TEXT NOT NULL,                            -- topup|verification|vision|dispute|trust|submerchant|grant
  ref TEXT,
  balance_after REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  number TEXT NOT NULL,
  amount_usd REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'paid',           -- paid|due|overdue
  period TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  merchant_id TEXT,
  event_key TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  body TEXT,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS comm_deliveries (
  id TEXT PRIMARY KEY,
  merchant_id TEXT,
  user_id TEXT,
  event_key TEXT NOT NULL,
  channel TEXT NOT NULL,                         -- email|inapp|whatsapp|push|sms
  recipient TEXT,
  subject TEXT,
  provider TEXT NOT NULL DEFAULT 'sandbox',      -- sandbox|brevo|meta|fcm
  status TEXT NOT NULL DEFAULT 'logged',         -- logged|sent|failed
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS comm_prefs (
  user_id TEXT NOT NULL,
  channel TEXT NOT NULL,                         -- email|whatsapp|push|sms
  enabled INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, channel)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  merchant_id TEXT,
  user_id TEXT,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sms_merchant ON sms_ledger(merchant_id, received_at);
CREATE INDEX IF NOT EXISTS idx_sms_ref ON sms_ledger(merchant_id, ref_code);
CREATE INDEX IF NOT EXISTS idx_receipts_merchant ON receipts(merchant_id, verified_at);
CREATE INDEX IF NOT EXISTS idx_intents_merchant ON intents(merchant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comm_created ON comm_deliveries(created_at);
`);

// tiny helpers ---------------------------------------------------------------
const q = {
  get: (sql, ...p) => db.prepare(sql).get(...p),
  all: (sql, ...p) => db.prepare(sql).all(...p),
  run: (sql, ...p) => db.prepare(sql).run(...p),
};

module.exports = { db, q, DATA_DIR };
