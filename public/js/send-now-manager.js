/**
 * Send Now Manager Module
 * Handles "Get One Now" functionality, cooldowns, and last notification display
 */

class SendNowManager {
  constructor(app) {
    this.app = app;
    this.waitingForFreshNotification = false; // flag for "Get One Now" clicks
  }

  /**
   * Handle Send One Now button click
   */
  setSendButtonState(state) {
    const sendState = this.app.elements.sendNowButton.querySelector('.send-state');
    const sendingState = this.app.elements.sendNowButton.querySelector('.sending-state');
    const sentState = this.app.elements.sendNowButton.querySelector('.sent-state');
    const failedState = this.app.elements.sendNowButton.querySelector('.failed-state');
    const cooldownState = this.app.elements.sendNowButton.querySelector('.cooldown-state');

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
        this.app.elements.sendNowButton.disabled = false;
        break;
      case 'sending':
        sendingState.style.display = 'flex';
        this.app.elements.sendNowButton.disabled = true;
        break;
      case 'sent':
        sentState.style.display = 'flex';
        this.app.elements.sendNowButton.disabled = true;
        break;
      case 'failed':
        failedState.style.display = 'flex';
        this.app.elements.sendNowButton.disabled = true;
        break;
      case 'cooldown':
        if (cooldownState) {
          cooldownState.style.display = 'flex';
        }
        this.app.elements.sendNowButton.disabled = true;
        break;
    }
  }

  async handleSendNow() {
    this.setSendButtonState('sending');

    try {
      const serviceWorker = await this.app.subscriptionManager.readyServiceWorker();
      if (!serviceWorker) return;

      const subscription = await serviceWorker.pushManager.getSubscription();
      if (!subscription) return;

      const adminKeyResponse = await fetch(this.app.CONSTANTS.ENDPOINTS.ADMIN_KEY);
      const adminKey = await adminKeyResponse.text();

      const response = await fetch(this.app.CONSTANTS.ENDPOINTS.ADMIN_SEND_NOW, {
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
        this.saveCooldownToCache(this.app.CONSTANTS.COOLDOWN_DURATION);
        this.startCooldown(this.app.CONSTANTS.COOLDOWN_DURATION);
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
    const sendState = this.app.elements.sendNowButton.querySelector('.cooldown-state .text');
    if (sendState) {
      sendState.textContent = ` Wait ${seconds}s`;
    }
  }

  /**
   * Handle refresh last notification button click
   */
  async handleRefreshLastNotification() {
    if (this.app.elements.refreshLastBtn) {
      // Add loading state to the refresh button
      const icon = this.app.elements.refreshLastBtn.querySelector('i');
      if (icon) {
        icon.classList.add('rotating');
      }
      this.app.elements.refreshLastBtn.disabled = true;
    }

    try {
      await this.loadLastNotification();
    } finally {
      // Remove loading state
      if (this.app.elements.refreshLastBtn) {
        const icon = this.app.elements.refreshLastBtn.querySelector('i');
        if (icon) {
          icon.classList.remove('rotating');
        }
        this.app.elements.refreshLastBtn.disabled = false;
      }
    }
  }

  /**
   * Load and display last notification
   */
  async loadLastNotification() {
    try {
      const serviceWorker = await this.app.subscriptionManager.readyServiceWorker();
      if (!serviceWorker) return;

      const subscription = await serviceWorker.pushManager.getSubscription();
      if (!subscription) return;

      const response = await fetch(`${this.app.CONSTANTS.ENDPOINTS.LAST_NOTIFICATION}?endpoint=${encodeURIComponent(subscription.endpoint)}`);
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
    if (this.app.elements.lastNotificationOriginal && this.app.elements.lastNotificationEnglish) {
      const originalContainer = document.querySelector('.last-notification .original');
      const revealText = originalContainer.querySelector('.reveal-text');
      const actualText = originalContainer.querySelector('.actual-text');

      this.app.elements.lastNotificationOriginal.textContent = original;
      this.app.elements.lastNotificationEnglish.textContent = english;

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

      this.app.elements.lastNotification.style.display = 'flex';
    }
  }

  /**
   * Hide last notification
   */
  hideLastNotification() {
    if (this.app.elements.lastNotification) {
      this.app.elements.lastNotification.style.display = 'none';
    }
  }
}