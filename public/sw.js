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
      badge: notificationData.badge
    })
  );
});
