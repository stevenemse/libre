/* Gestion des notifications push reçues par le service worker.
   Ce fichier est importé par le service worker généré (voir vite.config.ts). */

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Libre';
  const options = {
    body: payload.body || 'Un petit pas de plus vers ta liberté financière.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.tag || 'libre-reminder',
    data: { url: payload.url || '/', kind: payload.kind || 'reminder' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
