self.addEventListener('install', function(event) {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', function(event) {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'Nuova Notifica', body: event.data.text() };
    }
  }

  const title = data.title || 'Clay Performance';
  const options = {
    body: data.body || 'Hai una nuova notifica',
    icon: '/app-logo.svg',
    badge: '/app-logo.svg',
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      'setAppBadge' in navigator ? navigator.setAppBadge().catch(() => {}) : Promise.resolve()
    ])
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  const urlToOpen = new URL(event.notification.data.url, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(function(windowClients) {
      let matchingClient = null;
      for (let i = 0; i < windowClients.length; i++) {
        const windowClient = windowClients[i];
        // Check if the client is on the same origin
        if (new URL(windowClient.url).origin === self.location.origin) {
          matchingClient = windowClient;
          break;
        }
      }

      if (matchingClient) {
        return matchingClient.navigate(urlToOpen).then(client => client.focus());
      } else {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
