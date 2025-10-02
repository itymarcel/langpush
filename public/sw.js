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
      // Filter for clients that match our origin
      const appClients = clientList.filter(client =>
        client.url.includes(self.location.origin)
      );

      if (appClients.length > 0) {
        // App is open (foreground or background), focus first client and send message
        const targetClient = appClients[0];

        // Always send message first, then focus
        if (sentAt) {
          targetClient.postMessage({
            type: 'NOTIFICATION_CLICK',
            sentAt: sentAt
          });
        }

        // Focus the client (this will bring it to foreground)
        return targetClient.focus();
      } else {
        // App is not open, open new window with timestamp
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
