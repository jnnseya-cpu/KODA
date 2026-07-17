// KODA PWA service worker — offline shell + cache-first static assets.
const CACHE = 'koda-v1';
const SHELL = ['/app.html', '/styles.css', '/app.js', '/icon.svg', '/manifest.webmanifest'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/v1') || url.pathname.startsWith('/app/')) return; // API always network
  e.respondWith(
    caches.match(url.pathname === '/app' ? '/app.html' : e.request).then(hit =>
      hit || fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match('/app.html'))
    )
  );
});
