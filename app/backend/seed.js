// KODA — idempotent demo seed: admin + demo merchant with realistic data.
'use strict';
const { q } = require('./lib/db');
const U = require('./lib/util');
const engine = require('./lib/engine');

if (!q.get(`SELECT id FROM users WHERE email='admin@koda.africa'`)) {
  // KODA staff admin
  q.run(`INSERT INTO users (id,merchant_id,email,name,pass_hash,role,is_admin)
         VALUES (?,NULL,'admin@koda.africa','KODA Operations',?, 'owner',1)`,
    U.id('usr'), U.hashPassword('koda-admin'));

  // demo merchant — Maison Kivu (Kinshasa restaurant), Commerce plan
  const mid = U.id('mch');
  q.run(`INSERT INTO merchants (id,name,country,currency,plan,msisdn,logo_text,acu_balance)
         VALUES (?,'Maison Kivu','CD','CDF','commerce','+243812345678','Maison Kivu', 2140)`, mid);
  const owner = U.id('usr');
  q.run(`INSERT INTO users (id,merchant_id,email,name,phone,pass_hash,role)
         VALUES (?,?,'demo@koda.africa','Jeanne Nseya','+243899001122',?, 'owner')`,
    owner, mid, U.hashPassword('koda-demo'));
  q.run(`INSERT INTO users (id,merchant_id,email,name,pass_hash,role)
         VALUES (?,?,'caisse@koda.africa','Patrice M.',?, 'cashier')`,
    U.id('usr'), mid, U.hashPassword('koda-demo'));

  // devices
  q.run(`INSERT INTO devices (id,merchant_id,label,operator,sim_msisdn,status,attested,last_seen,battery,parse_health)
         VALUES (?,?,'Caisse principale — Tecno Spark','orange_cd','+243812345678','active',1,datetime('now'),84,0.996)`,
    U.id('dev'), mid);
  q.run(`INSERT INTO devices (id,merchant_id,label,operator,sim_msisdn,status,attested,last_seen,battery,parse_health)
         VALUES (?,?,'SIM M-Pesa — Samsung A14','mpesa_cd','+243821112233','active',1,datetime('now','-4 minutes'),67,0.991)`,
    U.id('dev'), mid);

  const m = q.get('SELECT * FROM merchants WHERE id=?', mid);
  // ledger: realistic day of Orange Money confirmations (balance-chain intact)
  let bal = 250000;
  const rows = [
    [15000, 'GRACE K', '4521', 'OM.260717.0912.C11901'],
    [25000, 'JEANNE N', '7702', 'OM.260717.1015.D48213'],
    [8500, 'PAUL M', '9010', 'OM.260717.1121.E77120'],
    [45000, 'SARAH T', '3345', 'OM.260717.1305.F09551'],
    [15000, 'DIDIER B', '6688', 'OM.260717.1402.G34410'],
  ];
  for (const [amt, name, sfx, ref] of rows) {
    bal += amt;
    engine.ingestSms(m, {
      raw: `Vous avez recu ${amt.toLocaleString('fr-FR')} FC de ${name} (+24389${sfx}). Ref: ${ref}. Solde: ${bal.toLocaleString('fr-FR')}`,
      operator: 'orange_cd',
    });
  }
  // one spoofed SMS → quarantined by the balance-chain defence
  engine.ingestSms(q.get('SELECT * FROM merchants WHERE id=?', mid), {
    raw: `Vous avez recu 80 000 FC de MR PROMO (+243890000). Ref: OM.260717.1441.X99310. Solde: 999 999`,
    operator: 'orange_cd',
  });

  // verify two of them through the engine (manual + api modes)
  const fresh = () => q.get('SELECT * FROM merchants WHERE id=?', mid);
  engine.verify(fresh(), null, 'OM.260717.1305.F09551', { mode: 'manual', userId: owner });
  engine.verify(fresh(), null, 'OM.260717.1015.D48213', { mode: 'api' });

  // an open dispute + an invoice
  q.run(`INSERT INTO disputes (id,merchant_id,reference,reason,evidence,recommendation)
         VALUES (?,?,'OM.260716.1899.Z00111','customer says paid, code not found',?,?)`,
    U.id('dsp'), mid,
    JSON.stringify({ assembled_by: 'DisputeAgent K-06', ledger_scan: 'no SMS ±45min', customer_interviewed: true }),
    'request payer-number confirmation');
  q.run(`INSERT INTO invoices (id,merchant_id,number,amount_usd,status,period)
         VALUES (?,?,'INV-2026-071',79,'paid','2026-07')`, U.id('inv'), mid);

  // manager seat at Maison Kivu — completes the three-role set
  q.run(`INSERT INTO users (id,merchant_id,email,name,pass_hash,role)
         VALUES (?,?,'manager@koda.africa','Olga T.',?, 'manager')`,
    U.id('usr'), mid, U.hashPassword('koda-demo'));

  // ---- portfolio day-one merchants (spec §9.3: the unfair go-to-market) ----
  const portfolio = [
    ['Tunakula', 'tunakula@koda.africa', 'Restaurant delivery — orders verified before the kitchen fires', 'commerce', '+243815550001', 1800],
    ['Scan & Go', 'scango@koda.africa', 'In-store checkout without POS-telco integration', 'boutique', '+243815550002', 520],
    ['StudYear', 'studyear@koda.africa', 'Course & exam-pack unlock on verified payment', 'commerce', '+243815550003', 2600],
    ['TicketRoyality', 'ticketroyality@koda.africa', 'Ticket issuance + paid voting at scale', 'commerce', '+243815550004', 3100],
  ];
  for (const [name, email, _desc, plan, msisdn, acu] of portfolio) {
    const pid = U.id('mch');
    q.run(`INSERT INTO merchants (id,name,country,currency,plan,msisdn,logo_text,acu_balance)
           VALUES (?,?,'CD','CDF',?,?,?,?)`, pid, name, plan, msisdn, name, acu);
    q.run(`INSERT INTO users (id,merchant_id,email,name,pass_hash,role)
           VALUES (?,?,?,?,?, 'owner')`, U.id('usr'), pid, email, name + ' Ops', U.hashPassword('koda-demo'));
    q.run(`INSERT INTO devices (id,merchant_id,label,operator,sim_msisdn,status,attested,last_seen,battery,parse_health)
           VALUES (?,?,?,'orange_cd',?,'active',1,datetime('now'),90,0.995)`,
      U.id('dev'), pid, name + ' — main till', msisdn);
  }

  // ---- platform account with sub-merchants (Plateforme class) ----
  const plid = U.id('mch');
  q.run(`INSERT INTO merchants (id,name,country,currency,plan,msisdn,logo_text,acu_balance,is_platform)
         VALUES (?,'Kinshasa Bots (BSP)','CD','CDF','plateforme','+243815550100','Kinshasa Bots', 21000, 1)`, plid);
  q.run(`INSERT INTO users (id,merchant_id,email,name,pass_hash,role)
         VALUES (?,?,'platform@koda.africa','Serge Bot-Builder',?, 'owner')`,
    U.id('usr'), plid, U.hashPassword('koda-demo'));
  for (const sub of ['Chez Mama Ngozi', 'Pharmacie Lumière', 'Boutique 24/24']) {
    const sid = U.id('mch');
    q.run(`INSERT INTO merchants (id,name,country,currency,plan,msisdn,parent_id,acu_balance)
           VALUES (?,?,'CD','CDF','boutique',NULL,?,0)`, sid, sub, plid);
    const secret = 'sk_live_sub_' + U.token(24);
    q.run(`INSERT INTO api_keys (id,merchant_id,prefix,key_hash,last4,label,submerchant_id)
           VALUES (?,?,'sk_live_sub',?,?,?,?)`,
      U.id('key'), plid, U.sha256(secret), secret.slice(-4), sub, sid);
  }

  console.log('  seed: demo + portfolio + platform accounts created (password: koda-demo)');
}
