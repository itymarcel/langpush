// Cache version - increment to force cache refresh
const CACHE_VERSION = 'v1';

self.addEventListener("push", e => {
  let notificationData;

  try {
    // Try to parse as JSON first
    notificationData = JSON.parse(e.data?.text() || '{}');
  } catch (error) {
    // Fallback for plain text notifications
    notificationData = {
      title: "New Phrase!",
      body: e.data?.text() || "A new language phrase is ready for you!",
      icon: "/icon-192.png",
      badge: "/icon-192.png"
    };
  }

  e.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      data: notificationData.data // Pass through timestamp data if present
    })
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', e => {
  e.notification.close();

  const sentAt = e.notification.data?.sentAt;

  // Always try both approaches: URL navigation AND direct messaging
  let urlToOpen = '/';
  if (sentAt) {
    urlToOpen = `/?notification=${encodeURIComponent(sentAt)}`;
  }

  e.waitUntil(
    Promise.resolve().then(() => {
      // First, try to use BroadcastChannel to communicate with any open instances
      if (sentAt && 'BroadcastChannel' in self) {
        try {
          const channel = new BroadcastChannel('notification-click');
          channel.postMessage({
            type: 'NOTIFICATION_CLICK',
            sentAt: sentAt
          });
          console.log('SW: Sent broadcast message');
        } catch (err) {
          console.log('SW: BroadcastChannel failed:', err);
        }
      }

      // Then handle client focusing/opening
      return clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      }).then(clientList => {
        console.log('SW: Found clients:', clientList.length);

        const appClients = clientList.filter(client =>
          client.url.includes(self.location.origin)
        );

        if (appClients.length > 0) {
          console.log('SW: Found app clients, focusing first one');
          const targetClient = appClients[0];

          // Send message via postMessage as backup
          if (sentAt) {
            targetClient.postMessage({
              type: 'NOTIFICATION_CLICK',
              sentAt: sentAt
            });
          }

          return targetClient.focus().catch(err => {
            console.log('SW: Focus failed, opening new window:', err);
            return clients.openWindow(urlToOpen);
          });
        } else {
          console.log('SW: No clients found, opening new window');
          return clients.openWindow(urlToOpen);
        }
      });
    }).catch(err => {
      console.error('SW: Error in notification click handler:', err);
      return clients.openWindow(urlToOpen);
    })
  );
});
