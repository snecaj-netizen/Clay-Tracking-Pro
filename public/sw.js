self.addEventListener('push', function(event) {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'Nuova Notifica', body: event.data.text() };
    }
  }

  const title = data.title || 'Clay Tracker Pro';
  const options = {
    body: data.body || 'Hai una nuova notifica',
    icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIiB2aWV3Qm94PSIwIDAgNTEyIDUxMiI+PHJlY3Qgd2lkdGg9IjUxMiIgaGVpZ2h0PSI1MTIiIHJ4PSIxMDAiIGZpbGw9IiNlYTU4MGMiLz48Y2lyY2xlIGN4PSIyNTYiIGN5PSIyNTYiIHI9IjE2MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSI0MCIvPjxjaXJjbGUgY3g9IjI1NiIgY3k9IjI1NiIgcj0iODAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNDAiLz48Y2lyY2xlIGN4PSIyNTYiIGN5PSIyNTYiIHI9IjIwIiBmaWxsPSJ3aGl0ZSIvPjwvc3ZnPg==',
    badge: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIiB2aWV3Qm94PSIwIDAgNTEyIDUxMiI+PHJlY3Qgd2lkdGg9IjUxMiIgaGVpZ2h0PSI1MTIiIHJ4PSIxMDAiIGZpbGw9IiNlYTU4MGMiLz48Y2lyY2xlIGN4PSIyNTYiIGN5PSIyNTYiIHI9IjE2MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSI0MCIvPjxjaXJjbGUgY3g9IjI1NiIgY3k9IjI1NiIgcj0iODAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNDAiLz48Y2lyY2xlIGN4PSIyNTYiIGN5PSIyNTYiIHI9IjIwIiBmaWxsPSJ3aGl0ZSIvPjwvc3ZnPg==',
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
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
