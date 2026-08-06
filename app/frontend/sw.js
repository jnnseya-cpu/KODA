// KODA PWA service worker — NETWORK-FIRST shell so updates always reach clients
// when online, with an offline cache fallback. (v1 was cache-first with a frozen
// name, which froze the app on an old build until the cache was cleared.)
const CACHE = 'koda-v3';
const SHELL = ['/app.html', '/styles.css', '/app.js', '/icon.svg', '/manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  // purge every older cache, then take control of all open clients immediately
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // API is always live network, never cached
  if (e.request.method !== 'GET' || url.pathname.startsWith('/v1') || url.pathname.startsWith('/app/')) return;

  // NETWORK-FIRST: fetch fresh, update the cache, fall back to cache only when offline.
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(url.pathname === '/app' ? '/app.html' : e.request)
        .then(hit => hit || caches.match('/app.html')))
  );
});
