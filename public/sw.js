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
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin)) {
            // App is open, focus and send message
            client.focus();
            if (sentAt) {
              client.postMessage({
                type: 'NOTIFICATION_CLICK',
                sentAt: sentAt
              });
            }
            return;
          }
        }

        // App is not open, open new window with timestamp
        return clients.openWindow(urlToOpen);
      })
  );
});
