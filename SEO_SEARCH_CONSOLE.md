# KODA — Get all 80 pages indexed by Google & Bing (today)

Your site already serves everything search engines need:

- **Sitemap:** https://kodajnn.com/sitemap.xml — lists all **80 URLs** (25 blog posts + 40 city×operator landing pages + 15 core & info pages)
- **Robots:** https://kodajnn.com/robots.txt — allows crawling and points to the sitemap
- Every page ships canonical tags, OpenGraph/Twitter meta, and JSON-LD structured data.

What's left is **telling Google and Bing the site exists** and **submitting the sitemap**. That
turns "found in a few weeks" into "indexed in a few days." ~10 minutes, done once.

> Domain: `kodajnn.com` · DNS host: **Hostinger** (Domains → kodajnn.com → DNS Zone / DNS records)

---

## Step 1 — Google Search Console (the important one)

### 1a. Add a Domain property
1. Go to **https://search.google.com/search-console** and sign in with your Google account
   (use `koda@kodajnn.com` or your main Google login).
2. Click the property dropdown (top-left) → **Add property**.
3. Choose the **Domain** box (the left option, not "URL prefix"). Enter exactly:
   ```
   kodajnn.com
   ```
   (no `https://`, no `www`). Click **Continue**.

### 1b. Verify by DNS TXT record
Google shows a **TXT record** to add. It looks like this (your token is unique — copy **yours**):

```
google-site-verification=AbC123xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

In **Hostinger → Domains → kodajnn.com → DNS / Nameservers → DNS records**, click **Add record**:

| Field | Value |
|---|---|
| **Type** | `TXT` |
| **Name / Host** | `@`  *(means the root domain; Hostinger may show it blank — that's fine)* |
| **TXT value / Content** | *paste the full* `google-site-verification=...` *string Google gave you* |
| **TTL** | leave default (e.g. 3600 / 14400) |

Save it. Back in Search Console, click **Verify**.
- DNS usually propagates in a few minutes; if it says "not found," wait 15–30 min and click Verify again.
- **Do not delete this TXT record later** — Google re-checks it to keep the property verified.

> **If you already moved DNS to Cloudflare** (Deploy guide Step 7): add the same TXT record in
> **Cloudflare → DNS → Records** instead of Hostinger. Same Type/Name/Value. Set it to **DNS only**
> (grey cloud) — proxying doesn't apply to TXT.

### 1c. Submit the sitemap
1. In Search Console left menu → **Sitemaps**.
2. Under "Add a new sitemap," type just:
   ```
   sitemap.xml
   ```
   (the box already shows `https://kodajnn.com/` in front). Click **Submit**.
3. Within a day it should read **Success** and show ~**80 discovered URLs**.

### 1d. Fast-track your top pages (optional but worth it)
For your 5–10 most important pages, paste each URL into the **search bar at the top** of Search
Console (the "Inspect any URL" box), then click **Request indexing**. Prioritise:

- `https://kodajnn.com/`
- `https://kodajnn.com/blog`
- `https://kodajnn.com/blog/stop-mobile-money-screenshot-fraud`
- `https://kodajnn.com/blog/five-doors-verify-mobile-money`
- `https://kodajnn.com/blog/free-mobile-money-verification-pricing`
- `https://kodajnn.com/verifier-orange-money-kinshasa`

(Google limits how many manual requests you can make per day — spend them on the pages that matter most.)

---

## Step 2 — Bing Webmaster Tools (feeds Bing + ChatGPT/Copilot search)

1. Go to **https://www.bing.com/webmasters** → sign in.
2. Click **Import from Google Search Console** (one click, reuses your verification) — this is the
   fastest path.
   - **Or** add `kodajnn.com` manually and verify with a TXT record, exactly like Step 1b but with
     the value Bing gives you (`MS=msXXXXXXXX`).
3. Bing usually imports your sitemap automatically. If not: **Sitemaps → Submit sitemap →**
   `https://kodajnn.com/sitemap.xml`.

---

## Step 2.5 — IndexNow (already built in — instant ping)

KODA now pings **IndexNow** automatically, which is the modern replacement for the old sitemap
"ping" endpoints (Google retired `/ping` in 2023; Bing redirects to IndexNow). It instantly notifies
**Bing, Yandex, Seznam and Naver** whenever the site is (re)built.

- **Ownership key file** is served at `https://kodajnn.com/<key>.txt` (proves the domain is yours).
- On every production boot the server submits all 80 sitemap URLs. Nothing to configure.
- To announce again on demand (e.g. right after a deploy), run on the server:
  ```bash
  docker compose exec -T koda node backend/tools/indexnow.js
  ```
  It prints `✅ Accepted` when the URLs are queued.

> IndexNow does **not** cover Google — Google indexing still comes from Step 1 (Search Console +
> sitemap). IndexNow is the fast path for everything else, including the engines behind
> ChatGPT/Copilot search.

---

## Step 3 — Confirm it's working

Run these anytime:

```bash
curl -s https://kodajnn.com/robots.txt          # should show Allow: / and the Sitemap: line
curl -s https://kodajnn.com/sitemap.xml | grep -c "<loc>"   # should print 80
dig +short TXT kodajnn.com                       # should list your google-site-verification=... string
```

In Google, after a few days:
```
site:kodajnn.com
```
The number of results climbs as pages get indexed. Full indexing of a new domain typically takes
**2–6 weeks**; the sitemap submission is what starts the clock today.

---

## What to expect (honest timeline)

| When | What happens |
|---|---|
| Today | Property verified, sitemap submitted, top pages requested |
| 2–7 days | Google/Bing crawl the sitemap; first pages appear in `site:kodajnn.com` |
| 2–6 weeks | Most of the 80 pages indexed; long-tail queries (e.g. "vérifier Orange Money Kinshasa") start showing impressions |
| 2–3 months | Rankings mature; steady organic clicks if the content matches real demand |

SEO is the **compounding** channel — genuinely fast *for SEO*, but not same-week. Pair it with the
referral loop and the field-sales kit (both in the app under **Growth**) for immediate acquisition
while the search traffic builds.

---

## Keep it growing (later)
- **Refresh & add posts:** the corpus lives in `app/shared/seo-content.js`; new posts auto-appear in
  the blog, sitemap, and internal-link web on the next deploy.
- **New city pages:** edit `SEO_CITIES` / `SEO_OPERATORS` in `app/frontend/build-site.js`.
- **Re-submit** is automatic — Google re-reads `sitemap.xml` on its own schedule once the property
  is verified. You only submit once.
