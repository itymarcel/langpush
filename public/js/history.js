/**
 * Notification History Module
 * Handles displaying and managing notification history
 */

class NotificationHistory {
  constructor(linguaPush) {
    this.app = linguaPush;
  }

  /**
   * Handle show history button click
   */
  async handleShowHistory() {
    try {
      const serviceWorker = await this.app.readyServiceWorker();
      if (!serviceWorker) return;

      const subscription = await serviceWorker.pushManager.getSubscription();
      if (!subscription) return;

      const response = await fetch(`${this.app.CONSTANTS.ENDPOINTS.NOTIFICATIONS}?endpoint=${encodeURIComponent(subscription.endpoint)}&limit=10`);
      const data = await response.json();

      if (data.ok) {
        this.showHistoryOverlay(data.notifications);
      } else {
        alert("Failed to load notification history.");
      }
    } catch (error) {
      console.error("Failed to load history:", error);
      alert("Failed to load notification history.");
    }
  }

  /**
   * Show history overlay with notifications
   */
  showHistoryOverlay(notifications) {
    // Remove existing overlay if any
    const existingOverlay = document.querySelector('.history-overlay');
    if (existingOverlay) {
      existingOverlay.remove();
    }

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'history-overlay';

    const modal = document.createElement('div');
    modal.className = 'history-modal';

    // Header
    const header = document.createElement('div');
    header.className = 'history-header';
    header.innerHTML = `
      <button class="close-btn" onclick="this.closest('.history-overlay').remove()">
        <i data-lucide="x" class="ios-icon"></i>
      </button>
    `;

    // Content
    const content = document.createElement('div');
    content.className = 'history-content';

    if (notifications.length === 0) {
      content.innerHTML = '<p class="no-history">No notification history found.</p>';
    } else {
      notifications.forEach(notification => {
        const item = document.createElement('div');
        item.className = 'history-item';

        const sentAt = new Date(notification.sent_at).toLocaleDateString();
        const difficultyLabel = notification.difficulty === 'medium' ? 'Med' : 'Easy';

        item.innerHTML = `
          <div class="history-item-content">
            <div class="history-border"></div>
            <div class="history-english">${notification.phrase_english}</div>
            <div class="history-original">${notification.phrase_original}</div>
            <div class="history-meta">
              <span class="history-language">${this.app.getLanguageDisplayName(notification.language)}</span>
              <span class="history-difficulty">${difficultyLabel}</span>
              <span class="history-date">${sentAt}</span>
            </div>
          </div>
        `;
        content.appendChild(item);
      });
    }

    modal.appendChild(header);
    modal.appendChild(content);
    overlay.appendChild(modal);

    // Add to DOM
    document.body.appendChild(overlay);

    // Initialize icons for the close button
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });
  }
}