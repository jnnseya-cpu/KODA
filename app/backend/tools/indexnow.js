// KODA — manually announce sitemap URLs to IndexNow (Bing/Yandex/Seznam/Naver).
// Usage:  node backend/tools/indexnow.js            announce only URLs changed since last time
//         node backend/tools/indexnow.js --all      force a full re-announce of every URL
// The site must be built first (the server does this at boot). Prints the result.
'use strict';
const indexnow = require('../lib/indexnow');

(async () => {
  const all = process.argv.includes('--all');
  const { current, added } = indexnow.pendingChanges();
  const list = all ? current : added;
  if (!current.length) { console.error('No sitemap URLs found — build the site first (start the server once).'); process.exit(1); }
  if (!list.length) { console.log('✓ Nothing changed since the last announce. Use --all to force a full re-submit.'); process.exit(0); }
  console.log(`Announcing ${list.length} URL(s) to IndexNow (key ${indexnow.KEY}) …`);
  const r = await indexnow.submit(list);
  if (r.ok) indexnow.recordAnnounced(current); // advance the baseline so boot won't repeat it
  console.log(r.ok ? `✅ Accepted (HTTP ${r.status}) — ${r.count} URL(s) announced.`
                   : `⚠️  Not accepted (HTTP ${r.status || 'no-network'}${r.reason ? ', ' + r.reason : ''}). Retry from the production host.`);
  process.exit(r.ok ? 0 : 1);
})();
