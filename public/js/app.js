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

    // Initialize modules
    this.subscriptionManager = new SubscriptionManager(this);
    this.uiController = new UIController(this);
    this.preferencesManager = new PreferencesManager(this);
    this.notificationHandler = new NotificationHandler(this);
    this.sendNowManager = new SendNowManager(this);
    this.history = new NotificationHistory(this);

    this.init();
  }

  /**
   * Initialize the application
   */
  init() {
    this.setupEventListeners();
    this.subscriptionManager.syncButton();
    Utils.initializeIcons();
    Utils.setupLiveReload(this.CONSTANTS.ENDPOINTS.LIVE_RELOAD);
    Utils.initializeChickenPopover(this.elements.chickenBtn);
    this.sendNowManager.loadLastNotification();
    this.sendNowManager.checkCooldownOnLoad();
    this.notificationHandler.checkForNotificationParameter();
  }

  /**
   * Set up all event listeners
   */
  setupEventListeners() {
    // Main subscription button
    this.elements.subButton.addEventListener("click", () => this.subscriptionManager.handleSubscriptionToggle());

    // Send Now button
    this.elements.sendNowButton.addEventListener("click", () => this.sendNowManager.handleSendNow());

    // Language selection change
    this.elements.languageSelect.addEventListener("change", (e) => {
      this.preferencesManager.updateLanguageDisplay(e.target.value);
    });

    // Difficulty selection change
    this.elements.difficultySelect.addEventListener("change", (e) => {
      this.preferencesManager.updateDifficultyDisplay(e.target.value);
    });

    // Refresh last notification button
    if (this.elements.refreshLastBtn) {
      this.elements.refreshLastBtn.addEventListener("click", () => this.sendNowManager.handleRefreshLastNotification());
    }

    // History button
    if (this.elements.historyBtn) {
      this.elements.historyBtn.addEventListener("click", () => this.history.handleShowHistory());
    }

    // Icons initialization
    document.addEventListener('DOMContentLoaded', () => {
      Utils.initializeIcons();
    });
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