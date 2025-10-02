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

  // Determine the URL to open
  let urlToOpen = '/';
  if (sentAt) {
    urlToOpen = `/?notification=${encodeURIComponent(sentAt)}`;
  }

  e.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(clientList => {
      console.log('SW: Found clients:', clientList.length);

      // Look for any client from our origin
      let targetClient = null;

      for (const client of clientList) {
        console.log('SW: Checking client:', client.url, 'visible:', client.visibilityState);
        if (client.url.includes(self.location.origin)) {
          targetClient = client;
          break;
        }
      }

      if (targetClient) {
        console.log('SW: Found target client, sending message and focusing');

        // Send message to the client
        if (sentAt) {
          targetClient.postMessage({
            type: 'NOTIFICATION_CLICK',
            sentAt: sentAt
          });
        }

        // Focus the client to bring it to foreground
        return targetClient.focus().catch(err => {
          console.log('SW: Focus failed, opening new window instead:', err);
          return clients.openWindow(urlToOpen);
        });
      } else {
        console.log('SW: No client found, opening new window');
        // No client found, open new window
        return clients.openWindow(urlToOpen);
      }
    }).catch(err => {
      console.error('SW: Error in notification click handler:', err);
      return clients.openWindow(urlToOpen);
    })
  );
});
