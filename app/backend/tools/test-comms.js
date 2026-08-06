// KODA — comms dispatch adapters (in-process, no network). Verifies the SMTP
// reply parser (the testable core of the zero-dep SMTP client) and the send
// gating (nothing is sent unless configured AND live-sending is allowed).
'use strict';
delete process.env.KODA_COMMS_LIVE; delete process.env.KODA_COMMS_DRYRUN;
delete process.env.KODA_SMTP_HOST; delete process.env.BREVO_API_KEY;
delete process.env.KODA_SMS_URL; delete process.env.FCM_KEY;
const s = require('../comms/senders');
let pass = 0, fail = 0;
const ok = (c, m, x = '') => { c ? (pass++, console.log(`  ✓ ${m} ${x}`)) : (fail++, console.log(`  ✗ ${m} ${x}`)); };

(async () => {
  console.log('\nKODA — comms dispatch adapters\n');
  // SMTP multiline reply parsing
  ok(s.parseReply('220 ready\r\n').complete && s.parseReply('220 ready\r\n').code === 220, 'parses a single-line reply');
  const multi = s.parseReply('250-koda\r\n250-PIPELINING\r\n250 AUTH LOGIN\r\n');
  ok(multi.complete && multi.code === 250, 'parses a multiline reply (completes on "250 ")');
  ok(!s.parseReply('250-koda\r\n250-PIPELINING\r\n').complete, 'incomplete multiline is not yet complete');
  ok(s.parseReply('235 2.7.0 OK\r\nMAIL...').rest.startsWith('MAIL'), 'returns the remainder after a complete reply');

  // live-send gate: nothing goes out in a test/dev context
  ok(s.liveAllowed() === false, 'live sending OFF by default (no NODE_ENV, no opt-in)');
  process.env.KODA_COMMS_LIVE = '1';
  ok(s.liveAllowed() === true, 'live sending ON with KODA_COMMS_LIVE=1');
  process.env.KODA_COMMS_DRYRUN = '1';
  ok(s.liveAllowed() === false, 'KODA_COMMS_DRYRUN=1 forces dry-run even when live');
  delete process.env.KODA_COMMS_DRYRUN; delete process.env.KODA_COMMS_LIVE;

  // senders are no-ops when unconfigured (no transport) or not live
  ok((await s.sendEmail('x@y.co', 's', '<b>h</b>')).skipped === 'dry_run', 'email is a no-op when not live');
  process.env.KODA_COMMS_LIVE = '1';
  ok((await s.sendEmail('x@y.co', 's', 'h')).skipped === 'no_transport', 'email no-op when no transport configured');
  ok((await s.sendSms('+243810000000', 't')).skipped === 'no_transport', 'sms no-op when no gateway configured');
  ok((await s.sendPush('tok', 't', 'b')).skipped === 'no_transport', 'push no-op when no FCM key configured');
  ok((await s.sendEmail('', 's', 'h')).skipped === 'no_recipient', 'no send without a recipient');
  delete process.env.KODA_COMMS_LIVE;

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})();
