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
  ];

  return { SITE, BRAND, PAGES, CLUSTERS, POSTS };
});
