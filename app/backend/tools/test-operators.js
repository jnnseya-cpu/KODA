// Unit tests (no server) — generic multilingual fallback parser + operator registry.
'use strict';
const { parseSms, genericParse } = require('../../shared/parser');
const ops = require('../../shared/operators');
let pass = 0, fail = 0;
const ok = (c, m, x = '') => { c ? (pass++, console.log(`  ✓ ${m} ${x}`)) : (fail++, console.log(`  ✗ ${m} ${x}`)); };

console.log('\nKODA — generic parser + operator registry\n');

// ── precise packs still win (no regression → NOT generic) ──
const orange = parseSms('Vous avez recu 25 000 FC de JEANNE (+243890001122). Ref: OM.260805.1701.A88213.');
ok(orange && orange.operator === 'orange_cd' && !orange.generic, 'precise pack still wins (orange_cd, not generic)', orange && orange.operator);

// ── generic fallback across operators/languages the packs DON'T cover ──
const cases = [
  ['M-Pesa KE (EN)', 'Confirmed. You have received Ksh1,000 from JOHN DOE 254712345678. Ref QAB1234XYZ. New M-PESA balance Ksh5,400', 1000, 'QAB1234XYZ'],
  ['MTN Ghana (EN)', 'Payment received GHS 50.00 from KWAME MENSAH. Transaction ID: 998877665. Current balance GHS 220.00', 50, '998877665'],
  ['OPay NG (EN)', 'You have received NGN 15,000 from ADA OKafor. Ref: OP20260805AB12. Balance: NGN 41,200', 15000, 'OP20260805AB12'],
  ['Vodafone Cash EG (EN)', 'You received EGP 500 from AHMED. Txn 5566778899. Balance EGP 1,200', 500, '5566778899'],
  ['Free Money SN (FR)', 'Transfert recu: 8 000 XOF de MOUSSA. Reference TR12345Z. Solde 20 000', 8000, 'TR12345Z'],
  ['M-Pesa MZ (PT)', 'Recebeu 800 MT de JOAO. Ref ABC55TT. Saldo 2000', 800, 'ABC55TT'],
  ['GCash PH (EN)', 'You have received PHP 500 from JUAN. Ref GC123456. Balance PHP 1,200', 500, 'GC123456'],
  ['DANA ID (Rp)', 'Anda menerima Rp 50.000 dari BUDI. Ref DN99XX2. Saldo Rp 200.000', 50000, 'DN99XX2'],
  ['bKash BD (Tk/TrxID)', 'You have received Tk 1,500 from RAHIM. TrxID BK12345678. Balance Tk 3,000', 1500, 'BK12345678'],
];
for (const [label, sms, amt, ref] of cases) {
  const r = parseSms(sms);
  ok(r && r.generic && r.operator === 'generic' && r.amount === amt && r.ref === ref,
    `generic parse: ${label}`, r ? `${r.amount}/${r.ref}` : 'null');
}

// ── junk / personal SMS must NOT parse (privacy: no false forward) ──
ok(parseSms('Salut, on se voit a 18h?') === null, 'personal SMS → no parse');
ok(parseSms('Your OTP is 123456, do not share it.') === null, 'OTP SMS → no parse');

// ── registry ──
const cov = ops.coverage();
ok(cov.total > 60 && cov.packed === 6, 'registry coverage', `${cov.total} operators, ${cov.packed} packed, ${cov.countries} countries`);
ok(ops.findBySender('MTNMoMo')?.name.includes('MTN'), 'findBySender attributes MTN');
ok(ops.findBySender('MPESA', 'KE')?.country === 'KE', 'findBySender honours country hint (M-Pesa KE)');
ok(ops.findBySender('random-sender') === null, 'unknown sender → null');

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
