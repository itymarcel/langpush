# LangPush

A native iOS app that delivers language learning through push notifications.

## What it does

LangPush sends you 3 daily push notifications with carefully selected phrase pairs in your chosen language (Italian, Spanish, French or Japanese) alongside their English translations. Each notification helps you learn common phrases naturally throughout your day.

## Development

### Backend Setup

```bash
# Install dependencies
npm install

# Set up local PostgreSQL database
createdb langpush_dev

# Start backend server
npm start

# Or with nodemon for development
npm run dev
```

The backend requires these environment variables (see `.env`):
- `DATABASE_URL` - PostgreSQL connection string
- `ADMIN_KEY` - Admin API authentication
- `PORT` - Server port (defaults to 3000)
- `ENVIRONMENT` - Environment (dev/production)

For iOS push notifications, also configure:
- `APNS_KEY_ID` - APNs Authentication Key ID
- `APNS_TEAM_ID` - Apple Developer Team ID
- `APNS_KEY_PATH` - Path to .p8 key file
- `APNS_PRODUCTION` - true for production, false for sandbox
- `APNS_BUNDLE_ID` - App bundle identifier

### iOS App Development

#### Open in Xcode
```bash
npx cap open ios
```

#### Build and Run on Simulator
1. Open the project in Xcode: `npx cap open ios`
2. Select a simulator (e.g., iPhone 15 Pro)
3. Click the Run button (▶️) or press `Cmd + R`

**Note:** Push notifications don't work in the simulator. You'll need a physical device for testing notifications.

#### Build and Run on Physical iPhone

1. **Connect your iPhone** via USB

2. **Open in Xcode:**
   ```bash
   npx cap open ios
   ```

3. **Select your device** from the device dropdown at the top (next to the Run button)

4. **Sign the app:**
   - In Xcode, select the "App" target
   - Go to "Signing & Capabilities" tab
   - Select your Team under "Signing"
   - Xcode will automatically create a provisioning profile

5. **Run the app:**
   - Click the Run button (▶️) or press `Cmd + R`
   - First time: You may need to trust the developer certificate on your iPhone:
     - Settings → General → VPN & Device Management → Developer App → Trust

6. **Enable Push Notifications:**
   - Make sure "Push Notifications" capability is enabled in Xcode
   - The app will request notification permission on first launch

#### Sync Changes (After modifying native code)
```bash
npx cap sync ios
```

### Manual Broadcast (Testing)

Send a notification to all iOS subscribers:
```bash
curl -X POST http://localhost:3000/admin/broadcast \
  -H "X-Admin-Key: ABC-3000-12"
```

Send to specific device:
```bash
curl -X POST http://localhost:3000/admin/send-now \
  -H "X-Admin-Key: ABC-3000-12" \
  -H "Content-Type: application/json" \
  -d '{"iosToken": "your_device_token_here"}'
```

### Required Code Changes for Push Notifications

Add this to `ios/App/App/AppDelegate.swift`:

```swift
// MARK: - Push Notifications
func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
}

func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
    NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
}
```

## Architecture

- **Backend:** Node.js/Express server with PostgreSQL database
- **Push Notifications:** APNs (Apple Push Notification service) via `node-apn`
- **iOS App:** Capacitor-based native iOS app
- **Languages:** Italian 🇮🇹, Spanish 🇪🇸, French 🇫🇷, Japanese 🇯🇵
- **Difficulty Levels:** Easy, Medium
