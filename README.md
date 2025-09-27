# LangPush

A Progressive Web App that delivers Italian and Spanish language learning through push notifications.

## What it does

LangPush sends you 3 daily push notifications with carefully selected phrase pairs in your chosen language (Italian or Spanish) alongside their English translations. Each notification helps you learn common phrases naturally throughout your day.

## Features

- **Multi-language support**: Choose between Italian and Spanish
- **Smart scheduling**: Receives notifications 3 times daily
- **Progressive Web App**: Install on any device for the best experience
- **Cross-platform**: Works on iOS, Android, and desktop browsers

## How to use

1. Visit the app in your browser
2. Choose your target language (Italian or Spanish)
3. Subscribe to notifications
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

## Tech Stack

- **Backend**: Node.js, Express, PostgreSQL
- **Frontend**: Vanilla JavaScript, Web Push API
- **Deployment**: Progressive Web App with Service Worker