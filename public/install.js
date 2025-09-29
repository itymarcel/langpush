const installBtn = document.getElementById("installBtn");
const iosTip = document.getElementById("iosTip");
const iosThirdpartyTip = document.getElementById("iosThirdpartyTip");

let deferredPrompt;

// Android/Chromium: real install prompt
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.style.display = "flex";
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
  installBtn.style.display = "none";
  if (iosTip) iosTip.remove();
  if (iosThirdpartyTip) iosThirdpartyTip.remove();
});

// iOS detection and tip logic
function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isIOSSafari() {
  const isIos = isIOS();
  // Safari on iOS contains "Safari" but not Chrome, Firefox, or other third-party indicators
  const isSafari = /safari/i.test(navigator.userAgent) && !/chrome|crios|fxios|opios|brave/i.test(navigator.userAgent);
  return isIos && isSafari;
}

function isIOSThirdParty() {
  const isIos = isIOS();
  const isSafari = isIOSSafari();
  return isIos && !isSafari;
}

function handleIOSTips() {
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;

  // Hide both tips by default
  if (iosTip) iosTip.style.display = "none";
  if (iosThirdpartyTip) iosThirdpartyTip.style.display = "none";

  // Don't show tips if already installed as PWA
  if (isStandalone) return;

  if (isIOSThirdParty()) {
    // Show third-party browser tip
    if (iosThirdpartyTip) iosThirdpartyTip.style.display = "flex";
    hideMainUI();
  } else if (isIOSSafari()) {
    // Show Safari tip
    if (iosTip) iosTip.style.display = "flex";
    hideMainUI();
  }
}

function hideMainUI() {
  // Hide subscribe button and language dropdown on iOS when not in standalone mode
  const subBtn = document.getElementById("sub");
  const languageDropdown = document.getElementById("language-container");
  const subscribeInfo = document.getElementById("subscribe-info");

  if (subBtn) subBtn.style.display = "none";
  if (languageDropdown) languageDropdown.style.display = "none";
  if (subscribeInfo) subscribeInfo.innerHTML = "";
}

// Run iOS tip logic when DOM is loaded
if (isIOS()) {
  document.addEventListener('DOMContentLoaded', handleIOSTips);
}

  