/**
 * Configuration Module
 * Handles different server URLs for development vs production
 */

class Config {
  constructor() {
    this.isCapacitor = window.Capacitor !== undefined;
    this.isProduction = this.detectProduction();
    this.serverUrl = this.getServerUrl();
  }

  detectProduction() {
    // Check if running on Railway or other production environment
    if (this.isCapacitor) {
      // For Capacitor apps in development, always use local server
      // You can set this to true when you want to test against production
      return false; // Set to true to test against Railway in simulator
    } else {
      // For PWA, check the current hostname
      return window.location.hostname !== 'localhost' &&
             window.location.hostname !== '127.0.0.1' &&
             !window.location.hostname.includes('192.168');
    }
  }

  getServerUrl() {
    if (this.isCapacitor) {
      // For Capacitor iOS app
      if (this.isProduction) {
        // Railway production URL
        return 'https://langpush-production.up.railway.app';
      } else {
        // Local development - iOS Simulator can use localhost
        return 'http://localhost:3000';
      }
    } else {
      // For PWA, use relative URLs (same origin)
      return '';
    }
  }

  getEndpointUrl(path) {
    return `${this.serverUrl}${path}`;
  }
}

// Create global config instance
window.AppConfig = new Config();