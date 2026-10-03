// Protocol OS Service Worker — network-first so updates always pick up, with two guards:
// a failed cross-origin call (the /sync Worker) is never answered with the cached page, and a
// navigation on a weak signal falls back to the cached app after 3 s instead of hanging blank.
// It also receives Web Push reminders from the sync Worker (push / notificationclick, at the bottom).
const CACHE = 'protocol-os-v17';
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png'
];

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

// ── Web Push reminders ───────────────────────────────────────────────────────────────────────────
// Payloads from the Worker are JSON: { title, body, data: { profile, block, date, url } }. A plain-text
// payload (or one that fails to parse) becomes the body of a generic reminder rather than being dropped.
const ICON = './icons/icon-192.png';

function parsePush(e) {
  let payload = null;
  if (e.data) {
    try { payload = e.data.json(); } catch (err) { try { payload = { body: e.data.text() }; } catch (err2) { payload = null; } }
  }
  if (!payload || typeof payload !== 'object') payload = { body: typeof payload === 'string' ? payload : '' };
  const inner = payload.data && typeof payload.data === 'object' ? payload.data : {};
  const data = {};
  ['profile', 'block', 'date', 'url'].forEach(k => { if (inner[k] != null) data[k] = inner[k]; else if (payload[k] != null) data[k] = payload[k]; });
  return { title: payload.title || 'Protocol OS', body: payload.body || '', data };
}

self.addEventListener('push', e => {
  const { title, body, data } = parsePush(e);
  const tag = data.block ? `block-${data.date}-${data.block}` : undefined;
  const options = { body, icon: ICON, badge: ICON, data };
  if (tag) { options.tag = tag; options.renotify = true; } // renotify without a tag throws in Chromium
  e.waitUntil(self.registration.showNotification(title, options));
});

// Tap on a reminder: bring an open Protocol OS window to the front and hand it the block (the app
// listens for { type: 'open-block' } via listenForOpenBlock in src/app/push.js); otherwise open one.
self.addEventListener('notificationclick', e => {
  const data = (e.notification && e.notification.data) || {};
  if (e.notification && typeof e.notification.close === 'function') e.notification.close();
  const scope = (self.registration && self.registration.scope) || new URL('./', self.location.href).href;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const client = all.find(c => typeof c.url === 'string' && c.url.indexOf(scope) === 0);
    if (client) {
      try { if (typeof client.focus === 'function') await client.focus(); } catch (err) {}
      try { client.postMessage({ type: 'open-block', data }); } catch (err) {}
      return;
    }
    return self.clients.openWindow(data.url || './index.html');
  })());
});
