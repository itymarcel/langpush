/**
 * Utility functions for Lingua Push
 */

class Utils {
  /**
   * Get language display name from language value
   */
  static getLanguageDisplayName(languageValue) {
    const languageMap = {
      'spanish': "Spanish",
      'french': "French",
      'japanese': "Japanese",
      'italian': "Italian"
    };
    return languageMap[languageValue] || "Italian";
  }

  /**
   * Convert base64 string to Uint8Array for VAPID keys
   */
  static base64ToUint8Array(base64) {
    const pad = "=".repeat((4 - base64.length % 4) % 4);
    const b64 = (base64 + pad).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(b64);
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
  }

  /**
   * Initialize Lucide icons
   */
  static initializeIcons() {
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  /**
   * Setup live reload for development
   */
  static setupLiveReload(liveReloadEndpoint) {
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      const eventSource = new EventSource(liveReloadEndpoint);
      eventSource.onmessage = (event) => {
        if (event.data === 'reload') {
          location.reload();
        }
      };
    }
  }

  /**
   * Initialize chicken popover
   */
  static initializeChickenPopover(chickenBtn) {
    if (chickenBtn) {
      const popoverContent = `
        <h3>langpush: Daily Language Pairs</h3>
        <p>Subscribing will send you a push notification 3 x times a day with a language pair of your choice.</p>
      `;

      new Popover(chickenBtn, popoverContent, {
        position: 'bottom',
        offset: 15,
        className: 'chicken-popover'
      });
    }
  }
}