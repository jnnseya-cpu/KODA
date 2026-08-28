// KODA — referral growth loop. Proves: a merchant gets a share code; a new merchant
// who joins with it is linked; the referrer is rewarded ONCE when the referred
// merchant verifies their first payment; both sides get ACU; idempotent.
'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
process.env.KODA_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'koda-ref-'));
process.env.KODA_QUIET = '1';
process.env.KODA_ALLOW_SANDBOX_REFS = '1';  // this in-process test verifies via TEST-OK refs
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

  // 3. referred merchant's first PAID top-up settles → BOTH rewarded, once.
  //    SECURITY NOTE: rewards fire on the treasury-backed paid-settle path
  //    (billing.settleTopup), NOT on engine.verify. Crediting ACU off a merchant's
  //    own verified SMS was a self-mint hole (fabricate an SMS → farm free ACU), so
  //    the reward hook was deliberately moved to money-actually-received. A verify
  //    alone must therefore NOT reward — that is asserted below.
  const billing = require('../lib/billing');
  const refBefore = bal(referrer), newBefore = bal(newId);
  const merchant = q.get('SELECT * FROM merchants WHERE id=?', newId);
  engine.verify(merchant, null, 'TEST-OK-25000', { mode: 'api', trace: { steps: [] } });
  ok(bal(referrer) === refBefore && bal(newId) === newBefore,
     'a bare verify does NOT reward (self-mint hole closed)', `ref+${bal(referrer) - refBefore} new+${bal(newId) - newBefore}`);

  // now settle a real paid top-up for the referred merchant → qualifies the referral
  q.run(`INSERT INTO topups (id,merchant_id,acu_amount,subtotal_usd,collection_fee_usd,tax_usd,total_usd,currency,rail,purpose,status)
         VALUES ('top_ref','${newId}',50,5,0.15,0,5.15,'USD','stripe','acu','pending')`);
  billing.settleTopup('top_ref');
  ok(bal(referrer) === refBefore + referrals.REWARD_ACU, 'referrer rewarded on referred first PAID settle', `+${bal(referrer) - refBefore}`);
  ok(bal(newId) === newBefore + 50 + referrals.REWARD_ACU, 'referred merchant gets top-up ACU + welcome reward', `+${bal(newId) - newBefore}`);
  ok(q.get(`SELECT status FROM referrals WHERE referred_id=?`, newId).status === 'qualified', 'referral marked qualified');

  // 4. idempotent — settling the SAME top-up again does NOT pay the referral again
  const afterRef = bal(referrer);
  billing.settleTopup('top_ref');
  ok(bal(referrer) === afterRef, 'no double reward on a replayed settle (idempotent)');

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
