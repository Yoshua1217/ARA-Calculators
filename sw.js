/* sw.js — ARA Field Tools PWA (stable offline HTML) */
const CACHE_VERSION = 'ara-tools-v1.0.2';
const HTML_URL = './index.html';       // <-- change to ./app.html if that’s your entry file
const CORE_ASSETS = [
  HTML_URL,
  './manifest.webmanifest',
  './icons/ara-192.png',
  './icons/ara-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(async (cache) => {
      // cache HTML with cache-busting to avoid partial/redirected responses
      await cache.add(new Request(HTML_URL, { cache: 'reload' }));
      await cache.addAll(CORE_ASSETS.filter(x => x !== HTML_URL));
    })
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

/* Strategy:
 * - For page navigations: serve cached HTML immediately (works offline), then update in background.
 * - For same-origin GET requests: cache-first, then put successful responses in cache.
 */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin
  if (url.origin !== self.location.origin) return;

  // NAVIGATIONS: return cached HTML so JS always runs offline
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match(HTML_URL).then(cached => cached || fetch(HTML_URL))
    );
    // Refresh HTML in the background when online
    event.waitUntil(
      fetch(new Request(HTML_URL, { cache: 'reload' }))
        .then(res => caches.open(CACHE_VERSION).then(c => c.put(HTML_URL, res.clone())))
        .catch(() => {})
    );
    return;
  }

  // OTHER SAME-ORIGIN GETS: cache-first
  if (req.method === 'GET') {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(res => {
          // Cache successful opaque/basic responses
          const clone = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(req, clone));
          return res;
        });
      })
    );
  }
});
