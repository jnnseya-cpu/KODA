// KODA — Payment Method Resolver (Network Intelligence Layer).
// The product principle: a network being present in a country is NOT enough —
// the customer sees it only when KODA supports it AND that specific merchant has
// an active, verified, healthy receiving account on it. This is the §28 formula.
'use strict';
const { q } = require('./db');
const U = require('./util');
const registry = require('../../shared/operators');

const mask = (id) => {
  const s = String(id || '').replace(/\s+/g, '');
  if (s.length < 6) return s;
  const head = s.startsWith('+') ? s.slice(0, 4) : s.slice(0, 2); // keep + country hint
  const tail = s.slice(-3);
  return head + 'X'.repeat(Math.max(3, s.length - head.length - 3)) + tail;
};

function deviceHealthy(deviceId) {
  if (!deviceId) return { linked: false, healthy: false };
  const d = q.get('SELECT * FROM devices WHERE id=?', deviceId);
  if (!d) return { linked: false, healthy: false };
  // healthy = active + seen within 10 min (heartbeat) + attested
  const seen = d.last_seen ? (Date.now() - new Date(d.last_seen + 'Z').getTime()) / 60000 : Infinity;
  const healthy = d.status === 'active' && seen <= 10 && d.parse_health >= 0.5;
  return { linked: true, healthy, status: d.status, stale_min: Math.round(seen) };
}

function connect(merchant, body) {
  const dep = registry.byId[body.network_code];
  if (!dep) return [400, { error: { code: 'unknown_network', message: 'network_code not in the Atlas' } }];
  if (registry.tierOf(dep) === 'C')
    return [422, { error: { code: 'network_not_supported', message: `${dep.name} is a bank-rail/app-push network (Tier C) — not SMS-verifiable`, koda_support: 'BANK_RAIL_REQUIRED' } }];
  const id = U.id('ma');
  const ident = String(body.account_identifier || '').trim();
  // Default to everything the wallet can actually receive (dual-currency markets
  // list both), not the Atlas primary alone: defaulting DRC accounts to ["CDF"]
  // silently removed every real number from USD checkouts.
  const currencies = Array.isArray(body.receive_currencies) && body.receive_currencies.length
    ? body.receive_currencies.filter(c => /^[A-Z]{3}$/.test(c)) : (dep.currencies || [dep.currency]);
  const verifyRef = 'KODA-' + U.token(3).toUpperCase().slice(0, 4);
  q.run(`INSERT INTO merchant_network_accounts
     (id,merchant_id,submerchant_id,network_code,account_identifier,masked,account_holder_name,receive_currencies,priority,device_id,verify_ref)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    id, merchant.id, body.submerchant_id || null, body.network_code, ident || null, mask(ident),
    body.account_holder_name || null, JSON.stringify(currencies), Number(body.priority) || 100, body.device_id || null, verifyRef);
  return {
    merchant_account_id: id, network_code: body.network_code, masked: mask(ident),
    ownership_status: 'UNVERIFIED', activation_status: 'DRAFT',
    // ownership proof: the merchant makes/receives a tiny transfer carrying this ref;
    // Sentinel must capture a confirmation containing it → then activate.
    verify_ref: verifyRef,
    next: 'Send a test payment with this reference, then POST /activate once Sentinel captures it.',
  };
}

function setState(merchant, id, patch) {
  const a = q.get('SELECT * FROM merchant_network_accounts WHERE id=? AND merchant_id=?', id, merchant.id);
  if (!a) return [404, { error: { code: 'account_not_found' } }];
  const cols = [], vals = [];
  for (const [k, v] of Object.entries(patch)) { cols.push(`${k}=?`); vals.push(v); }
  q.run(`UPDATE merchant_network_accounts SET ${cols.join(',')} WHERE id=?`, ...vals, id);
  return { ok: true, merchant_account_id: id, ...patch };
}

// Activation is SELF-SERVE — the merchant just turns a receiving number on/off.
// KODA needs no upfront "ownership ceremony": every real payment is verified
// per-transaction (Door 3 matches the customer's confirmation code against the SMS
// the merchant's own phone actually received). A wrong/unowned number therefore
// never verifies a payment and self-corrects. Ownership remains an auto-earned trust
// badge (set when a forwarded SMS carries the account's verify_ref) — a signal, not a gate.
function activate(merchant, id) {
  const a = q.get('SELECT * FROM merchant_network_accounts WHERE id=? AND merchant_id=?', id, merchant.id);
  if (!a) return [404, { error: { code: 'account_not_found' } }];
  return setState(merchant, id, { activation_status: 'ACTIVE' });
}

// edit a receiving account — fix a wrong number or holder name. Changing the number
// resets the ownership badge (the proof was for the old number) and re-issues a ref.
function update(merchant, id, body) {
  const a = q.get('SELECT * FROM merchant_network_accounts WHERE id=? AND merchant_id=?', id, merchant.id);
  if (!a) return [404, { error: { code: 'account_not_found' } }];
  const cols = [], vals = [];
  if (typeof body.account_identifier === 'string' && body.account_identifier.trim()) {
    const ident = body.account_identifier.trim();
    cols.push('account_identifier=?', 'masked=?'); vals.push(ident, mask(ident));
    if (ident !== a.account_identifier) { cols.push("ownership_status='UNVERIFIED'"); }
  }
  if (typeof body.account_holder_name === 'string') { cols.push('account_holder_name=?'); vals.push(body.account_holder_name.trim() || null); }
  if (!cols.length) return { ok: true, merchant_account_id: id };
  q.run(`UPDATE merchant_network_accounts SET ${cols.join(',')} WHERE id=?`, ...vals, id);
  const row = q.get('SELECT id,network_code,masked,account_identifier,account_holder_name,ownership_status,activation_status FROM merchant_network_accounts WHERE id=?', id);
  return { ok: true, merchant_account_id: id, ...row };
}

// remove a receiving account entirely (a wrong entry the merchant no longer wants).
function remove(merchant, id) {
  const a = q.get('SELECT id FROM merchant_network_accounts WHERE id=? AND merchant_id=?', id, merchant.id);
  if (!a) return [404, { error: { code: 'account_not_found' } }];
  q.run('DELETE FROM merchant_network_accounts WHERE id=?', id);
  return { ok: true, removed: id };
}

// door → column
const DOOR_COL = { MANUAL: 'enabled_manual', WHATSAPP: 'enabled_whatsapp', API: 'enabled_api' };

// THE RESOLVER — returns { available, excluded } for a merchant + context.
function resolve(merchant, ctx = {}) {
  const country = ctx.country || merchant.country;
  const currency = ctx.currency || merchant.currency;
  const door = (ctx.door || 'API').toUpperCase();
  const accounts = q.all(
    `SELECT * FROM merchant_network_accounts WHERE merchant_id=? AND ${ctx.submerchant_id ? 'submerchant_id=?' : 'submerchant_id IS NULL'}`,
    ...(ctx.submerchant_id ? [merchant.id, ctx.submerchant_id] : [merchant.id]));
  const available = [], excluded = [];
  const drop = (a, reason) => excluded.push({ network_code: a.network_code, reason });

  for (const a of accounts) {
    const dep = registry.byId[a.network_code];
    if (!dep) { drop(a, 'KODA_NOT_SUPPORTED'); continue; }
    if (registry.tierOf(dep) === 'C') { drop(a, 'KODA_NOT_SUPPORTED'); continue; }
    if (country && dep.country !== country) { drop(a, 'COUNTRY_MISMATCH'); continue; }
    const curs = JSON.parse(a.receive_currencies || '[]');
    if (currency && curs.length && !curs.includes(currency)) { drop(a, 'CURRENCY_UNSUPPORTED'); continue; }
    if (a.activation_status === 'PAUSED') { drop(a, 'MERCHANT_TEMPORARILY_PAUSED'); continue; }
    if (a.activation_status === 'SUSPENDED') { drop(a, 'OPERATOR_SUSPENDED'); continue; }
    if (a.activation_status !== 'ACTIVE') { drop(a, 'MERCHANT_NOT_ACTIVATED'); continue; }
    // ownership is a trust badge, NOT a visibility gate — payments verify per-transaction
    if (!DOOR_COL[door] || !a[DOOR_COL[door]]) { drop(a, 'DOOR_DISABLED'); continue; }
    const dev = deviceHealthy(a.device_id);
    // auto doors (API/WhatsApp) need a healthy Sentinel; MANUAL can run device-less
    if (door !== 'MANUAL' && !dev.healthy) { drop(a, dev.linked ? 'DEVICE_OFFLINE' : 'DEVICE_OFFLINE'); continue; }
    available.push({
      network_code: a.network_code,
      brand: registry.familyOf(dep),
      display_name: a.account_holder_name ? dep.name : dep.name,
      merchant_account_id: a.id,
      masked_receiving_identifier: a.masked,
      account_holder_name: a.account_holder_name || null,
      currency, tier: registry.tierOf(dep),
      instruction_mode: 'USSD',
      priority: a.priority,
      health: dev.healthy ? 'HEALTHY' : (door === 'MANUAL' ? 'MANUAL' : 'DEGRADED'),
      ownership_verified: a.ownership_status === 'VERIFIED',   // trust badge (auto-earned from SMS)
      koda_support: dep.packed ? 'LIVE' : (registry.tierOf(dep) === 'A' ? 'BETA' : 'PILOT'),
    });
  }
  available.sort((x, y) => x.priority - y.priority || (x.health === 'HEALTHY' ? -1 : 1));
  return { country, currency, door, available, excluded };
}

// public country catalogue (from the registry, no merchant data)
function catalogue(countryCode, { currency, supportStatus } = {}) {
  const nets = registry.OPERATORS
    .filter(o => o.country === countryCode && registry.tierOf(o) !== 'C')
    .filter(o => !currency || o.currency === currency)
    .map(o => ({
      code: o.id, display_name: o.name, network_type: 'MOBILE_MONEY',
      currency: o.currency, tier: registry.tierOf(o), family: registry.familyOf(o),
      koda_support_status: o.packed ? 'LIVE' : registry.tierOf(o) === 'A' ? 'TEMPLATE_REQUIRED' : 'PILOT',
      supported_doors: ['MANUAL', 'WHATSAPP', 'API'],
    }))
    .filter(n => !supportStatus || n.koda_support_status === supportStatus);
  return { country: { code: countryCode }, networks: nets, count: nets.length };
}

module.exports = { connect, activate, update, remove, setState, resolve, catalogue, mask, deviceHealthy };
