const CACHE = 'pirurim-v2';
const SHELL = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL))));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(response => {
      const copy = response.clone(); caches.open(CACHE).then(cache => cache.put('/', copy)); return response;
    }).catch(() => caches.match('/')));
  } else {
    event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
      return response;
    })));
  }
});
self.addEventListener('push', event => {
  let data = { title: 'התקבלה הזמנה חדשה', body: 'יש הזמנה חדשה שממתינה לך', url: '/admin' };
  try { data = { ...data, ...event.data.json() }; } catch {}
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body, icon: '/icon-192.png', badge: '/icon-192.png', data: { url: data.url || '/admin' },
    dir: 'rtl', lang: 'he', tag: data.tag || 'order'
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
    const target = new URL(event.notification.data.url || '/admin', self.location.origin).href;
    const client = clients.find(item => new URL(item.url).origin === self.location.origin);
    return client ? client.navigate(target).then(item => item.focus()) : self.clients.openWindow(target);
  }));
});
