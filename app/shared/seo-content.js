// KODA — SEO content corpus & internal-link graph. Drives the AI SEO agent (K-10).
// Topics are keyword-clustered around real search intent for African mobile-money
// merchants; each post declares internal link targets so the generator weaves a
// dense backlink web (the on-page half of SEO). UMD.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KODA_SEO = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SITE = 'https://kodajnn.com';
  const BRAND = 'KODA';

  // product/industry pages every post can link INTO (internal authority flow)
  const PAGES = {
    home: { url: '/', title: 'KODA — Mobile Money Payment Verification' },
    how: { url: '/how-it-works', title: 'How KODA verifies mobile money payments' },
    coverage: { url: '/coverage', title: 'KODA global coverage — operators & countries' },
    industries: { url: '/industries', title: 'KODA for restaurants, retail, schools & marketplaces' },
    developers: { url: '/developers', title: 'KODA API for developers' },
    growth: { url: '/growth', title: 'KODA Growth Partner Programme' },
    getstarted: { url: '/get-started', title: 'Get started with KODA free' },
    status: { url: '/status', title: 'KODA platform status & operator parse health' },
  };

  // keyword clusters → each becomes a pillar the posts target and interlink around
  const CLUSTERS = [
    'verify mobile money payment', 'mobile money fraud', 'confirmation SMS verification',
    'accept mobile money payments', 'M-Pesa payment verification', 'Orange Money for business',
    'WhatsApp payments verification', 'no telco API payment', 'screenshot payment fraud',
    'mobile money reconciliation',
  ];

  // The post corpus. body paragraphs use {{page:key}} and {{post:slug}} tokens that
  // the generator expands into real <a> links, building the internal backlink web.
  const POSTS = [
    {
      slug: 'stop-mobile-money-screenshot-fraud',
      title: 'How to Stop Mobile Money Screenshot Fraud in 2026',
      keyword: 'screenshot payment fraud',
      description: 'Screenshot payment fraud costs African merchants millions. Here is how to verify every mobile money payment against the operator SMS — and lock each code so it can never be reused.',
      tags: ['fraud', 'mobile money', 'verification'],
      links: ['how', 'industries', 'getstarted'],
      related: ['verify-mpesa-payment-without-api', 'balance-chain-fake-sms', 'accept-orange-money-whatsapp'],
      faqs: [
        ['Can a customer fake a mobile money payment screenshot?', 'Yes — screenshots are trivial to edit. That is exactly why {{brand}} never trusts a screenshot alone and verifies the code against the merchant’s own operator confirmation SMS.'],
        ['How do I stop the same payment being used twice?', '{{brand}} locks every verified reference code permanently. A second attempt with the same code is rejected instantly — see {{page:how}}.'],
      ],
      body: [
        'Every day, merchants across Africa lose money to edited payment screenshots. A customer sends a doctored image, the merchant releases the goods, and the payment was never real. The root problem is simple: the merchant is trusting a customer-side artifact.',
        '{{brand}} flips this. Every mobile money operator already sends the merchant a confirmation SMS for every payment received. That SMS — not the customer’s screenshot — is the ground truth. When you {{page:how}}, {{brand}} matches the customer’s reference code against your own operator SMS and returns a verdict in about three seconds.',
        'The single biggest win is replay protection. Once a code is verified, it is locked forever, across every channel. Nobody can pay you once and reuse that code for a second order. For high-volume businesses like {{page:industries}}, this alone eliminates the most common street-level fraud.',
        'You do not need a telco contract or a developer to start. Read {{post:verify-mpesa-payment-without-api}} for the full flow, or {{page:getstarted}} and verify your first payment free.',
      ],
    },
    {
      slug: 'verify-mpesa-payment-without-api',
      title: 'How to Verify an M-Pesa Payment Without a Telco API',
      keyword: 'M-Pesa payment verification',
      description: 'You do not need M-Pesa API access to verify payments. Learn how KODA turns the confirmation SMS on your own phone into instant, fraud-proof payment verification — no contract, no code.',
      tags: ['M-Pesa', 'verification', 'no-code'],
      links: ['how', 'developers', 'getstarted'],
      related: ['stop-mobile-money-screenshot-fraud', 'accept-orange-money-whatsapp', 'mobile-money-reconciliation-guide'],
      faqs: [
        ['Do I need M-Pesa API access to verify payments?', 'No. {{brand}} reads the confirmation SMS your operator already sends you, so you verify payments with zero telco integration. Developers can also use the {{page:developers}}.'],
        ['How long does M-Pesa verification take with KODA?', 'KODA’s own processing is under 10 seconds; the only wait is the operator’s SMS delivery.'],
      ],
      body: [
        'Getting official M-Pesa (or Airtel Money, MTN MoMo) API access can take 6–18 months, a contract, and paybill registration — and many small businesses are simply rejected. Meanwhile you already receive a confirmation SMS for every payment.',
        '{{brand}} uses that SMS as the API. When a customer pays and gives you their reference code, you paste it into {{brand}} and it checks the code against your own operator confirmation. You can {{page:getstarted}} in minutes on any phone.',
        'For automated flows — an order that confirms itself, a ticket that issues itself — the {{page:developers}} exposes three endpoints and a sandbox. But most merchants never write a line of code.',
        'Worried about fake SMS? Read {{post:balance-chain-fake-sms}} to see how KODA’s balance-chain check catches spoofed confirmations automatically.',
      ],
    },
    {
      slug: 'accept-orange-money-whatsapp',
      title: 'Accept Orange Money Payments in WhatsApp (the Right Way)',
      keyword: 'WhatsApp payments verification',
      description: 'Selling on WhatsApp? Verify every Orange Money and mobile money payment right inside the conversation — no apps for your customer, no code for you.',
      tags: ['Orange Money', 'WhatsApp', 'commerce'],
      links: ['how', 'industries', 'getstarted'],
      related: ['stop-mobile-money-screenshot-fraud', 'verify-mpesa-payment-without-api', 'mobile-money-reconciliation-guide'],
      faqs: [
        ['Can I verify payments inside WhatsApp?', 'Yes. With KODA Chat Mode the customer drops their payment code in the chat and {{brand}} confirms it in the same thread. See {{page:how}}.'],
        ['Does my customer need to install anything?', 'No. The customer pays the normal way and sends their code — nothing to install.'],
      ],
      body: [
        'A huge share of African commerce happens in WhatsApp. The weak link is payment: the customer says “I paid,” maybe sends a screenshot, and the seller has to trust it.',
        '{{brand}} Chat Mode makes verification part of the conversation. The customer drops their Orange Money (or M-Pesa, Airtel, MTN) reference code into the chat, and {{brand}} replies in-thread: confirmed, with the amount. If the code was already used, it says so.',
        'This is ideal for {{page:industries}} that sell directly to customers — food, fashion, tickets. And because it is the same engine behind {{page:how}}, everything is logged to your ledger with full fraud screening.',
        'Ready to try it? {{page:getstarted}} free, and read {{post:stop-mobile-money-screenshot-fraud}} to understand why chat-based screenshots were never safe.',
      ],
    },
    {
      slug: 'balance-chain-fake-sms',
      title: 'How KODA Catches Fake Payment SMS with the Balance-Chain',
      keyword: 'mobile money fraud',
      description: 'Fraudsters can spoof a payment SMS — but they cannot fake your running balance. Learn how KODA’s balance-chain defence quarantines fake confirmations automatically.',
      tags: ['fraud', 'security', 'engineering'],
      links: ['how', 'developers', 'status'],
      related: ['stop-mobile-money-screenshot-fraud', 'verify-mpesa-payment-without-api', 'mobile-money-reconciliation-guide'],
      faqs: [
        ['Can someone send a fake payment SMS to trick verification?', 'They can try, but every genuine operator SMS carries your running balance. A spoofed message breaks the balance arithmetic and {{brand}} quarantines it automatically.'],
        ['Does KODA store my other SMS?', 'No. Only payment confirmation SMS from known operators are read — see {{page:how}}.'],
      ],
      body: [
        'The obvious attack on SMS-based verification is to spoof a confirmation. So KODA’s deepest defence needs no external dependency at all: arithmetic.',
        'Every genuine operator confirmation carries your new balance. That means each balance must equal the previous balance plus the amount received. A spoofed SMS breaks that chain — and {{brand}} quarantines it and alerts you. You can watch operator parse health on the {{page:status}} page.',
        'This is why {{page:how}} is fundamentally more secure than screenshot-based checking: the truth is anchored in the operator’s own bookkeeping. Developers can inspect the decision trace via the {{page:developers}}.',
        'Combine this with permanent replay locking — covered in {{post:stop-mobile-money-screenshot-fraud}} — and the fraud surface collapses.',
      ],
    },
    {
      slug: 'mobile-money-reconciliation-guide',
      title: 'Mobile Money Reconciliation: Find the Money You Forgot',
      keyword: 'mobile money reconciliation',
      description: 'Unmatched mobile money payments are money you were paid but never recorded. Here is how to reconcile every payment automatically and recover lost revenue.',
      tags: ['reconciliation', 'accounting', 'operations'],
      links: ['how', 'industries', 'getstarted'],
      related: ['verify-mpesa-payment-without-api', 'accept-orange-money-whatsapp', 'balance-chain-fake-sms'],
      faqs: [
        ['What is an unmatched mobile money payment?', 'A payment that landed on your line but was never attached to an order — money you earned but did not record. {{brand}} surfaces these automatically.'],
        ['How does KODA reconcile payments?', 'It compares every operator SMS on your line against your verified orders and flags gaps, duplicates and unmatched receipts. Start at {{page:getstarted}}.'],
      ],
      body: [
        'Busy merchants lose real money not to fraud but to disorganisation: a payment arrives, the order is handled verbally, and it is never recorded. At month end the numbers do not add up.',
        '{{brand}} keeps a structured live feed of every payment on your line and flags the ones with no matching order — “you were paid three times today with no order attached.” That is recovered revenue, every week.',
        'It works for any business taking mobile money, but especially {{page:industries}} with high transaction volume. Everything ties back to the verified ledger from {{page:how}}.',
        'Pair reconciliation with fraud protection — see {{post:balance-chain-fake-sms}} — and your payment operations become airtight. {{page:getstarted}} free today.',
      ],
    },

    // ── FEATURE CORPUS — one post per feature/function, densely interlinked ──
    {
      slug: 'five-doors-verify-mobile-money',
      title: 'Five Ways to Accept & Verify Mobile Money (One Engine)',
      keyword: 'accept mobile money payments',
      description: 'Console, WhatsApp, API, USSD or inbound SMS — KODA verifies mobile money payments through five “doors”, all backed by the same fraud-proof engine. Pick the one that fits how you already sell.',
      tags: ['doors', 'overview', 'mobile money'],
      links: ['how', 'developers', 'getstarted'],
      related: ['verify-mobile-money-by-ussd', 'mobile-money-verification-api', 'accept-orange-money-whatsapp'],
      faqs: [
        ['How many ways can I verify a payment with KODA?', 'Five: the web {{page:how}} console, WhatsApp chat, the {{page:developers}} API, USSD on a feature phone (see {{post:verify-mobile-money-by-ussd}}), and fully automatic inbound SMS (see {{post:auto-verify-with-sentinel-app}}).'],
        ['Do all five doors share the same fraud checks?', 'Yes. Every door runs the same balance-chain and replay-lock engine described in {{post:balance-chain-fake-sms}} — the interface changes, the security never does.'],
      ],
      body: [
        'Merchants sell in different ways — over a counter, in WhatsApp, through a website, or on a basic phone with no internet. {{brand}} does not force one workflow on everyone. It exposes the same verification engine through five doors, so you verify payments the way you already trade.',
        'Door 1 is the {{page:how}} console: paste a code, get a verdict. Door 2 is WhatsApp — the customer drops their code in the chat (see {{post:accept-orange-money-whatsapp}}). Door 3 is fully automatic: when the operator SMS lands, the order confirms itself (see {{post:auto-verify-with-sentinel-app}}).',
        'Door 4 is USSD for feature phones — no smartphone, no data required, covered in {{post:verify-mobile-money-by-ussd}}. Door 5 is the {{page:developers}} API and webhooks, for websites and apps that confirm orders programmatically (see {{post:mobile-money-verification-api}}).',
        'Whichever door you use, the truth is the same operator SMS and the same permanent code-lock. Start on the door that fits you today and add others later — {{page:getstarted}} free.',
      ],
    },
    {
      slug: 'verify-mobile-money-by-ussd',
      title: 'Verify Mobile Money Payments by USSD (No Smartphone)',
      keyword: 'no telco API payment',
      description: 'No smartphone and no internet? KODA lets you verify a mobile money payment over USSD on any basic phone — dial a short code, enter the reference, get a confirmed verdict.',
      tags: ['USSD', 'feature phone', 'access'],
      links: ['how', 'coverage', 'getstarted'],
      related: ['five-doors-verify-mobile-money', 'verify-mpesa-payment-without-api', 'auto-verify-with-sentinel-app'],
      faqs: [
        ['Can I verify a payment without a smartphone?', 'Yes. {{brand}}’s USSD door works on any GSM phone — dial the short code, enter the reference, and read the verdict on screen. It is one of the {{post:five-doors-verify-mobile-money}}.'],
        ['Does USSD verification need internet?', 'No. USSD runs over the signalling channel, so it works with zero mobile data — ideal wherever coverage is thin. See {{page:coverage}}.'],
      ],
      body: [
        'A large share of African traders still run their business on a feature phone. Any verification tool that assumes a smartphone and a data plan simply excludes them — so {{brand}} does not assume it.',
        'The USSD door turns verification into a menu on any phone. The merchant dials a short code, enters the customer’s reference, and reads “Confirmed — 25,000 CDF” right there. It is the same engine as {{page:how}}, reached through the signalling channel instead of the web.',
        'Because it needs no app and no internet, USSD reaches the merchants other tools leave behind — exactly the reach {{brand}} is built for (see {{page:coverage}}). It sits alongside the other {{post:five-doors-verify-mobile-money}}.',
        'If you do have a smartphone, the SMS door can verify with zero taps — read {{post:auto-verify-with-sentinel-app}}. Either way, {{page:getstarted}} costs nothing.',
      ],
    },
    {
      slug: 'mobile-money-verification-api',
      title: 'The Mobile Money Verification API (3 Endpoints, No Telco Deal)',
      keyword: 'mobile money verification API',
      description: 'Add fraud-proof mobile money verification to any app in an afternoon. KODA’s REST API creates a payment intent, verifies a reference, and fires a webhook — no telco integration required.',
      tags: ['API', 'developers', 'integration'],
      links: ['developers', 'how', 'getstarted'],
      related: ['payment-verified-webhooks', 'add-verified-checkout-to-website', 'five-doors-verify-mobile-money'],
      faqs: [
        ['What does the KODA API do?', 'It creates a payment intent, verifies a customer’s reference code against the operator SMS, and notifies your server via webhook. Full reference at {{page:developers}}.'],
        ['Do I need an operator API to use it?', 'No — that is the point. {{brand}} verifies against the confirmation SMS, so you skip the {{post:verify-mpesa-payment-without-api}} telco process entirely.'],
      ],
      body: [
        'For anyone building a checkout, {{brand}} gives you the verification layer the operators make so hard to get. Three endpoints: create an intent, verify a reference, read usage — plus a sandbox with magic codes so you can build without moving money.',
        'A typical flow: your server creates an intent for 25,000 CDF, the customer pays and submits their code, you call verify, and {{brand}} confirms it against the merchant’s operator SMS. The reference is then locked forever against {{post:stop-mobile-money-screenshot-fraud}}.',
        'You never poll — {{brand}} pushes a signed event the moment a payment verifies. That pattern is covered in {{post:payment-verified-webhooks}}, and the drop-in front end in {{post:add-verified-checkout-to-website}}.',
        'The API is one of the {{post:five-doors-verify-mobile-money}}; everything is documented on the {{page:developers}} page. {{page:getstarted}} and grab a test key.',
      ],
    },
    {
      slug: 'payment-verified-webhooks',
      title: 'Get a Webhook the Moment a Payment Is Verified',
      keyword: 'no telco API payment',
      description: 'Stop polling and stop refreshing. KODA fires a signed webhook the instant a mobile money payment is verified, so your order confirms itself in real time.',
      tags: ['webhooks', 'automation', 'developers'],
      links: ['developers', 'how', 'getstarted'],
      related: ['mobile-money-verification-api', 'add-verified-checkout-to-website', 'auto-verify-with-sentinel-app'],
      faqs: [
        ['How do I know when a payment is verified?', '{{brand}} sends your server a signed webhook the moment verification succeeds — no polling. See the {{page:developers}} reference.'],
        ['Are the webhooks secure?', 'Each endpoint has its own signing secret so you can verify authenticity, and events are scoped per merchant. Details on {{page:developers}}.'],
      ],
      body: [
        'The best payment UX confirms itself. Instead of asking a customer to wait while you check, {{brand}} tells your system the instant a payment is real — the order ships, the ticket issues, the seat unlocks, automatically.',
        'Add a webhook endpoint, and every verified payment (from any of the {{post:five-doors-verify-mobile-money}}) delivers a signed event to your server. It pairs naturally with the {{post:mobile-money-verification-api}} for a fully automated checkout.',
        'This is what powers Door 3 — the self-confirming online order in {{post:auto-verify-with-sentinel-app}}. When the operator SMS lands and matches an open order, the webhook fires with no human in the loop.',
        'Everything is signed, replayable and logged against the ledger from {{page:how}}. Set one up on the {{page:developers}} page after you {{page:getstarted}}.',
      ],
    },
    {
      slug: 'verify-payment-screenshot-ai',
      title: 'Verify a Payment Screenshot with AI — Then Prove It’s Real',
      keyword: 'screenshot payment fraud',
      description: 'Sometimes a customer only has a screenshot. KODA’s Vision reads it, extracts the reference, and still checks that reference against the operator SMS — so a screenshot becomes a real verification, not blind trust.',
      tags: ['vision', 'AI', 'fraud'],
      links: ['how', 'developers', 'getstarted'],
      related: ['stop-mobile-money-screenshot-fraud', 'balance-chain-fake-sms', 'mobile-money-verification-api'],
      faqs: [
        ['Can KODA read a payment screenshot?', 'Yes — Vision extracts the reference and amount from an image, then still verifies that reference against the operator SMS. A screenshot alone is never trusted; see {{post:stop-mobile-money-screenshot-fraud}}.'],
        ['Is reading the screenshot enough to confirm payment?', 'No, and that is the point. The extracted code is checked against your own operator confirmation and the {{post:balance-chain-fake-sms}} defence before anything is confirmed.'],
      ],
      body: [
        'Screenshots are where fraud lives — but customers still send them. Rather than pretend they will stop, {{brand}} makes them safe: Vision reads the image, pulls out the reference and amount, and hands that code to the real verification engine.',
        'The screenshot is only a way to capture the code. The actual truth is still the operator SMS on the merchant’s phone, exactly as in {{page:how}}. If the extracted code has no matching confirmation, it is rejected — the fraud in {{post:stop-mobile-money-screenshot-fraud}} simply does not work.',
        'It is metered as an AI action and returns a full decision trace, so developers can audit every step via the {{page:developers}} API. The spoof-SMS defence in {{post:balance-chain-fake-sms}} runs underneath it.',
        'Turn a screenshot from a liability into a verification. {{page:getstarted}} and try Vision on your next ambiguous payment.',
      ],
    },
    {
      slug: 'win-mobile-money-disputes',
      title: 'Win Mobile Money Disputes with an Automatic Evidence File',
      keyword: 'mobile money fraud',
      description: 'When a payment is questioned, KODA’s DisputeAgent assembles the operator SMS, verification trace and timeline into one evidence file — so you resolve disputes with proof, not memory.',
      tags: ['disputes', 'evidence', 'operations'],
      links: ['how', 'industries', 'getstarted'],
      related: ['mobile-money-reconciliation-guide', 'balance-chain-fake-sms', 'shared-fraud-network'],
      faqs: [
        ['How do I prove a mobile money payment was real?', '{{brand}} keeps the operator SMS, the verification trace and the locked reference for every payment, and DisputeAgent bundles them into one evidence file. See {{page:how}}.'],
        ['Who decides a dispute?', 'You do — but with facts. {{brand}} builds the evidence and a recommendation; the merchant resolves it as accepted, rejected or escalated.'],
      ],
      body: [
        'Disputes are won or lost on records. A customer claims they paid, or claims they did not receive goods, and the merchant is left arguing from memory. {{brand}} replaces memory with a file.',
        'Every verified payment already carries its operator SMS, its decision trace and a permanently locked reference. When a dispute opens, DisputeAgent assembles these into a single evidence pack with a clear recommendation — the same ledger that powers {{page:how}}.',
        'This matters most for high-volume {{page:industries}} where a few disputes a week is normal. It builds directly on {{post:mobile-money-reconciliation-guide}} and the fraud signals from {{post:balance-chain-fake-sms}}.',
        'Repeat bad actors are also fed into the {{post:shared-fraud-network}}. {{page:getstarted}} and let your records defend you.',
      ],
    },
    {
      slug: 'fraudsentinel-velocity-rules',
      title: 'FraudSentinel: Velocity Rules That Catch Payment Abuse',
      keyword: 'mobile money fraud',
      description: 'Fraud has a rhythm. KODA’s FraudSentinel watches the velocity and pattern of payments — repeated codes, impossible sequences, suspicious bursts — and flags abuse before it costs you.',
      tags: ['fraud', 'risk', 'security'],
      links: ['how', 'status', 'getstarted'],
      related: ['balance-chain-fake-sms', 'shared-fraud-network', 'win-mobile-money-disputes'],
      faqs: [
        ['What does FraudSentinel check?', 'Payment velocity and pattern: reused references, impossible timing, and abnormal bursts. It works alongside the {{post:balance-chain-fake-sms}} arithmetic defence.'],
        ['Will it block real customers?', 'Genuine payments verify instantly; only patterns that match abuse are held for review. Parse and health signals are visible on {{page:status}}.'],
      ],
      body: [
        'A single fake payment is caught by arithmetic. Coordinated abuse — many small tests, reused codes, rapid retries — has a shape, and {{brand}}’s FraudSentinel is built to see that shape.',
        'Every verification is scored on velocity and pattern. A code that was already locked, a burst of attempts, a sequence that could not physically happen — each raises the risk score and can hold a payment for review, all recorded in the {{page:how}} trace.',
        'It layers on top of the spoof defence in {{post:balance-chain-fake-sms}} and feeds confirmed abuse into the {{post:shared-fraud-network}}, so one merchant’s attacker becomes everyone’s known risk.',
        'When something is held, the evidence is ready for {{post:win-mobile-money-disputes}}. {{page:getstarted}} and let the engine watch the patterns for you.',
      ],
    },
    {
      slug: 'shared-fraud-network',
      title: 'The Shared Fraud Network: One Merchant’s Attacker, Everyone’s Warning',
      keyword: 'mobile money fraud',
      description: 'Fraudsters reuse the same numbers across shops. KODA’s cross-merchant trust network turns confirmed abuse at one merchant into an early warning for all — privacy-preserving, opt-in.',
      tags: ['fraud', 'network', 'trust'],
      links: ['how', 'coverage', 'getstarted'],
      related: ['fraudsentinel-velocity-rules', 'win-mobile-money-disputes', 'balance-chain-fake-sms'],
      faqs: [
        ['How does the fraud network help me?', 'When a counterparty is repeatedly flagged across merchants, {{brand}} raises risk on their future payments to you too — before they cost you anything.'],
        ['Do you share my customer data?', 'No raw data is shared. The network uses masked, aggregated risk signals only, consistent with the privacy posture behind {{page:how}}.'],
      ],
      body: [
        'A fraudster rarely targets one shop. They work a market, reusing the same lines and tactics from stall to stall. Isolated, each merchant relearns the lesson the hard way. Networked, the first flag protects the rest.',
        '{{brand}}’s trust network aggregates masked risk signals from confirmed abuse — quarantines, disputes, reused codes — and elevates risk on that counterparty’s future payments across participating merchants. It extends {{post:fraudsentinel-velocity-rules}} from one shop to the whole corridor.',
        'It shares no raw customer data, only aggregated signals, and grows stronger with {{page:coverage}}. Confirmed cases come from the evidence in {{post:win-mobile-money-disputes}} and the arithmetic in {{post:balance-chain-fake-sms}}.',
        'The more merchants join, the smarter the shield. {{page:getstarted}} and opt in free.',
      ],
    },
    {
      slug: 'auto-verify-with-sentinel-app',
      title: 'Auto-Verify Every Payment with the KODA Sentinel App',
      keyword: 'confirmation SMS verification',
      description: 'Install the Sentinel app on the phone that holds your mobile money SIM, and payments verify themselves. The confirmation SMS becomes an instant, hands-free verdict.',
      tags: ['Sentinel', 'automation', 'SMS'],
      links: ['how', 'developers', 'getstarted'],
      related: ['five-doors-verify-mobile-money', 'payment-verified-webhooks', 'balance-chain-fake-sms'],
      faqs: [
        ['How does automatic verification work?', 'The Sentinel app securely forwards the operator confirmation SMS to {{brand}} the moment it arrives; the matching order verifies itself with no taps. It is Door 3 of the {{post:five-doors-verify-mobile-money}}.'],
        ['Does KODA read all my messages?', 'No. Sentinel only forwards payment confirmations from known operators, and off-line messages are queued on-device until it reconnects. See {{page:how}}.'],
      ],
      body: [
        'The fastest verification is the one you never touch. When your customer pays, your operator already texts you — the Sentinel app turns that text into an instant, structured verdict.',
        'Install it on the phone holding your SIM, pair it once, and every incoming confirmation is forwarded securely to {{brand}}. If it matches an open order, that order confirms itself and fires a {{post:payment-verified-webhooks}} event — the automatic Door 3 among the {{post:five-doors-verify-mobile-money}}.',
        'It only touches known-operator payment SMS, keeps a heartbeat so you know it is live, and back-fills anything received while offline. Every message still passes the {{post:balance-chain-fake-sms}} check before it can verify.',
        'Hands-free, fraud-checked payment confirmation on the phone you already own. {{page:getstarted}} and pair a device.',
      ],
    },
    {
      slug: 'woocommerce-mobile-money-verification',
      title: 'Add Verified Mobile Money to WooCommerce (No Telco Deal)',
      keyword: 'accept mobile money payments',
      description: 'Sell on WooCommerce? Add KODA and every mobile money order verifies itself against the operator SMS before you ship — scoped, revocable credentials, no master key pasted anywhere.',
      tags: ['WooCommerce', 'ecommerce', 'plugin'],
      links: ['developers', 'how', 'getstarted'],
      related: ['add-verified-checkout-to-website', 'mobile-money-verification-api', 'payment-verified-webhooks'],
      faqs: [
        ['Can I verify mobile money orders on WooCommerce?', 'Yes. The {{brand}} connection verifies each order against the operator SMS and confirms it via webhook — built on the {{post:mobile-money-verification-api}}.'],
        ['Is it safe to connect my store?', 'You approve the connection in your dashboard and the store receives scoped, revocable credentials — never your master secret. See {{page:developers}}.'],
      ],
      body: [
        'WooCommerce stores in mobile-money markets face the same wall: no clean way to confirm that an order was actually paid. {{brand}} closes that gap without a telco contract.',
        'Connect your store and each order is verified against the merchant’s operator SMS, then confirmed with a {{post:payment-verified-webhooks}} event so fulfilment is automatic. The connection uses scoped, revocable credentials issued through the OAuth-style flow on {{page:developers}} — no pasted master key.',
        'It is the same engine as {{page:how}}, wrapped for e-commerce. For custom sites, the drop-in in {{post:add-verified-checkout-to-website}} does the same job in a snippet.',
        'Stop shipping against unconfirmed orders. {{page:getstarted}}, connect WooCommerce, and verify your first store order free.',
      ],
    },
    {
      slug: 'add-verified-checkout-to-website',
      title: 'Add a Verified Mobile Money Checkout to Any Website',
      keyword: 'accept mobile money payments',
      description: 'Drop one snippet into your site and customers pay by mobile money with a verified confirmation — no redirect to a telco, no screenshots, no manual checking.',
      tags: ['widget', 'checkout', 'website'],
      links: ['developers', 'how', 'getstarted'],
      related: ['woocommerce-mobile-money-verification', 'mobile-money-verification-api', 'mobile-money-payment-links'],
      faqs: [
        ['How do I add mobile money checkout to my site?', 'Drop in the {{brand}} widget or call the {{post:mobile-money-verification-api}}; the customer pays and their code is verified against the operator SMS in real time.'],
        ['Does the customer leave my site?', 'No. The verified checkout runs inline, and confirmation arrives via {{post:payment-verified-webhooks}} — see {{page:developers}}.'],
      ],
      body: [
        'Most “mobile money on your website” options bounce the customer to a telco page and leave you guessing whether they finished. {{brand}}’s drop-in keeps checkout on your site and confirms the payment for real.',
        'Add the snippet, and the customer pays then submits their reference; {{brand}} verifies it against the operator SMS and confirms inline, exactly like {{page:how}}. Under the hood it is the {{post:mobile-money-verification-api}} with a {{post:payment-verified-webhooks}} callback.',
        'No redirect, no screenshot trust, no plugin lock-in — and for WooCommerce specifically there is a packaged path in {{post:woocommerce-mobile-money-verification}}. Prefer no code at all? Send a {{post:mobile-money-payment-links}} instead.',
        'One snippet, verified payments. {{page:getstarted}} and paste your key.',
      ],
    },
    {
      slug: 'marketplace-payments-submerchants',
      title: 'Verify Payments for a Marketplace — Onboard Thousands of Sub-Merchants',
      keyword: 'accept mobile money payments',
      description: 'Running a marketplace or agent network? KODA’s Plateforme tier onboards sub-merchants under one master key, each verifying their own mobile money payments with scoped access.',
      tags: ['marketplace', 'platform', 'sub-merchants'],
      links: ['industries', 'developers', 'getstarted'],
      related: ['mobile-money-verification-api', 'white-label-payment-receipts', 'five-doors-verify-mobile-money'],
      faqs: [
        ['Can KODA verify payments across many merchants?', 'Yes — the Plateforme tier onboards sub-merchants under one master account, each with scoped keys, verifying their own payments. See {{page:developers}}.'],
        ['Is each sub-merchant isolated?', 'Yes. Every sub-merchant has its own ledger, receipts and restricted credentials, so one deal can onboard thousands without cross-contamination.'],
      ],
      body: [
        'A marketplace lives or dies on trust between many small sellers and their buyers. {{brand}}’s Plateforme tier gives every seller real payment verification while the platform keeps one relationship to manage.',
        'Onboard sub-merchants under a master account; each gets scoped, restricted credentials and its own verified ledger, powered by the {{post:mobile-money-verification-api}}. Buyers still get the fraud-proof confirmation from {{page:how}} on any of the {{post:five-doors-verify-mobile-money}}.',
        'Every seller can issue {{post:white-label-payment-receipts}} under their own brand, and the platform sees aggregate health across the network. It is built for high-volume {{page:industries}} — agent networks, delivery fleets, ticketing.',
        'One integration, thousands of verified sellers. {{page:getstarted}} and talk to us about Plateforme.',
      ],
    },
    {
      slug: 'white-label-payment-receipts',
      title: 'White-Label Payment Receipts Your Customers Trust',
      keyword: 'confirmation SMS verification',
      description: 'Every verified payment produces a branded receipt in your colours and name — proof for your customer, marketing for you. Fully white-label across email and in-app.',
      tags: ['receipts', 'branding', 'white-label'],
      links: ['how', 'industries', 'getstarted'],
      related: ['marketplace-payments-submerchants', 'mobile-money-reconciliation-guide', 'refer-merchants-earn-credit'],
      faqs: [
        ['Can I brand the payment receipts?', 'Yes — receipts and emails carry your logo, colour and name. {{brand}} is white-label from the first payment. See {{page:how}}.'],
        ['What proof does a receipt carry?', 'The verified reference, amount, operator and timestamp, tied to the locked code — usable as evidence in {{post:win-mobile-money-disputes}}.'],
      ],
      body: [
        'A receipt is both proof and a brand moment. {{brand}} issues one for every verified payment, in your colours and under your name — so your customer sees your business, not ours.',
        'Each receipt records the verified reference, amount, operator and time, anchored to the permanently locked code from {{page:how}}. It doubles as dispute evidence (see {{post:win-mobile-money-disputes}}) and as a clean line in your {{post:mobile-money-reconciliation-guide}}.',
        'For marketplaces, every sub-merchant gets their own branding — see {{post:marketplace-payments-submerchants}}. And every receipt quietly carries a “verify payments with KODA” prompt, so happy customers become referrals (see {{post:refer-merchants-earn-credit}}).',
        'Look professional on every payment. {{page:getstarted}} and set your brand colour.',
      ],
    },
    {
      slug: 'mobile-money-payment-links',
      title: 'Sell With a Mobile Money Payment Link (No Code, No Store)',
      keyword: 'accept mobile money payments',
      description: 'Create a payment link, send it in WhatsApp, and get a verified confirmation when the customer pays. The simplest way to sell online with mobile money — no website required.',
      tags: ['payment links', 'no-code', 'commerce'],
      links: ['how', 'industries', 'getstarted'],
      related: ['accept-orange-money-whatsapp', 'add-verified-checkout-to-website', 'payment-verified-webhooks'],
      faqs: [
        ['Can I sell without a website?', 'Yes. Create a {{brand}} payment link, share it anywhere, and the payment is verified against the operator SMS when the customer pays. See {{page:how}}.'],
        ['How do I know the link was paid?', 'The intent verifies automatically and can fire a {{post:payment-verified-webhooks}} event, or simply show confirmed in your dashboard.'],
      ],
      body: [
        'Not every seller wants a store or an integration. Sometimes you just need to send a price and get paid — safely. A {{brand}} payment link does exactly that.',
        'Create a link for an amount, share it in {{post:accept-orange-money-whatsapp}} or anywhere else, and when the customer pays, {{brand}} verifies the payment against the operator SMS just like {{page:how}}. No screenshots, no “I promise I paid”.',
        'It is the no-code sibling of the {{post:add-verified-checkout-to-website}} widget, and it can still notify your systems through {{post:payment-verified-webhooks}}. Perfect for {{page:industries}} that sell socially — fashion, food, services.',
        'Send a link, get verified money. {{page:getstarted}} and create your first one free.',
      ],
    },
    {
      slug: 'refer-merchants-earn-credit',
      title: 'Refer a Merchant, Earn Free Credit — the KODA Referral Programme',
      keyword: 'Orange Money for business',
      description: 'Every KODA merchant gets a share link. Invite another business; when they verify their first payment, you both earn free credit. Growth that pays you back.',
      tags: ['referral', 'growth', 'rewards'],
      links: ['growth', 'getstarted', 'how'],
      related: ['ai-marketing-tools-mobile-money-merchants', 'white-label-payment-receipts', 'five-doors-verify-mobile-money'],
      faqs: [
        ['How does the KODA referral programme work?', 'Share your link; when a merchant you invite verifies their first payment, you both receive free ACU credit. Find your link in the {{page:growth}} tools.'],
        ['Is there a limit on referrals?', 'No. Every qualified referral rewards both sides, so the more merchants you bring, the more credit you earn.'],
      ],
      body: [
        'The people best placed to recommend a payment tool are merchants who already trust it. So {{brand}} rewards them: every account has a share link, and bringing another business earns both of you free credit.',
        'When a merchant you invite {{page:getstarted}} and verifies their first payment through any of the {{post:five-doors-verify-mobile-money}}, the reward lands automatically for both sides. No forms, no waiting — it settles on their first real {{page:how}} verification.',
        'It compounds with your other growth tools in the {{page:growth}} programme, including the {{post:ai-marketing-tools-mobile-money-merchants}}. Even your {{post:white-label-payment-receipts}} quietly invite the next merchant.',
        'Grow the network you already believe in and get paid for it. Find your link in {{page:growth}} today.',
      ],
    },
    {
      slug: 'ai-marketing-tools-mobile-money-merchants',
      title: 'AI Marketing Tools Built for Mobile Money Merchants',
      keyword: 'Orange Money for business',
      description: 'KODA’s Growth engine writes your social posts, adverts, email campaigns and a full field-sales kit — in six languages, tailored to your shop. Marketing that brings customers, built in.',
      tags: ['growth', 'AI', 'marketing'],
      links: ['growth', 'getstarted', 'industries'],
      related: ['refer-merchants-earn-credit', 'mobile-money-payment-links', 'accept-orange-money-whatsapp'],
      faqs: [
        ['What marketing can KODA generate?', 'Social posts, targeted adverts, email campaigns, landing copy, hashtags, video scripts, and a six-language field-sales kit — all in the {{page:growth}} tools.'],
        ['Is the content tailored to my business?', 'Yes — every tool is generated around your shop name, market, currency and plan, then ready to post or print.'],
      ],
      body: [
        'A verification tool that also helps you sell is worth more than one that only guards the till. {{brand}}’s Growth engine turns your account into a marketing team.',
        'Generate ready-to-use social posts, adverts, email campaigns, hashtags and video scripts — plus a field-sales kit with a WhatsApp pitch, door-to-door script and flyer in six languages. Everything is tailored to your shop and lives in the {{page:growth}} tools.',
        'Point that content at a {{post:mobile-money-payment-links}} or your {{post:accept-orange-money-whatsapp}} channel, and you have a full funnel. Bring other merchants through it and earn with the {{post:refer-merchants-earn-credit}}.',
        'Built for real {{page:industries}} on the ground. {{page:getstarted}} and run your first campaign free.',
      ],
    },
    {
      slug: 'cashier-permissions-team-roles',
      title: 'Team Roles Done Right: Let Cashiers Verify, Not Everything',
      keyword: 'accept mobile money payments',
      description: 'Give cashiers exactly the access they need to verify payments — and nothing more. KODA’s owner, manager and cashier roles keep your money operations safe as you grow your team.',
      tags: ['team', 'roles', 'operations'],
      links: ['how', 'industries', 'getstarted'],
      related: ['five-doors-verify-mobile-money', 'mobile-money-reconciliation-guide', 'white-label-payment-receipts'],
      faqs: [
        ['Can I let staff verify payments without full access?', 'Yes. The cashier role can verify payments but cannot invite users or change settings; owners and managers hold the rest. See {{page:how}}.'],
        ['How many team members can I add?', 'Add the team your business needs, each with the right role, so verification scales without handing over the keys.'],
      ],
      body: [
        'As a business grows, more hands touch payments — and that is where control matters. {{brand}} separates who can verify from who can administer, so a busy counter never means an open door.',
        'A cashier can confirm payments through any of the {{post:five-doors-verify-mobile-money}} but cannot invite users, move settings or export sensitive data. Managers and owners handle configuration and see the full {{post:mobile-money-reconciliation-guide}}.',
        'Every action is attributed, and every verified payment still produces a branded receipt from {{post:white-label-payment-receipts}}, so accountability is built in — the same audited ledger as {{page:how}}.',
        'Scale your team without scaling your risk. {{page:getstarted}} and invite your first cashier.',
      ],
    },
    {
      slug: 'checkout-in-your-language',
      title: 'Checkout in Your Language — French, Swahili, Lingala & More',
      keyword: 'accept mobile money payments',
      description: 'KODA speaks your customers’ language. Checkout and verification auto-adapt across French, English, Swahili, Lingala, Wolof and more — so nobody hesitates at the moment of payment.',
      tags: ['languages', 'localisation', 'checkout'],
      links: ['coverage', 'how', 'getstarted'],
      related: ['accept-orange-money-whatsapp', 'mobile-money-payment-links', 'five-doors-verify-mobile-money'],
      faqs: [
        ['What languages does KODA support?', 'Checkout and merchant tools work across French, English, Swahili, Lingala, Wolof and more, adapting to the customer’s device. See {{page:coverage}}.'],
        ['Does the customer choose the language?', 'The checkout auto-detects the device language and can be set manually, so payment feels native everywhere you sell.'],
      ],
      body: [
        'People hesitate to pay in a language they half-understand — and hesitation at checkout is lost revenue. {{brand}} removes it by speaking the customer’s language automatically.',
        'The checkout page detects the device language and renders in French, English, Swahili, Lingala, Wolof and more, while your merchant tools follow your own preference. It is the same verification from {{page:how}}, localised at the edge across our {{page:coverage}}.',
        'That reach matters on every door — from {{post:accept-orange-money-whatsapp}} to a shared {{post:mobile-money-payment-links}} to all {{post:five-doors-verify-mobile-money}}.',
        'Sell to everyone in your market, in their words. {{page:getstarted}} free.',
      ],
    },
    {
      slug: 'free-mobile-money-verification-pricing',
      title: 'Verify Mobile Money Payments Free — How KODA Pricing Works',
      keyword: 'verify mobile money payment',
      description: 'Start verifying mobile money payments for free, forever. KODA’s free tier covers real monthly verifications; you only pay as you scale, with transparent ACU credit for AI features.',
      tags: ['pricing', 'free tier', 'ACU'],
      links: ['getstarted', 'how', 'growth'],
      related: ['five-doors-verify-mobile-money', 'refer-merchants-earn-credit', 'verify-mpesa-payment-without-api'],
      faqs: [
        ['Is KODA free to use?', 'Yes — the Marché tier verifies real payments every month at no cost. You only pay when you outgrow it. {{page:getstarted}} free.'],
        ['What is ACU?', 'ACU is prepaid credit for AI features and verifications beyond your plan’s quota. Plain verifications within quota are free, and you can earn ACU via {{post:refer-merchants-earn-credit}}.'],
      ],
      body: [
        'A tool that stops fraud should not be a gamble to try. {{brand}} lets you verify real mobile money payments free on the Marché tier — no card, no contract, no telco deal (see {{post:verify-mpesa-payment-without-api}}).',
        'Verifications within your monthly quota cost nothing. ACU credit is only spent on AI features and on verifications beyond quota, so pricing tracks your growth, not your fear. All {{post:five-doors-verify-mobile-money}} are included from day one, on the same engine as {{page:how}}.',
        'Need more credit? Top up transparently, or earn it through the {{post:refer-merchants-earn-credit}} and the {{page:growth}} programme.',
        'Try the whole thing free and decide with real numbers. {{page:getstarted}} now.',
      ],
    },
    {
      slug: 'late-mobile-money-payment-verification',
      title: 'When a Payment Arrives Late: KODA Still Confirms It',
      keyword: 'confirmation SMS verification',
      description: 'Operator SMS can be delayed. KODA remembers the pending order and verifies the payment the moment the confirmation lands — even minutes later — instead of failing the sale.',
      tags: ['reliability', 'SMS', 'operations'],
      links: ['how', 'status', 'getstarted'],
      related: ['auto-verify-with-sentinel-app', 'balance-chain-fake-sms', 'mobile-money-reconciliation-guide'],
      faqs: [
        ['What if the confirmation SMS is delayed?', '{{brand}} keeps the order open and verifies it as soon as the operator SMS arrives, marking it verified-late instead of failing. See {{page:how}}.'],
        ['Will a late payment still be fraud-checked?', 'Yes — late confirmations pass the same {{post:balance-chain-fake-sms}} and velocity checks before they can verify.'],
      ],
      body: [
        'Networks lag. A customer pays, but the operator SMS takes two minutes to arrive — and a naive system has already failed the sale. {{brand}} is built for the real network, not the ideal one.',
        'When a code has no confirmation yet, {{brand}} does not reject it outright; it holds the order and watches. The moment the matching operator SMS lands — including via {{post:auto-verify-with-sentinel-app}} — it verifies and marks the payment verified-late, all on the {{page:how}} ledger.',
        'Late or not, every confirmation clears the {{post:balance-chain-fake-sms}} defence first, and nothing slips through your {{post:mobile-money-reconciliation-guide}}. You can watch operator delivery health on {{page:status}}.',
        'Stop losing sales to slow SMS. {{page:getstarted}} and let {{brand}} wait for the money so you do not have to.',
      ],
    },
  ];

  return { SITE, BRAND, PAGES, CLUSTERS, POSTS };
});
