/* sw.js - ARA Field Tools offline cache */
const CACHE_VERSION = 'ara-tools-v1.0.0';
const CORE_ASSETS = [
  './',               // index.html (on GitHub Pages this resolves correctly)
  './index.html',     // explicit
  './manifest.webmanifest',
  './icons/ara-192.png',
  './icons/ara-512.png'
  // If you break CSS/JS out of the HTML later, list those files here too.
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k === CACHE_VERSION ? null : caches.delete(k))))
    )
  );
  self.clients.claim();
});

// Cache-first for same-origin GETs; network for others
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET and same-origin
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // For navigations (HTML), try network first then cache (so updates appear when online)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((c) => c.put('./', copy));
        return res;
      }).catch(() => caches.match('./') || caches.match('./index.html'))
    );
    return;
  }

  // For other requests, serve cache first, fall back to network
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        // Cache successful same-origin responses
        const resClone = res.clone();
        caches.open(CACHE_VERSION).then((c) => c.put(req, resClone));
        return res;
      });
    })
  );
});
