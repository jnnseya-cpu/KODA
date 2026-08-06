// KODA — database layer (node:sqlite, zero dependencies)
// Swap-to-Postgres path: every query goes through prepared statements here;
// replace this module with a pg adapter without touching route code.
'use strict';
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DATA_DIR = process.env.KODA_DATA_DIR || path.join(__dirname, '..', '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, 'koda.db'));
// WAL + synchronous=NORMAL: commits skip per-transaction fsync (durability at
// checkpoint), the standard high-throughput SQLite posture; busy_timeout guards
// concurrent writers during bursts.
db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;');

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
  acu_balance REAL NOT NULL DEFAULT 50,          -- free AI/overage allowance (verifs within quota are free)
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
  scopes TEXT NOT NULL DEFAULT '["*"]',          -- JSON array; rk_ keys carry restricted scopes
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
  device_token TEXT,                             -- bearer secret the Sentinel app uses to forward SMS
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
  client_secret TEXT,                            -- per-intent token for the customer-facing checkout
  success_url TEXT,                              -- where the customer is sent on verified
  cancel_url TEXT,
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

-- password reset tokens (forgot-password flow). token_hash = sha256(token); the
-- raw token only ever lives in the emailed link. Single-use, short-lived.
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sms_merchant ON sms_ledger(merchant_id, received_at);
CREATE INDEX IF NOT EXISTS idx_sms_ref ON sms_ledger(merchant_id, ref_code);
CREATE INDEX IF NOT EXISTS idx_receipts_merchant ON receipts(merchant_id, verified_at);
CREATE INDEX IF NOT EXISTS idx_intents_merchant ON intents(merchant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comm_created ON comm_deliveries(created_at);
`);

// lightweight migrations for existing dev databases
try { db.exec(`ALTER TABLE api_keys ADD COLUMN scopes TEXT NOT NULL DEFAULT '["*"]'`); } catch { /* exists */ }
try { db.exec(`ALTER TABLE intents ADD COLUMN client_secret TEXT`); } catch { /* exists */ }
try { db.exec(`ALTER TABLE intents ADD COLUMN success_url TEXT`); } catch { /* exists */ }
try { db.exec(`ALTER TABLE intents ADD COLUMN cancel_url TEXT`); } catch { /* exists */ }
try { db.exec(`ALTER TABLE devices ADD COLUMN device_token TEXT`); } catch { /* exists */ }

// merchant network accounts — a merchant proves + activates specific operator
// deployments (registry network_code). The Payment Method Resolver reads these
// to decide what a customer may see. (Network Intelligence Layer.)
db.exec(`CREATE TABLE IF NOT EXISTS merchant_network_accounts (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  submerchant_id TEXT,
  network_code TEXT NOT NULL,                       -- registry operator id, e.g. orange_cd
  account_identifier TEXT,                          -- receiving msisdn/till (masked in output)
  masked TEXT,
  account_holder_name TEXT,
  ownership_status TEXT NOT NULL DEFAULT 'UNVERIFIED', -- UNVERIFIED|VERIFIED
  activation_status TEXT NOT NULL DEFAULT 'DRAFT',     -- DRAFT|ACTIVE|PAUSED|SUSPENDED
  enabled_manual INTEGER NOT NULL DEFAULT 1,
  enabled_whatsapp INTEGER NOT NULL DEFAULT 1,
  enabled_api INTEGER NOT NULL DEFAULT 1,
  receive_currencies TEXT NOT NULL DEFAULT '[]',    -- JSON array
  priority INTEGER NOT NULL DEFAULT 100,
  device_id TEXT,                                   -- linked Sentinel device
  verify_ref TEXT,                                  -- ownership micro-reference challenge
  suspended_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`);

// ---------- GLOBAL BILLING MESH (System B — how KODA collects its own revenue) ----------
// topups: one collection attempt, idempotent. status: initiated→pending→settled|failed|expired
db.exec(`CREATE TABLE IF NOT EXISTS topups (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  acu_amount INTEGER NOT NULL,
  subtotal_usd REAL NOT NULL,                 -- KODA net (4× cost)
  collection_fee_usd REAL NOT NULL DEFAULT 0, -- passed through to merchant
  tax_usd REAL NOT NULL DEFAULT 0,
  total_usd REAL NOT NULL,                     -- what the merchant pays
  currency TEXT NOT NULL DEFAULT 'USD',
  rail TEXT NOT NULL,                          -- provider code
  distributor_id TEXT,                         -- set for the distributor rail
  intent_id TEXT,                              -- KODA payment intent on the KD account (rail=distributor)
  provider_ref TEXT,
  status TEXT NOT NULL DEFAULT 'initiated',
  idempotency_key TEXT UNIQUE,
  routing_snapshot TEXT,                       -- why this rail won (auditable JSON)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  settled_at TEXT
);`);

// billing_ledger: append-only, double-entry. Every settlement posts balanced rows
// (sum of acu_delta per topup = 0). balance_after is chained per account = tamper-evident,
// the same defence philosophy used against SMS spoofers.
db.exec(`CREATE TABLE IF NOT EXISTS billing_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_key TEXT NOT NULL,                   -- 'merchant:<id>' | 'distributor:<id>' | 'koda:treasury'
  entry_type TEXT NOT NULL,                    -- topup_credit|kd_float_debit|koda_issuance|voucher_redeem|wholesale_credit|reversal|adjustment
  acu_delta INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  topup_id TEXT,
  ref TEXT,
  idempotency_key TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`);

// per-account running balance for the ledger chain (merchant wallet stays authoritative
// in merchants.acu_balance; this tracks KD float + treasury and mirrors merchant credits)
db.exec(`CREATE TABLE IF NOT EXISTS billing_accounts (
  account_key TEXT PRIMARY KEY,
  balance_acu INTEGER NOT NULL DEFAULT 0
);`);

db.exec(`CREATE TABLE IF NOT EXISTS distributors (
  id TEXT PRIMARY KEY,
  merchant_id TEXT REFERENCES merchants(id),   -- a KD is a KODA merchant whose product is ACU
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  msisdn TEXT,                                 -- the KD's own mobile-money number (pay-to)
  device_id TEXT,                              -- the KD's Sentinel
  float_acu INTEGER NOT NULL DEFAULT 0,        -- prepaid inventory (authoritative)
  wholesale_bps INTEGER NOT NULL DEFAULT 8500, -- pays 85% of retail = 15% discount
  parent_kd TEXT REFERENCES distributors(id),
  status TEXT NOT NULL DEFAULT 'active',        -- active|frozen
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`);

db.exec(`CREATE TABLE IF NOT EXISTS resellers (
  id TEXT PRIMARY KEY,
  legal_name TEXT NOT NULL,
  country TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',        -- APPLICANT|DUE_DILIGENCE|ACTIVE|SUSPENDED|TERMINATED
  settlement_currency TEXT NOT NULL DEFAULT 'USD',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`);

// vouchers: Ed25519-signed, single-use, product+market locked, PIN stored hashed
db.exec(`CREATE TABLE IF NOT EXISTS vouchers (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  reseller_id TEXT REFERENCES resellers(id),
  product_code TEXT NOT NULL,                   -- ACU_TOPUP|PLAN_30_DAYS|...
  acu_amount INTEGER NOT NULL DEFAULT 0,
  country_lock TEXT,
  currency_lock TEXT,
  pin_hash TEXT NOT NULL UNIQUE,
  signature TEXT NOT NULL,                       -- Ed25519 over the payload
  status TEXT NOT NULL DEFAULT 'dormant',        -- dormant→active→redeemed|void
  expires_at TEXT,
  activated_at TEXT,
  redeemed_at TEXT,
  redeemed_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`);

// tiny helpers ---------------------------------------------------------------
// Prepared-statement cache: preparing on every call costs ~30–60 µs each; the
// hot verify path runs ~10 statements, so caching keeps the money path fast.
const _stmts = new Map();
function prep(sql) {
  let s = _stmts.get(sql);
  if (!s) { s = db.prepare(sql); _stmts.set(sql, s); }
  return s;
}
const q = {
  get: (sql, ...p) => prep(sql).get(...p),
  all: (sql, ...p) => prep(sql).all(...p),
  run: (sql, ...p) => prep(sql).run(...p),
};

// All-or-nothing wrapper for multi-statement money moves. node:sqlite is
// synchronous (no interleaving), but a throw BETWEEN statements would otherwise
// leave a partial state (e.g. wallet credited but top-up not marked settled).
// BEGIN IMMEDIATE + COMMIT, ROLLBACK on any throw. Not re-entrant — callers must
// not nest tx() (SQLite has no nested transactions); inner helpers stay tx-free.
function tx(fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const r = fn(); db.exec('COMMIT'); return r; }
  catch (e) { try { db.exec('ROLLBACK'); } catch { /* already rolled back */ } throw e; }
}

module.exports = { db, q, tx, DATA_DIR };
