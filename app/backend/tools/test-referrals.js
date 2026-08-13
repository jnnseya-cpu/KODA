// KODA — referral growth loop. Proves: a merchant gets a share code; a new merchant
// who joins with it is linked; the referrer is rewarded ONCE when the referred
// merchant verifies their first payment; both sides get ACU; idempotent.
'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
process.env.KODA_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'koda-ref-'));
process.env.KODA_QUIET = '1';
const { q } = require('../lib/db');
require('../seed');
const referrals = require('../lib/referrals');
const engine = require('../lib/engine');

let pass = 0, fail = 0;
const ok = (c, m, x = '') => { c ? (pass++, console.log('  ✓', m, x)) : (fail++, console.log('  ✗', m, x)); };
const bal = (id) => q.get('SELECT acu_balance FROM merchants WHERE id=?', id).acu_balance;

(async () => {
  console.log('\nKODA — referral growth loop\n');
  const ms = q.all('SELECT id FROM merchants LIMIT 2');
  const referrer = ms[0].id;

  // 1. share code + link
  const code = referrals.ensureCode(referrer);
  ok(/^[A-Z0-9]{6}$/.test(code), 'merchant gets a 6-char share code', code);
  ok(referrals.ensureCode(referrer) === code, 'code is stable (same on re-fetch)');
  ok(referrals.linkFor(referrer).includes('ref=' + code), 'share link carries ?ref=CODE');

  // 2. a new merchant joins with the code → linked, not yet rewarded
  const newId = 'mch_ref_new';
  q.run(`INSERT INTO merchants (id,name,acu_balance) VALUES (?,?,0)`, newId, 'Referred Co');
  const rBefore = bal(referrer);
  referrals.attach(newId, code);
  ok(q.get('SELECT referred_by FROM merchants WHERE id=?', newId).referred_by === referrer, 'new merchant linked to referrer');
  ok(q.get(`SELECT status FROM referrals WHERE referred_id=?`, newId).status === 'signed_up', 'referral starts as signed_up');
  ok(bal(referrer) === rBefore, 'no reward yet (signup alone does not pay)');

  // 3. referred merchant verifies first payment → BOTH rewarded, once
  const refBefore = bal(referrer), newBefore = bal(newId);
  const merchant = q.get('SELECT * FROM merchants WHERE id=?', newId);
  engine.verify(merchant, null, 'TEST-OK-25000', { mode: 'api', trace: { steps: [] } });
  ok(bal(referrer) === refBefore + referrals.REWARD_ACU, 'referrer rewarded on referred first verify', `+${bal(referrer) - refBefore}`);
  ok(bal(newId) === newBefore + referrals.REWARD_ACU, 'referred merchant also rewarded (welcome)', `+${bal(newId) - newBefore}`);
  ok(q.get(`SELECT status FROM referrals WHERE referred_id=?`, newId).status === 'qualified', 'referral marked qualified');

  // 4. idempotent — a second verify does NOT pay again
  const afterRef = bal(referrer);
  engine.verify(merchant, null, 'TEST-OK-30000', { mode: 'api', trace: { steps: [] } });
  ok(bal(referrer) === afterRef, 'no double reward on a later verify (idempotent)');

  // 5. stats
  const s = referrals.stats(referrer);
  ok(s.referred >= 1 && s.qualified >= 1 && s.acu_earned >= referrals.REWARD_ACU, 'stats report referred/qualified/earned', `${s.qualified}/${s.referred} · ${s.acu_earned} ACU`);

  // 6. self-referral + bad code are ignored
  const selfId = 'mch_self'; q.run(`INSERT INTO merchants (id,name,acu_balance) VALUES (?,?,0)`, selfId, 'Self');
  const selfCode = referrals.ensureCode(selfId);
  referrals.attach(selfId, selfCode);
  ok(!q.get('SELECT referred_by FROM merchants WHERE id=?', selfId).referred_by, 'self-referral ignored');

  console.log(`\n${fail === 0 ? '✅ REFERRALS GREEN' : '❌ REFERRALS FAILED'} — ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('REFERRAL TEST CRASH', e && e.stack || e); process.exit(1); });
