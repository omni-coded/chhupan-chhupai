// Service worker: lets phones install the game and opens it fast on a weak connection.
// Pages are always fetched fresh when online; built assets (hashed names) are cached.
const CACHE = 'cc-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/ws')) return;

  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          caches.open(CACHE).then((c) => c.put('/', res.clone()));
          return res;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icon')) {
    e.respondWith(
      caches.match(e.request).then(
        (hit) =>
          hit ||
          fetch(e.request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
            return res;
          }),
      ),
    );
  }
});
