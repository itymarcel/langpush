# Railway Deployment Configuration for LangPush

## Environment Variables Required for Railway

### Database
- `DATABASE_URL` - PostgreSQL connection string (provided by Railway)

### Web Push (PWA)
- `VAPID_PUBLIC_KEY` - Your VAPID public key
- `VAPID_PRIVATE_KEY` - Your VAPID private key
- `CONTACT_EMAIL` - Your contact email for VAPID

### Admin Access
- `ADMIN_KEY` - API key for admin endpoints

### Apple Push Notifications (iOS app)
- `APNS_KEY_ID` - Your Apple Push Notification Key ID
- `APNS_TEAM_ID` - Your Apple Developer Team ID
- `APNS_KEY_PATH` - Path to your .p8 key file (see below)

### Server Configuration
- `PORT` - Server port (Railway sets this automatically)
- `NODE_ENV` - Set to `production`

## APNs Setup for iOS

### 1. Create APNs Key in Apple Developer Console
1. Go to [Apple Developer Console](https://developer.apple.com/account/resources/authkeys)
2. Create a new key with "Apple Push Notifications service (APNs)" capability
3. Download the `.p8` file (keep it secure!)
4. Note the Key ID (10 characters)
5. Note your Team ID (10 characters)

### 2. Upload APNs Key to Railway
You have several options for the `.p8` key file:

#### Option A: Upload as Base64 (Recommended)
```bash
# Convert your .p8 file to base64
base64 AuthKey_XXXXXXXXXX.p8 | tr -d '\n' > apns_key_base64.txt
```
Then set `APNS_KEY_PATH` to the base64 string as an environment variable.

#### Option B: Mount as Volume (if Railway supports it)
Upload the `.p8` file and set `APNS_KEY_PATH` to the file path.

### 3. Update Your Config
In your Railway deployment, update the config.js file to use your production URL:

```javascript
// In public/js/config.js, update the production URL:
return 'https://your-app-name.railway.app';
```

### 4. Railway Database
Railway will automatically provide a PostgreSQL database. The schema will be created automatically on first startup.

## iOS App Configuration

### 1. Update Capacitor Config
In `capacitor.config.ts`:
```typescript
const config: CapacitorConfig = {
  appId: 'com.langpush.app', // Use your actual bundle ID
  appName: 'LangPush',
  webDir: 'public',
  server: {
    url: 'https://your-app-name.railway.app', // Your Railway URL
    cleartext: false
  }
};
```

### 2. Build and Deploy
```bash
# Build the Capacitor app
npx cap build ios

# Open in Xcode (requires macOS)
npx cap open ios
```

### 3. Configure iOS App in Xcode
1. Set your Team and Bundle Identifier
2. Enable Push Notifications capability
3. Configure App ID in Apple Developer Console with Push Notifications
4. Build and distribute your app

## Development vs Production

### Local Development
- PWA: Uses service worker and web push
- iOS: Points to your local server (update IP in config.js)

### Production (Railway)
- PWA: Deployed as static site with server
- iOS: Points to Railway URL, uses APNs for native push

## Security Notes
- Never commit `.p8` files or private keys to git
- Use Railway's environment variables for all secrets
- The `ADMIN_KEY` should be a strong random string
- VAPID keys should be generated specifically for your app

## Testing
1. Deploy to Railway
2. Test PWA functionality
3. Build iOS app pointing to Railway URL
4. Test iOS native push notifications

## Troubleshooting
- Check Railway logs for APNs connection errors
- Verify all environment variables are set
- Ensure .p8 key file is accessible in production
- Check iOS app bundle ID matches APNs configuration