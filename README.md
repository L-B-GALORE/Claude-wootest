# Twilio Browser Phone

A simple browser-based phone application using Twilio Voice SDK.

## Features

- Make outbound calls from your browser
- Receive inbound calls in your browser
- Full call controls: mute, hang up, dial pad
- Auto-provisioning of Twilio TwiML App and API Keys

## Setup Instructions

### 1. Deploy to Vercel

Since you've already connected your GitHub repo to Vercel:

1. Go to your Vercel dashboard
2. Your project should auto-deploy once this code is pushed
3. If not, click "Redeploy" or import the project again

### 2. Add Vercel KV Database

1. In your Vercel project dashboard, go to the **Storage** tab
2. Click **Create Database**
3. Select **KV** (Redis-compatible)
4. Click **Create**
5. Vercel will automatically add the required environment variables to your project

### 3. Configure Twilio Phone Number

**IMPORTANT:** Before using the app, you need to point your Twilio phone number to your deployed app:

1. Get your Vercel deployment URL (e.g., `https://your-app.vercel.app`)
2. Go to [Twilio Console](https://console.twilio.com/us1/develop/phone-numbers/manage/incoming)
3. Click on your phone number
4. Under "Voice Configuration":
   - When a call comes in: **Webhook**
   - URL: `https://your-app.vercel.app/voice`
   - HTTP: **POST**
5. Click **Save**

### 4. Initialize the App

1. Visit your deployed app URL: `https://your-app.vercel.app`
2. You'll see the setup screen
3. Enter your Twilio credentials:
   - **Account SID** (found at console.twilio.com)
   - **Auth Token** (found at console.twilio.com)
   - **Phone Number** (your Twilio phone number, e.g., +1234567890)
4. Click **Initialize**
5. The app will automatically:
   - Create a TwiML App in your Twilio account
   - Create an API Key and Secret
   - Store everything securely in Vercel KV

### 5. Start Making Calls!

Once initialized, you can:

- **Make outbound calls**: Enter a phone number and click Call
- **Receive inbound calls**: Call your Twilio number from any phone
- **Use call controls**: Mute, hang up, send DTMF tones

## How It Works

### Backend (Node.js + Express)
- Handles Twilio webhooks
- Generates access tokens for browser calls
- Auto-provisions Twilio resources
- Stores configuration in Vercel KV

### Frontend (HTML + CSS + JavaScript)
- Uses Twilio Voice SDK for WebRTC calls
- Three UI states: Idle, Incoming, Active
- Real-time call controls

## Troubleshooting

### Can't receive calls?
- Make sure your Twilio phone number is configured to point to your Vercel URL
- Check that the webhook URL is `https://your-app.vercel.app/voice`

### Can't make calls?
- Check browser console for errors
- Ensure microphone permissions are granted
- Verify your Twilio account has sufficient credits

### "Not initialized" error?
- Visit the app and complete the setup process
- Check that Vercel KV database is properly connected

## Tech Stack

- **Backend**: Node.js, Express, Twilio SDK
- **Frontend**: Vanilla JavaScript, Twilio Voice SDK
- **Database**: Vercel KV (Redis)
- **Hosting**: Vercel
