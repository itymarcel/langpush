/**
 * Notification Handler Module
 * Handles notification click events, focus detection, and app navigation
 */

class NotificationHandler {
  constructor(app) {
    this.app = app;
    this.pendingNotificationTimestamp = null;
    this.isAppVisible = document.visibilityState === 'visible';
    this.isAppFocused = document.hasFocus();
    this.notificationChannel = null;

    this.setupMessageListeners();
    this.setupFocusDetection();
  }

  /**
   * Setup service worker and broadcast channel message listeners
   */
  setupMessageListeners() {
    // Service worker message listener for notification clicks
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('App: Received SW message:', event.data);
        if (event.data.type === 'NOTIFICATION_CLICK' && event.data.sentAt) {
          console.log('App: Processing notification click for timestamp:', event.data.sentAt);
          this.handleNotificationNavigation(event.data.sentAt);
        }
      });
    }

    // BroadcastChannel listener for notification clicks (more reliable for background apps)
    if ('BroadcastChannel' in window) {
      this.notificationChannel = new BroadcastChannel('notification-click');
      this.notificationChannel.addEventListener('message', (event) => {
        console.log('App: Received broadcast message:', event.data);
        if (event.data.type === 'NOTIFICATION_CLICK' && event.data.sentAt) {
          console.log('App: Processing notification click via broadcast for timestamp:', event.data.sentAt);

          // If app is currently visible and focused, handle immediately
          if (document.visibilityState === 'visible' && document.hasFocus()) {
            this.handleNotificationNavigation(event.data.sentAt);
          } else {
            // Store the pending navigation for when app becomes visible/focused
            this.pendingNotificationTimestamp = event.data.sentAt;
          }
        }
      });
    }
  }

  /**
   * Setup enhanced focus detection using multiple methods
   */
  setupFocusDetection() {
    // Method 1: Visibility API
    document.addEventListener('visibilitychange', () => {
      const wasVisible = this.isAppVisible;
      this.isAppVisible = document.visibilityState === 'visible';

      console.log('App: Visibility changed to:', document.visibilityState);

      if (!wasVisible && this.isAppVisible) {
        // Small delay to allow notification tap handler to set pending timestamp
        setTimeout(() => {
          // Handle pending notification if exists
          if (this.pendingNotificationTimestamp) {
            console.log('App: App became visible with pending notification');
            // Only handle if not already being handled
            if (this.pendingNotificationTimestamp !== 'handling') {
              const timestamp = this.pendingNotificationTimestamp;
              this.pendingNotificationTimestamp = 'handling'; // Mark as being handled
              this.handleNotificationNavigation(timestamp);
            }
          } else {
            // Only refresh latest notification if no pending navigation
            console.log('App: App became visible, refreshing last notification');
            this.app.sendNowManager.loadLastNotification();
          }
        }, 150);
      }
    }, false);

    // Method 2: Window focus/blur events
    window.addEventListener('focus', () => {
      const wasFocused = this.isAppFocused;
      this.isAppFocused = true;

      console.log('App: Window focus gained');

      if (!wasFocused) {
        setTimeout(() => {
          if (this.pendingNotificationTimestamp && this.pendingNotificationTimestamp !== 'handling') {
            console.log('App: App gained focus with pending notification');
            const timestamp = this.pendingNotificationTimestamp;
            this.pendingNotificationTimestamp = 'handling';
            this.handleNotificationNavigation(timestamp);
          }
        }, 150);
      }
    }, false);

    window.addEventListener('blur', () => {
      this.isAppFocused = false;
      console.log('App: Window focus lost');
    }, false);

    // Method 3: Page show event (for when page comes back from bfcache)
    window.addEventListener('pageshow', (event) => {
      console.log('App: Page show event, persisted:', event.persisted);

      setTimeout(() => {
        if (this.pendingNotificationTimestamp && this.pendingNotificationTimestamp !== 'handling') {
          console.log('App: Page show with pending notification');
          const timestamp = this.pendingNotificationTimestamp;
          this.pendingNotificationTimestamp = 'handling';
          this.handleNotificationNavigation(timestamp);
        }
      }, 150);
    }, false);
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
    console.log('App: handleNotificationNavigation called with:', sentAtTimestamp);
    try {
      // First, refresh the last notification display to ensure it's up to date
      console.log('App: Refreshing last notification before opening history...');
      await this.app.sendNowManager.loadLastNotification();

      // Small delay to ensure DOM has updated with new notification text
      await new Promise(resolve => setTimeout(resolve, 200));
      console.log('App: Notification loaded and UI updated');

      console.log('App: Opening history...');
      // Open history and wait for it to be fully loaded with animations complete
      await this.app.history.handleShowHistory();

      console.log('App: History loaded, highlighting notification...');
      // Now highlight the notification immediately since history is ready
      this.app.history.highlightNotification(sentAtTimestamp);

      // Clear the pending notification after successful navigation
      this.pendingNotificationTimestamp = null;
      console.log('App: Navigation completed, cleared pending notification');

    } catch (error) {
      console.error('Failed to navigate to notification:', error);
      // Clear pending notification even on error
      this.pendingNotificationTimestamp = null;
    }
  }
}