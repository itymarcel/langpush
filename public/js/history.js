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

      const response = await fetch(`${this.app.CONSTANTS.ENDPOINTS.NOTIFICATIONS}?endpoint=${encodeURIComponent(subscription.endpoint)}&limit=5`);
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

    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.innerHTML = '<i data-lucide="x" class="ios-icon"></i>';
    closeBtn.addEventListener('click', () => this.closeHistoryWithAnimation());

    header.appendChild(closeBtn);

    // Content
    const content = document.createElement('div');
    content.className = 'history-content';

    if (notifications.length === 0) {
      const noHistory = document.createElement('p');
      noHistory.className = 'no-history';
      noHistory.textContent = 'No notification history found.';
      noHistory.style.animationDelay = '0ms';
      content.appendChild(noHistory);
    } else {
      // Create array of random delays for animation
      const delays = Array.from({ length: notifications.length }, (_, i) => i * 50);

      // Shuffle the delays array for random order
      for (let i = delays.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [delays[i], delays[j]] = [delays[j], delays[i]];
      }

      notifications.forEach((notification, index) => {
        const item = document.createElement('div');
        item.className = 'history-item';

        // Set randomized animation delay
        item.style.animationDelay = `${delays[index]}ms`;
        // Store the delay for reverse animation
        item.dataset.originalDelay = delays[index];
        // Store timestamp for highlighting
        item.dataset.sentAt = notification.sent_at;

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

    // Store reference for close animation
    this.currentOverlay = overlay;

    // Fade in background
    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
    });

    // Initialize icons for the close button
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.closeHistoryWithAnimation();
      }
    });
  }

  /**
   * Close history overlay with reverse animation
   */
  closeHistoryWithAnimation() {
    if (!this.currentOverlay) return;

    const overlay = this.currentOverlay;
    const historyItems = overlay.querySelectorAll('.history-item, .no-history');

    // Get original delays and create reverse order
    const itemsWithDelays = Array.from(historyItems).map(item => ({
      element: item,
      originalDelay: parseInt(item.dataset.originalDelay || '0')
    }));

    // Sort by original delay (highest first for reverse effect)
    itemsWithDelays.sort((a, b) => b.originalDelay - a.originalDelay);

    // Apply reverse animation with staggered timing
    itemsWithDelays.forEach((item, index) => {
      setTimeout(() => {
        item.element.style.animation = 'history-item-disappear 200ms cubic-bezier(0.420, 0.035, 0.000, 0.995) forwards';
      }, index * 20); // Faster close timing
    });

    // Fade out background after items start disappearing
    setTimeout(() => {
      overlay.style.opacity = '0';
    }, 100);

    // Remove overlay after all animations complete
    const totalAnimationTime = (itemsWithDelays.length * 30) + 300;
    setTimeout(() => {
      overlay.remove();
      this.currentOverlay = null;
    }, totalAnimationTime);
  }

  /**
   * Highlight a specific notification by timestamp
   */
  highlightNotification(sentAtTimestamp) {
    if (!this.currentOverlay) return;

    console.log('Looking for notification with timestamp:', sentAtTimestamp);

    // Get all history items to debug
    const allItems = this.currentOverlay.querySelectorAll('.history-item');
    console.log('Available timestamps:', Array.from(allItems).map(item => item.dataset.sentAt));

    const targetItem = this.currentOverlay.querySelector(`[data-sent-at="${sentAtTimestamp}"]`);
    if (!targetItem) {
      console.warn(`Notification with timestamp ${sentAtTimestamp} not found in current history`);

      // Try to find a close match (in case of timestamp format differences)
      const approximateMatch = Array.from(allItems).find(item => {
        const itemTimestamp = item.dataset.sentAt;
        // Check if timestamps are within 10 seconds of each other
        const timeDiff = Math.abs(new Date(itemTimestamp).getTime() - new Date(sentAtTimestamp).getTime());
        return timeDiff < 10000; // 10 seconds tolerance
      });

      if (approximateMatch) {
        console.log('Found approximate match, highlighting it');
        this.highlightItem(approximateMatch);
      }
      return;
    }

    console.log('Found exact match, highlighting');
    this.highlightItem(targetItem);
  }

  /**
   * Apply highlight effect to a specific item
   */
  highlightItem(targetItem) {
    // Add highlight class
    targetItem.classList.add('highlighted');

    // Scroll to the item if needed
    targetItem.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });

    // Pulse animation
    targetItem.style.animation = 'highlight-pulse 1.5s ease-in-out 3';

    // Remove highlight after animation
    setTimeout(() => {
      targetItem.classList.remove('highlighted');
      targetItem.style.animation = '';
    }, 4500);
  }
}