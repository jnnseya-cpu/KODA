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

  console.log('  seed: demo data created (demo@koda.africa / koda-demo)');
}
