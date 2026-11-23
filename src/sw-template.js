// The service worker (the build turns this into dist/sw.js, filling in the version and the files).
// It keeps every file of the game on the device: the game is answered from there first, so it
// loads with no signal and starts fast, and a newer build is fetched in the background and used
// from the next start.
const VERSION = '__VERSION__';
const FILES = __FILES__;
const CACHE = `mycelium-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

// Old copies of the game are thrown away once this one is in charge.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('mycelium-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // Opening the game: the stored page, whatever the address (./, ./index.html, ?source=…).
  const page = req.mode === 'navigate';
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = page ? await cache.match('./', { ignoreVary: true }) : await cache.match(req, { ignoreSearch: true, ignoreVary: true });
      if (hit) return hit;
      try {
        return await fetch(req);
      } catch (err) {
        if (page) {
          const fallback = await cache.match('./index.html', { ignoreVary: true });
          if (fallback) return fallback;
        }
        throw err;
      }
    }),
  );
});
