/**
 * Lingua Push - Main Application JavaScript
 */

class LinguaPush {
  constructor() {
    this.btn = document.getElementById("sub");
    this.sendNowBtn = document.getElementById("sendNow");
    this.reg = null; // service worker registration cache

    this.init();
  }

  /**
   * Initialize the application
   */
  init() {
    this.setupEventListeners();
    this.syncButton();
    this.initializeIcons();
    this.setupLiveReload();
    this.initializeChickenPopover();
    this.loadLastNotification();
    this.checkCooldownOnLoad();
  }

  /**
   * Set up all event listeners
   */
  setupEventListeners() {
    // Main subscription button
    this.btn.addEventListener("click", () => this.handleSubscriptionToggle());

    // Send Now button
    this.sendNowBtn.addEventListener("click", () => this.handleSendNow());

    // Language selection change
    document.getElementById("language-select").addEventListener("change", (e) => {
      this.updateLanguageDisplay(e.target.value);
    });

    // Icons initialization
    document.addEventListener('DOMContentLoaded', () => {
      lucide.createIcons();
    });
  }

  /**
   * Update button state and UI based on subscription status
   */
  setButtonState(state) {
    const subscribeInfo = document.getElementById("subscribe-info");
    const spinner = document.querySelector(".spinner");

    switch (state) {
      case "sub":
        this.btn.innerHTML = '<i data-lucide="bell-off" class="ios-icon"></i> Unsubscribe';
        this.btn.disabled = false;
        this.btn.classList.add("outline");
        this.sendNowBtn.style.display = "flex";
        if (spinner) {
          spinner.style.visibility = "visible";
          spinner.style.opacity = "1";
        }
        this.updateSubscribedMessage(document.getElementById("language-select").value);
        break;

      case "unsub":
        this.btn.innerHTML = '<i data-lucide="bell" class="ios-icon"></i> Subscribe';
        this.btn.disabled = false;
        this.btn.classList.remove("outline");
        this.sendNowBtn.style.display = "none";
        if (spinner) {
          spinner.style.visibility = "hidden";
          spinner.style.opacity = "0";
        }
        this.updateUnsubscribedMessage(document.getElementById("language-select").value);
        break;

      default:
        this.btn.innerHTML = '<i data-lucide="loader" class="ios-icon rotating blue-text"></i>';
        this.btn.disabled = true;
        this.btn.classList.remove("outline");
        this.sendNowBtn.style.display = "none";
        if (spinner) {
          spinner.style.visibility = "hidden";
          spinner.style.opacity = "0";
        }
        subscribeInfo.innerHTML = "";
        break;
    }

    lucide.createIcons();
  }

  /**
   * Check if subscribe info should be shown (not on iOS or iOS and installed)
   */
  shouldShowSubscribeInfo() {
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;

    // Show info if not iOS, or if iOS and installed as PWA
    return !isIos || (isIos && isStandalone);
  }

  /**
   * Update subscribed message (when user is subscribed)
   */
  updateSubscribedMessage(languageValue) {
    const subscribeInfo = document.getElementById("subscribe-info");
    const languageName = languageValue === "spanish" ? "Spanish" :
                        languageValue === "french" ? "French" :
                        languageValue === "japanese" ? "Japanese" : "Italian";

    if (subscribeInfo) {
      subscribeInfo.innerHTML = `You're receiving <b>3</b> hand picked <br/>${languageName} ↔ English phrase pairs a day.`;
    }
  }

  /**
   * Update unsubscribed message (when user is not subscribed)
   */
  updateUnsubscribedMessage(languageValue) {
    const subscribeInfo = document.getElementById("subscribe-info");
    const languageName = languageValue === "spanish" ? "Spanish" :
                        languageValue === "french" ? "French" :
                        languageValue === "japanese" ? "Japanese" : "Italian";

    if (subscribeInfo) {
      subscribeInfo.innerHTML = `Once subscribed, you'll receive <br/><b>3 notifications a day</b> with hand picked <br/><span id="language-name">${languageName}</span> ↔ English phrase pairs.`;
    }
  }

  /**
   * Initialize service worker
   */
  async readyServiceWorker() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      this.btn.innerHTML = '<i data-lucide="x-circle" class="ios-icon"></i> Push not supported';
      this.btn.disabled = true;
      lucide.createIcons();
      return null;
    }

    if (!this.reg) {
      await navigator.serviceWorker.register("/sw.js");
      this.reg = await navigator.serviceWorker.ready;
    }

    return this.reg;
  }

  /**
   * Get VAPID public key from server
   */
  async getVapidKey() {
    const response = await fetch("/vapidPublicKey");
    return (await response.text()).trim();
  }

  /**
   * Convert base64 string to Uint8Array
   */
  base64ToUint8Array(base64) {
    const pad = "=".repeat((4 - base64.length % 4) % 4);
    const b64 = (base64 + pad).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(b64);
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
  }

  /**
   * Sync button state with actual subscription status
   */
  async syncButton() {
    this.setButtonState("loading");

    const serviceWorker = await this.readyServiceWorker();
    if (!serviceWorker) return;

    const subscription = await serviceWorker.pushManager.getSubscription();
    let existsOnServer = false;
    let savedLanguage = null;

    const languageSelect = document.getElementById("language-select");

    // Check if subscription exists on server
    if (subscription) {
      try {
        const queryParams = new URLSearchParams({ endpoint: subscription.endpoint });
        const response = await fetch(`/subscribe/exists?${queryParams}`);
        const data = await response.json();
        existsOnServer = !!data.exists;

        // Get saved language preference if subscribed
        if (existsOnServer) {
          savedLanguage = await this.getSavedLanguage(subscription.endpoint);
        }
      } catch (error) {
        console.error("Error checking subscription:", error);
      }
    }

    const isSubscribed = subscription && existsOnServer;
    this.setButtonState(isSubscribed ? "sub" : "unsub");
    this.updateUI(isSubscribed, savedLanguage, languageSelect);

    return { subscription, existsOnServer, savedLanguage };
  }

  /**
   * Get saved language preference from server
   */
  async getSavedLanguage(endpoint) {
    try {
      const adminKeyResponse = await fetch('/admin-key');
      const adminKey = await adminKeyResponse.text();

      const response = await fetch('/admin/subs', {
        headers: { 'X-Admin-Key': adminKey }
      });

      if (response.ok) {
        const adminData = await response.json();
        const userSub = adminData.rows.find(row => {
          const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
          return data.endpoint === endpoint;
        });

        if (userSub) {
          const data = typeof userSub.data === 'string' ? JSON.parse(userSub.data) : userSub.data;
          return data.language || 'italian';
        }
      }
    } catch (error) {
      console.error("Error fetching saved language:", error);
    }

    return null;
  }

  /**
   * Update UI based on subscription status
   */
  updateUI(isSubscribed, savedLanguage, languageSelect) {
    const languageLabel = document.querySelector('#language-container label');

    // Update language selection
    if (savedLanguage) {
      languageSelect.value = savedLanguage;
    }

    // Enable/disable language selector
    languageSelect.disabled = isSubscribed;

    // Update label text
    if (languageLabel) {
      languageLabel.textContent = isSubscribed ? "You are subscribed to" : "Choose language";
    }
  }

  /**
   * Handle subscription toggle (subscribe/unsubscribe)
   */
  async handleSubscriptionToggle() {
    const serviceWorker = await this.readyServiceWorker();
    if (!serviceWorker) return;

    // Get current state
    const { subscription, existsOnServer } = await this.syncButton();

    if (subscription && existsOnServer) {
      await this.unsubscribe(subscription);
    } else {
      await this.subscribe(serviceWorker);
    }
  }

  /**
   * Handle unsubscription
   */
  async unsubscribe(subscription) {
    this.setButtonState("loading");
    const endpoint = subscription.endpoint;

    try {
      await subscription.unsubscribe();
      await fetch("/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint })
      });
      await this.syncButton();
    } catch (error) {
      console.error("Unsubscribe failed:", error);
      alert("Unsubscribe failed.");
      await this.syncButton();
    }
  }

  /**
   * Handle subscription
   */
  async subscribe(serviceWorker) {
    // Check notification permission
    if (Notification.permission === "denied") {
      alert("Notifications are blocked. Enable them in your browser settings.");
      return;
    }

    this.setButtonState("loading");

    try {
      // Request permission if needed
      if (Notification.permission !== "granted") {
        await Notification.requestPermission();
      }

      // Get VAPID key and create subscription
      const vapidKey = await this.getVapidKey();
      const newSubscription = await serviceWorker.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.base64ToUint8Array(vapidKey)
      });

      // Get selected language
      const languageSelect = document.getElementById("language-select");
      const selectedLanguage = languageSelect.value;

      // Send subscription to server with language preference
      const subscriptionData = {
        ...newSubscription.toJSON(),
        language: selectedLanguage
      };

      await fetch("/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscriptionData)
      });

      await this.syncButton();

    } catch (error) {
      console.error("Subscription failed:", error);
      this.setButtonState("unsub");
      alert("Subscription failed.");
    }
  }

  /**
   * Initialize Lucide icons
   */
  initializeIcons() {
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  /**
   * Handle Send One Now button click
   */
  setSendButtonState(state) {
    const sendState = this.sendNowBtn.querySelector('.send-state');
    const sendingState = this.sendNowBtn.querySelector('.sending-state');
    const sentState = this.sendNowBtn.querySelector('.sent-state');
    const failedState = this.sendNowBtn.querySelector('.failed-state');
    const cooldownState = this.sendNowBtn.querySelector('.cooldown-state');

    // Hide all states
    sendState.style.display = 'none';
    sendingState.style.display = 'none';
    sentState.style.display = 'none';
    failedState.style.display = 'none';
    if (cooldownState) cooldownState.style.display = 'none';

    // Show the appropriate state
    switch (state) {
      case 'send':
        sendState.style.display = 'flex';
        this.sendNowBtn.disabled = false;
        break;
      case 'sending':
        sendingState.style.display = 'flex';
        this.sendNowBtn.disabled = true;
        break;
      case 'sent':
        sentState.style.display = 'flex';
        this.sendNowBtn.disabled = true;
        break;
      case 'failed':
        failedState.style.display = 'flex';
        this.sendNowBtn.disabled = true;
        break;
      case 'cooldown':
        if (cooldownState) {
          cooldownState.style.display = 'flex';
        }
        this.sendNowBtn.disabled = true;
        break;
    }
  }

  async handleSendNow() {
    this.setSendButtonState('sending');

    try {
      const serviceWorker = await this.readyServiceWorker();
      if (!serviceWorker) return;

      const subscription = await serviceWorker.pushManager.getSubscription();
      if (!subscription) return;

      const adminKeyResponse = await fetch('/admin-key');
      const adminKey = await adminKeyResponse.text();

      const response = await fetch("/admin/send-now", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Key": adminKey
        },
        body: JSON.stringify({ endpoint: subscription.endpoint })
      });

      if (response.ok) {
        this.setSendButtonState('sent');
        // Reload last notification after sending
        this.loadLastNotification();

        // Start 60-second cooldown with countdown
        this.saveCooldownToCache(60);
        this.startCooldown(60);
      } else {
        throw new Error('Failed to send notification');
      }
    } catch (error) {
      console.error("Send now failed:", error);
      this.setSendButtonState('failed');
      setTimeout(() => {
        this.setSendButtonState('send');
      }, 2000);
    }
  }

  saveCooldownToCache(seconds) {
    const endTime = Date.now() + (seconds * 1000);
    localStorage.setItem('sendNowCooldown', endTime);
  }

  checkCooldownOnLoad() {
    const endTime = localStorage.getItem('sendNowCooldown');
    if (!endTime) return;

    const remaining = Math.ceil((parseInt(endTime) - Date.now()) / 1000);
    if (remaining > 0) {
      this.startCooldown(remaining);
    } else {
      localStorage.removeItem('sendNowCooldown');
    }
  }

  startCooldown(seconds) {
    let remaining = seconds;
    this.setSendButtonState('cooldown');
    this.updateCooldownText(remaining);

    const interval = setInterval(() => {
      remaining--;
      this.updateCooldownText(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        localStorage.removeItem('sendNowCooldown');
        this.setSendButtonState('send');
      }
    }, 1000);
  }

  updateCooldownText(seconds) {
    const sendState = this.sendNowBtn.querySelector('.cooldown-state .text');
    if (sendState) {
      sendState.textContent = ` Wait ${seconds}s`;
    }
  }

  /**
   * Initialize chicken popover
   */
  initializeChickenPopover() {
    const chickenBtn = document.getElementById('chickenBtn');
    if (chickenBtn) {
      const popoverContent = `
        <h3>Daily Language Pairs</h3>
        <p>Subscribing will send you a push notification 3 x times a day with a language pair of your choice.</p>
      `;

      new Popover(chickenBtn, popoverContent, {
        position: 'bottom',
        offset: 15,
        className: 'chicken-popover'
      });
    }
  }

  /**
   * Load and display last notification
   */
  async loadLastNotification() {
    try {
      const serviceWorker = await this.readyServiceWorker();
      if (!serviceWorker) return;

      const subscription = await serviceWorker.pushManager.getSubscription();
      if (!subscription) return;

      const response = await fetch(`/last-notification?endpoint=${encodeURIComponent(subscription.endpoint)}`);
      const data = await response.json();

      if (data.ok && data.hasNotification) {
        this.displayLastNotification(data.original, data.english, data.language, data.sentAt);
      } else {
        this.hideLastNotification();
      }
    } catch (error) {
      console.error("Failed to load last notification:", error);
      this.hideLastNotification();
    }
  }

  /**
   * Display last notification in the UI
   */
  displayLastNotification(original, english, language, sentAt) {
    const lastNotificationDiv = document.querySelector('.last-notification');
    const originalDiv = lastNotificationDiv.querySelector('.original');
    const englishDiv = lastNotificationDiv.querySelector('.english');

    if (originalDiv && englishDiv) {
      originalDiv.textContent = original;
      englishDiv.textContent = english;
      lastNotificationDiv.style.display = 'flex';
    }
  }

  /**
   * Hide last notification
   */
  hideLastNotification() {
    const lastNotificationDiv = document.querySelector('.last-notification');
    if (lastNotificationDiv) {
      lastNotificationDiv.style.display = 'none';
    }
  }

  /**
   * Setup live reload for development
   */
  setupLiveReload() {
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      const eventSource = new EventSource('/live-reload');
      eventSource.onmessage = (event) => {
        if (event.data === 'reload') {
          location.reload();
        }
      };
    }
  }
}

// Initialize the application when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new LinguaPush();
});