/**
 * Capacitor Manager Module
 * Handles iOS native functionality and push notifications
 */

class CapacitorManager {
  constructor(app) {
    this.app = app;
    this.isCapacitor = window.Capacitor !== undefined;
    this.pushNotifications = null;
    this.registrationInProgress = false;

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

        // Clear notification badge when app opens
        this.clearNotificationBadge();

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

    if (this.registrationInProgress) {
      console.warn('⚠️ [Capacitor] Registration already in progress, skipping...');
      return;
    }

    this.registrationInProgress = true;

    // Add additional diagnostics
    console.log('🔍 [Capacitor] Capacitor info:', window.Capacitor?.getPlatform());
    console.log('🔍 [Capacitor] Plugin available:', !!this.pushNotifications);
    console.log('🔍 [Capacitor] Plugin methods:', Object.keys(this.pushNotifications || {}));

    console.log('📱 [Capacitor] Calling pushNotifications.register()...');

    try {
      const result = await this.pushNotifications.register();
      console.log('✅ [Capacitor] Register call completed, result:', result);
      console.log('✅ [Capacitor] Waiting for callback...');

      // Set a timeout to catch if no callback is received
      setTimeout(() => {
        if (this.registrationInProgress) {
          console.warn('⚠️ [Capacitor] No registration callback received after 10 seconds!');
          console.warn('⚠️ [Capacitor] This usually means APNs environment mismatch or network issues');
          console.warn('⚠️ [Capacitor] Checking if device is connected to internet...');
          console.warn('⚠️ [Capacitor] Platform:', window.Capacitor?.getPlatform());
          this.registrationInProgress = false;
        }
      }, 10000);
    } catch (error) {
      console.error('❌ [Capacitor] Registration failed with exception:', error);
      console.error('❌ [Capacitor] Error type:', typeof error);
      console.error('❌ [Capacitor] Error message:', error?.message);
      console.error('❌ [Capacitor] Error stack:', error?.stack);
      this.registrationInProgress = false;
      throw error;
    }
  }

  async onRegistrationSuccess(deviceToken) {
    console.log('🎉 [Capacitor] Registration success callback triggered!');
    console.log('🔑 [Capacitor] Device token received:', deviceToken);
    this.registrationInProgress = false;

    try {
      // Store device token in localStorage for future use
      localStorage.setItem('ios_device_token', deviceToken);
      console.log('💾 [Capacitor] Device token stored in localStorage');

      // Get current language and difficulty from UI
      const language = this.app.elements.languageSelect.value;
      const difficulty = this.app.elements.difficultySelect.value;
      console.log('🌍 [Capacitor] Selected language:', language, 'difficulty:', difficulty);

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
        // Update UI to show subscribed state
        this.app.uiController.setButtonState('sub');
      } else {
        throw new Error(data.error || 'Failed to register device');
      }
    } catch (error) {
      console.error('❌ [Capacitor] Failed to register device token:', error);
      this.app.uiController.setButtonState('unsub');
    }
  }

  onRegistrationError(error) {
    console.error('❌ [Capacitor] Push registration failed:', error);
    console.error('❌ [Capacitor] Error details:', JSON.stringify(error));
    this.registrationInProgress = false;
    this.app.uiController.setButtonState('sub');
  }

  onNotificationReceived(notification) {
    console.log('Notification received:', notification);
    // Handle background notification received
    // Refresh last notification display with retry logic for server processing
    this.app.sendNowManager.loadLastNotification(3); // Retry up to 3 times
  }

  onNotificationTapped(notification) {
    console.log('Notification tapped:', notification);

    // Clear notification badge when notification is tapped
    this.clearNotificationBadge();

    // Refresh last notification display first
    this.app.sendNowManager.loadLastNotification();

    // If the app was opened from a notification, show the history
    const data = notification.notification.data;
    if (data && data.sentAt) {
      // Use notification handler for consistent navigation
      this.app.notificationHandler.handleNotificationNavigation(data.sentAt);
    }
  }

  /**
   * Clear notification badge and delivered notifications
   */
  async clearNotificationBadge() {
    if (!this.pushNotifications) return;

    try {
      // Remove all delivered notifications from notification center
      await this.pushNotifications.removeAllDeliveredNotifications();
      console.log('📱 [Capacitor] Cleared notification badge and delivered notifications');
    } catch (error) {
      console.error('❌ [Capacitor] Failed to clear notification badge:', error);
    }
  }

  async checkExistingSubscription() {
    console.log('🔍 [Capacitor] Checking iOS subscription status...');

    try {
      if (!this.pushNotifications) {
        console.log('ℹ️ [Capacitor] No push notifications available');
        return { exists: false, language: null, difficulty: null };
      }

      // Get stored device token from localStorage
      const deviceToken = localStorage.getItem('ios_device_token');
      if (!deviceToken) {
        console.log('ℹ️ [Capacitor] No stored device token found');
        return { exists: false, language: null, difficulty: null };
      }

      console.log('🔍 [Capacitor] Checking subscription with stored device token');
      const response = await fetch(`${this.app.CONSTANTS.ENDPOINTS.SUBSCRIBE_IOS_EXISTS}?deviceToken=${encodeURIComponent(deviceToken)}`);
      const data = await response.json();

      console.log('📋 [Capacitor] Subscription check result:', data);

      if (data.exists) {
        return {
          exists: true,
          language: data.language || 'italian',
          difficulty: data.difficulty || 'easy'
        };
      } else {
        return { exists: false, language: null, difficulty: null };
      }
    } catch (error) {
      console.error('❌ [Capacitor] Error checking subscription:', error);
      return { exists: false, language: null, difficulty: null };
    }
  }

  async sendNow() {
    console.log('🔍 [Capacitor] Starting Send Now for iOS...');

    try {
      if (!this.pushNotifications) {
        console.error('❌ [Capacitor] pushNotifications not initialized');
        throw new Error('Capacitor not initialized');
      }

      const deviceToken = localStorage.getItem('ios_device_token');
      if (!deviceToken) {
        console.error('❌ [Capacitor] No device token available for Send Now');
        throw new Error('Device not registered');
      }

      console.log('🔍 [Capacitor] Using device token for Send Now');

      const adminKeyResponse = await fetch(this.app.CONSTANTS.ENDPOINTS.ADMIN_KEY);
      const adminKey = await adminKeyResponse.text();
      console.log('🔑 [Capacitor] Retrieved admin key for Send Now');

      console.log('📡 [Capacitor] Sending iOS Send Now request...');
      const response = await fetch(this.app.CONSTANTS.ENDPOINTS.ADMIN_SEND_NOW, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Key": adminKey
        },
        body: JSON.stringify({
          iosToken: deviceToken,
          appIsOpen: true  // Tell server not to send push since app is open
        })
      });

      console.log('📡 [Capacitor] Send Now response status:', response.status);
      if (response.ok) {
        const responseData = await response.json();
        console.log('📡 [Capacitor] Send Now response data:', responseData);
        console.log('✅ [Capacitor] Send Now successful');
        return true;
      } else {
        const errorData = await response.json();
        console.error('❌ [Capacitor] Send Now failed:', errorData);
        throw new Error(errorData.error || 'Failed to send notification');
      }
    } catch (error) {
      console.error('❌ [Capacitor] Send Now error:', error);
      throw error;
    }
  }

  async updateDifficulty(difficulty) {
    console.log('🔍 [Capacitor] Starting difficulty update for iOS:', difficulty);

    try {
      if (!this.pushNotifications) {
        console.error('❌ [Capacitor] pushNotifications not initialized');
        throw new Error('Capacitor not initialized');
      }

      const deviceToken = localStorage.getItem('ios_device_token');
      if (!deviceToken) {
        console.error('❌ [Capacitor] No device token available for difficulty update');
        throw new Error('Device not registered');
      }

      console.log('🔍 [Capacitor] Using device token for difficulty update');

      console.log('📡 [Capacitor] Sending iOS difficulty update request...');
      const response = await fetch(this.app.CONSTANTS.ENDPOINTS.SUBSCRIBE_DIFFICULTY, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          iosToken: deviceToken,
          difficulty: difficulty
        })
      });

      console.log('📡 [Capacitor] Difficulty update response status:', response.status);
      if (response.ok) {
        const responseData = await response.json();
        console.log('📡 [Capacitor] Difficulty update response data:', responseData);
        console.log('✅ [Capacitor] Difficulty updated successfully');
        return true;
      } else {
        const errorData = await response.json();
        console.error('❌ [Capacitor] Difficulty update failed:', errorData);
        throw new Error(errorData.error || 'Failed to update difficulty');
      }
    } catch (error) {
      console.error('❌ [Capacitor] Difficulty update error:', error);
      throw error;
    }
  }

  async updateLanguage(language) {
    console.log('🔍 [Capacitor] Starting language update for iOS:', language);

    try {
      if (!this.pushNotifications) {
        console.error('❌ [Capacitor] pushNotifications not initialized');
        throw new Error('Capacitor not initialized');
      }

      const deviceToken = localStorage.getItem('ios_device_token');
      if (!deviceToken) {
        console.error('❌ [Capacitor] No device token available for language update');
        throw new Error('Device not registered');
      }

      console.log('🔍 [Capacitor] Using device token for language update');

      console.log('📡 [Capacitor] Sending iOS language update request...');
      const response = await fetch(this.app.CONSTANTS.ENDPOINTS.SUBSCRIBE_LANGUAGE, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          iosToken: deviceToken,
          language: language
        })
      });

      console.log('📡 [Capacitor] Language update response status:', response.status);
      if (response.ok) {
        const responseData = await response.json();
        console.log('📡 [Capacitor] Language update response data:', responseData);
        console.log('✅ [Capacitor] Language updated successfully');
        return true;
      } else {
        const errorData = await response.json();
        console.error('❌ [Capacitor] Language update failed:', errorData);
        throw new Error(errorData.error || 'Failed to update language');
      }
    } catch (error) {
      console.error('❌ [Capacitor] Language update error:', error);
      throw error;
    }
  }

  async getLastNotification() {
    console.log('🔍 [Capacitor] Getting last notification for iOS...');

    try {
      const deviceToken = localStorage.getItem('ios_device_token');
      if (!deviceToken) {
        console.log('ℹ️ [Capacitor] No device token available for last notification');
        return { ok: false, hasNotification: false };
      }

      console.log('🔍 [Capacitor] Using device token for last notification');
      const response = await fetch(`${this.app.CONSTANTS.ENDPOINTS.LAST_NOTIFICATION}?iosToken=${encodeURIComponent(deviceToken)}`);
      const data = await response.json();

      console.log('📋 [Capacitor] Last notification response:', data);
      return data;
    } catch (error) {
      console.error('❌ [Capacitor] Error getting last notification:', error);
      return { ok: false, hasNotification: false };
    }
  }

  async unsubscribe() {
    console.log('🔍 [Capacitor] Starting iOS unsubscribe...');

    if (!this.pushNotifications) {
      throw new Error('Capacitor not initialized');
    }

    try {
      const deviceToken = localStorage.getItem('ios_device_token');
      if (!deviceToken) {
        console.log('ℹ️ [Capacitor] No device token to unsubscribe');
        return;
      }

      console.log('📡 [Capacitor] Sending unsubscribe request to server...');
      const response = await fetch(this.app.CONSTANTS.ENDPOINTS.SUBSCRIBE_IOS, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deviceToken: deviceToken
        })
      });

      console.log('📡 [Capacitor] Unsubscribe response status:', response.status);

      if (response.ok) {
        console.log('✅ [Capacitor] Successfully unsubscribed from server');
        // Clear stored device token
        localStorage.removeItem('ios_device_token');
        console.log('💾 [Capacitor] Device token removed from localStorage');
      } else {
        const errorData = await response.json();
        console.error('❌ [Capacitor] Unsubscribe failed:', errorData);
        throw new Error(errorData.error || 'Failed to unsubscribe');
      }
    } catch (error) {
      console.error('❌ [Capacitor] Unsubscribe error:', error);
      throw error;
    }
  }
}