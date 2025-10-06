/**
 * Capacitor Manager Module
 * Handles iOS native functionality and push notifications
 */

class CapacitorManager {
  constructor(app) {
    this.app = app;
    this.isCapacitor = window.Capacitor !== undefined;
    this.pushNotifications = null;

    if (this.isCapacitor) {
      this.initializeCapacitor();
    }
  }

  async initializeCapacitor() {
    try {
      // Simple check for Capacitor
      if (typeof window.Capacitor !== 'undefined') {
        console.log('✅ Capacitor detected');

        // For now, let's not try to access plugins immediately
        // We'll check them when needed
        console.log('✅ Capacitor initialized successfully');
      } else {
        console.log('⚠️ Capacitor not available - running in browser mode');
      }
    } catch (error) {
      console.error('❌ Failed to initialize Capacitor:', error);
    }
  }

  setupPushListeners() {
    if (!this.pushNotifications) return;

    // Called when the push notification registration is successful
    this.pushNotifications.addListener('registration', (token) => {
      console.log('Push registration success, token: ' + token.value);
      this.onRegistrationSuccess(token.value);
    });

    // Called when the push notification registration fails
    this.pushNotifications.addListener('registrationError', (error) => {
      console.error('Push registration error: ', error);
      this.onRegistrationError(error);
    });

    // Called when a push notification is received
    this.pushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push notification received: ', notification);
      this.onNotificationReceived(notification);
    });

    // Called when a push notification is tapped
    this.pushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('Push notification action performed: ', notification);
      this.onNotificationTapped(notification);
    });
  }

  async requestPermissions() {
    if (!this.pushNotifications) {
      throw new Error('Push notifications not available in iOS Simulator');
    }

    let permStatus = await this.pushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      permStatus = await this.pushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      throw new Error('Push notification permissions denied');
    }

    return permStatus;
  }

  async registerForPush() {
    if (!this.pushNotifications) {
      throw new Error('Capacitor not initialized');
    }

    await this.pushNotifications.register();
  }

  async onRegistrationSuccess(deviceToken) {
    try {
      // Get current language and difficulty from UI
      const language = this.app.elements.languageSelect.value;
      const difficulty = this.app.elements.difficultySelect.value;

      // Register the device token with our server
      const response = await fetch(this.app.CONSTANTS.ENDPOINTS.SUBSCRIBE_IOS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deviceToken: deviceToken,
          language: language,
          difficulty: difficulty
        })
      });

      const data = await response.json();

      if (data.ok) {
        console.log('iOS device registered successfully');
        // Update UI to show subscribed state
        this.app.uiController.setButtonState('unsub');
        this.app.uiController.showSubscribeInfo();
      } else {
        throw new Error(data.error || 'Failed to register device');
      }
    } catch (error) {
      console.error('Failed to register device token:', error);
      this.app.uiController.setButtonState('sub');
    }
  }

  onRegistrationError(error) {
    console.error('Push registration failed:', error);
    this.app.uiController.setButtonState('sub');
  }

  onNotificationReceived(notification) {
    console.log('Notification received:', notification);
    // Handle background notification received
    // Refresh last notification display
    this.app.sendNowManager.loadLastNotification();
  }

  onNotificationTapped(notification) {
    console.log('Notification tapped:', notification);

    // If the app was opened from a notification, show the history
    const data = notification.notification.data;
    if (data && data.sentAt) {
      // Open history and highlight the specific notification
      setTimeout(() => {
        this.app.history.handleShowHistory().then(() => {
          this.app.history.highlightNotification(data.sentAt);
        });
      }, 1000);
    }
  }

  async checkExistingSubscription() {
    // For development, let's just return false for now
    // This will show the Subscribe button instead of assuming subscribed
    console.log('Checking iOS subscription status...');
    return false;
  }

  async unsubscribe() {
    if (!this.pushNotifications) {
      throw new Error('Capacitor not initialized');
    }

    // For iOS, we need to get the current device token and remove it from server
    // Since we can't get the token directly, we'll rely on server-side cleanup
    // when push notifications fail

    // For now, we'll just remove permissions
    // Note: iOS doesn't allow programmatic unregistration from notifications
    console.log('iOS unsubscribe - permissions cannot be revoked programmatically');
    throw new Error('iOS notifications must be disabled in Settings app');
  }
}