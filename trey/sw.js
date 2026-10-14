// Trey Protocol service worker: only here for Web Push. It shows the reminders trey-protocol sends
// and, on tap, opens the app on the right tab. No fetch handler: every request goes to the network.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let p = {};
  try { p = e.data ? e.data.json() : {}; } catch { p = { body: e.data.text() }; }
  const data = p.data || {};
  const opts = { body: p.body || '', icon: 'icon-192.png', badge: 'icon-192.png', data };
  if (data.tag) { opts.tag = data.tag; opts.renotify = true; } // renotify without a tag throws in Chromium
  e.waitUntil(self.registration.showNotification(p.title || 'Trey · Protocol', opts));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const tab = (e.notification.data || {}).tab || 'protocol';
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const w = wins.find((c) => c.url.startsWith(self.registration.scope));
    if (w) { await w.focus(); w.postMessage({ type: 'open-tab', tab }); return; }
    await self.clients.openWindow('./?tab=' + tab);
  })());
});
