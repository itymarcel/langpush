# LangPush

A PWA that delivers language learning through push notifications.

## What it does

LangPush sends you 3 daily push notifications with carefully selected phrase pairs in your chosen language (Italian, Spanish, French or Japanese) alongside their English translations. Each notification helps you learn common phrases naturally throughout your day.

## How to use

1. Visit the app in your browser (https://langpush.hypersuper.uk)
2. Choose your target language
3. Subscribe
4. **On iPhone**: Add the app to your home screen for push notifications to work
5. **On Android/Desktop**: Optionally install as a PWA for better experience

## Development

### Local setup

```bash
# Install dependencies
npm install

# Set up local PostgreSQL database
createdb langpush_dev

# Start development server
npm run dev
```

The app requires these environment variables (see `.env` for local development):
- `DATABASE_URL` - PostgreSQL connection string
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` - Web Push keys
- `CONTACT_EMAIL` - Contact email for VAPID
- `ADMIN_KEY` - Admin API authentication

### Manual broadcast

```bash
curl -X POST http://localhost:3000/admin/broadcast \
  -H "X-Admin-Key: local-dev-admin-key"
```


### Code changes to capacitor PUSH (REQUIRED)
```
// MARK: - Push Notifications
50 +      func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
51 +          NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
52 +      }
53 +  
54 +      func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
55 +          NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
56 +      }
```