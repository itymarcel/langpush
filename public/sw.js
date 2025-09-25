self.addEventListener("push", e => {
  const data = e.data?.text() || "New phrase!";
  e.waitUntil(
    self.registration.showNotification("Lingua Ping", {
      body: data, icon: "/icon.png"
    })
  );
});
