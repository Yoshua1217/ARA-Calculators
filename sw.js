/* sw.js — ARA Field Tools PWA (GitHub Pages-safe) */
const CACHE_VERSION = 'ara-tools-v1.0.3';

/* Resolve exact URLs the SW should cache/serve for navigations */
const SCOPE_URL = self.registration ? self.registration.scope : (self.location.origin + '/');
const INDEX_URL = new URL('index.html', SCOPE_URL).toString();  // e.g. https://user.github.io/repo/index.html
const ROOT_URL  = SCOPE_URL;                                    // e.g. https://user.github.io/repo/

const CORE_ASSETS = [
  INDEX_URL,
  ROOT_URL,
  new URL('manifest.webmanifest', SCOPE_URL).toString(),
  new URL('icons/ara-192.png', SCOPE_URL).toString(),
  new URL('icons/ara-512.png', SCOPE_URL).toString()
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(async (cache) => {
      // Precache root and index explicitly so offline navigations always work
      await cache.addAll(CORE_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k === CACHE_VERSION ? null : caches.delete(k))))
    )
  );
  self.clients.claim();
});

/* Strategy:
   - Navigations: serve cached INDEX/ROOT immediately; refresh in background when online.
   - Same-origin GETs: cache-first, then stash successful responses. */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    // Always try to serve a cached shell so the app is interactive offline
    event.respondWith(
      caches.match(INDEX_URL).then(cached =>
        cached || caches.match(ROOT_URL) || fetch(req)
      )
    );

    // Update HTML shell in the background (when online)
    event.waitUntil(
      fetch(INDEX_URL, { cache: 'reload' })
        .then(res =>
          caches.open(CACHE_VERSION).then(c => {
            c.put(INDEX_URL, res.clone());
            c.put(ROOT_URL,  res.clone());
          })
        )
        .catch(() => {})
    );
    return;
  }

  if (req.method === 'GET') {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(res => {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(req, clone));
          return res;
        });
      })
    );
  }
});
