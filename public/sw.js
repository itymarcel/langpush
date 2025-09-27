self.addEventListener("push", e => {
  const data = e.data?.text() || "New phrase!";
  e.waitUntil(
    self.registration.showNotification("A New Phrase for You)", {
      body: data, icon: "/icon.png"
    })
  );
});
