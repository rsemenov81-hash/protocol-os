// Sanitize even queued notifications from an older server version.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const notification of await self.registration.getNotifications()) notification.close();
  await self.clients.claim();
})()));
self.addEventListener('push', event => {
  event.waitUntil(self.registration.showNotification('Google it.', {
    body: 'Google it.', icon: 'icon-192.png', badge: 'icon-192.png',
    tag: 'google-it', renotify: true,
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const client = clients.find(c => c.url.startsWith(self.registration.scope));
    if (client) { await client.navigate(self.registration.scope); await client.focus(); }
    else await self.clients.openWindow(self.registration.scope);
  })());
});
