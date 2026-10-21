// TREE's reminders. The server sends a short message, and this shows it on the phone and opens TREE where it points.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('push', e => {
  let m = {};
  try { m = e.data ? e.data.json() : {}; } catch (_) { m = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(m.title || 'TREE', {
    body: m.body || '', tag: m.tag || 'tree', renotify: true,
    icon: 'icon-192.png', badge: 'icon-192.png', data: { url: m.url || 'tree.html' }
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || 'tree.html', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    for (const c of cs) if ('navigate' in c) return c.navigate(url).then(w => (w || c).focus()).catch(() => self.clients.openWindow(url));
    return self.clients.openWindow(url);
  }));
});
