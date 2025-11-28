/**
 * Speech Manager Module
 * Handles text-to-speech synthesis for language phrases
 */

class SpeechManager {
  constructor() {
    this.synthesis = window.speechSynthesis;
    this.isSpeaking = false;
  }

  /**
   * Get the appropriate language code for speech synthesis
   * @param {string} language - Language name (italian, spanish, french, japanese)
   * @returns {string} Language code (it-IT, es-ES, fr-FR, ja-JP)
   */
  getLanguageCode(language) {
    const languageMap = {
      'italian': 'it-IT',
      'spanish': 'es-ES',
      'french': 'fr-FR',
      'japanese': 'ja-JP'
    };
    return languageMap[language] || 'en-US';
  }

  /**
   * Speak the given text in the specified language
   * @param {string} text - Text to speak
   * @param {string} language - Language name
   */
  speak(text, language) {
    // Cancel any ongoing speech
    if (this.isSpeaking) {
      this.synthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = this.getLanguageCode(language);
    utterance.rate = 0.85; // Slightly slower for learning

    utterance.onstart = () => {
      this.isSpeaking = true;
    };

    utterance.onend = () => {
      this.isSpeaking = false;
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      this.isSpeaking = false;
    };

    this.synthesis.speak(utterance);
  }

  /**
   * Stop any ongoing speech
   */
  stop() {
    if (this.isSpeaking) {
      this.synthesis.cancel();
      this.isSpeaking = false;
    }
  }

  /**
   * Check if speech synthesis is supported
   * @returns {boolean}
   */
  isSupported() {
    return 'speechSynthesis' in window;
  }
}
