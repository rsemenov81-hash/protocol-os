// Protocol OS Service Worker — network-first so updates always pick up, with two guards:
// a failed cross-origin call (the /sync Worker) is never answered with the cached page, and a
// navigation on a weak signal falls back to the cached app after 3 s instead of hanging blank.
const CACHE = 'protocol-os-v16';
const ASSETS = ['./', './index.html'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    Promise.all([
      caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))),
      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return; // cross-origin (sync Worker, fonts): straight to the network, failures stay failures
  const isNav = e.request.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const net = fetch(e.request).then(resp => {
      if (resp && resp.ok && resp.type === 'basic') cache.put(e.request, resp.clone());
      return resp;
    });
    if (!isNav) return net.catch(() => cache.match(e.request));
    const timeout = new Promise(res => setTimeout(() => res(null), 3000));
    const first = await Promise.race([net.catch(() => null), timeout]);
    if (first) return first;
    const cached = (await cache.match(e.request)) || (await cache.match('./index.html'));
    if (cached) { net.catch(() => {}); return cached; }
    return net;
  })());
});
