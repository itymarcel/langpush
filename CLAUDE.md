# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Lingua Push is a web-based progressive web app (PWA) that sends push notifications with Italian language learning phrases. Users can subscribe to receive periodic notifications containing Italian phrases with English translations.

## Architecture

### Backend (`server.js`)
- **Express.js server** with PostgreSQL database for subscription management
- **Web Push API** integration using `web-push` library for sending notifications
- **VAPID protocol** for secure push messaging
- **Subscription management**: stores push subscriptions as JSONB in PostgreSQL
- **Admin endpoints** protected by `X-Admin-Key` header authentication
- **Phrase broadcasting** sends random Italian-English phrase pairs to all subscribers

### Frontend (`public/`)
- **Progressive Web App** with service worker for push notifications
- **Installation support** for Android (native prompt) and iOS (manual instructions)
- **Push subscription management** with subscribe/unsubscribe functionality
- **Service Worker** (`sw.js`) handles incoming push notifications

### Data Layer
- **PostgreSQL database** with single `subs` table storing subscription data as JSONB
- **Phrase data** (`phrases.js`) contains 67 Italian-English phrase pairs with no-repeat logic
- **Environment variables** for VAPID keys, database connection, and admin authentication

## Local Development Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up PostgreSQL database:**
   ```bash
   createdb langpush_dev
   ```

3. **Environment variables:**
   The `.env` file is already configured with local development settings including:
   - Local PostgreSQL connection
   - Generated VAPID keys for web push
   - Local admin key: `local-dev-admin-key`

## Common Commands

```bash
# Start the server (development)
npm start

# Start the server (production with environment variables)
NODE_ENV=production npm start

# Test admin broadcast locally
curl -X POST http://localhost:3000/admin/broadcast -H "X-Admin-Key: local-dev-admin-key"
```

## Environment Variables Required

- `DATABASE_URL` - PostgreSQL connection string
- `VAPID_PUBLIC_KEY` - VAPID public key for web push
- `VAPID_PRIVATE_KEY` - VAPID private key for web push
- `CONTACT_EMAIL` - Contact email for VAPID details
- `ADMIN_KEY` - API key for admin endpoints
- `PORT` - Server port (defaults to 3000)

## Key API Endpoints

- `GET /vapidPublicKey` - Returns VAPID public key for client subscription
- `POST /subscribe` - Subscribe to push notifications (deduplicates by endpoint)
- `GET /subscribe/exists?endpoint=` - Check if subscription exists
- `DELETE /subscribe` - Unsubscribe from notifications
- `GET /admin/subs` - Admin: view subscription count and sample (requires auth)
- `POST /admin/broadcast` - Admin: send phrase to all subscribers (requires auth)

## Deployment

The project uses GitHub Actions (`.github/workflows/main.yml`) for automated phrase broadcasting:
- Scheduled to run 4 times daily at Rome timezone hours (9AM, 12PM, 3PM, 6PM)
- Includes timezone awareness for both CET and CEST
- Uses secrets for `PUBLIC_URL` and `ADMIN_KEY`

## Development Notes

- Database table is auto-created on startup with `CREATE TABLE IF NOT EXISTS`
- Push subscription deduplication by endpoint prevents duplicate entries
- Failed push notifications (410/404 status) trigger automatic subscription cleanup
- Service worker registration and push permission must be handled in HTTPS context
- PWA installation works differently on iOS (manual) vs Android (programmatic)