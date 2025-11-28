/**
 * Development Tools Module
 * Provides UI state toggles and mock data for development
 */

class DevTools {
  constructor(app) {
    this.app = app;
    this.isDevMode = false;
    this.devPanel = null;

    this.setupKeyboardShortcut();
  }

  /**
   * Setup keyboard shortcut to toggle dev mode (Cmd/Ctrl + D)
   */
  setupKeyboardShortcut() {
    document.addEventListener('keydown', (e) => {
      // Cmd+D on Mac, Ctrl+D on Windows/Linux
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        this.toggleDevMode();
      }
    });
  }

  /**
   * Toggle dev mode on/off
   */
  toggleDevMode() {
    this.isDevMode = !this.isDevMode;

    if (this.isDevMode) {
      this.showDevPanel();
    } else {
      this.hideDevPanel();
    }
  }

  /**
   * Show the dev panel
   */
  showDevPanel() {
    // Remove existing panel if any
    if (this.devPanel) {
      this.devPanel.remove();
    }

    // Create dev panel
    this.devPanel = document.createElement('div');
    this.devPanel.className = 'dev-panel';
    this.devPanel.innerHTML = `
      <div class="dev-panel-header">
        <span>🛠️ Dev Tools</span>
        <button class="dev-close-btn">×</button>
      </div>
      <div class="dev-panel-content">
        <div class="dev-section">
          <h3>Subscription State</h3>
          <button class="dev-btn" id="devToggleSubscription">Toggle Subscription</button>
        </div>
        <div class="dev-section">
          <h3>Mock Data</h3>
          <button class="dev-btn" id="devShowNotification">Show Mock Notification</button>
          <button class="dev-btn" id="devShowNotificationUnrevealed">Show Unrevealed Notification</button>
          <button class="dev-btn" id="devShowHistory">Show Mock History</button>
        </div>
        <div class="dev-section">
          <h3>UI States</h3>
          <button class="dev-btn" id="devShowAll">Show All Elements</button>
          <button class="dev-btn" id="devHideAll">Hide All Elements</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.devPanel);
    this.attachDevPanelListeners();
  }

  /**
   * Hide the dev panel
   */
  hideDevPanel() {
    if (this.devPanel) {
      this.devPanel.remove();
      this.devPanel = null;
    }
  }

  /**
   * Attach event listeners to dev panel buttons
   */
  attachDevPanelListeners() {
    // Close button
    this.devPanel.querySelector('.dev-close-btn').addEventListener('click', () => {
      this.toggleDevMode();
    });

    // Toggle subscription
    document.getElementById('devToggleSubscription').addEventListener('click', () => {
      this.toggleSubscriptionState();
    });

    // Show mock notification
    document.getElementById('devShowNotification').addEventListener('click', () => {
      this.showMockNotification();
    });

    // Show mock notification (unrevealed)
    document.getElementById('devShowNotificationUnrevealed').addEventListener('click', () => {
      this.showMockNotificationUnrevealed();
    });

    // Show mock history
    document.getElementById('devShowHistory').addEventListener('click', () => {
      this.showMockHistory();
    });

    // Show all elements
    document.getElementById('devShowAll').addEventListener('click', () => {
      this.showAllElements();
    });

    // Hide all elements
    document.getElementById('devHideAll').addEventListener('click', () => {
      this.hideAllElements();
    });
  }

  /**
   * Toggle subscription state (visual only)
   */
  toggleSubscriptionState() {
    const subBtn = this.app.elements.subButton;
    const sendBtn = this.app.elements.sendNowButton;
    const historyBtn = this.app.elements.historyBtn;

    const subState = subBtn.querySelector('.sub-state');
    const unsubState = subBtn.querySelector('.unsub-state');

    // Toggle button states
    if (subState.style.display !== 'none') {
      // Currently showing subscribe button -> switch to unsubscribe
      subState.style.display = 'none';
      unsubState.style.display = 'flex';
      subBtn.classList.add('outline');
      sendBtn.style.display = 'flex';
      if (historyBtn) historyBtn.style.display = 'flex';
    } else {
      // Currently showing unsubscribe button -> switch to subscribe
      subState.style.display = 'flex';
      unsubState.style.display = 'none';
      subBtn.classList.remove('outline');
      sendBtn.style.display = 'none';
      if (historyBtn) historyBtn.style.display = 'none';
    }
  }

  /**
   * Show mock notification on main screen
   */
  showMockNotification() {
    const mockNotifications = {
      italian: {
        original: "Come stai this is a bit longer so we can see how it looks in two?",
        english: "How are you?",
        language: "italian"
      },
      spanish: {
        original: "¿Qué tal?",
        english: "How's it going?",
        language: "spanish"
      },
      french: {
        original: "Comment ça va ?",
        english: "How are you?",
        language: "french"
      },
      japanese: {
        original: "元気ですか？ (Genki desu ka?)",
        english: "How are you?",
        language: "japanese"
      }
    };

    const currentLanguage = this.app.elements.languageSelect.value;
    const notification = mockNotifications[currentLanguage];

    this.app.sendNowManager.displayLastNotification(
      notification.original,
      notification.english,
      notification.language,
      Date.now()
    );
  }

  /**
   * Show mock notification in unrevealed state (with reveal mechanism)
   */
  showMockNotificationUnrevealed() {
    const mockNotifications = {
      italian: {
        original: "Come stai this is a bit longer so we can see how it looks in two?",
        english: "How are you?",
        language: "italian"
      },
      spanish: {
        original: "¿Qué tal?",
        english: "How's it going?",
        language: "spanish"
      },
      french: {
        original: "Comment ça va ?",
        english: "How are you?",
        language: "french"
      },
      japanese: {
        original: "元気ですか？ (Genki desu ka?)",
        english: "How are you?",
        language: "japanese"
      }
    };

    const currentLanguage = this.app.elements.languageSelect.value;
    const notification = mockNotifications[currentLanguage];

    // Set the flag to trigger reveal mechanism
    this.app.sendNowManager.waitingForFreshNotification = true;

    this.app.sendNowManager.displayLastNotification(
      notification.original,
      notification.english,
      notification.language,
      Date.now()
    );
  }

  /**
   * Show mock history overlay
   */
  showMockHistory() {
    const mockHistoryData = [
      {
        phrase_original: "Buongiorno!",
        phrase_english: "Good morning!",
        language: "italian",
        difficulty: "easy",
        sent_at: new Date(Date.now() - 86400000).toISOString() // 1 day ago
      },
      {
        phrase_original: "Grazie mille!",
        phrase_english: "Thanks a lot!",
        language: "italian",
        difficulty: "easy",
        sent_at: new Date(Date.now() - 172800000).toISOString() // 2 days ago
      },
      {
        phrase_original: "Come ti chiami?",
        phrase_english: "What's your name?",
        language: "italian",
        difficulty: "easy",
        sent_at: new Date(Date.now() - 259200000).toISOString() // 3 days ago
      },
      {
        phrase_original: "Dove abiti?",
        phrase_english: "Where do you live?",
        language: "italian",
        difficulty: "medium",
        sent_at: new Date(Date.now() - 345600000).toISOString() // 4 days ago
      },
      {
        phrase_original: "Quanto costa?",
        phrase_english: "How much is it?",
        language: "italian",
        difficulty: "easy",
        sent_at: new Date(Date.now() - 432000000).toISOString() // 5 days ago
      }
    ];

    this.app.history.showHistoryOverlay(mockHistoryData);
  }

  /**
   * Show all UI elements for layout debugging
   */
  showAllElements() {
    // Show all major elements
    this.app.elements.sendNowButton.style.display = 'flex';
    if (this.app.elements.historyBtn) this.app.elements.historyBtn.style.display = 'flex';

    // Show notification
    this.showMockNotification();

    // Set to unsubscribed state
    const subState = this.app.elements.subButton.querySelector('.sub-state');
    const unsubState = this.app.elements.subButton.querySelector('.unsub-state');
    subState.style.display = 'none';
    unsubState.style.display = 'flex';
    this.app.elements.subButton.classList.add('outline');
  }

  /**
   * Hide all UI elements
   */
  hideAllElements() {
    this.app.elements.sendNowButton.style.display = 'none';
    if (this.app.elements.historyBtn) this.app.elements.historyBtn.style.display = 'none';
    this.app.sendNowManager.hideLastNotification();

    // Reset to subscribed state
    const subState = this.app.elements.subButton.querySelector('.sub-state');
    const unsubState = this.app.elements.subButton.querySelector('.unsub-state');
    subState.style.display = 'flex';
    unsubState.style.display = 'none';
    this.app.elements.subButton.classList.remove('outline');
  }
}
