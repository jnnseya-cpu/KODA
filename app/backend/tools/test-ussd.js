// KODA — USSD (Door 4) adapter unit tests. Pure module test (no server): proves the
// aggregator-agnostic parse, the CON/END vs JSON reply formats, the config-gated "live"
// status, and the opt-in shared-secret source guard.
//   node --no-warnings backend/tools/test-ussd.js
'use strict';
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra !== undefined ? '· ' + JSON.stringify(extra) : ''); } }

// fresh module load after mutating env (config is read live via getters, so no reload needed)
const ussd = require('../comms/ussd');

console.log('\n═══ KODA USSD adapter ═══\n');

// ── config gating ────────────────────────────────────────────────────────────
delete process.env.KODA_USSD_PROVIDER;
ok('unset provider → door not "live" (endpoint still answers in sandbox)', ussd.configured() === false);
ok('unset provider → default wire format is africastalking', ussd.format() === 'africastalking');
ok('describe() tells the operator how to configure it', /KODA_USSD_PROVIDER/.test(ussd.describe()));

process.env.KODA_USSD_PROVIDER = 'africastalking';
ok('provider=africastalking → configured/live', ussd.configured() === true);
process.env.KODA_USSD_PROVIDER = 'generic';
ok('provider=generic → configured/live', ussd.configured() === true && ussd.format() === 'generic');
process.env.KODA_USSD_PROVIDER = 'nonsense';
ok('unrecognised provider → not configured', ussd.configured() === false);

// ── inbound parsing across wire formats ──────────────────────────────────────
const at = ussd.parseInbound({ sessionId: 's1', phoneNumber: '+243890111000', text: '1*OM.260805.1701.A88213' });
ok('AT inbound: phone + last step extracted', at.phone === '+243890111000' && at.steps[at.steps.length - 1] === 'OM.260805.1701.A88213', at);
const gen = ussd.parseInbound({ session_id: 's2', msisdn: '243890222000', input: 'ABC123' });
ok('generic inbound: msisdn + input normalised', gen.phone === '243890222000' && gen.steps[0] === 'ABC123', gen);
const empty = ussd.parseInbound({ phoneNumber: '+243', text: '' });
ok('empty text → zero steps (menu prompt case)', empty.steps.length === 0);

// ── reply formatting ─────────────────────────────────────────────────────────
process.env.KODA_USSD_PROVIDER = 'africastalking';
const rCon = ussd.reply(true, 'Entrez le code');
ok('AT continue → "CON " prefix, text/plain', rCon[0] === 200 && rCon[1] === 'CON Entrez le code' && /text\/plain/.test(rCon[2]['content-type']), rCon);
const rEnd = ussd.reply(false, 'Paiement confirme');
ok('AT terminal → "END " prefix', rEnd[1] === 'END Paiement confirme');
process.env.KODA_USSD_PROVIDER = 'generic';
const jCon = ussd.reply(true, 'Entrez le code');
ok('generic continue → JSON {action:continue}', jCon[0] === 200 && jCon[1].action === 'continue' && jCon[1].message === 'Entrez le code', jCon);
const jEnd = ussd.reply(false, 'ok');
ok('generic terminal → JSON {action:end}', jEnd[1].action === 'end');

// ── source guard (opt-in shared secret) ──────────────────────────────────────
delete process.env.KODA_USSD_SECRET;
ok('no secret configured → open (skipped), never fails closed', ussd.verifySource({}, {}).ok === true);
process.env.KODA_USSD_SECRET = 's3cr3t-value';
ok('secret set + correct header → accepted', ussd.verifySource({ 'x-ussd-secret': 's3cr3t-value' }, {}).ok === true);
ok('secret set + correct body field → accepted', ussd.verifySource({}, { secret: 's3cr3t-value' }).ok === true);
ok('secret set + wrong secret → rejected', ussd.verifySource({ 'x-ussd-secret': 'nope' }, {}).ok === false);
ok('secret set + missing secret → rejected', ussd.verifySource({}, {}).ok === false);
delete process.env.KODA_USSD_SECRET;
delete process.env.KODA_USSD_PROVIDER;

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
