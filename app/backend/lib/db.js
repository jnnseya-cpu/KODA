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
  acu_balance REAL NOT NULL DEFAULT 10,          -- welcome trial credit (signup sets it explicitly; verifs within quota are always free)
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

-- Platform installations (WooCommerce/custom/etc). Each carries its own SCOPED,
-- REVOCABLE credentials instead of a pasted master secret (spec §5/§6/§7): a
-- restricted api_key + a webhook endpoint, both bound to and revocable with the install.
CREATE TABLE IF NOT EXISTS installations (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  platform TEXT NOT NULL,                        -- woocommerce|custom|shopify|...
  store_url TEXT,
  key_id TEXT,                                   -- the scoped api_key issued to this install
  webhook_id TEXT,                               -- the webhook endpoint created for this install
  config_version INTEGER NOT NULL DEFAULT 1,
  revoked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- OAuth-style one-time authorization codes. A merchant approves a plugin connection
-- in the KODA dashboard; KODA redirects the plugin back with a short-lived single-use
-- code; the plugin exchanges it SERVER-TO-SERVER for the install's scoped credentials
-- (so the secret never rides in a browser redirect / history). Single-use + expiring.
CREATE TABLE IF NOT EXISTS oauth_codes (
  code TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  installation_id TEXT,
  redirect_uri TEXT,
  payload TEXT NOT NULL,                          -- JSON {server_key, webhook_secret, webhook_url, installation_id}
  used INTEGER NOT NULL DEFAULT 0,
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

-- Blog post read counter (one row per slug; incremented by a same-origin beacon
-- from each published blog page). No PII — just an aggregate read tally.
CREATE TABLE IF NOT EXISTS blog_views (
  slug TEXT PRIMARY KEY,
  views INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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
// livemode: 1 = created by a live key (or the dashboard); 0 = created by a koda_test key.
// Sandbox magic references (TEST-*) are honoured ONLY on livemode=0 intents (or when the
// KODA_ALLOW_SANDBOX_REFS env flag is set for dev/CI) — never on a live customer order.
try { db.exec(`ALTER TABLE intents ADD COLUMN livemode INTEGER NOT NULL DEFAULT 1`); } catch { /* exists */ }
try { db.exec(`ALTER TABLE devices ADD COLUMN device_token TEXT`); } catch { /* exists */ }
// how this Sentinel captures the operator message: 'sms' (side-load build reads the SMS)
// or 'notification' (Play build reads the payment notification). Reported by the heartbeat.
try { db.exec(`ALTER TABLE devices ADD COLUMN capture TEXT NOT NULL DEFAULT 'sms'`); } catch { /* exists */ }
// plan-subscription: merchants table is created above, so this ALTER is safe here.
try { db.exec(`ALTER TABLE merchants ADD COLUMN plan_expires_at TEXT`); } catch { /* exists */ }

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

/*
 * Repair: DRC accounts enrolled under the old single-currency default.
 *
 * `connect()` used to default receive_currencies to the Atlas primary — ["CDF"] for
 * every Congolese operator — so a merchant's real, activated M-Pesa number was
 * silently filtered out of USD checkouts and the page fell back to the profile
 * number ("wrong KODA numbers", live testing 18 Aug). DRC wallets hold CDF and USD
 * balances side by side, so ["CDF"] on a CD account describes the wallet wrongly.
 * Only the exact old default is widened; any other explicit list is a merchant's
 * own choice and stays untouched (they can narrow again via the update API).
 */
try {
  db.exec(`UPDATE merchant_network_accounts SET receive_currencies='["CDF","USD"]'
           WHERE network_code LIKE '%_cd' AND receive_currencies='["CDF"]'`);
} catch { /* nothing to repair */ }

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
  purpose TEXT NOT NULL DEFAULT 'acu',         -- 'acu' | 'plan' (plan-subscription collection)
  plan_key TEXT,                               -- target plan when purpose='plan'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  settled_at TEXT
);`);
// migrations for existing topups tables (no-op on fresh DBs that already have them)
try { db.exec(`ALTER TABLE topups ADD COLUMN purpose TEXT NOT NULL DEFAULT 'acu'`); } catch { /* exists */ }
try { db.exec(`ALTER TABLE topups ADD COLUMN plan_key TEXT`); } catch { /* exists */ }

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
  wholesale_bps INTEGER NOT NULL DEFAULT 8500,  -- 85% of the 5× retail: KODA nets 4.25×, distributor keeps a 15% spread
  parent_kd TEXT REFERENCES distributors(id),
  status TEXT NOT NULL DEFAULT 'active',        -- active|frozen
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`);

db.exec(`CREATE TABLE IF NOT EXISTS resellers (
  id TEXT PRIMARY KEY,
  merchant_id TEXT REFERENCES merchants(id),    -- links a KODA login → the reseller console (self-service)
  legal_name TEXT NOT NULL,
  country TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',        -- APPLICANT|DUE_DILIGENCE|ACTIVE|SUSPENDED|TERMINATED
  settlement_currency TEXT NOT NULL DEFAULT 'USD',
  inventory_acu INTEGER NOT NULL DEFAULT 0,     -- prepaid voucher inventory (authoritative escrow)
  wholesale_bps INTEGER NOT NULL DEFAULT 8000,  -- 80% of the 5× retail: KODA nets the 4× floor, reseller keeps a 20% spread
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`);
// migrations for existing reseller tables (no-op on fresh DBs)
try { db.exec(`ALTER TABLE resellers ADD COLUMN merchant_id TEXT REFERENCES merchants(id)`); } catch { /* exists */ }
try { db.exec(`ALTER TABLE resellers ADD COLUMN inventory_acu INTEGER NOT NULL DEFAULT 0`); } catch { /* exists */ }
try { db.exec(`ALTER TABLE resellers ADD COLUMN wholesale_bps INTEGER NOT NULL DEFAULT 8000`); } catch { /* exists */ }
// One-time data migrations, keyed on user_version so each runs exactly once and
// never clobbers a per-partner rate an admin sets afterwards.
//  v1 — resellers standardise to 80% (20% margin).   [superseded by v3]
//  v2 — distributors stay at 85% (15% margin).        [superseded by v3]
//  v3 — 4× FLOOR: no ACU is sold below retail, including partner wholesale. Move every
//       partner still below 100% up to 10000 bps (buy at retail; earn via fee on top).
try {
  const uv = (db.prepare('PRAGMA user_version').get() || {}).user_version || 0;
  if (uv < 1) {
    db.exec(`UPDATE resellers SET wholesale_bps = 8000`);
    db.exec('PRAGMA user_version = 1');
  }
  if (uv < 2) {
    db.exec(`UPDATE distributors SET wholesale_bps = 8500`);
    db.exec('PRAGMA user_version = 2');
  }
  if (uv < 3) {
    db.exec(`UPDATE distributors SET wholesale_bps = 10000 WHERE wholesale_bps < 10000`);
    db.exec(`UPDATE resellers SET wholesale_bps = 10000 WHERE wholesale_bps < 10000`);
    db.exec('PRAGMA user_version = 3');
  }
  if (uv < 4) {
    // Balanced model: retail rose to 5×, so the standard 85%/80% wholesale rates once
    // again clear the 4× floor AND give partners a real 15%/20% margin. Restore them
    // (v3 had forced everyone to 100% when retail was 4× and any discount broke the floor).
    db.exec(`UPDATE distributors SET wholesale_bps = 8500 WHERE wholesale_bps >= 10000`);
    db.exec(`UPDATE resellers SET wholesale_bps = 8000 WHERE wholesale_bps >= 10000`);
    db.exec('PRAGMA user_version = 4');
  }
} catch { /* best-effort one-time migration */ }

// vouchers: Ed25519-signed, single-use, product+market locked, PIN stored hashed
db.exec(`CREATE TABLE IF NOT EXISTS vouchers (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  reseller_id TEXT REFERENCES resellers(id),
  product_code TEXT NOT NULL,                   -- ACU_TOPUP|PLAN_30D
  plan_key TEXT,                                -- target plan when product is a subscription
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
try { db.exec(`ALTER TABLE vouchers ADD COLUMN plan_key TEXT`); } catch { /* exists */ }

// Public contact-form submissions. Stored regardless of email-transport config so a
// message is never lost even when no SMTP/Brevo provider is set (sandbox).
db.exec(`CREATE TABLE IF NOT EXISTS contact_messages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  topic TEXT,
  message TEXT NOT NULL,
  source_ip TEXT,
  user_agent TEXT,
  delivered INTEGER NOT NULL DEFAULT 0,          -- 1 once emailed to the inbox
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`);

// Partner (distributor/reseller) applications from the public /rails page.
db.exec(`CREATE TABLE IF NOT EXISTS partner_applications (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,                             -- distributor|reseller|either
  name TEXT NOT NULL,
  contact TEXT NOT NULL,                          -- phone / WhatsApp / email
  city TEXT,
  country TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new',             -- new|contacted|approved|rejected
  source_ip TEXT,
  user_agent TEXT,
  delivered INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`);

// ── ADD-ON A: operator-API cross-verification (dual-confirm) ─────────────────
// Purely additive. Every receipt is 'sms_anchored' by default (exactly today's
// behaviour). When an operator API adapter is configured, a receipt can be
// enriched to 'dual_confirmed' — the SMS-anchored verdict is never changed, only
// an extra trust label + trace line is layered on.
try { db.exec(`ALTER TABLE receipts ADD COLUMN confirmation_level TEXT NOT NULL DEFAULT 'sms_anchored'`); } catch { /* exists */ }

// ── ADD-ON B: cross-merchant trust / fraud network ──────────────────────────
// Privacy-preserving: we store only a SALTED HASH of the payer's trailing digits
// plus aggregate counts — never a raw number, name, or which merchant. A merchant
// only ever reads the network aggregate (a signal), never another merchant's data.
db.exec(`CREATE TABLE IF NOT EXISTS network_trust (
  payer_hash TEXT PRIMARY KEY,                    -- HMAC(salt, payer suffix) — no raw PII
  verified_count INTEGER NOT NULL DEFAULT 0,
  quarantine_count INTEGER NOT NULL DEFAULT 0,
  dispute_count INTEGER NOT NULL DEFAULT 0,
  first_seen TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen TEXT NOT NULL DEFAULT (datetime('now'))
);`);
// Explicit fraud flags contributed by any merchant (a chargeback, a confirmed
// scam ref). Keyed by hash so it is portable across the network without leaking.
db.exec(`CREATE TABLE IF NOT EXISTS network_flags (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,                             -- payer|reference
  value_hash TEXT NOT NULL,
  reason TEXT NOT NULL,
  merchant_id TEXT,                               -- contributor (never exposed to others)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_network_flags_value ON network_flags(kind, value_hash);`);

// SecurityAgent: abuse/attack event log + auto-block list (built-in, zero-dep).
db.exec(`CREATE TABLE IF NOT EXISTS security_events (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,                              -- pow_fail|honeypot|bad_login|injection|scan|...
  ip TEXT,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_secev_ip ON security_events(ip, created_at);`);
db.exec(`CREATE TABLE IF NOT EXISTS blocked_ips (
  ip TEXT PRIMARY KEY,
  reason TEXT,
  until TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`);

// KODA runtime settings — admin-editable config that overrides env defaults, so the
// team manages things (like KODA's own mobile-money receiving numbers for self-
// collection) from the console instead of editing env files. Key/value; values are
// JSON or plain strings. Read via lib/settings.js (DB → env → default).
db.exec(`CREATE TABLE IF NOT EXISTS koda_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`);

// Referral engine (organic growth loop): each merchant has a share code; a new
// merchant who joins with it and verifies their first payment rewards both sides.
try { db.exec(`ALTER TABLE merchants ADD COLUMN ref_code TEXT`); } catch { /* exists */ }
try { db.exec(`ALTER TABLE merchants ADD COLUMN referred_by TEXT`); } catch { /* exists */ }
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_merchants_refcode ON merchants(ref_code) WHERE ref_code IS NOT NULL;`);
db.exec(`CREATE TABLE IF NOT EXISTS referrals (
  id TEXT PRIMARY KEY,
  referrer_id TEXT NOT NULL,
  referred_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'signed_up',        -- signed_up | qualified
  reward_acu REAL NOT NULL DEFAULT 0,
  qualified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_id);`);

// Webhook routing (spec §15): an endpoint may be scoped to a destination
// (e.g. "woocommerce", "pos"); NULL = catch-all (receives everything, as before).
try { db.exec(`ALTER TABLE webhook_endpoints ADD COLUMN destination TEXT`); } catch { /* exists */ }
// Human-readable name/label so merchants can tell endpoints apart (spec §9).
try { db.exec(`ALTER TABLE webhook_endpoints ADD COLUMN name TEXT`); } catch { /* exists */ }
// Payload style shown in the webhook dashboard (KODA sends the full event object = 'snapshot').
try { db.exec(`ALTER TABLE webhook_endpoints ADD COLUMN payload_style TEXT NOT NULL DEFAULT 'snapshot'`); } catch { /* exists */ }
// Delivery telemetry for the dashboard: HTTP response time (ms) and status of each attempt.
try { db.exec(`ALTER TABLE webhook_deliveries ADD COLUMN duration_ms INTEGER`); } catch { /* exists */ }
try { db.exec(`ALTER TABLE webhook_deliveries ADD COLUMN response_status INTEGER`); } catch { /* exists */ }

// Idempotency-Key on verification (intent) creation: a repeated create with the
// same key returns the original result instead of making a second verification.
db.exec(`CREATE TABLE IF NOT EXISTS idempotency_keys (
  merchant_id TEXT NOT NULL,
  key TEXT NOT NULL,
  intent_id TEXT,
  response TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (merchant_id, key)
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
