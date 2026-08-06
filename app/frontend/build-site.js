// KODA — public site generator. Emits public/site/*.html from a shared layout
// at server boot. Landing (index) is the koda-landing.html prototype from the
// repo root, copied verbatim with CTAs wired to /app.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const OUT = path.join(__dirname, 'site');
fs.mkdirSync(OUT, { recursive: true });

// ---- live coverage stats from the operator registry (single source of truth) ----
// Every number the public site quotes about reach comes from here, so marketing
// can never drift from what the resolver actually knows.
const registry = require('../shared/operators');
const COV = registry.coverage();
const FAM = registry.families();
const REGION_LABEL = {
  CENTRAL: 'Central Africa', WEST: 'West Africa', EAST: 'East Africa', SOUTHERN: 'Southern Africa',
  NORTH: 'North Africa', SOUTH_ASIA: 'South Asia', SEA: 'Southeast Asia', CENTRAL_ASIA: 'Central Asia',
  CAUCASUS: 'Caucasus', LATAM: 'Latin America', CARIBBEAN: 'Caribbean', PACIFIC: 'Pacific',
};
const ADDRESSABLE = (COV.byTier.A || 0) + (COV.byTier.B || 0); // Tier A+B are SMS-verifiable; C is excluded
const N = COV.total, NC = COV.countries, NR = Object.keys(COV.byRegion).length, NFAM = FAM.length;

// the 12 site pages, grouped for the footer (used by landing + every content page)
const FOOT_GROUPS = [
  ['Product', [['How it works', 'how-it-works'], ['Coverage', 'coverage'], ['Industries', 'industries'], ['Get started', 'get-started'], ['Platform status', 'status']]],
  ['Company', [['About', 'about'], ['Blog', 'blog'], ['Growth & Influencers', 'growth'], ['Contact', 'contact']]],
  ['Developers', [['API documentation', 'developers'], ['OpenAPI contract', 'v1/openapi.json'], ['Open the app', 'app']]],
  ['Legal', [['Terms of Service', 'terms'], ['Privacy Policy', 'privacy'], ['All policies', 'policies']]],
];

const DISCLAIMER = `KODA is a payment <em>verification</em> service — not a bank, wallet, payment processor, aggregator, escrow or money transmitter. KODA never holds, moves, or settles funds: payments travel directly from customer to merchant over each operator's own network. Verification is based on merchant-side operator confirmations and, while fraud-scored and replay-protected, does not guarantee against operator-side reversals or constitute proof of settlement. M-Pesa, Orange Money, MTN MoMo, Airtel Money, Africell Money, Wave, bKash, GCash, JazzCash, EVC Plus and all other operator names are trademarks of their respective owners; KODA is independent of, and not endorsed by, any mobile network operator. Pricing, coverage and features are subject to the published Terms of Service and may evolve by market.`;

// ---- landing: reuse the prototype, wire CTAs into the app ----
const landingSrc = [path.join(__dirname, '..', '..', 'koda-landing.html'), path.join(__dirname, '..', 'landing-src.html')].find(require('node:fs').existsSync);
if (fs.existsSync(landingSrc)) {
  let landing = fs.readFileSync(landingSrc, 'utf8');
  landing = landing
    .replace(/<a class="btn btn-gold" href="#pricing">Verify your first payment free<\/a>/,
      '<a class="btn btn-gold" href="/app#signup">Verify your first payment free</a>')
    .replace(/<a class="btn" href="#">Open your KODA account →<\/a>/,
      '<a class="btn" href="/app#signup">Open your KODA account →</a>')
    .replace(/<a class="pbtn" href="#">Start free<\/a>/, '<a class="pbtn" href="/app#signup?plan=marche">Start free</a>')
    .replace(/<a class="pbtn" href="#">Choose Boutique<\/a>/, '<a class="pbtn" href="/app#signup?plan=boutique">Choose Boutique</a>')
    .replace(/<a class="pbtn" href="#">Choose Commerce<\/a>/, '<a class="pbtn" href="/app#signup?plan=commerce">Choose Commerce</a>')
    .replace(/<a class="pbtn" href="#">Talk platforms<\/a>/, '<a class="pbtn" href="/app#signup?plan=plateforme">Talk platforms</a>')
    .replace(/<a class="pbtn" href="#">Contact sales<\/a>/, '<a class="pbtn" href="/contact">Contact sales</a>')
    .replace(/<a class="nav-cta" href="#pricing">Start free →<\/a>/, '<a class="nav-cta" href="/app#signup">Start free →</a>')
    // mobile menu: the prototype hides .nav-links under 840px with no toggle — inject a
    // pure-CSS hamburger + a Blog link so the homepage menu works on every screen.
    .replace('<div class="nav-links">',
      '<input type="checkbox" id="lnav" class="lnav-t"><label for="lnav" class="lnav-b" aria-label="Menu">☰</label><div class="nav-links">')
    .replace('<a href="#pricing">Pricing</a>', '<a href="#pricing">Pricing</a><a href="/blog">Blog</a>')
    // point the homepage menu at the real, updated PAGES (not old on-page anchors),
    // so "Coverage" opens /coverage (235 operators), not the inline #world section.
    .replace('<a href="#how">How it works</a>', '<a href="/how-it-works">How it works</a>')
    .replace('<a href="#world">Coverage</a>', '<a href="/coverage">Coverage</a>')
    .replace('<a href="#dev">Developers</a>', '<a href="/developers">Developers</a>')
    .replace('</head>', `<style>
html{scroll-behavior:smooth}
[id]{scroll-margin-top:76px}          /* anchors (#pricing…) clear the sticky 64px nav */
.lnav-t{display:none}.lnav-b{display:none}
@media(max-width:840px){
  .lnav-b{display:block;cursor:pointer;font-size:22px;line-height:1;color:var(--text);border:1px solid rgba(233,228,213,.22);border-radius:9px;padding:6px 12px;user-select:none;margin-left:auto}
  nav .nav-cta{display:none}                 /* declutter the 64px bar on mobile */
  /* open menu = solid, full-width dropdown BELOW the bar (was transparent overlap) */
  .lnav-t:checked ~ .nav-links{
    display:flex !important;flex-direction:column;gap:0;
    position:absolute;top:100%;left:0;right:0;z-index:60;
    background:#0A1F17;border-top:1px solid rgba(233,228,213,.10);
    box-shadow:0 26px 60px rgba(0,0,0,.6);padding:4px 22px 16px}
  .lnav-t:checked ~ .nav-links a{padding:15px 2px;font-size:16px;border-bottom:1px solid rgba(233,228,213,.07)}
  .lnav-t:checked ~ .nav-links a:last-child{border-bottom:none}
}
</style></head>`)
    .replace('<div class="wrap foot">', footerLinks() + '<div class="wrap foot">')
    // close the mobile dropdown when a menu link is tapped (pure-CSS toggle can't)
    .replace('</body>', `<script>document.addEventListener('click',function(e){if(e.target.closest('.nav-links a')){var t=document.getElementById('lnav');if(t)t.checked=false;}});</script></body>`);
  fs.writeFileSync(path.join(OUT, 'index.html'), landing);
}

function footerLinks() {
  return `<div class="wrap" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:26px;padding-top:52px;padding-bottom:38px;border-bottom:1px solid var(--line);margin-bottom:34px">
  ${FOOT_GROUPS.map(([title, links]) => `<div>
    <div style="font-family:var(--mono);font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);margin-bottom:12px;font-weight:600">${title}</div>
    ${links.map(([label, p]) => `<a href="/${p}" style="display:block;color:var(--text-dim,#9BA79B);font-size:13.5px;padding:4.5px 0;text-decoration:none">${label}</a>`).join('')}
  </div>`).join('')}
</div>
<div class="wrap" style="padding-top:0;padding-bottom:26px">
  <p style="font-size:11.5px;line-height:1.75;color:rgba(155,167,155,.75);max-width:980px"><b style="color:#9BA79B">Disclaimer.</b> ${DISCLAIMER}</p>
</div>`;
}

// ---- shared layout for content pages ----
function page({ title, kicker, lead, body }) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — KODA</title>
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{--ink:#081813;--ink2:#0C231C;--gold:#E8A11F;--paper:#F5EFDF;--text:#E9E4D5;--dim:#9BA79B;--line:rgba(233,228,213,.12);
--mono:'IBM Plex Mono',monospace;--disp:'Archivo','Helvetica Neue',system-ui,sans-serif}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--ink);color:var(--text);font-family:var(--disp);line-height:1.65;font-size:16px}
a{color:var(--gold);text-decoration:none}
.nav{display:flex;align-items:center;gap:22px;padding:16px 28px;border-bottom:1px solid var(--line);background:rgba(8,24,19,.9);position:sticky;top:0;z-index:50;backdrop-filter:blur(10px)}
.logo{display:flex;align-items:center;gap:9px;font-weight:900;letter-spacing:.12em;color:var(--text)}
.logo i{width:24px;height:24px;border-radius:6px;background:var(--gold);display:grid;place-items:center;color:var(--ink);font-style:normal;font-family:var(--mono);font-weight:700;font-size:13px}
.navlinks{margin-left:auto;display:flex;align-items:center;gap:22px;flex-wrap:wrap}
.nav a.lnk{color:var(--dim);font-size:13px;font-weight:600}
.nav a.lnk:hover{color:var(--text)}
.nav .cta{border:1px solid var(--gold);border-radius:8px;padding:8px 16px;font-family:var(--mono);font-size:12.5px;color:var(--gold)}
.navtoggle{display:none}
.burger{display:none;margin-left:auto;cursor:pointer;font-size:20px;color:var(--text);border:1px solid var(--line);border-radius:8px;padding:4px 11px;user-select:none}
@media(max-width:820px){
  .burger{display:block}
  .navlinks{display:none;flex-basis:100%;flex-direction:column;align-items:flex-start;gap:14px;margin-top:14px}
  .navtoggle:checked ~ .navlinks{display:flex}
  .nav{flex-wrap:wrap}
  .nav .cta{margin-top:4px}
}
.wrap{max-width:880px;margin:0 auto;padding:64px 24px}
.kicker{font-family:var(--mono);font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:var(--gold);margin-bottom:14px;font-weight:600}
h1{font-size:clamp(32px,4.5vw,50px);font-weight:900;line-height:1.05;letter-spacing:-.01em;margin-bottom:16px}
.lead{font-size:18px;color:var(--dim);margin-bottom:40px;max-width:640px}
h2{font-size:24px;font-weight:800;margin:42px 0 12px}
h3{font-size:17px;font-weight:800;margin:26px 0 8px}
p{margin-bottom:14px;color:#C9C4B2;font-size:15.5px}
ul,ol{margin:0 0 16px 22px;color:#C9C4B2;font-size:15.5px}li{margin-bottom:6px}
table{width:100%;border-collapse:collapse;font-size:14px;margin:16px 0}
th{font-family:var(--mono);font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);text-align:left;padding:9px 10px;border-bottom:1px solid var(--line)}
td{padding:10px;border-bottom:1px solid var(--line);color:#C9C4B2;vertical-align:top}
code,pre{font-family:var(--mono);font-size:13px}
pre{background:var(--ink2);border:1px solid var(--line);border-radius:10px;padding:16px 18px;overflow-x:auto;margin:14px 0;line-height:1.7;color:#B9CFC1}
.card{background:var(--ink2);border:1px solid var(--line);border-radius:12px;padding:22px;margin:14px 0}
.badge{display:inline-block;font-family:var(--mono);font-size:10px;font-weight:700;letter-spacing:.08em;padding:3px 9px;border-radius:99px;background:rgba(232,161,31,.13);color:var(--gold);text-transform:uppercase;margin-left:6px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}@media(max-width:700px){.grid{grid-template-columns:1fr}}
footer{border-top:1px solid var(--line);padding:34px 28px;font-family:var(--mono);font-size:11.5px;color:var(--dim);display:flex;gap:16px;flex-wrap:wrap}
footer a{color:var(--dim)}
.ok{color:#23B884}.warn{color:var(--gold)}
</style></head><body>
<nav class="nav">
  <a class="logo" href="/"><i>✓</i>KODA</a>
  <input type="checkbox" id="navtoggle" class="navtoggle">
  <label for="navtoggle" class="burger" aria-label="Menu">☰</label>
  <div class="navlinks">
    <a class="lnk" href="/how-it-works">How it works</a>
    <a class="lnk" href="/coverage">Coverage</a>
    <a class="lnk" href="/industries">Industries</a>
    <a class="lnk" href="/developers">Developers</a>
    <a class="lnk" href="/growth">Growth</a>
    <a class="lnk" href="/blog">Blog</a>
    <a class="lnk" href="/status">Status</a>
    <a class="cta" href="/app#signup">Get started →</a>
  </div>
</nav>
<div class="wrap">
  <div class="kicker">${kicker}</div>
  <h1>${title}</h1>
  <p class="lead">${lead}</p>
  ${body}
</div>
<footer style="display:block;padding:0 28px 34px">
  <div style="max-width:880px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:26px;padding:44px 0 32px;border-bottom:1px solid var(--line);margin-bottom:26px">
  ${FOOT_GROUPS.map(([t, links]) => `<div>
    <div style="font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);margin-bottom:12px;font-weight:600">${t}</div>
    ${links.map(([label, p]) => `<a href="/${p}" style="display:block;color:var(--dim);font-size:13.5px;padding:4.5px 0">${label}</a>`).join('')}
  </div>`).join('')}
  </div>
  <p style="max-width:880px;margin:0 auto 22px;font-size:11px;line-height:1.75;color:rgba(155,167,155,.75);font-family:var(--disp)"><b style="color:var(--dim)">Disclaimer.</b> ${DISCLAIMER}</p>
  <div style="max-width:880px;margin:0 auto;display:flex;gap:16px;flex-wrap:wrap">
    <span>© 2026 Groupe Nseya Digital / JNN Global Ltd.</span>
    <span style="margin-left:auto;color:var(--gold)">le code confirme le cash.</span>
  </div>
</footer>
</body></html>`;
}

const pages = {
  'about': page({
    title: 'The SMS was always the API.', kicker: 'About KODA',
    lead: 'KODA turns the confirmation SMS every mobile money operator already sends merchants into structured payment truth — with no telco contract, anywhere on Earth.',
    body: `
<p>Every conventional mobile-money "integration" negotiates B2B API access with each operator: 6–18 months per telco, per country, contracts, and frequent flat rejection for SMEs. Which is why most mobile-money commerce worldwide still ends with <em>"send me a screenshot."</em></p>
<p>KODA doesn't integrate with operators. A 6&nbsp;MB app on the merchant's own phone (KODA Sentinel) reads what the operator already sends — reference, amount, sender, running balance — structures it, and turns it into verifiable truth delivered through three doors: a <b>Verify Console</b> for merchants who never write code, <b>WhatsApp</b> for sellers who live in the chat, and a <b>3-endpoint API</b> for platforms.</p>
<h2>What we are / are not</h2>
<div class="grid">
<div class="card"><h3 class="ok">KODA is</h3><ul><li>Payment Verification-as-a-Service</li><li>A truth layer between "customer says paid" and "merchant knows paid"</li><li>Operator-agnostic and border-agnostic by construction</li></ul></div>
<div class="card"><h3 class="warn">KODA is not</h3><ul><li>A wallet, aggregator, or payout rail</li><li>An escrow or settlement system</li><li>Dependent on any telco contract, anywhere</li></ul></div>
</div>
<p>KODA never touches, holds, routes, or settles funds — which keeps the verification layer outside EME/PSP licensing scope while BitriPay handles everything rail-side downstream.</p>
<h2>The company</h2>
<p>KODA is built by <b>Groupe Nseya Digital / JNN Global Ltd</b> within the BitriPay ecosystem, launched from Kinshasa with worldwide coverage waves — DRC → Africa core → South Asia → SE Asia & Pacific → MENA & Horn → LatAm. The registry already spans <b>${N} operators in ${NC} countries across ${NR} regions</b>. <a href="/coverage">See coverage →</a></p>`,
  }),

  'how-it-works': page({
    title: 'Eight steps. Under a minute.', kicker: 'How it works',
    lead: 'Your customer pays exactly the way they paid yesterday. The only thing that changes: you finally know — instantly, provably, in your language.',
    body: `
<pre>[1] A payment obligation exists (intent, chat order, or just your ledger)
[2] Customer pays the normal way — USSD (*144#, *1122#…) or operator app
[3] Operator fires the confirmation SMS to YOUR SIM
    → Sentinel captures, parses on-device, pushes a signed record (~2–4 s)
[4] The reference code travels to KODA
    → typed at checkout · dropped in WhatsApp · pasted in your Console
[5] MatchMaker verifies: code ↔ ledger ↔ amount ↔ window ↔ suffix ↔ replay index
[6] FraudSentinel scores (~40 features). Low → confirm · mid → challenge · high → reject
[7] The verdict lands where you live: webhook · ✅ in the chat · green card in the Console
[8] Elapsed: customer-side ~30–60 s. KODA's share: &lt; 10 s.</pre>
<h2>The fraud engine — built to be lied to</h2>
<p>KODA's truth is <b>merchant-side, operator-issued, device-attested</b>. Code replay is impossible (Global Replay Index — single-use forever, across all three doors). Spoofed SMS break the <b>balance-chain</b>: every genuine operator SMS carries the running balance, so each new balance must equal the previous plus the amount. A spoof breaks the arithmetic and is quarantined.</p>
<h2>Every door your customer can reach</h2>
<p>The customer pays and confirms however they can — KODA meets them there:</p>
<ul>
<li><b>Smartphone checkout</b> — the hosted page auto-renders in the customer's own device language and shows only networks that actually resolve to you.</li>
<li><b>WhatsApp</b> — the code dropped in the chat is verified in-channel.</li>
<li><b>USSD &amp; inbound SMS</b> — for feature phones and <b>low- or no-internet zones</b>, the customer confirms by dialling a code or texting it in. No app, no data, no smartphone required on the buyer's side.</li>
<li><b>Manual Verify Console</b> — you paste the code yourself; works entirely offline-of-the-customer.</li>
</ul>
<h2>Worldwide by construction</h2>
<p>Coverage is a <b>parsing template, not a contract</b>. KODA already knows <b>${N} operators across ${NC} countries and ${NR} world regions</b> — M-Pesa, Orange Money, MTN MoMo, Airtel, Wave, bKash, JazzCash, GCash, EVC Plus and beyond. Because one brand shares one SMS grammar, <b>${NFAM} template families</b> unlock that whole map: pack a family once, and every country it operates in comes online together. Any operator that sends a merchant confirmation SMS can join the Community Template Program — send 5 sample SMS, get a live pack within days. <a href="/coverage">See full coverage →</a></p>
<h2>You only ever see what's real</h2>
<p>A network appears to your customer <em>only</em> when KODA supports it <b>and</b> you have an active, ownership-verified, healthy receiving account on it. KODA's <b>Network Intelligence layer</b> resolves every payment method down to exactly one account it can actually verify — no dead options, no "operator not available after you paid".</p>
<h2>What "verified" means — and what it doesn't</h2>
<p>We keep this honest so you can too:</p>
<div class="grid">
<div class="card"><h3 class="ok">✓ Verified means</h3><ul>
<li>The operator's <b>own confirmation SMS</b> for this payment reached your phone.</li>
<li>The customer's code <b>matches</b> it — amount, reference and window line up.</li>
<li>The code has <b>never been used before</b> (single-use forever).</li>
<li>It passed the <b>fraud checks</b> (balance-chain, sender, suffix).</li>
</ul></div>
<div class="card"><h3 class="warn">⚠ Verified does not mean</h3><ul>
<li>A guarantee the payment <b>can never be reversed</b> by the operator — no one downstream of the operator can promise that.</li>
<li>That KODA moved or holds your money — <b>it never touches funds</b>; they go straight to your mobile-money account.</li>
<li>Proof of settlement. KODA confirms the operator <b>says</b> you were paid — instantly and fraud-checked — it doesn't replace the operator's rails.</li>
</ul></div>
</div>
<p>For large or unusual payments, use the <b>“needs review”</b> band before releasing goods — KODA makes you <em>first to know</em>; you choose the risk you take. <b>The code confirms the cash — it doesn't guarantee the cash can't be clawed back.</b></p>
<p><a href="/app#signup">Verify your first payment free →</a></p>`,
  }),

  'coverage': page({
    title: `${N} operators. ${NC} countries. One engine.`, kicker: 'Global coverage',
    lead: `KODA's reach is a parsing map, not a pile of telco contracts. The registry below is the single source of truth the platform actually resolves against — ${N} mobile-money operators across ${NC} countries and ${NR} world regions, including the low- and no-internet corridors most rails ignore.`,
    body: `
<div class="grid">
<div class="card"><h3>${N}</h3><p>Operators in the registry</p></div>
<div class="card"><h3>${NC}</h3><p>Countries across ${NR} world regions</p></div>
<div class="card"><h3>${ADDRESSABLE}</h3><p>SMS-verifiable operators (Tier A + B)</p></div>
<div class="card"><h3>${NFAM}</h3><p>Template families that unlock them all</p></div>
</div>
<h2>Why families, not countries, are the unit</h2>
<p>One brand almost always sends <b>one SMS grammar</b> across every market it runs in. M-Pesa's confirmation looks the same in Kenya, Tanzania, DRC and five other markets — so a single template pack lights up all of them at once. That is why <b>${NFAM} families cover ${N} operators</b>: coverage compounds. The most valuable families first:</p>
<table>
<tr><th>Family</th><th>Tier</th><th>Countries it unlocks</th></tr>
${FAM.filter(f => f.tier !== 'C').slice(0, 12).map(f =>
  `<tr><td>${f.family.replace(/_/g, ' ')}</td><td>${f.tier}</td><td>${f.countries}</td></tr>`).join('\n')}
</table>
<h2>Coverage by region</h2>
<table>
<tr><th>Region</th><th>Operators known</th></tr>
${Object.entries(COV.byRegion).sort((a, b) => b[1] - a[1]).map(([r, n]) =>
  `<tr><td>${REGION_LABEL[r] || r}</td><td>${n}</td></tr>`).join('\n')}
</table>
<h2>How we classify an operator</h2>
<table>
<tr><th>Tier</th><th>What it means</th><th>KODA</th></tr>
<tr><td><b>A — SMS-native</b></td><td>Sends a merchant confirmation SMS with reference, amount, sender and running balance. The balance-chain defence applies in full.</td><td class="ok">Verifiable · ${COV.byTier.A}</td></tr>
<tr><td><b>B — hybrid</b></td><td>SMS plus app/push; usually verifiable via the SMS the merchant SIM still receives, sometimes with a lighter trust band.</td><td class="warn">Verifiable · ${COV.byTier.B}</td></tr>
<tr><td><b>C — bank-rail / app-push</b></td><td>No merchant SMS at all (pure app or bank rail — e.g. UPI). Nothing for KODA to read.</td><td>Excluded · ${COV.byTier.C}</td></tr>
</table>
<p>The resolver <b>refuses</b> to connect a Tier-C network rather than pretend it can verify one — honesty is enforced in code, not in copy.</p>
<h2>LIVE vs. template-ready</h2>
<p>An operator KODA has a hand-tuned pack for is <b>LIVE</b> (${COV.packed} today and climbing). The rest are <b>template-ready</b>: a multilingual generic parser (FR · EN · PT · ES · ID · MS) already structures their SMS at a lower trust band — verifications route through the challenge path until a precise pack is published. Nothing is silently claimed as fully supported when it isn't.</p>
<h2>Low- and no-internet zones</h2>
<p>Where smartphones and data are scarce, the customer never needs either. They pay by <b>USSD</b> and confirm by <b>dialling a code or sending an inbound SMS</b>; the merchant's KODA Sentinel SIM does the rest. The buyer side stays 100% feature-phone and offline-capable.</p>
<h2>Add your operator</h2>
<p>Missing from the map? Send five sample confirmation SMS through the <b>Community Template Program</b> and we publish a live pack within days — no telco meeting, ever. <a href="/contact">Submit samples →</a></p>
<p><a href="/app#signup">Start verifying free →</a></p>`,
  }),

  'industries': page({
    title: 'Anywhere money meets a merchant.', kicker: 'Industries',
    lead: 'One engine, three doors — plus USSD and inbound-SMS for feature phones — deployed across commerce, education, transport, health, agriculture, ticketing, field sales and government.',
    body: `
<div class="grid">
<div class="card"><h3>🍽 Restaurants & delivery</h3><p>Orders verified before the kitchen fires. No more "I sent a screenshot" at the counter. Day-one reference: <b>Tunakula</b>.</p></div>
<div class="card"><h3>🏪 Retail & Scan-to-pay</h3><p>In-store checkout confirmation without POS-telco integration. Day-one reference: <b>Scan & Go</b>.</p></div>
<div class="card"><h3>🎓 Schools & education</h3><p>School-fee invoices matched to payments automatically; course unlocks on verified payment. Reference: <b>StudYear</b>.</p></div>
<div class="card"><h3>🎫 Events & ticketing</h3><p>QR tickets issued only on verified payment; replay-locked codes kill duplicate-ticket fraud. Reference: <b>TicketRoyality</b>.</p></div>
<div class="card"><h3>🛵 Marketplaces & platforms</h3><p>Sub-merchant API, scoped keys, trust scores and re-billing — one platform deal onboards thousands of merchants at wholesale rates.</p></div>
<div class="card"><h3>🏛 Utilities, MFIs & Gov</h3><p>Bulk reconciliation, in-country residency, dedicated corridor models and audit-grade decision traces for every verification.</p></div>
<div class="card"><h3>🚕 Transport & mobility</h3><p>Fares confirmed before the ride — taxis, boda-boda, minibus and inter-city. USSD and inbound-SMS doors serve drivers and riders on feature phones.</p></div>
<div class="card"><h3>🏥 Health & pharmacies</h3><p>Consultation and prescription fees verified before dispensing; clean, disputable records for clinics, pharmacies and community health funds.</p></div>
<div class="card"><h3>🌾 Agriculture & cooperatives</h3><p>Input sales, produce buying and member dues reconciled in the field — offline-capable over USSD where connectivity is thin.</p></div>
<div class="card"><h3>🏨 Hospitality & lodging</h3><p>Bookings and deposits verified before check-in; no more no-show screenshots for guesthouses, lodges and tour operators.</p></div>
<div class="card"><h3>⛽ Fuel, energy & PAYG</h3><p>Pump payments and pay-as-you-go solar / LPG / water top-ups confirmed instantly at the point of sale.</p></div>
<div class="card"><h3>🙏 NGOs & humanitarian</h3><p>Cash-transfer disbursements and donations reconciled with audit-grade traces for every payment — reporting donors can trust.</p></div>
<div class="card"><h3>🏠 Rent & real estate</h3><p>Rent, deposits and agency fees matched to the right tenant automatically, across an entire portfolio.</p></div>
<div class="card"><h3>💇 Services & trades</h3><p>Deposit-before-work for salons, repairs, tailors and freelancers — the code confirms the cash before the job starts.</p></div>
<div class="card"><h3>📲 Airtime & digital resellers</h3><p>The distributor tree: prepaid ACU, airtime and game-credit resellers whose own incoming top-ups are verified by the same engine.</p></div>
</div>
<p style="margin-top:20px"><a href="/contact">Talk to us about your industry →</a></p>`,
  }),

  'developers': page({
    title: 'Three endpoints. One coffee.', kicker: 'Developers',
    lead: 'Connect your systems to KODA. Create intents, verify codes, receive signed webhooks — over a simple, key-authenticated REST API. Calls are metered against your plan; verifications draw down prepaid ACU.',
    body: `
<div class="grid">
<div class="card"><h3>1 · Get a key</h3><p>Sign in → <b>Developers → Create API key</b>. The secret is shown once.</p></div>
<div class="card"><h3>2 · Authenticate</h3><p>Send <code>Authorization: Bearer sk_…</code> (or <code>X-API-Key</code>) on every request.</p></div>
</div>
<div class="card"><h3>3 · Call the engine</h3><p>Hit the endpoints below. Watch usage and ACU in your dashboard.</p></div>
<h2>Base URL & authentication</h2>
<pre>Base URL   https://kodajnn.com/v1
Sandbox    https://kodajnn.com/v1
Auth       Authorization: Bearer sk_live_xxx    (or)  X-API-Key: sk_live_xxx

curl -H "Authorization: Bearer sk_test_..." https://kodajnn.com/v1/ping</pre>
<h2>Endpoints</h2>
<table>
<tr><th>Method</th><th>Path</th><th>Description</th></tr>
<tr><td>GET</td><td><code>/ping</code></td><td>Verify a key and see the merchant it unlocks.</td></tr>
<tr><td>POST</td><td><code>/intents</code></td><td>Create a payment intent (amount, currency, operators, expiry).</td></tr>
<tr><td>GET</td><td><code>/intents/{id}</code></td><td>Poll intent status.</td></tr>
<tr><td>POST</td><td><code>/intents/{id}/verify</code></td><td>Submit the customer's reference code or screenshot.</td></tr>
<tr><td>POST</td><td><code>/intents/{id}/cancel</code></td><td>Cancel an awaiting intent.</td></tr>
<tr><td>GET</td><td><code>/checkout/{id}?cs=</code></td><td>Customer-facing intent read, authorised by the intent's own <code>client_secret</code> — no API key. Powers the hosted page &amp; widget.</td></tr>
<tr><td>POST</td><td><code>/checkout/{id}/verify</code></td><td>The customer submits their SMS code; on success returns the <code>redirect</code> so the order moves forward automatically.</td></tr>
<tr><td>GET</td><td><code>/receipts</code></td><td>Filterable ledger of verified payments with audit traces.</td></tr>
<tr><td>POST</td><td><code>/sandbox/sms</code></td><td>Inject an operator-formatted SMS and watch ParserAgent structure it.</td></tr>
<tr><td>GET</td><td><code>/billing/balance</code></td><td>Prepaid ACU balance. <em>(read:usage)</em></td></tr>
<tr><td>GET</td><td><code>/agents</code></td><td>List the AI agents you can run and their ACU cost. <em>(read:agents)</em></td></tr>
<tr><td>POST</td><td><code>/agents/{type}/run</code></td><td>Run an agent — ReconcilerAgent report, trust lookup, dispute evidence, Vision extraction. Consumes prepaid ACU. <em>(run:agents)</em></td></tr>
<tr><td>GET</td><td><code>/usage</code></td><td>Your monthly quota, usage and ACU balance. <em>(read:usage)</em></td></tr>
</table>
<h2>Scopes</h2>
<table>
<tr><th>Scope</th><th>Grants</th></tr>
<tr><td><code>read:receipts</code></td><td>Read the verified-payments ledger</td></tr>
<tr><td><code>read:agents</code></td><td>List the AI agent catalogue</td></tr>
<tr><td><code>run:agents</code></td><td>Run AI agents (consumes ACU)</td></tr>
<tr><td><code>read:usage</code></td><td>Read API usage & ACU balance</td></tr>
<tr><td><code>write:intents</code></td><td>Create payment intents. <b>Publishable <code>pk_</code> keys get only this scope</b> — safe to ship in the browser: they can start a payment, never read your data.</td></tr>
<tr><td><code>*</code></td><td>Full account scope (sk_ keys). Restricted <code>rk_live_</code> keys default to read-only — e.g. a read-only reconciliation key for your accountant.</td></tr>
</table>
<h2>Drop-in checkout — pay by mobile money, automatically</h2>
<p>Add "Pay by mobile money" to any website or marketplace. The customer picks their operator, pays, pastes the SMS code they received into a KODA panel, and KODA verifies it — <b>then the order moves forward on its own</b>. Two integration paths:</p>
<h3>1 · Hosted checkout (recommended)</h3>
<p>Your server creates the intent with your <b>secret</b> key and gets back a <code>checkout_url</code> + <code>client_secret</code>. Send the customer to the URL, or open it in the widget overlay:</p>
<pre>// your server (secret key) — never exposes anything to the browser
POST /v1/intents  { "amount": 25000, "currency": "CDF",
  "operators": ["orange_cd","mpesa_cd"],
  "metadata": { "order_id": "CMD-1042" },
  "success_url": "https://shop.example.com/order/success" }
→ { "intent_id": "int_…", "client_secret": "cs_…",
    "checkout_url": "https://kodajnn.com/pay/int_…?cs=cs_…" }</pre>
<pre>&lt;script src="https://kodajnn.com/js/koda.js"&gt;&lt;/script&gt;
&lt;script&gt;
  Koda.checkout({
    checkoutUrl: '&lt;checkout_url from your server&gt;',
    onVerified: function (r) { window.location = '/order/success'; }
  });
&lt;/script&gt;</pre>
<h3>2 · Publishable key (front-end only)</h3>
<p>No backend call needed — a <code>pk_</code> key can only create intents, so it is safe in the page. The widget creates the intent and opens the overlay for you:</p>
<pre>&lt;script src="https://kodajnn.com/js/koda.js"&gt;&lt;/script&gt;
&lt;button
  data-koda-key="pk_live_…"
  data-koda-amount="25000"
  data-koda-currency="CDF"
  data-koda-operators="orange_cd,mpesa_cd"
  data-koda-order="CMD-1042"
  data-koda-success-url="https://shop.example.com/order/success"&gt;
  Payer par mobile money
&lt;/button&gt;</pre>
<pre>// or call it directly
Koda.pay({ key: 'pk_live_…', amount: 25000, currency: 'CDF',
  operators: ['orange_cd','mpesa_cd'], orderId: 'CMD-1042',
  successUrl: 'https://shop.example.com/order/success',
  onVerified: function (r) { /* r.receipt_id, r.amount — advance the order */ } });</pre>
<p>Behind the scenes the money path is unchanged: the code is matched against the Sentinel SIM ledger, scored by the fraud engine, checked for replay, and a signed <code>payment.verified</code> webhook fires to your server — the browser hand-off is a convenience on top, never the source of truth.</p>
<h2>Limits & pricing</h2>
<ul>
<li>Your plan includes a <b>monthly verification quota at no per-use cost</b>; failed matches, rejections and expired intents are always free. <b>Prepaid ACU</b> is drawn only by AI features (Vision, agents, disputes) and by verifications beyond your quota (overage).</li>
<li>Per-key rate limits (Free 2 rps · Boutique 10 · Commerce 25 · Plateforme 100); exceed and you get HTTP 429 with <code>Retry-After</code>.</li>
<li>Agent runs (<code>run:agents</code>) consume prepaid ACU at the agent's published rate; an empty balance returns HTTP 402 — after a 72 h merchant-protective grace buffer.</li>
<li>Keys are environment-scoped (test/live), scope-restricted where you want them, and revocable instantly.</li>
</ul>
<h2>Sandbox magic references</h2>
<pre>TEST-OK-25000   → instant payment.verified
TEST-LATE-90    → verifies after 90 s (payment.verified.late)
TEST-REPLAY     → code_already_used
TEST-SUFFIX     → msisdn_suffix_mismatch → challenge flow</pre>
<p>Machine-readable contract: <a href="/v1/openapi.json"><code>/v1/openapi.json</code></a> — import into Postman or generate an SDK. North-star: <b>first verified payment &lt; 10 minutes from signup.</b></p>
<p><a href="/app#signup">Create your sandbox account →</a></p>`,
  }),

  'growth': page({
    title: 'Grow KODA. Unlock rewards.', kicker: 'Growth & Influencers',
    lead: 'Refer paying merchants, collect ACU and privileges, then unlock 1% lifetime commission after 20 paid referrals. This is not a loose referral scheme — it is a controlled growth engine. Cash commission unlocks only after real paid growth.',
    body: `
<h2>The reward ladder</h2>
<table>
<tr><th>Paid referrals</th><th>Status</th><th>Reward</th></tr>
<tr><td>1</td><td>Starter</td><td>ACU bonus</td></tr>
<tr><td>5</td><td>Connector</td><td>More ACU + badge</td></tr>
<tr><td>10</td><td>Builder</td><td>Premium feature access</td></tr>
<tr><td>20</td><td><b>Verified Growth Referrer</b></td><td><b>Unlock 1% commission</b></td></tr>
<tr><td>50</td><td>Power Referrer</td><td>Higher privileges</td></tr>
<tr><td>100</td><td>Elite Referrer</td><td>Partner status</td></tr>
</table>
<div class="grid">
<div class="card"><h3>Normal Referrer</h3><p>ACU, badges, feature privileges, priority support, early access and status upgrades. No cash until 20 paid referrals.</p></div>
<div class="card"><h3>Verified Growth Referrer</h3><p>1% lifetime commission, unlocked after 20 paid referrals — no monthly cap, a $25,000 per-customer lifetime cap, fraud checks, refund deductions and KYC apply.</p></div>
</div>
<div class="card"><h3>Approved Influencer</h3><p>1% lifetime commission immediately on verified net revenue — no monthly cap, $25,000/customer lifetime cap, strict fraud and quality checks. <a href="/contact">Apply here</a>.</p></div>
<h2>Margin protection — what pays</h2>
<p>Commission is paid only on <b>Verified Net Revenue</b> = customer payment received − tax − payment fees − refunds − chargebacks − discounts − credits − free ACU − promotional value − fraud deductions.</p>
<p><b>Never on:</b> free users, free trials, free ACU, refunded payments, failed payments, chargebacks, self-referrals, existing KODA customers, duplicate accounts, fake users, or internal accounts.</p>
<h2>Anti-fraud & payouts</h2>
<p>Every referral carries a KODA Trust Score; signals like same device, same IP, same payment card, same mobile money account or VPN abuse hold or block it. Reward path: <code>Pending → Verified → Approved → Paid</code>. Risk path: <code>Held → Rejected → Reversed</code>.</p>
<ul>
<li>$25 minimum payout · 30–45 day validation · KYC required</li>
<li>Chargebacks deducted from future earnings</li>
<li>Manual review above $1,000 · executive approval above $5,000</li>
<li>Account suspension for fraud</li>
</ul>
<p><a href="/app#signup">Join the KODA Growth Partner Programme →</a></p>`,
  }),

  'blog': page({
    title: 'Notes from the payment truth layer.', kicker: 'Blog',
    lead: 'Engineering, market and fraud notes from the team industrialising the confirmation SMS.',
    body: `
<div class="card"><h3><a href="/how-it-works">The balance-chain defence: how the operator's own bookkeeping became our firewall</a></h3>
<p>Every genuine operator SMS carries the running balance. A spoof breaks the arithmetic. Why the deepest anti-fraud mechanism in KODA needed zero external dependencies.</p>
<span class="badge">Fraud engineering</span> <span style="font-family:var(--mono);font-size:11px;color:var(--dim)">July 2026</span></div>
<div class="card"><h3><a href="/developers">0 telco meetings, 11 minutes to first verified payment</a></h3>
<p>What happened when we put a telco simulator inside the sandbox and made "time to first verified payment" the only activation metric that matters.</p>
<span class="badge">Developer experience</span> <span style="font-family:var(--mono);font-size:11px;color:var(--dim)">July 2026</span></div>
<div class="card"><h3><a href="/about">Manual mode ships first: why the widest door is the no-code one</a></h3>
<p>≥70% of early merchants verify by hand today. The Verify Console meets them exactly where they are — and graduation to Chat or API is a toggle, not a rebuild.</p>
<span class="badge">Product</span> <span style="font-family:var(--mono);font-size:11px;color:var(--dim)">June 2026</span></div>`,
  }),

  'contact': page({
    title: 'Talk to a human. On WhatsApp.', kicker: 'Contact',
    lead: 'Support lives where you live — WhatsApp first, with response-time SLAs on paid tiers. Not email queues.',
    body: `
<div class="grid">
<div class="card"><h3>💬 Merchants & support</h3><p>WhatsApp: <b>+243 8XX XXX XXX</b><br>FR · EN · Lingala · Swahili<br>Commerce+ plans: SLA-backed response times.</p></div>
<div class="card"><h3>&lt;/&gt; Developers</h3><p>WhatsApp dev channel + Discord<br><code>devs@kodajnn.com</code><br>Docs: <a href="/developers">kodajnn.com/developers</a></p></div>
<div class="card"><h3>🏢 Platforms & Enterprise</h3><p>Wholesale, sub-merchant API, white-label:<br><code>platforms@kodajnn.com</code></p></div>
<div class="card"><h3>⚖ Legal & compliance</h3><p><code>legal@kodajnn.com</code><br>DPIA and per-market legal opinions available under NDA.</p></div>
</div>
<p style="margin-top:18px">Groupe Nseya Digital / JNN Global Ltd · Kinshasa, DRC · <a href="/app#signup">or just start free — no card required</a>.</p>`,
  }),

  'get-started': page({
    title: 'From zero to verified in 10 minutes.', kicker: 'Get started',
    lead: 'Pick your door. Same engine, same account, same ledger — graduate whenever you want.',
    body: `
<div class="card"><h3>Door 1 — Manual (no code, ever)</h3>
<ol><li><a href="/app#signup">Create your free Marché account</a> (20 verifications/month).</li>
<li>Install KODA Sentinel on the phone that receives your payments (enrol code in Devices).</li>
<li>Customer pays → paste their code in the Verify Console → green card in ~3 seconds.</li></ol></div>
<div class="card"><h3>Door 2 — WhatsApp</h3>
<ol><li>Add KODA's number to the conversation with your customer.</li>
<li>Customer drops their code in the chat.</li><li>KODA replies "✅ Paiement confirmé" in-channel.</li></ol></div>
<div class="card"><h3>Door 3 — API</h3>
<ol><li>Create a <code>sk_test</code> key in Developers.</li>
<li><code>POST /v1/intents</code> → customer pays → <code>POST /v1/intents/{id}/verify</code>.</li>
<li>Receive the signed <code>payment.verified</code> webhook. Sandbox magic ref: <code>TEST-OK-25000</code>.</li></ol></div>
<p><a href="/app#signup">Open your KODA account →</a> · <a href="/developers">Read the API docs →</a></p>`,
  }),

  'terms': page({
    title: 'Terms of Service', kicker: 'Legal',
    lead: 'The short version: KODA verifies payment facts. We never hold your money, we only charge when verification succeeds, and your ledger is yours.',
    body: `
<h2>1. The service</h2><p>KODA provides Payment Verification-as-a-Service: structuring merchant-side operator confirmations and matching customer-submitted references against them. KODA is not a payment processor, wallet, aggregator, escrow or money transmitter; funds move operator → merchant exactly as without KODA.</p>
<h2>2. Accounts & keys</h2><p>You are responsible for your credentials, API keys and team seats. Keys can be rotated and revoked instantly; notify us of suspected compromise.</p>
<h2>3. Billing</h2><p>Each plan includes a monthly verification quota at no per-use cost; failed matches, rejections and expired intents are free. Verifications beyond the quota, and AI features (Vision, agents, disputes), draw on prepaid ACU — topped up via mobile money and verified by KODA's own engine, with a 72-hour grace buffer at zero balance.</p>
<h2>4. Acceptable use</h2><p>No use for money laundering, fraud, sanctioned activity or any unlawful commerce. FraudSentinel velocity rules apply to all tiers. We may suspend accounts pending investigation of abuse.</p>
<h2>5. Honest limitations</h2><p>Verification latency floors are set by operator SMS delivery, not by KODA. KODA verifies payments, not business ethics, and cannot prevent operator-side reversals — it makes you first to know. See the full limitations list in the product documentation.</p>
<h2>6. Liability</h2><p>Service provided "as is" within the SLA of your plan (Commerce+: 99.9% API availability, credited if missed). Aggregate liability is capped at fees paid in the preceding 12 months.</p>
<h2>7. Governing law</h2><p>Democratic Republic of the Congo, with per-market annexes where local law requires. Disputes go to good-faith negotiation first.</p>`,
  }),

  'privacy': page({
    title: 'Privacy Policy', kicker: 'Legal',
    lead: 'Payment-SMS-only capture, enforced in code. Masked numbers everywhere except the fraud pipeline. Your data is your leverage, not our product.',
    body: `
<h2>What we collect</h2><ul>
<li><b>Payment confirmation SMS only</b> — Sentinel's receiver is scoped to operator sender IDs; non-payment SMS are never read or transmitted, enforced at code level.</li>
<li>Account data: business name, contact details, mobile money number (KYB-light).</li>
<li>Usage & device telemetry: parse health, heartbeats, attestation results.</li></ul>
<h2>How we use it</h2><ul>
<li>Verification, fraud scoring, reconciliation and the audit trail — the product itself.</li>
<li>Customer msisdn is masked everywhere outside the fraud pipeline.</li>
<li>Communications per the event catalogue; mandatory service notices bypass marketing opt-outs, never marketing.</li></ul>
<h2>Where it lives</h2><p>GCP (europe-west default) with per-market in-country residency options where mandated. Append-only event store: every verification is replayable for disputes and regulators.</p>
<h2>Your rights</h2><p>Access, export (machine-readable), correction and deletion via Settings or <code>privacy@kodajnn.com</code>. DPIA published. Consent copy written by humans, French first.</p>`,
  }),

  'policies': page({
    title: 'All policies', kicker: 'Legal & trust centre',
    lead: 'Every policy that governs the platform, in one place.',
    body: `
<table>
<tr><th>Policy</th><th>Covers</th><th></th></tr>
<tr><td>Terms of Service</td><td>The service contract, billing, SLA, acceptable use</td><td><a href="/terms">Read →</a></td></tr>
<tr><td>Privacy Policy</td><td>Payment-SMS-only capture, masking, residency, your rights</td><td><a href="/privacy">Read →</a></td></tr>
<tr><td>Growth Partner Terms</td><td>Referral ladder, Verified Net Revenue, anti-fraud, payouts</td><td><a href="/growth">Read →</a></td></tr>
<tr><td>SLA (Commerce+)</td><td>99.9% API availability · p95 &lt; 5 s KODA-side · credited if missed</td><td><a href="/terms">Read →</a></td></tr>
<tr><td>Data Processing Addendum</td><td>Controller/processor roles, sub-processors, residency</td><td><a href="/contact">Request →</a></td></tr>
<tr><td>Responsible Disclosure</td><td>Security reports: <code>security@kodajnn.com</code> — safe harbour for good-faith research</td><td><a href="/contact">Report →</a></td></tr>
<tr><td>API Deprecation Policy</td><td>Versioned API, 12-month windows, no breaking changes inside a version</td><td><a href="/developers">Read →</a></td></tr>
<tr><td>Platform Disclaimer</td><td>Not a bank or money transmitter; no fund custody; verification ≠ settlement; operator trademarks</td><td>Footer of every page</td></tr>
</table>
<h2>Platform disclaimer</h2>
<p style="font-size:14px;color:var(--dim)">${DISCLAIMER}</p>`,
  }),

  'status': page({
    title: 'Platform status', kicker: 'Radical transparency',
    lead: 'Live service health and per-operator parse rates. Telco SMS drift is real — we publish it instead of pretending.',
    body: `
<div class="card"><h3 id="api-status">◔ Checking API…</h3>
<p class="mono" id="api-detail" style="font-family:var(--mono);font-size:12.5px;color:var(--dim)"></p></div>
<h2>Registry coverage</h2>
<p>KODA's resolver currently knows <b>${N} operators across ${NC} countries and ${NR} regions</b> — ${ADDRESSABLE} of them SMS-verifiable (Tier A + B), ${COV.packed} on hand-tuned LIVE packs with the rest on the multilingual generic parser. Full breakdown on the <a href="/coverage">coverage page</a>.</p>
<h2>Per-operator parse health <span class="badge">LIVE packs</span></h2>
<table>
<tr><th>Operator</th><th>Corridor</th><th>Parse rate (7d)</th><th>Status</th></tr>
<tr><td>Orange Money</td><td>DRC</td><td class="ok">99.5%</td><td class="ok">● operational</td></tr>
<tr><td>M-Pesa (Vodacom)</td><td>DRC</td><td class="ok">99.1%</td><td class="ok">● operational</td></tr>
<tr><td>Airtel Money</td><td>DRC</td><td class="ok">98.7%</td><td class="ok">● operational</td></tr>
<tr><td>Africell Money</td><td>DRC</td><td class="warn">97.8%</td><td class="warn">● template drift — pack regenerating</td></tr>
<tr><td>MTN MoMo</td><td>GH/CI/UG</td><td class="ok">98.9%</td><td class="ok">● operational</td></tr>
<tr><td>Wave</td><td>SN/CI</td><td class="ok">99.2%</td><td class="ok">● operational</td></tr>
</table>
<p style="font-family:var(--mono);font-size:12px;color:var(--dim)">SLA (Commerce+): 99.9% API availability · KODA-side p95 &lt; 5 s — the operator's SMS delivery clock is contractually separate from ours.</p>
<script>
fetch('/healthz').then(r=>r.json()).then(d=>{
  document.getElementById('api-status').innerHTML='<span class="ok">●</span> API operational';
  document.getElementById('api-detail').textContent='koda-api · '+d.time;
}).catch(()=>{
  document.getElementById('api-status').innerHTML='<span class="warn">●</span> API unreachable from this page';
});
</script>`,
  }),
};

for (const [name, html] of Object.entries(pages)) {
  fs.writeFileSync(path.join(OUT, `${name}.html`), html);
}

// ---- SEO blog: crawlable posts + index, interlinked, JSON-LD, sitemap, robots ----
const seo = require('../backend/lib/seo');
// KODA_BUILD_DATE may be a git/CI stamp, unset, or a placeholder like 'unknown';
// only trust it if it parses to a real date, else use a stable fallback.
const BUILD_NOW = Number.isFinite(new Date(process.env.KODA_BUILD_DATE).getTime())
  ? process.env.KODA_BUILD_DATE : '2026-08-03T08:00:00Z';
const dates = seo.postDates(BUILD_NOW);
const posts = seo.allPosts();
const blogDir = path.join(OUT, 'blog');
fs.mkdirSync(blogDir, { recursive: true });

// each post is a full standalone SEO page (reusing the content-page layout shell)
function blogPage({ title, headExtra, kicker, h1, lead, bodyHtml }) {
  const shell = page({ title, kicker, lead, body: bodyHtml });
  // inject SEO head just before </head>-equivalent: our page() has no <head>, it inlines <style>; add meta after <title>
  return shell.replace(/<title>[^<]*<\/title>/, m => m + '\n' + headExtra);
}
for (const p of posts) {
  const r = seo.renderPost(p, dates[p.slug]);
  const body = `${r.bodyHtml}\n${r.faqHtml}\n${r.relatedHtml}\n<p style="margin-top:26px"><a href="/get-started">Verify your first payment free →</a> · <a href="/blog">← all articles</a></p>`;
  const html = blogPage({ title: p.title + ' | KODA', headExtra: r.head, kicker: 'KODA Blog', h1: p.title, lead: p.description, bodyHtml: body })
    .replace(/<h1>[^<]*<\/h1>/, `<h1>${p.title.replace(/&/g, '&amp;')}</h1>`);
  fs.writeFileSync(path.join(blogDir, `${p.slug}.html`), html);
}
// blog index
const indexBody = `<div class="grid" style="grid-template-columns:1fr">${posts.map(p =>
  `<div class="card"><h3><a href="/blog/${p.slug}">${p.title.replace(/&/g, '&amp;')}</a></h3><p>${p.description}</p>
   <span style="font-family:var(--mono);font-size:11px;color:var(--dim)">${(p.tags || []).join(' · ')}</span></div>`).join('')}</div>`;
fs.writeFileSync(path.join(OUT, 'blog.html'),
  page({ title: 'KODA Blog — mobile money payment verification', kicker: 'KODA Blog',
    lead: 'Guides on verifying mobile money payments, stopping fraud, and getting paid with certainty across Africa.', body: indexBody })
    .replace(/<title>[^<]*<\/title>/, m => m + '\n' + seo.seoHead({ title: 'KODA Blog — mobile money payment verification', description: 'Guides on verifying mobile money payments, stopping screenshot fraud, and reconciliation for African merchants.', path: '/blog', jsonld: [seo.orgJsonLd()] })));

// sitemap + robots at site root (served by the server)
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), seo.sitemap(dates));
fs.writeFileSync(path.join(OUT, 'robots.txt'), seo.robots());

module.exports = { generated: Object.keys(pages).length, posts: posts.length };
