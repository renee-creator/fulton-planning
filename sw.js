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

// Observe TREE opens without signal. Its one page, its Home Screen settings and its icons are kept on the phone, and
// each is fetched fresh whenever there is signal, so an update always arrives. Nothing else of TREE is kept here.
const OBSERVE = /\/(observe\.html|observe\.webmanifest|tree-icons\/observe-[^/]+\.png)$/;
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin || !OBSERVE.test(u.pathname)) return;
  e.respondWith(fetch(e.request).then(r => { if (r && r.ok) { const c = r.clone(); caches.open('observe-tree').then(k => k.put(u.pathname, c)); } return r; })
    .catch(() => caches.open('observe-tree').then(k => k.match(u.pathname)).then(r => r || Response.error())));
});
