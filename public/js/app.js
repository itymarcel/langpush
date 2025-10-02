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
        SUBSCRIBE_DIFFICULTY: '/subscribe/difficulty',
        SUBSCRIBE_LANGUAGE: '/subscribe/language',
        ADMIN_SUBS: '/admin/subs',
        ADMIN_SEND_NOW: '/admin/send-now',
        LAST_NOTIFICATION: '/last-notification',
        NOTIFICATIONS: '/notifications',
        LIVE_RELOAD: '/live-reload'
      },
      SELECTORS: {
        SUB_BUTTON: 'sub',
        SEND_NOW_BUTTON: 'sendNow',
        LANGUAGE_SELECT: 'language-select',
        DIFFICULTY_SELECT: 'difficulty-select',
        LANGUAGE_CONTAINER: 'language-container',
        DIFFICULTY_CONTAINER: 'difficulty-container',
        SUBSCRIBE_INFO: 'subscribe-info',
        CHICKEN_BTN: 'chickenBtn',
        LAST_NOTIFICATION: '.last-notification',
        LAST_NOTIFICATION_ORIGINAL: '.last-notification .original .actual-text',
        LAST_NOTIFICATION_ENGLISH: '.last-notification .english',
        LAST_NOTIFICATION_REFRESH_BTN: 'refreshLastBtn',
        HISTORY_BTN: 'historyBtn',
      },
      LANGUAGES: {
        ITALIAN: 'italian',
        SPANISH: 'spanish',
        FRENCH: 'french',
        JAPANESE: 'japanese'
      },
      COOLDOWN_DURATION: 3,
    };

    // Cache DOM elements
    this.elements = {
      subButton: document.getElementById(this.CONSTANTS.SELECTORS.SUB_BUTTON),
      sendNowButton: document.getElementById(this.CONSTANTS.SELECTORS.SEND_NOW_BUTTON),
      languageSelect: document.getElementById(this.CONSTANTS.SELECTORS.LANGUAGE_SELECT),
      difficultySelect: document.getElementById(this.CONSTANTS.SELECTORS.DIFFICULTY_SELECT),
      subscribeInfo: document.getElementById(this.CONSTANTS.SELECTORS.SUBSCRIBE_INFO),
      chickenBtn: document.getElementById(this.CONSTANTS.SELECTORS.CHICKEN_BTN),
      lastNotification: document.querySelector(this.CONSTANTS.SELECTORS.LAST_NOTIFICATION),
      lastNotificationOriginal: document.querySelector(this.CONSTANTS.SELECTORS.LAST_NOTIFICATION_ORIGINAL),
      lastNotificationEnglish: document.querySelector(this.CONSTANTS.SELECTORS.LAST_NOTIFICATION_ENGLISH),
      refreshLastBtn: document.getElementById(this.CONSTANTS.SELECTORS.LAST_NOTIFICATION_REFRESH_BTN),
      historyBtn: document.getElementById(this.CONSTANTS.SELECTORS.HISTORY_BTN)
    };

    // State
    this.reg = null; // service worker registration cache
    this.waitingForFreshNotification = false; // flag for "Get One Now" clicks

    // Initialize history module
    this.history = new NotificationHistory(this);

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
    this.checkForNotificationParameter();
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

    // Difficulty selection change
    this.elements.difficultySelect.addEventListener("change", (e) => {
      this.updateDifficultyDisplay(e.target.value);
    });

    // Refresh last notification button
    if (this.elements.refreshLastBtn) {
      this.elements.refreshLastBtn.addEventListener("click", () => this.handleRefreshLastNotification());
    }

    // History button
    if (this.elements.historyBtn) {
      this.elements.historyBtn.addEventListener("click", () => this.history.handleShowHistory());
    }

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

    // Service worker message listener for notification clicks
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'NOTIFICATION_CLICK' && event.data.sentAt) {
          this.handleNotificationNavigation(event.data.sentAt);
        }
      });
    }
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
        if (this.elements.historyBtn) this.elements.historyBtn.style.display = "flex";
        if (spinner) {
          spinner.style.visibility = "visible";
          spinner.style.opacity = "1";
        }
        this.updateSubscribedMessage(this.elements.languageSelect.value, this.elements.difficultySelect.value);
        break;

      case "unsub":
        if (subState) subState.style.display = 'flex';
        this.elements.subButton.disabled = false;
        this.elements.subButton.classList.remove("outline");
        this.elements.sendNowButton.style.display = "none";
        if (this.elements.historyBtn) this.elements.historyBtn.style.display = "none";
        if (spinner) {
          spinner.style.visibility = "hidden";
          spinner.style.opacity = "0";
        }
        this.updateUnsubscribedMessage(this.elements.languageSelect.value, this.elements.difficultySelect.value);
        break;

      case "unsupported":
        if (unsupportedState) unsupportedState.style.display = 'flex';
        this.elements.subButton.disabled = true;
        this.elements.subButton.classList.remove("outline");
        this.elements.sendNowButton.style.display = "none";
        if (this.elements.historyBtn) this.elements.historyBtn.style.display = "none";
        if (spinner) {
          spinner.style.visibility = "hidden";
          spinner.style.opacity = "0";
        }
        this.elements.subscribeInfo.style.display = "none";
        break;

      default: // loading
        if (loadingState) loadingState.style.display = 'flex';
        this.elements.subButton.disabled = true;
        this.elements.subButton.classList.remove("outline");
        this.elements.sendNowButton.style.display = "none";
        if (this.elements.historyBtn) this.elements.historyBtn.style.display = "none";
        if (spinner) {
          spinner.style.visibility = "hidden";
          spinner.style.opacity = "0";
        }
        this.elements.subscribeInfo.style.display = "none";
        break;
    }

    lucide.createIcons();
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
  updateSubscribedMessage(languageValue, difficultyValue = 'easy') {
    const languageName = this.getLanguageDisplayName(languageValue);
    const difficultyName = difficultyValue === 'medium' ? 'medium' : 'easy';

    // Hide unsubscribed message and show subscribed message
    const subscribedMessage = document.getElementById('subscribed-message');
    const unsubscribedMessage = document.getElementById('unsubscribed-message');
    const subscribedLanguage = document.getElementById('subscribed-language');
    const subscribedDifficulty = document.getElementById('subscribed-difficulty');

    if (subscribedMessage && unsubscribedMessage) {
      unsubscribedMessage.style.display = 'none';
      subscribedMessage.style.display = 'block';

      if (subscribedLanguage) subscribedLanguage.textContent = languageName;
      if (subscribedDifficulty) subscribedDifficulty.textContent = difficultyName;
    }

    if (this.elements.subscribeInfo) {
      this.elements.subscribeInfo.style.display = 'block';
    }
  }

  /**
   * Update unsubscribed message (when user is not subscribed)
   */
  updateUnsubscribedMessage(languageValue, difficultyValue = 'easy') {
    const languageName = this.getLanguageDisplayName(languageValue);
    const difficultyName = difficultyValue === 'medium' ? 'medium' : 'easy';

    // Hide subscribed message and show unsubscribed message
    const subscribedMessage = document.getElementById('subscribed-message');
    const unsubscribedMessage = document.getElementById('unsubscribed-message');
    const unsubscribedLanguage = document.getElementById('unsubscribed-language');
    const unsubscribedDifficulty = document.getElementById('unsubscribed-difficulty');

    if (subscribedMessage && unsubscribedMessage) {
      subscribedMessage.style.display = 'none';
      unsubscribedMessage.style.display = 'block';

      if (unsubscribedLanguage) unsubscribedLanguage.textContent = languageName;
      if (unsubscribedDifficulty) unsubscribedDifficulty.textContent = difficultyName;
    }

    if (this.elements.subscribeInfo) {
      this.elements.subscribeInfo.style.display = 'block';
    }
  }

  /**
   * Update language display when language changes
   */
  async updateLanguageDisplay(languageValue) {
    const difficultyValue = this.elements.difficultySelect.value;

    // Check if user is subscribed
    if (this.elements.subButton.classList.contains("outline")) {
      // User is subscribed - update language on server
      await this.updateSubscriptionLanguage(languageValue);
      // Update the subscribed message with new language
      this.updateSubscribedMessage(languageValue, difficultyValue);
    } else {
      // User is not subscribed - just update the message
      this.updateUnsubscribedMessage(languageValue, difficultyValue);
    }
  }

  /**
   * Update difficulty display when difficulty changes
   */
  async updateDifficultyDisplay(difficultyValue) {
    const languageValue = this.elements.languageSelect.value;

    // Check if user is subscribed
    if (this.elements.subButton.classList.contains("outline")) {
      // User is subscribed - update difficulty on server
      await this.updateSubscriptionDifficulty(difficultyValue);
      // Update the subscribed message with new difficulty
      this.updateSubscribedMessage(languageValue, difficultyValue);
    } else {
      // User is not subscribed - just update the message
      this.updateUnsubscribedMessage(languageValue, difficultyValue);
    }
  }

  /**
   * Show difficulty loading state
   */
  showDifficultyLoading(show = true) {
    const loadingElement = document.querySelector('.difficulty-loading');
    if (loadingElement) {
      loadingElement.style.display = show ? 'block' : 'none';
    }

    // Disable the difficulty select while loading
    this.elements.difficultySelect.disabled = show;
  }

  /**
   * Update subscription difficulty on server
   */
  async updateSubscriptionDifficulty(difficulty) {
    this.showDifficultyLoading(true);

    try {
      const serviceWorker = await this.readyServiceWorker();
      if (!serviceWorker) return;

      const subscription = await serviceWorker.pushManager.getSubscription();
      if (!subscription) return;

      const response = await fetch(this.CONSTANTS.ENDPOINTS.SUBSCRIBE_DIFFICULTY, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          difficulty: difficulty
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to update difficulty: ${response.status}`);
      }

      console.log(`Difficulty updated to: ${difficulty}`);
    } catch (error) {
      console.error("Failed to update difficulty:", error);
      alert("Failed to update difficulty setting. Please try again.");
    } finally {
      this.showDifficultyLoading(false);
    }
  }

  /**
   * Show language loading state
   */
  showLanguageLoading(show = true) {
    const loadingElement = document.querySelector('.language-loading');
    if (loadingElement) {
      loadingElement.style.display = show ? 'block' : 'none';
    }

    // Disable the language select while loading
    this.elements.languageSelect.disabled = show;
  }

  /**
   * Update subscription language on server
   */
  async updateSubscriptionLanguage(language) {
    this.showLanguageLoading(true);

    try {
      const serviceWorker = await this.readyServiceWorker();
      if (!serviceWorker) return;

      const subscription = await serviceWorker.pushManager.getSubscription();
      if (!subscription) return;

      const response = await fetch(this.CONSTANTS.ENDPOINTS.SUBSCRIBE_LANGUAGE, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          language: language
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to update language: ${response.status}`);
      }

      console.log(`Language updated to: ${language}`);
    } catch (error) {
      console.error("Failed to update language:", error);
      alert("Failed to update language setting. Please try again.");
    } finally {
      this.showLanguageLoading(false);
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
      return { existsOnServer: false, savedLanguage: null, savedDifficulty: null };
    }

    const existsOnServer = await this.checkSubscriptionOnServer(subscription.endpoint);
    let savedLanguage = null;
    let savedDifficulty = null;

    if (existsOnServer) {
      const savedPrefs = await this.getSavedPreferences(subscription.endpoint);
      savedLanguage = savedPrefs.language;
      savedDifficulty = savedPrefs.difficulty;
    }

    return { existsOnServer, savedLanguage, savedDifficulty };
  }

  /**
   * Sync button state with actual subscription status
   */
  async syncButton() {
    this.setButtonState("loading");

    const serviceWorker = await this.readyServiceWorker();
    if (!serviceWorker) return;

    const subscription = await serviceWorker.pushManager.getSubscription();
    const { existsOnServer, savedLanguage, savedDifficulty } = await this.getSubscriptionStatus(subscription);

    const isSubscribed = subscription && existsOnServer;
    this.setButtonState(isSubscribed ? "sub" : "unsub");
    this.updateUI(isSubscribed, savedLanguage, savedDifficulty, this.elements.languageSelect, this.elements.difficultySelect);

    return { subscription, existsOnServer, savedLanguage, savedDifficulty };
  }

  /**
   * Get saved preferences (language and difficulty) from server
   */
  async getSavedPreferences(endpoint) {
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
          return {
            language: data.language || 'italian',
            difficulty: userSub.difficulty || 'easy'
          };
        }
      }
    } catch (error) {
      console.error("Error fetching saved preferences:", error);
    }

    return { language: null, difficulty: null };
  }

  /**
   * Update UI based on subscription status
   */
  updateUI(isSubscribed, savedLanguage, savedDifficulty, languageSelect, difficultySelect) {
    const languageLabel = document.querySelector('#language-container label');
    const difficultyLabel = document.querySelector('#difficulty-container label');

    // Update language selection
    if (savedLanguage) {
      languageSelect.value = savedLanguage;
    }

    // Update difficulty selection
    if (savedDifficulty) {
      difficultySelect.value = savedDifficulty;
    }

    // Enable/disable selectors - allow both language and difficulty changes for subscribed users
    // Only disable language if currently loading
    const isLoadingLanguage = document.querySelector('.language-loading')?.style.display === 'block';
    languageSelect.disabled = isLoadingLanguage;
    // Only disable difficulty if currently loading
    const isLoadingDifficulty = document.querySelector('.difficulty-loading')?.style.display === 'block';
    difficultySelect.disabled = isLoadingDifficulty;

    // Update label text
    if (languageLabel) {
      languageLabel.textContent = isSubscribed ? "You are subscribed to" : "Choose language";
    }
    if (difficultyLabel) {
      difficultyLabel.textContent = isSubscribed ? "Difficulty level" : "Choose difficulty";
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

      // Get selected language and difficulty
      const languageSelect = document.getElementById("language-select");
      const difficultySelect = document.getElementById("difficulty-select");
      const selectedLanguage = languageSelect.value;
      const selectedDifficulty = difficultySelect.value;

      // Send subscription to server with language and difficulty preferences
      const subscriptionData = {
        ...newSubscription.toJSON(),
        language: selectedLanguage,
        difficulty: selectedDifficulty
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

        // Set flag to show reveal mechanism for the incoming notification
        this.waitingForFreshNotification = true;

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
   * Handle refresh last notification button click
   */
  async handleRefreshLastNotification() {
    if (this.elements.refreshLastBtn) {
      // Add loading state to the refresh button
      const icon = this.elements.refreshLastBtn.querySelector('i');
      if (icon) {
        icon.classList.add('rotating');
      }
      this.elements.refreshLastBtn.disabled = true;
    }

    try {
      await this.loadLastNotification();
    } finally {
      // Remove loading state
      if (this.elements.refreshLastBtn) {
        const icon = this.elements.refreshLastBtn.querySelector('i');
        if (icon) {
          icon.classList.remove('rotating');
        }
        this.elements.refreshLastBtn.disabled = false;
      }
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
      const originalContainer = document.querySelector('.last-notification .original');
      const revealText = originalContainer.querySelector('.reveal-text');
      const actualText = originalContainer.querySelector('.actual-text');

      this.elements.lastNotificationOriginal.textContent = original;
      this.elements.lastNotificationEnglish.textContent = english;

      // Check if this is a fresh notification from "Get One Now"
      if (this.waitingForFreshNotification) {
        // Add unrevealed class and show "Reveal" text
        originalContainer.classList.add('unrevealed');
        originalContainer.classList.remove('revealed');
        revealText.style.display = 'block';
        actualText.style.display = 'none';

        // Add click handler to reveal the text
        const revealHandler = () => {
          originalContainer.classList.remove('unrevealed');
          originalContainer.classList.add('revealed');
          revealText.style.display = 'none';
          actualText.style.display = 'block';
          originalContainer.removeEventListener('click', revealHandler);
        };

        originalContainer.addEventListener('click', revealHandler);

        // Reset the flag
        this.waitingForFreshNotification = false;
      } else {
        // Show text normally for existing notifications
        originalContainer.classList.remove('unrevealed');
        originalContainer.classList.add('revealed');
        revealText.style.display = 'none';
        actualText.style.display = 'block';
      }

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

  /**
   * Check for notification parameter in URL on page load
   */
  checkForNotificationParameter() {
    const urlParams = new URLSearchParams(window.location.search);
    const notificationTimestamp = urlParams.get('notification');

    if (notificationTimestamp) {
      // Clear the URL parameter
      window.history.replaceState({}, document.title, window.location.pathname);

      // Handle the notification navigation
      this.handleNotificationNavigation(notificationTimestamp);
    }
  }

  /**
   * Handle navigation from notification click
   */
  async handleNotificationNavigation(sentAtTimestamp) {
    try {
      // Wait a moment for the app to fully load
      await new Promise(resolve => setTimeout(resolve, 500));

      // Open history and highlight the specific notification
      await this.history.handleShowHistory();

      // Wait for history to open, then highlight
      setTimeout(() => {
        this.history.highlightNotification(sentAtTimestamp);
      }, 300);

    } catch (error) {
      console.error('Failed to navigate to notification:', error);
    }
  }
}

// Initialize the application when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new LinguaPush();
});

// Global function for copying link (called from onclick in HTML)
function copyLink() {
  navigator.clipboard.writeText(window.location.href)
    .then(() => alert("Link copied! Please paste into Safari."))
    .catch(() => alert("Could not copy. Long-press the address bar and copy manually."));
}