/**
 * Lingua Push - Main Application JavaScript
 */

class LinguaPush {
  constructor() {
    // Constants
    this.CONSTANTS = {
      ENDPOINTS: {
        VAPID_KEY: '/vapidPublicKey',
        ADMIN_KEY: '/admin-key',
        SUBSCRIBE: '/subscribe',
        SUBSCRIBE_EXISTS: '/subscribe/exists',
        ADMIN_SUBS: '/admin/subs',
        ADMIN_SEND_NOW: '/admin/send-now',
        LAST_NOTIFICATION: '/last-notification',
        LIVE_RELOAD: '/live-reload'
      },
      SELECTORS: {
        SUB_BUTTON: 'sub',
        SEND_NOW_BUTTON: 'sendNow',
        LANGUAGE_SELECT: 'language-select',
        LANGUAGE_CONTAINER: 'language-container',
        SUBSCRIBE_INFO: 'subscribe-info',
        CHICKEN_BTN: 'chickenBtn',
        LAST_NOTIFICATION: '.last-notification',
        LAST_NOTIFICATION_ORIGINAL: '.last-notification .original',
        LAST_NOTIFICATION_ENGLISH: '.last-notification .english'
      },
      LANGUAGES: {
        ITALIAN: 'italian',
        SPANISH: 'spanish',
        FRENCH: 'french',
        JAPANESE: 'japanese'
      },
      COOLDOWN_DURATION: 60
    };

    // Cache DOM elements
    this.elements = {
      subButton: document.getElementById(this.CONSTANTS.SELECTORS.SUB_BUTTON),
      sendNowButton: document.getElementById(this.CONSTANTS.SELECTORS.SEND_NOW_BUTTON),
      languageSelect: document.getElementById(this.CONSTANTS.SELECTORS.LANGUAGE_SELECT),
      subscribeInfo: document.getElementById(this.CONSTANTS.SELECTORS.SUBSCRIBE_INFO),
      chickenBtn: document.getElementById(this.CONSTANTS.SELECTORS.CHICKEN_BTN),
      lastNotification: document.querySelector(this.CONSTANTS.SELECTORS.LAST_NOTIFICATION),
      lastNotificationOriginal: document.querySelector(this.CONSTANTS.SELECTORS.LAST_NOTIFICATION_ORIGINAL),
      lastNotificationEnglish: document.querySelector(this.CONSTANTS.SELECTORS.LAST_NOTIFICATION_ENGLISH)
    };

    // State
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
    this.elements.subButton.addEventListener("click", () => this.handleSubscriptionToggle());

    // Send Now button
    this.elements.sendNowButton.addEventListener("click", () => this.handleSendNow());

    // Language selection change
    this.elements.languageSelect.addEventListener("change", (e) => {
      this.updateLanguageDisplay(e.target.value);
    });

    // Icons initialization
    document.addEventListener('DOMContentLoaded', () => {
      lucide.createIcons();
    });

    // Refresh data when app becomes visible again (from background/swipe away)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        // App became visible again - refresh latest notification
        this.loadLastNotification();
      }
    });
  }

  /**
   * Update button state and UI based on subscription status
   */
  setButtonState(state) {
    const spinner = document.querySelector(".spinner");

    // Get all button state elements
    const subState = this.elements.subButton.querySelector('.sub-state');
    const unsubState = this.elements.subButton.querySelector('.unsub-state');
    const loadingState = this.elements.subButton.querySelector('.loading-state');
    const unsupportedState = this.elements.subButton.querySelector('.unsupported-state');

    // Hide all states first
    [subState, unsubState, loadingState, unsupportedState].forEach(element => {
      if (element) element.style.display = 'none';
    });

    switch (state) {
      case "sub":
        if (unsubState) unsubState.style.display = 'flex';
        this.elements.subButton.disabled = false;
        this.elements.subButton.classList.add("outline");
        this.elements.sendNowButton.style.display = "flex";
        if (spinner) {
          spinner.style.visibility = "visible";
          spinner.style.opacity = "1";
        }
        this.updateSubscribedMessage(this.elements.languageSelect.value);
        break;

      case "unsub":
        if (subState) subState.style.display = 'flex';
        this.elements.subButton.disabled = false;
        this.elements.subButton.classList.remove("outline");
        this.elements.sendNowButton.style.display = "none";
        if (spinner) {
          spinner.style.visibility = "hidden";
          spinner.style.opacity = "0";
        }
        this.updateUnsubscribedMessage(this.elements.languageSelect.value);
        break;

      case "unsupported":
        if (unsupportedState) unsupportedState.style.display = 'flex';
        this.elements.subButton.disabled = true;
        this.elements.subButton.classList.remove("outline");
        this.elements.sendNowButton.style.display = "none";
        if (spinner) {
          spinner.style.visibility = "hidden";
          spinner.style.opacity = "0";
        }
        this.elements.subscribeInfo.innerHTML = "";
        break;

      default: // loading
        if (loadingState) loadingState.style.display = 'flex';
        this.elements.subButton.disabled = true;
        this.elements.subButton.classList.remove("outline");
        this.elements.sendNowButton.style.display = "none";
        if (spinner) {
          spinner.style.visibility = "hidden";
          spinner.style.opacity = "0";
        }
        this.elements.subscribeInfo.innerHTML = "";
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
   * Get language display name
   */
  getLanguageDisplayName(languageValue) {
    const languageMap = {
      [this.CONSTANTS.LANGUAGES.SPANISH]: "Spanish",
      [this.CONSTANTS.LANGUAGES.FRENCH]: "French",
      [this.CONSTANTS.LANGUAGES.JAPANESE]: "Japanese",
      [this.CONSTANTS.LANGUAGES.ITALIAN]: "Italian"
    };
    return languageMap[languageValue] || "Italian";
  }

  /**
   * Update subscribed message (when user is subscribed)
   */
  updateSubscribedMessage(languageValue) {
    const languageName = this.getLanguageDisplayName(languageValue);
    if (this.elements.subscribeInfo) {
      this.elements.subscribeInfo.innerHTML = `You're receiving <b>3</b> hand picked <br/>${languageName} ↔ English phrase pairs a day.`;
    }
  }

  /**
   * Update unsubscribed message (when user is not subscribed)
   */
  updateUnsubscribedMessage(languageValue) {
    const languageName = this.getLanguageDisplayName(languageValue);
    if (this.elements.subscribeInfo) {
      this.elements.subscribeInfo.innerHTML = `Once subscribed, you'll receive <br/><b>3 notifications a day</b> with hand picked <br/><span id="language-name">${languageName}</span> ↔ English phrase pairs.`;
    }
  }

  /**
   * Initialize service worker
   */
  async readyServiceWorker() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      this.setButtonState("unsupported");
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
    const response = await fetch(this.CONSTANTS.ENDPOINTS.VAPID_KEY);
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
   * Check if subscription exists on server
   */
  async checkSubscriptionOnServer(endpoint) {
    try {
      const queryParams = new URLSearchParams({ endpoint });
      const response = await fetch(`${this.CONSTANTS.ENDPOINTS.SUBSCRIBE_EXISTS}?${queryParams}`);
      const data = await response.json();
      return !!data.exists;
    } catch (error) {
      console.error("Error checking subscription:", error);
      return false;
    }
  }

  /**
   * Get subscription status and preferences
   */
  async getSubscriptionStatus(subscription) {
    if (!subscription) {
      return { existsOnServer: false, savedLanguage: null };
    }

    const existsOnServer = await this.checkSubscriptionOnServer(subscription.endpoint);
    let savedLanguage = null;

    if (existsOnServer) {
      savedLanguage = await this.getSavedLanguage(subscription.endpoint);
    }

    return { existsOnServer, savedLanguage };
  }

  /**
   * Sync button state with actual subscription status
   */
  async syncButton() {
    this.setButtonState("loading");

    const serviceWorker = await this.readyServiceWorker();
    if (!serviceWorker) return;

    const subscription = await serviceWorker.pushManager.getSubscription();
    const { existsOnServer, savedLanguage } = await this.getSubscriptionStatus(subscription);

    const isSubscribed = subscription && existsOnServer;
    this.setButtonState(isSubscribed ? "sub" : "unsub");
    this.updateUI(isSubscribed, savedLanguage, this.elements.languageSelect);

    return { subscription, existsOnServer, savedLanguage };
  }

  /**
   * Get saved language preference from server
   */
  async getSavedLanguage(endpoint) {
    try {
      const adminKeyResponse = await fetch(this.CONSTANTS.ENDPOINTS.ADMIN_KEY);
      const adminKey = await adminKeyResponse.text();

      const response = await fetch(this.CONSTANTS.ENDPOINTS.ADMIN_SUBS, {
        headers: { 'X-Admin-Key': adminKey }
      });

      if (response.ok) {
        const adminData = await response.json();
        const userSub = adminData.rows.find(row => {
          const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
          return data.endpoint === endpoint && !row.deactivated;
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
      await fetch(this.CONSTANTS.ENDPOINTS.SUBSCRIBE, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint })
      });
      // Hide last notification when unsubscribed
      this.hideLastNotification();
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

      await fetch(this.CONSTANTS.ENDPOINTS.SUBSCRIBE, {
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
    const sendState = this.elements.sendNowButton.querySelector('.send-state');
    const sendingState = this.elements.sendNowButton.querySelector('.sending-state');
    const sentState = this.elements.sendNowButton.querySelector('.sent-state');
    const failedState = this.elements.sendNowButton.querySelector('.failed-state');
    const cooldownState = this.elements.sendNowButton.querySelector('.cooldown-state');

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
        this.elements.sendNowButton.disabled = false;
        break;
      case 'sending':
        sendingState.style.display = 'flex';
        this.elements.sendNowButton.disabled = true;
        break;
      case 'sent':
        sentState.style.display = 'flex';
        this.elements.sendNowButton.disabled = true;
        break;
      case 'failed':
        failedState.style.display = 'flex';
        this.elements.sendNowButton.disabled = true;
        break;
      case 'cooldown':
        if (cooldownState) {
          cooldownState.style.display = 'flex';
        }
        this.elements.sendNowButton.disabled = true;
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

      const adminKeyResponse = await fetch(this.CONSTANTS.ENDPOINTS.ADMIN_KEY);
      const adminKey = await adminKeyResponse.text();

      const response = await fetch(this.CONSTANTS.ENDPOINTS.ADMIN_SEND_NOW, {
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

        // Start cooldown with countdown
        this.saveCooldownToCache(this.CONSTANTS.COOLDOWN_DURATION);
        this.startCooldown(this.CONSTANTS.COOLDOWN_DURATION);
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
    const sendState = this.elements.sendNowButton.querySelector('.cooldown-state .text');
    if (sendState) {
      sendState.textContent = ` Wait ${seconds}s`;
    }
  }

  /**
   * Initialize chicken popover
   */
  initializeChickenPopover() {
    if (this.elements.chickenBtn) {
      const popoverContent = `
        <h3>Daily Language Pairs</h3>
        <p>Subscribing will send you a push notification 3 x times a day with a language pair of your choice.</p>
      `;

      new Popover(this.elements.chickenBtn, popoverContent, {
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

      const response = await fetch(`${this.CONSTANTS.ENDPOINTS.LAST_NOTIFICATION}?endpoint=${encodeURIComponent(subscription.endpoint)}`);
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
    if (this.elements.lastNotificationOriginal && this.elements.lastNotificationEnglish) {
      this.elements.lastNotificationOriginal.textContent = original;
      this.elements.lastNotificationEnglish.textContent = english;
      this.elements.lastNotification.style.display = 'flex';
    }
  }

  /**
   * Hide last notification
   */
  hideLastNotification() {
    if (this.elements.lastNotification) {
      this.elements.lastNotification.style.display = 'none';
    }
  }

  /**
   * Setup live reload for development
   */
  setupLiveReload() {
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      const eventSource = new EventSource(this.CONSTANTS.ENDPOINTS.LIVE_RELOAD);
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