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

        // Initialize push notifications plugin
        const { PushNotifications } = Capacitor.Plugins;
        this.pushNotifications = PushNotifications;

        // Set up push notification listeners
        this.setupPushListeners();

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
      console.log('🎉 [Capacitor] REGISTRATION SUCCESS CALLBACK!');
      console.log('🔑 [Capacitor] Token received:', token.value);
      this.onRegistrationSuccess(token.value);
    });

    // Called when the push notification registration fails
    this.pushNotifications.addListener('registrationError', (error) => {
      console.error('❌ [Capacitor] REGISTRATION ERROR CALLBACK!');
      console.error('❌ [Capacitor] Error details:', JSON.stringify(error));
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
    console.log('🔍 [Capacitor] Starting requestPermissions()');

    if (!this.pushNotifications) {
      console.error('❌ [Capacitor] pushNotifications is null or undefined');
      throw new Error('Push notifications not available in iOS Simulator');
    }

    console.log('✅ [Capacitor] pushNotifications plugin available');
    console.log('🔍 [Capacitor] Checking current permissions...');

    let permStatus = await this.pushNotifications.checkPermissions();
    console.log('📋 [Capacitor] Current permission status:', JSON.stringify(permStatus));

    if (permStatus.receive === 'prompt') {
      console.log('🔔 [Capacitor] Requesting permissions from user...');
      permStatus = await this.pushNotifications.requestPermissions();
      console.log('📋 [Capacitor] Permission request result:', JSON.stringify(permStatus));
    } else {
      console.log('ℹ️ [Capacitor] No permission request needed, status:', permStatus.receive);
    }

    if (permStatus.receive !== 'granted') {
      console.error('❌ [Capacitor] Permissions denied, status:', permStatus.receive);
      throw new Error('Push notification permissions denied');
    }

    console.log('✅ [Capacitor] Permissions granted successfully');
    return permStatus;
  }

  async registerForPush() {
    console.log('🔍 [Capacitor] Starting registerForPush()');

    if (!this.pushNotifications) {
      console.error('❌ [Capacitor] pushNotifications not initialized');
      throw new Error('Capacitor not initialized');
    }

    console.log('📱 [Capacitor] Calling pushNotifications.register()...');
    await this.pushNotifications.register();
    console.log('✅ [Capacitor] Register call completed, waiting for callback...');

    // Set a timeout to catch if no callback is received
    setTimeout(() => {
      console.warn('⚠️ [Capacitor] No registration callback received after 10 seconds!');
      console.warn('⚠️ [Capacitor] This usually means APNs environment mismatch or network issues');
    }, 10000);
  }

  async onRegistrationSuccess(deviceToken) {
    console.log('🎉 [Capacitor] Registration success callback triggered!');
    console.log('🔑 [Capacitor] Device token received:', deviceToken);

    try {
      // Get current language and difficulty from UI
      const language = this.app.elements.languageSelect.value;
      const difficulty = this.app.elements.difficultySelect.value;
      console.log('🌍 [Capacitor] Selected language:', language, 'difficulty:', difficulty);

      console.log('🌐 [Capacitor] Sending registration to server...');
      console.log('📡 [Capacitor] Endpoint:', this.app.CONSTANTS.ENDPOINTS.SUBSCRIBE_IOS);

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

      console.log('📡 [Capacitor] Server response status:', response.status);
      const data = await response.json();
      console.log('📡 [Capacitor] Server response data:', JSON.stringify(data));

      if (data.ok) {
        console.log('✅ [Capacitor] iOS device registered successfully');
        // Update UI to show subscribed state
        this.app.uiController.setButtonState('unsub');
        this.app.uiController.showSubscribeInfo();
      } else {
        console.error('❌ [Capacitor] Server registration failed:', data.error);
        throw new Error(data.error || 'Failed to register device');
      }
    } catch (error) {
      console.error('❌ [Capacitor] Failed to register device token:', error);
      this.app.uiController.setButtonState('sub');
    }
  }

  onRegistrationError(error) {
    console.error('❌ [Capacitor] Push registration failed:', error);
    console.error('❌ [Capacitor] Error details:', JSON.stringify(error));
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