// KODA — public site generator. Emits public/site/*.html from a shared layout
// at server boot. Landing (index) is the koda-landing.html prototype from the
// repo root, copied verbatim with CTAs wired to /app.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const OUT = path.join(__dirname, '..', 'public', 'site');
fs.mkdirSync(OUT, { recursive: true });

// ---- landing: reuse the prototype, wire CTAs into the app ----
const landingSrc = path.join(__dirname, '..', '..', 'koda-landing.html');
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
    .replace('</nav>', '</nav>' + siteBanner());
  fs.writeFileSync(path.join(OUT, 'index.html'), landing);
}
function siteBanner() {
  return `<div style="background:#0C231C;border-bottom:1px solid rgba(233,228,213,.1);font-family:'IBM Plex Mono',monospace;font-size:11.5px;padding:8px 24px;display:flex;gap:18px;flex-wrap:wrap;color:#9BA79B">
  ${['about', 'how-it-works', 'industries', 'developers', 'growth', 'blog', 'status', 'contact'].map(p =>
    `<a style="color:inherit;text-decoration:none" href="/${p}">${p.replace(/-/g, ' ')}</a>`).join('')}
  <a style="color:#E8A11F;text-decoration:none;margin-left:auto" href="/app">→ open the app</a></div>`;
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
.nav{display:flex;align-items:center;gap:22px;padding:16px 28px;border-bottom:1px solid var(--line);background:rgba(8,24,19,.9);position:sticky;top:0;backdrop-filter:blur(10px);flex-wrap:wrap}
.logo{display:flex;align-items:center;gap:9px;font-weight:900;letter-spacing:.12em;color:var(--text)}
.logo i{width:24px;height:24px;border-radius:6px;background:var(--gold);display:grid;place-items:center;color:var(--ink);font-style:normal;font-family:var(--mono);font-weight:700;font-size:13px}
.nav a.lnk{color:var(--dim);font-size:13px;font-weight:600}
.nav a.lnk:hover{color:var(--text)}
.nav .cta{margin-left:auto;border:1px solid var(--gold);border-radius:8px;padding:8px 16px;font-family:var(--mono);font-size:12.5px}
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
  <a class="lnk" href="/about">About</a><a class="lnk" href="/how-it-works">How it works</a>
  <a class="lnk" href="/industries">Industries</a><a class="lnk" href="/developers">Developers</a>
  <a class="lnk" href="/growth">Growth</a><a class="lnk" href="/blog">Blog</a>
  <a class="lnk" href="/status">Status</a><a class="lnk" href="/contact">Contact</a>
  <a class="cta" href="/app#signup">Get started →</a>
</nav>
<div class="wrap">
  <div class="kicker">${kicker}</div>
  <h1>${title}</h1>
  <p class="lead">${lead}</p>
  ${body}
</div>
<footer>
  <span>© 2026 Groupe Nseya Digital / JNN Global Ltd.</span>
  <a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/policies">All policies</a>
  <a href="/status">Platform status</a>
  <span style="margin-left:auto;color:var(--gold)">le code confirme le cash.</span>
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
<p>KODA is built by <b>Groupe Nseya Digital / JNN Global Ltd</b> within the BitriPay ecosystem, launched from Kinshasa with worldwide coverage waves — DRC → Africa core → South Asia → SE Asia & Pacific → MENA & Horn → LatAm.</p>`,
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
<h2>Worldwide by construction</h2>
<p>Coverage is a <b>parsing template, not a contract</b>. KODA works wherever the operator sends a merchant confirmation SMS — M-Pesa, Orange Money, MTN MoMo, Airtel, Wave, bKash, JazzCash, GCash, EVC Plus and any operator in the Community Template Program: send 5 sample SMS, get a live pack within days.</p>
<p><a href="/app#signup">Verify your first payment free →</a></p>`,
  }),

  'industries': page({
    title: 'Anywhere money meets a merchant.', kicker: 'Industries',
    lead: 'One engine, three doors — deployed across commerce, education, transport, ticketing and field sales.',
    body: `
<div class="grid">
<div class="card"><h3>🍽 Restaurants & delivery</h3><p>Orders verified before the kitchen fires. No more "I sent a screenshot" at the counter. Day-one reference: <b>Tunakula</b>.</p></div>
<div class="card"><h3>🏪 Retail & Scan-to-pay</h3><p>In-store checkout confirmation without POS-telco integration. Day-one reference: <b>Scan & Go</b>.</p></div>
<div class="card"><h3>🎓 Schools & education</h3><p>School-fee invoices matched to payments automatically; course unlocks on verified payment. Reference: <b>StudYear</b>.</p></div>
<div class="card"><h3>🎫 Events & ticketing</h3><p>QR tickets issued only on verified payment; replay-locked codes kill duplicate-ticket fraud. Reference: <b>TicketRoyality</b>.</p></div>
<div class="card"><h3>🛵 Marketplaces & platforms</h3><p>Sub-merchant API, scoped keys, trust scores and re-billing — one platform deal onboards thousands of merchants at wholesale rates.</p></div>
<div class="card"><h3>🏛 Utilities, MFIs & Gov</h3><p>Bulk reconciliation, in-country residency, dedicated corridor models and audit-grade decision traces for every verification.</p></div>
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
<pre>Base URL   https://api.koda.africa/v1
Sandbox    https://sandbox.koda.africa/v1
Auth       Authorization: Bearer sk_live_xxx    (or)  X-API-Key: sk_live_xxx

curl -H "Authorization: Bearer sk_test_..." https://api.koda.africa/v1/ping</pre>
<h2>Endpoints</h2>
<table>
<tr><th>Method</th><th>Path</th><th>Description</th></tr>
<tr><td>GET</td><td><code>/ping</code></td><td>Verify a key and see the merchant it unlocks.</td></tr>
<tr><td>POST</td><td><code>/intents</code></td><td>Create a payment intent (amount, currency, operators, expiry).</td></tr>
<tr><td>GET</td><td><code>/intents/{id}</code></td><td>Poll intent status.</td></tr>
<tr><td>POST</td><td><code>/intents/{id}/verify</code></td><td>Submit the customer's reference code or screenshot.</td></tr>
<tr><td>POST</td><td><code>/intents/{id}/cancel</code></td><td>Cancel an awaiting intent.</td></tr>
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
<tr><td><code>*</code></td><td>Full account scope (sk_ keys). Restricted <code>rk_live_</code> keys default to read-only — e.g. a read-only reconciliation key for your accountant.</td></tr>
</table>
<h2>Limits & pricing</h2>
<ul>
<li>The billable atom is a <b>successful verification</b> — failed matches, rejections and expired intents are free.</li>
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
<div class="card"><h3>&lt;/&gt; Developers</h3><p>WhatsApp dev channel + Discord<br><code>devs@koda.africa</code><br>Docs: <a href="/developers">koda.africa/developers</a></p></div>
<div class="card"><h3>🏢 Platforms & Enterprise</h3><p>Wholesale, sub-merchant API, white-label:<br><code>platforms@koda.africa</code></p></div>
<div class="card"><h3>⚖ Legal & compliance</h3><p><code>legal@koda.africa</code><br>DPIA and per-market legal opinions available under NDA.</p></div>
</div>
<p style="margin-top:18px">Groupe Nseya Digital / JNN Global Ltd · Kinshasa, DRC · <a href="/app#signup">or just start free — no card required</a>.</p>`,
  }),

  'get-started': page({
    title: 'From zero to verified in 10 minutes.', kicker: 'Get started',
    lead: 'Pick your door. Same engine, same account, same ledger — graduate whenever you want.',
    body: `
<div class="card"><h3>Door 1 — Manual (no code, ever)</h3>
<ol><li><a href="/app#signup">Create your free Marché account</a> (50 verifications/month).</li>
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
<h2>3. Billing</h2><p>The billable atom is a successful verification. Failed matches, rejections and expired intents are free. Prepaid ACU wallets are topped up via mobile money and verified by KODA's own engine; a 72-hour grace buffer applies at zero balance.</p>
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
<h2>Your rights</h2><p>Access, export (machine-readable), correction and deletion via Settings or <code>privacy@koda.africa</code>. DPIA published. Consent copy written by humans, French first.</p>`,
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
<tr><td>Responsible Disclosure</td><td>Security reports: <code>security@koda.africa</code> — safe harbour for good-faith research</td><td><a href="/contact">Report →</a></td></tr>
<tr><td>API Deprecation Policy</td><td>Versioned API, 12-month windows, no breaking changes inside a version</td><td><a href="/developers">Read →</a></td></tr>
</table>`,
  }),

  'status': page({
    title: 'Platform status', kicker: 'Radical transparency',
    lead: 'Live service health and per-operator parse rates. Telco SMS drift is real — we publish it instead of pretending.',
    body: `
<div class="card"><h3 id="api-status">◔ Checking API…</h3>
<p class="mono" id="api-detail" style="font-family:var(--mono);font-size:12.5px;color:var(--dim)"></p></div>
<h2>Per-operator parse health</h2>
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
module.exports = { generated: Object.keys(pages).length };
