/**
 * Subscription Management Module
 * Handles all subscription-related functionality
 */

class SubscriptionManager {
  constructor(app) {
    this.app = app;
    this.reg = null; // service worker registration cache
  }

  /**
   * Initialize service worker
   */
  async readyServiceWorker() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      this.app.uiController.setButtonState("unsupported");
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
    const response = await fetch(this.app.CONSTANTS.ENDPOINTS.VAPID_KEY);
    return (await response.text()).trim();
  }

  /**
   * Check if subscription exists on server
   */
  async checkSubscriptionOnServer(endpoint) {
    try {
      const queryParams = new URLSearchParams({ endpoint });
      const response = await fetch(`${this.app.CONSTANTS.ENDPOINTS.SUBSCRIBE_EXISTS}?${queryParams}`);
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
    this.app.uiController.setButtonState("loading");

    const serviceWorker = await this.readyServiceWorker();
    if (!serviceWorker) return;

    const subscription = await serviceWorker.pushManager.getSubscription();
    const { existsOnServer, savedLanguage, savedDifficulty } = await this.getSubscriptionStatus(subscription);

    const isSubscribed = subscription && existsOnServer;
    this.app.uiController.setButtonState(isSubscribed ? "sub" : "unsub");
    this.app.uiController.updateUI(isSubscribed, savedLanguage, savedDifficulty, this.app.elements.languageSelect, this.app.elements.difficultySelect);

    return { subscription, existsOnServer, savedLanguage, savedDifficulty };
  }

  /**
   * Get saved preferences (language and difficulty) from server
   */
  async getSavedPreferences(endpoint) {
    try {
      const adminKeyResponse = await fetch(this.app.CONSTANTS.ENDPOINTS.ADMIN_KEY);
      const adminKey = await adminKeyResponse.text();

      const response = await fetch(this.app.CONSTANTS.ENDPOINTS.ADMIN_SUBS, {
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
    this.app.uiController.setButtonState("loading");
    const endpoint = subscription.endpoint;

    try {
      await subscription.unsubscribe();
      await fetch(this.app.CONSTANTS.ENDPOINTS.SUBSCRIBE, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint })
      });
      // Hide last notification when unsubscribed
      this.app.sendNowManager.hideLastNotification();
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

    this.app.uiController.setButtonState("loading");

    try {
      // Request permission if needed
      if (Notification.permission !== "granted") {
        await Notification.requestPermission();
      }

      // Get VAPID key and create subscription
      const vapidKey = await this.getVapidKey();
      const newSubscription = await serviceWorker.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: Utils.base64ToUint8Array(vapidKey)
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

      await fetch(this.app.CONSTANTS.ENDPOINTS.SUBSCRIBE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscriptionData)
      });

      await this.syncButton();

    } catch (error) {
      console.error("Subscription failed:", error);
      this.app.uiController.setButtonState("unsub");
      alert("Subscription failed.");
    }
  }
}