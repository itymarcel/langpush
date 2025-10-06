import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.langpush.app',
  appName: 'LangPush',
  webDir: 'public',
  // Remove server config to load locally during development
  // server: {
  //   url: 'https://langpush-production.up.railway.app',
  //   cleartext: false
  // },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    }
  }
};

export default config;