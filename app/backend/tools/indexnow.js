// KODA — manually submit all sitemap URLs to IndexNow (Bing/Yandex/Seznam/Naver).
// Usage:  node backend/tools/indexnow.js        (submits every URL in the built sitemap)
// The site must be built first (the server does this at boot). Prints the result.
'use strict';
const indexnow = require('../lib/indexnow');

(async () => {
  const list = indexnow.urls();
  if (!list.length) { console.error('No sitemap URLs found — build the site first (start the server once).'); process.exit(1); }
  console.log(`Submitting ${list.length} URLs to IndexNow (key ${indexnow.KEY}) …`);
  const r = await indexnow.submit(list);
  console.log(r.ok ? `✅ Accepted (HTTP ${r.status}) — ${r.count} URLs announced.`
                   : `⚠️  Not accepted (HTTP ${r.status || 'no-network'}${r.reason ? ', ' + r.reason : ''}). Retry from the production host.`);
  process.exit(r.ok ? 0 : 1);
})();
