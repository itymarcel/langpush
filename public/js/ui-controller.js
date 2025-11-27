/**
 * UI Controller Module
 * Handles all UI state management and display logic
 */

class UIController {
  constructor(app) {
    this.app = app;
  }

  /**
   * Update button state and UI based on subscription status
   */
  setButtonState(state) {
    const spinner = document.querySelector(".spinner");

    // Get all button state elements
    const subState = this.app.elements.subButton.querySelector('.sub-state');
    const unsubState = this.app.elements.subButton.querySelector('.unsub-state');
    const loadingState = this.app.elements.subButton.querySelector('.loading-state');
    const unsupportedState = this.app.elements.subButton.querySelector('.unsupported-state');

    // Hide all states first
    [subState, unsubState, loadingState, unsupportedState].forEach(element => {
      if (element) element.style.display = 'none';
    });

    switch (state) {
      case "sub":
        if (unsubState) unsubState.style.display = 'flex';
        this.app.elements.subButton.disabled = false;
        this.app.elements.subButton.classList.add("outline");
        this.app.elements.sendNowButton.style.display = "flex";
        if (this.app.elements.historyBtn) this.app.elements.historyBtn.style.display = "flex";
        if (spinner) {
          spinner.style.visibility = "visible";
          spinner.style.opacity = "1";
        }
        this.updateSubscribedMessage(this.app.elements.languageSelect.value, this.app.elements.difficultySelect.value);
        break;

      case "unsub":
        if (subState) subState.style.display = 'flex';
        this.app.elements.subButton.disabled = false;
        this.app.elements.subButton.classList.remove("outline");
        this.app.elements.sendNowButton.style.display = "none";
        if (this.app.elements.historyBtn) this.app.elements.historyBtn.style.display = "none";
        if (spinner) {
          spinner.style.visibility = "hidden";
          spinner.style.opacity = "0";
        }
        this.updateUnsubscribedMessage(this.app.elements.languageSelect.value, this.app.elements.difficultySelect.value);
        break;

      case "unsupported":
        if (unsupportedState) unsupportedState.style.display = 'flex';
        this.app.elements.subButton.disabled = true;
        this.app.elements.subButton.classList.remove("outline");
        this.app.elements.sendNowButton.style.display = "none";
        if (this.app.elements.historyBtn) this.app.elements.historyBtn.style.display = "none";
        if (spinner) {
          spinner.style.visibility = "hidden";
          spinner.style.opacity = "0";
        }
        // this.app.elements.subscribeInfo.style.display = "none";
        break;

      default: // loading
        if (loadingState) loadingState.style.display = 'flex';
        this.app.elements.subButton.disabled = true;
        this.app.elements.subButton.classList.remove("outline");
        this.app.elements.sendNowButton.style.display = "none";
        if (this.app.elements.historyBtn) this.app.elements.historyBtn.style.display = "none";
        if (spinner) {
          spinner.style.visibility = "hidden";
          spinner.style.opacity = "0";
        }
        // this.app.elements.subscribeInfo.style.display = "none";
        break;
    }

    Utils.initializeIcons();
  }

  /**
   * Update subscribed message (when user is subscribed)
   */
  updateSubscribedMessage(languageValue, difficultyValue = 'easy') {
    const languageName = Utils.getLanguageDisplayName(languageValue);
    const difficultyName = difficultyValue === 'medium' ? 'medium' : 'easy';

    // Hide unsubscribed message and show subscribed message
    const subscribedMessage = document.getElementById('subscribed-message');
    const unsubscribedMessage = document.getElementById('unsubscribed-message');
    const subscribedLanguage = document.getElementById('subscribed-language');
    const subscribedDifficulty = document.getElementById('subscribed-difficulty');

    if (subscribedMessage && unsubscribedMessage) {
      unsubscribedMessage.style.display = 'none';
      subscribedMessage.style.display = 'block';

      if (subscribedLanguage) subscribedLanguage.textContent = languageName;
      if (subscribedDifficulty) subscribedDifficulty.textContent = difficultyName;
    }

    // if (this.app.elements.subscribeInfo) {
    //   this.app.elements.subscribeInfo.style.display = 'block';
    // }
  }

  /**
   * Update unsubscribed message (when user is not subscribed)
   */
  updateUnsubscribedMessage(languageValue, difficultyValue = 'easy') {
    const languageName = Utils.getLanguageDisplayName(languageValue);
    const difficultyName = difficultyValue === 'medium' ? 'medium' : 'easy';

    // Hide subscribed message and show unsubscribed message
    const subscribedMessage = document.getElementById('subscribed-message');
    const unsubscribedMessage = document.getElementById('unsubscribed-message');
    const unsubscribedLanguage = document.getElementById('unsubscribed-language');
    const unsubscribedDifficulty = document.getElementById('unsubscribed-difficulty');

    if (subscribedMessage && unsubscribedMessage) {
      subscribedMessage.style.display = 'none';
      unsubscribedMessage.style.display = 'block';

      if (unsubscribedLanguage) unsubscribedLanguage.textContent = languageName;
      if (unsubscribedDifficulty) unsubscribedDifficulty.textContent = difficultyName;
    }

    // if (this.app.elements.subscribeInfo) {
    //   this.app.elements.subscribeInfo.style.display = 'block';
    // }
  }

  /**
   * Update UI based on subscription status
   */
  updateUI(isSubscribed, savedLanguage, savedDifficulty, languageSelect, difficultySelect) {
    const languageLabel = document.querySelector('#language-container label');
    const difficultyLabel = document.querySelector('#difficulty-container label');

    // Update language selection
    if (savedLanguage) {
      languageSelect.value = savedLanguage;
    }

    // Update difficulty selection
    if (savedDifficulty) {
      difficultySelect.value = savedDifficulty;
    }

    // Enable/disable selectors - allow both language and difficulty changes for subscribed users
    // Only disable language if currently loading
    const isLoadingLanguage = document.querySelector('.language-loading')?.style.display === 'block';
    languageSelect.disabled = isLoadingLanguage;
    // Only disable difficulty if currently loading
    const isLoadingDifficulty = document.querySelector('.difficulty-loading')?.style.display === 'block';
    difficultySelect.disabled = isLoadingDifficulty;

    // Update label text
    if (languageLabel) {
      languageLabel.textContent = isSubscribed ? "You are subscribed to" : "Choose language";
    }
    if (difficultyLabel) {
      difficultyLabel.textContent = isSubscribed ? "Difficulty level" : "Choose difficulty";
    }
  }

  /**
   * Show difficulty loading state
   */
  showDifficultyLoading(show = true) {
    const loadingElement = document.querySelector('.difficulty-loading');
    if (loadingElement) {
      loadingElement.style.display = show ? 'block' : 'none';
    }

    // Disable the difficulty select while loading
    this.app.elements.difficultySelect.disabled = show;
  }

  /**
   * Show language loading state
   */
  showLanguageLoading(show = true) {
    const loadingElement = document.querySelector('.language-loading');
    if (loadingElement) {
      loadingElement.style.display = show ? 'block' : 'none';
    }

    // Disable the language select while loading
    this.app.elements.languageSelect.disabled = show;
  }
}