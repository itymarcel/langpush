self.addEventListener("push", e => {
  const data = e.data?.text() || "New phrase!";
  e.waitUntil(
    self.registration.showNotification("NEW ITALIAN PHRASE :)", {
      body: data, icon: "/icon.png"
    })
  );
});
