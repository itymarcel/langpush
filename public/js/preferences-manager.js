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
    this.app.uiController.showDifficultyLoading(true);

    try {
      const serviceWorker = await this.app.subscriptionManager.readyServiceWorker();
      if (!serviceWorker) return;

      const subscription = await serviceWorker.pushManager.getSubscription();
      if (!subscription) return;

      const response = await fetch(this.app.CONSTANTS.ENDPOINTS.SUBSCRIBE_DIFFICULTY, {
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
      this.app.uiController.showDifficultyLoading(false);
    }
  }

  /**
   * Update subscription language on server
   */
  async updateSubscriptionLanguage(language) {
    this.app.uiController.showLanguageLoading(true);

    try {
      const serviceWorker = await this.app.subscriptionManager.readyServiceWorker();
      if (!serviceWorker) return;

      const subscription = await serviceWorker.pushManager.getSubscription();
      if (!subscription) return;

      const response = await fetch(this.app.CONSTANTS.ENDPOINTS.SUBSCRIBE_LANGUAGE, {
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
      this.app.uiController.showLanguageLoading(false);
    }
  }
}