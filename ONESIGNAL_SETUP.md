# OneSignal Push Notifications Setup

This document explains how to complete the OneSignal setup for push notifications.

## Overview

OneSignal has been integrated for web push notifications. The implementation includes:
- Frontend: OneSignal Web SDK v16 with permission management
- Backend: OneSignal REST API integration for sending notifications
- UI: Settings > Notifications page for testing

## Current Status

✅ **Completed:**
- Frontend OneSignal SDK integration (initialized in index.html)
- NotificationsPage UI with enable/test functionality
- Backend notification endpoint (POST /api/v1/notifications/test)
- Proper SDK initialization using OneSignalDeferred pattern
- Service worker file for push notifications

⏳ **Remaining:**
- **CRITICAL:** Configure web push in OneSignal dashboard (see below)
- Set Cloudflare Worker secrets for OneSignal credentials
- Test end-to-end notification flow

## ⚠️ IMPORTANT: Configure Web Push in OneSignal Dashboard

**You must complete this before notifications will work:**

1. Go to https://onesignal.com/ and log in
2. Select your app (App ID: `7d31c727-b3c6-4bbf-a0fa-55032d69454d`)
3. Navigate to **Settings** → **Platforms**
4. Find **Web Push** and click **Configure** (or **Add Platform**)
5. Choose **Typical Site** setup
6. Enter your site information:
   - **Site URL**: Your staging URL (e.g., `https://your-app.pages.dev`)
   - **Auto Resubscribe**: Enable (recommended)
   - **Default Notification Icon**: Optional
7. For **Service Worker** configuration:
   - The service worker file is already created at `/public/OneSignalSDKWorker.js`
   - OneSignal will detect it automatically
8. Click **Save**
9. For local development, also add `http://localhost:5173` (or your Vite port)

**Without this configuration, you'll see error:** `"App not configured for web push"`

## Required Secrets

You need to add two secrets to your Cloudflare Worker for staging (and later production) environments:

### 1. ONESIGNAL_APP_ID
```bash
cd backend
echo "7d31c727-b3c6-4bbf-a0fa-55032d69454d" | npx wrangler secret put ONESIGNAL_APP_ID --env staging
echo "7d31c727-b3c6-4bbf-a0fa-55032d69454d" | npx wrangler secret put ONESIGNAL_APP_ID
```

### 2. ONESIGNAL_REST_API_KEY
```bash
cd backend
echo "os_v2_app_puy4oj5tyzf37ih2kubs22kfju2fhhtma7zuvjnaodb2oar5xmg6ikwgkuj5uunrw6cx3e53xz37qjoowakh7kjck2unaekxc7cedhq" | npx wrangler secret put ONESIGNAL_REST_API_KEY --env staging
echo "os_v2_app_puy4oj5tyzf37ih2kubs22kfju2fhhtma7zuvjnaodb2oar5xmg6ikwgkuj5uunrw6cx3e53xz37qjoowakh7kjck2unaekxc7cedhq" | npx wrangler secret put ONESIGNAL_REST_API_KEY
```

## Testing Push Notifications

**Prerequisites:**
- Web push must be configured in OneSignal dashboard (see above)
- Backend secrets must be set (see Required Secrets section)

**Steps:**
1. Deploy the backend with the secrets configured
2. Deploy the frontend (service worker file must be accessible)
3. Navigate to Settings > Notifications
4. Click "Enable Notifications" - OneSignal slidedown should appear
5. Allow browser permissions when prompted
6. You should see your **Player ID** appear in the UI
7. Click "Send Test Notification" to receive a test push
8. You should see a browser notification appear 🔔

**For Local Testing:**
1. Add `http://localhost:5173` to allowed origins in OneSignal dashboard
2. Run `cd frontend && npm run dev`
3. Follow steps 3-8 above

## How It Works

### Frontend
- **OneSignal SDK** is loaded from CDN in `index.html` (v16)
- **Initialization** happens in `index.html` using `OneSignalDeferred` array (official v16 pattern)
- **Config** is in `config/onesignal.js` with helper functions:
  - `waitForOneSignal()` - Ensures SDK is loaded before use
  - `requestNotificationPermission()` - Prompts user and returns Player ID
  - `isSubscribed()` - Checks if user has granted permission
  - `getPlayerId()` - Gets current subscription ID
- **UI** is in `pages/settings/NotificationsPage.jsx` for permission and testing

### Backend
- **Endpoint**: `POST /api/v1/notifications/test`
- **Authentication**: Requires auth token (uses authMiddleware)
- **Implementation**: Sends notification to specific Player ID via OneSignal REST API
- **Location**: `backend/src/api/notifications/index.js`

### Notification Flow
1. User enables notifications in Settings
2. OneSignal SDK requests browser permission
3. On permission grant, SDK generates a Player ID (subscription ID)
4. Player ID is displayed in the UI (for debugging)
5. User clicks "Send Test Notification"
6. Frontend sends Player ID to backend endpoint
7. Backend calls OneSignal REST API to send notification
8. OneSignal delivers push to user's browser

## Files Modified

### Frontend
- `index.html` - Added OneSignal SDK v16 script tag and initialization via OneSignalDeferred
- `public/OneSignalSDKWorker.js` - Service worker for push notifications (NEW)
- `config/onesignal.js` - OneSignal helper functions with waitForOneSignal() (NEW)
- `pages/settings/NotificationsPage.jsx` - Notifications UI (NEW)
- `App.jsx` - Added notifications route
- `pages/settings/SettingsLayout.jsx` - Added Notifications nav item

### Backend
- `api/notifications/index.js` - Notification endpoints (NEW)
- `index.js` - Added notifications router

## Production Considerations

For production use, you may want to:
1. Store Player IDs in database linked to users
2. Send notifications on real events (incoming calls, messages)
3. Add notification preferences (enable/disable per event type)
4. Handle notification clicks to navigate to relevant page
5. Set up notification batching for multiple recipients

## OneSignal Dashboard

Access your OneSignal dashboard at: https://onesignal.com/
- App ID: `7d31c727-b3c6-4bbf-a0fa-55032d69454d`
- View delivery analytics, manage segments, and configure notification settings

## Troubleshooting

### "App not configured for web push" error
**This is the most common issue!**
- Go to OneSignal dashboard → Settings → Platforms → Web Push
- Make sure you've configured web push for your site URL
- Add both your production domain AND `http://localhost:5173` for testing
- Save the configuration and wait a minute for it to propagate

### "OneSignal SDK not loaded" error
- This has been fixed by using the `OneSignalDeferred` initialization pattern
- The SDK is now initialized in `index.html` before React loads
- A `waitForOneSignal()` helper ensures the SDK is ready before any operations

### Permission request not showing / Button stuck on "Enabling..."
- Check browser console for errors
- Most likely cause: Web push not configured in OneSignal dashboard (see above)
- Make sure you're on HTTPS or localhost (OneSignal requirement)
- Verify the App ID in `index.html` matches your OneSignal app
- Clear browser cache and try again

### Test notification not sending
- Verify both secrets are set in Cloudflare Worker
- Check backend logs for OneSignal API errors
- Ensure Player ID is displayed in the UI (means subscription successful)
- Check OneSignal dashboard → Messages → Delivery to see if notification was sent
