// Protocol OS Service Worker — network-first so updates always pick up
const CACHE = 'protocol-os-v11';
const ASSETS = ['./', './Protocol-OS.html'];

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
  // Network-first: try fresh, fall back to cache
  e.respondWith(
    fetch(e.request).then(resp => {
      if (resp && resp.ok && resp.type === 'basic') {
        const clone = resp.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, clone));
      }
      return resp;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./Protocol-OS.html')))
  );
});
