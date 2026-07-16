/* sw.js — offline shell + instant repeat loads for the hand-built site.
   Strategy:
   - HTML pages + data JSON  -> network-first (always fresh online, cached for offline)
   - versioned CSS/JS (?v=)  -> cache-first (immutable per version; new ?v = new fetch)
   - images / other same-origin GET -> cache-first
   - cross-origin (analytics, ipwho, github avatar) -> untouched, straight to network
   Progressive: if the SW fails to register the site works exactly as before.
   Bump CACHE to force a full purge on the next visit. */

const CACHE = 'zgw-v1';

// precache the page shells so any chapter opens from a cold offline start
// (their ?v assets fill in via runtime caching on the first online visit)
const SHELL = [
  '/', '/index.html', '/about.html', '/work.html', '/projects.html',
  '/papers.html', '/resume.html', '/stall.html', '/oneshot.html', '/404.html',
  '/manifest.webmanifest', '/assets/img/favicon.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL).catch(() => {}))   // don't fail install if one 404s
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                 // never touch POST beacons
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;       // analytics / ipwho / avatar pass through

  const fresh = req.mode === 'navigate' ||
                url.pathname.endsWith('.html') ||
                url.pathname.endsWith('.json');

  if (fresh) {
    // network-first: fresh when online, cached when offline, shell as last resort
    e.respondWith(
      fetch(req)
        .then(res => { const c = res.clone(); caches.open(CACHE).then(k => k.put(req, c)); return res; })
        .catch(() => caches.match(req).then(m => m || caches.match('/index.html')))
    );
    return;
  }

  // cache-first for versioned assets + images
  e.respondWith(
    caches.match(req).then(m => m || fetch(req).then(res => {
      if (res.ok) { const c = res.clone(); caches.open(CACHE).then(k => k.put(req, c)); }
      return res;
    }))
  );
});
