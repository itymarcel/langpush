/**
 * Preferences Manager Module
 * Handles language and difficulty preference updates
 */

class PreferencesManager {
  constructor(app) {
    this.app = app;
  }

  /**
   * Update language display when language changes
   */
  async updateLanguageDisplay(languageValue) {
    const difficultyValue = this.app.elements.difficultySelect.value;

    // Check if user is subscribed
    if (this.app.elements.subButton.classList.contains("outline")) {
      // User is subscribed - update language on server
      await this.updateSubscriptionLanguage(languageValue);
      // Update the subscribed message with new language
      this.app.uiController.updateSubscribedMessage(languageValue, difficultyValue);
    } else {
      // User is not subscribed - just update the message
      this.app.uiController.updateUnsubscribedMessage(languageValue, difficultyValue);
    }
  }

  /**
   * Update difficulty display when difficulty changes
   */
  async updateDifficultyDisplay(difficultyValue) {
    const languageValue = this.app.elements.languageSelect.value;

    // Check if user is subscribed
    if (this.app.elements.subButton.classList.contains("outline")) {
      // User is subscribed - update difficulty on server
      await this.updateSubscriptionDifficulty(difficultyValue);
      // Update the subscribed message with new difficulty
      this.app.uiController.updateSubscribedMessage(languageValue, difficultyValue);
    } else {
      // User is not subscribed - just update the message
      this.app.uiController.updateUnsubscribedMessage(languageValue, difficultyValue);
    }
  }

  /**
   * Update subscription difficulty on server
   */
  async updateSubscriptionDifficulty(difficulty) {
    console.log('🔍 [PreferencesManager] Starting difficulty update:', difficulty);
    this.app.uiController.showDifficultyLoading(true);

    try {
      // Check if running on iOS Capacitor
      if (this.app.capacitorManager && this.app.capacitorManager.isCapacitor) {
        console.log('📱 [PreferencesManager] Using iOS Capacitor difficulty update');
        await this.app.capacitorManager.updateDifficulty(difficulty);
        console.log('✅ [PreferencesManager] iOS difficulty update successful');
        return;
      }

      // Web subscription logic
      console.log('🌐 [PreferencesManager] Using web subscription difficulty update');
      const serviceWorker = await this.app.subscriptionManager.readyServiceWorker();
      if (!serviceWorker) {
        console.error('❌ [PreferencesManager] No service worker available');
        return;
      }

      const subscription = await serviceWorker.pushManager.getSubscription();
      if (!subscription) {
        console.error('❌ [PreferencesManager] No subscription available');
        return;
      }

      console.log('📡 [PreferencesManager] Sending web difficulty update request');
      const response = await fetch(this.app.CONSTANTS.ENDPOINTS.SUBSCRIBE_DIFFICULTY, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          difficulty: difficulty
        })
      });

      console.log('📡 [PreferencesManager] Web difficulty response status:', response.status);
      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ [PreferencesManager] Web difficulty update failed:', errorData);
        throw new Error(`Failed to update difficulty: ${response.status}`);
      }

      console.log(`✅ [PreferencesManager] Web difficulty updated to: ${difficulty}`);
    } catch (error) {
      console.error("❌ [PreferencesManager] Failed to update difficulty:", error);
      alert("Failed to update difficulty setting. Please try again.");
    } finally {
      this.app.uiController.showDifficultyLoading(false);
    }
  }

  /**
   * Update subscription language on server
   */
  async updateSubscriptionLanguage(language) {
    console.log('🔍 [PreferencesManager] Starting language update:', language);
    this.app.uiController.showLanguageLoading(true);

    try {
      // Check if running on iOS Capacitor
      if (this.app.capacitorManager && this.app.capacitorManager.isCapacitor) {
        console.log('📱 [PreferencesManager] Using iOS Capacitor language update');
        await this.app.capacitorManager.updateLanguage(language);
        console.log('✅ [PreferencesManager] iOS language update successful');
        return;
      }

      // Web subscription logic
      console.log('🌐 [PreferencesManager] Using web subscription language update');
      const serviceWorker = await this.app.subscriptionManager.readyServiceWorker();
      if (!serviceWorker) {
        console.error('❌ [PreferencesManager] No service worker available');
        return;
      }

      const subscription = await serviceWorker.pushManager.getSubscription();
      if (!subscription) {
        console.error('❌ [PreferencesManager] No subscription available');
        return;
      }

      console.log('📡 [PreferencesManager] Sending web language update request');
      const response = await fetch(this.app.CONSTANTS.ENDPOINTS.SUBSCRIBE_LANGUAGE, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          language: language
        })
      });

      console.log('📡 [PreferencesManager] Web language response status:', response.status);
      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ [PreferencesManager] Web language update failed:', errorData);
        throw new Error(`Failed to update language: ${response.status}`);
      }

      console.log(`✅ [PreferencesManager] Web language updated to: ${language}`);
    } catch (error) {
      console.error("❌ [PreferencesManager] Failed to update language:", error);
      alert("Failed to update language setting. Please try again.");
    } finally {
      this.app.uiController.showLanguageLoading(false);
    }
  }
}