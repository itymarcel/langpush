const installBtn = document.getElementById("installBtn");
const iosTip = document.getElementById("iosTip");

let deferredPrompt;

// Android/Chromium: real install prompt
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.style.display = "block";
});

installBtn.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice; // { outcome: "accepted" | "dismissed", platform: ... }
  deferredPrompt = null;
  installBtn.style.display = "none";
});

// Hide UI when already installed
window.addEventListener("appinstalled", () => {
  installBtn.style.display = "block";
  if (iosTip) iosTip.remove();
});

// iOS Safari: show tip (no programmatic A2HS)
const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
if (isIos && !isStandalone) {
  iosTip.style.display = "block";
  // Hide subscribe button and language dropdown on iOS when not in standalone mode
  const subBtn = document.getElementById("sub");
  const languageDropdown = document.getElementById("language-container");
  if (subBtn) {
    subBtn.style.display = "none";
  }
  if (languageDropdown) {
    languageDropdown.style.display = "none";
  }
}
