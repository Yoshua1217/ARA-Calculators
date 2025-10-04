/* sw.js — ARA Field Tools (solid offline on GitHub Pages) */
const CACHE = 'ara-tools-v1.0.4';

/* Compute absolute URLs based on where the SW is hosted */
const SCOPE = (self.registration && self.registration.scope) || (self.location.origin + '/');
const INDEX_URL = new URL('index.html', SCOPE).toString();  // e.g. https://user.github.io/repo/index.html
const MANIFEST = new URL('manifest.webmanifest', SCOPE).toString();
const ICON192  = new URL('icons/ara-192.png', SCOPE).toString();
const ICON512  = new URL('icons/ara-512.png', SCOPE).toString();

const PRECACHE = [INDEX_URL, MANIFEST, ICON192, ICON512];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(async (c) => {
      // Always fetch a fresh HTML so we don’t cache a redirect or placeholder
      const freshHtml = await fetch(INDEX_URL, { cache: 'reload' });
      await c.put(INDEX_URL, freshHtml.clone());
      // Precache other core files
      await c.addAll(PRECACHE.filter(u => u !== INDEX_URL));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      // Clean old caches
      const keys = await caches.keys();
      await Promise.all(keys.map(k => (k === CACHE ? null : caches.delete(k))));
      // Optional: enable navigation preload (nice-to-have)
      if (self.registration.navigationPreload) {
        try { await self.registration.navigationPreload.enable(); } catch {}
      }
      await self.clients.claim();
    })()
  );
});

/* Strategy:
 * - Navigations: serve the cached index.html immediately (so JS runs offline),
 *   then refresh it in the background when online.
 * - Other same-origin GETs: cache-first, then stash successful responses.
 */
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) return;

  // HTML navigations
  if (req.mode === 'navigate') {
    e.respondWith(
      (async () => {
        // Prefer preload (if available), else cached, else network
        try {
          const prel = await e.preloadResponse;
          if (prel) return prel;
        } catch {}
        const cached = await caches.match(INDEX_URL);
        if (cached) return cached;
        return fetch(req); // online first run (before install)
      })()
    );

    // Background refresh of the HTML shell
    e.waitUntil(
      (async () => {
        try {
          const fresh = await fetch(INDEX_URL, { cache: 'reload' });
          const c = await caches.open(CACHE);
          await c.put(INDEX_URL, fresh.clone());
        } catch {}
      })()
    );
    return;
  }

  // Other requests: cache-first
  if (req.method === 'GET') {
    e.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
          return res;
        });
      })
    );
  }
});
