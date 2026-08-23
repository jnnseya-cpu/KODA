// KODA — SEO Agent (K-10). Generates crawlable blog posts with a dense internal
// backlink web, JSON-LD structured data, sitemap.xml and robots.txt. When an AI
// gateway key is present it can expand/refresh copy; otherwise it renders the
// curated corpus deterministically. "Autopilot" = generate/refresh on demand or
// on a schedule.
'use strict';
const { SITE, BRAND, PAGES, POSTS } = require('../../shared/seo-content');

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const bySlug = Object.fromEntries(POSTS.map(p => [p.slug, p]));

// expand {{page:key}}, {{post:slug}}, {{brand}} into real hyperlinks
function weave(text) {
  return String(text)
    .replace(/\{\{brand\}\}/g, `<strong>${BRAND}</strong>`)
    .replace(/\{\{page:(\w+)\}\}/g, (_, k) => {
      const pg = PAGES[k]; return pg ? `<a href="${pg.url}">${esc(pg.title)}</a>` : k;
    })
    .replace(/\{\{post:([a-z0-9-]+)\}\}/g, (_, slug) => {
      const p = bySlug[slug]; return p ? `<a href="/blog/${slug}">${esc(p.title)}</a>` : slug;
    });
}
function weaveText(text) { // link-free version for meta/JSON-LD
  return String(text).replace(/\{\{brand\}\}/g, BRAND).replace(/\{\{page:(\w+)\}\}/g, (_, k) => PAGES[k]?.title || k).replace(/\{\{post:([a-z0-9-]+)\}\}/g, (_, s) => bySlug[s]?.title || s);
}

function articleJsonLd(post, dateISO) {
  return {
    '@context': 'https://schema.org', '@type': 'BlogPosting',
    headline: post.title, description: post.description,
    keywords: (post.tags || []).concat(post.keyword).join(', '),
    author: { '@type': 'Organization', name: BRAND, url: SITE },
    publisher: { '@type': 'Organization', name: BRAND, url: SITE, logo: { '@type': 'ImageObject', url: SITE + '/icon-512.png' } },
    datePublished: dateISO, dateModified: dateISO,
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE}/blog/${post.slug}` },
    url: `${SITE}/blog/${post.slug}`,
  };
}
function faqJsonLd(post) {
  if (!post.faqs || !post.faqs.length) return null;
  return { '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: post.faqs.map(([q, a]) => ({ '@type': 'Question', name: weaveText(q),
      acceptedAnswer: { '@type': 'Answer', text: weaveText(a) } })) };
}
function breadcrumbJsonLd(post) {
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Blog', item: `${SITE}/blog` },
      { '@type': 'ListItem', position: 2, name: post.title, item: `${SITE}/blog/${post.slug}` },
    ] };
}

// full <head> SEO block reused by every page
function seoHead({ title, description, path, image, jsonld = [] }) {
  const url = SITE + path;
  const ld = jsonld.filter(Boolean).map(o => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('\n');
  return `<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:site_name" content="${BRAND}">
<meta property="og:image" content="${SITE}${image || '/icon-512.png'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="robots" content="index,follow,max-image-preview:large">
${ld}`;
}

function renderPost(post, dateISO) {
  const jsonld = [articleJsonLd(post, dateISO), faqJsonLd(post), breadcrumbJsonLd(post)];
  const related = (post.related || []).map(s => bySlug[s]).filter(Boolean);
  const bodyHtml = post.body.map(p => `<p>${weave(p)}</p>`).join('\n');
  const faqHtml = post.faqs && post.faqs.length
    ? `<h2>Frequently asked questions</h2>` + post.faqs.map(([q, a]) => `<h3>${esc(weaveText(q))}</h3><p>${weave(a)}</p>`).join('\n') : '';
  const relatedHtml = related.length
    ? `<h2>Related reading</h2><ul>${related.map(r => `<li><a href="/blog/${r.slug}">${esc(r.title)}</a></li>`).join('')}</ul>` : '';
  return { head: seoHead({ title: post.title + ' | ' + BRAND, description: post.description, path: `/blog/${post.slug}`, jsonld }),
    bodyHtml, faqHtml, relatedHtml, post };
}

function allPosts() { return POSTS; }

// Per-post on-page SEO score (0–100) from real, checkable factors. Returns the score
// plus an actionable checklist so the admin panel can show WHAT to fix, not just a number.
function wordCount(post) {
  const body = (post.body || []).join(' ');
  const faq = (post.faqs || []).map(([q, a]) => `${q} ${a}`).join(' ');
  return `${body} ${faq}`.split(/\s+/).filter(Boolean).length;
}
function seoScore(post) {
  const checks = [];
  const add = (ok, label, detail) => checks.push({ ok: !!ok, label, detail });
  const tl = (post.title || '').length;
  add(tl >= 30 && tl <= 65, 'Title length', `${tl} chars · aim 30–65`);
  const dl = (post.description || '').length;
  add(dl >= 120 && dl <= 170, 'Meta description', `${dl} chars · aim 120–170`);
  const kw = (post.keyword || '').toLowerCase();
  const firstKw = kw.split(/\s+/)[0] || '';
  add(!!kw && firstKw && (post.title || '').toLowerCase().includes(firstKw), 'Keyword in title', kw || 'no target keyword');
  const wc = wordCount(post);
  add(wc >= 600, 'Word count', `${wc} words · aim ≥600`);
  const il = (post.links || []).length + (post.related || []).length;
  add(il >= 3, 'Internal links', `${il} · aim ≥3`);
  add((post.faqs || []).length >= 2, 'FAQ schema', `${(post.faqs || []).length} Q&A`);
  add((post.tags || []).length >= 2, 'Tags', `${(post.tags || []).length}`);
  const passed = checks.filter((c) => c.ok).length;
  return { score: Math.round((passed / checks.length) * 100), passed, total: checks.length, checks };
}
// Compact per-post SEO metadata (slug/title/score/checks/links) for the admin panel.
function postsMeta() {
  return POSTS.map((p) => {
    const s = seoScore(p);
    return { slug: p.slug, title: p.title, keyword: p.keyword || '',
      internal_links: (p.links || []).length + (p.related || []).length,
      score: s.score, passed: s.passed, total: s.total, checks: s.checks };
  });
}
function postDates(startISO) {
  // deterministic descending dates from a supplied "now" (scripts can't call Date.now())
  // tolerate a missing/invalid start (e.g. KODA_BUILD_DATE=unknown) → fall back safely
  let base = new Date(startISO).getTime();
  if (!Number.isFinite(base)) base = new Date('2026-08-03T08:00:00Z').getTime();
  return Object.fromEntries(POSTS.map((p, i) => [p.slug, new Date(base - i * 3 * 864e5).toISOString()]));
}

function sitemap(dates) {
  const urls = [
    ...Object.values(PAGES).map(p => ({ loc: SITE + p.url, priority: p.url === '/' ? '1.0' : '0.8' })),
    { loc: SITE + '/blog', priority: '0.7' },
    ...POSTS.map(p => ({ loc: `${SITE}/blog/${p.slug}`, priority: '0.6', lastmod: dates[p.slug] })),
    ...['about', 'contact', 'terms', 'privacy', 'policies', 'status'].map(s => ({ loc: `${SITE}/${s}`, priority: '0.4' })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map(u => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod.slice(0, 10)}</lastmod>` : ''}<priority>${u.priority}</priority></url>`).join('\n') +
    `\n</urlset>\n`;
}
function robots() {
  return `User-agent: *\nAllow: /\nDisallow: /app\nDisallow: /v1\n\nSitemap: ${SITE}/sitemap.xml\n`;
}
function orgJsonLd() {
  return { '@context': 'https://schema.org', '@type': 'Organization', name: BRAND, url: SITE,
    logo: SITE + '/icon-512.png', description: 'Mobile money payment verification — verify any payment against the operator SMS, no telco API.',
    sameAs: [] };
}
// site-level structured data for the homepage — declares the canonical site and
// its blog so crawlers understand the property (the "JSON-LD sitemap" surface).
function websiteJsonLd() {
  return { '@context': 'https://schema.org', '@type': 'WebSite', name: BRAND, url: SITE,
    inLanguage: ['en', 'fr'], publisher: { '@type': 'Organization', name: BRAND, url: SITE, logo: SITE + '/icon-512.png' },
    hasPart: { '@type': 'Blog', '@id': SITE + '/blog', name: `${BRAND} Blog`, url: SITE + '/blog' } };
}

module.exports = { renderPost, allPosts, postDates, sitemap, robots, seoHead, orgJsonLd, websiteJsonLd, weave, seoScore, postsMeta, SITE, BRAND, PAGES };
