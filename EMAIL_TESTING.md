# Testing Cloudflare Email Sending

This guide will help you test if Cloudflare Email Sending is properly configured and working on your account.

## Prerequisites

Before testing, ensure the following are set up in your Cloudflare Dashboard:

### 1. Email Routing Must Be Enabled

1. Go to **Cloudflare Dashboard** → Select your **woophone.io** domain
2. Navigate to **Email** → **Email Routing**
3. Click **Get Started** (if not already enabled)
4. Follow the setup wizard to enable Email Routing

### 2. Verify Sender Email Address

1. In **Email Routing** settings
2. Go to **Destination addresses** or **Routing rules**
3. Ensure **help@woophone.io** is configured as a valid sending address
4. Verify DNS records are properly configured (SPF, DKIM, DMARC)

### 3. Email Sending Private Beta Access

Cloudflare Email Sending is currently in **private beta** (as of October 2025).

- Check if your account has access to the beta
- If not, you may need to request access or wait for general availability
- Check: https://www.cloudflare.com/products/email-routing/

---

## Testing Method

We've created a simple test endpoint that will:
- Send a test email from **help@woophone.io**
- To **chris@abuntly.com**
- Using Cloudflare Email Sending

### Option 1: Test via Staging Deployment (Recommended)

**Step 1: Install Dependencies**
```bash
cd /root/Claude-wootest/backend
npm install
```

**Step 2: Deploy to Staging**
```bash
# The code is already committed, so just deploy:
cd /root/Claude-wootest/backend
CLOUDFLARE_API_TOKEN=nVt1Wo79IbqNQgPkgRpOmWqIuhqHpIXmbyJoUTYc wrangler deploy --env staging
```

**Step 3: Test the Endpoint**

Once deployed, visit this URL in your browser or use curl:

```bash
curl https://claude-wootestnew-api-staging.lilboo.workers.dev/test-email
```

Or just visit in your browser:
```
https://claude-wootestnew-api-staging.lilboo.workers.dev/test-email
```

**Step 4: Check the Response**

You'll get one of these responses:

**✅ Success Response:**
```json
{
  "success": true,
  "message": "Test email sent successfully!",
  "details": {
    "from": "help@woophone.io",
    "to": "chris@abuntly.com",
    "subject": "Test Email from Cloudflare Workers",
    "sentAt": "2025-10-30T..."
  },
  "instructions": "Check chris@abuntly.com inbox..."
}
```

**❌ Error Responses:**

If you get an error, it will include troubleshooting steps. Common errors:

1. **EMAIL_BINDING_NOT_FOUND** - Email Sending binding not configured
2. **Email Routing not enabled** - Need to enable in Cloudflare Dashboard
3. **Email Sending beta not enabled** - Need beta access

**Step 5: Check Your Email**

1. Check **chris@abuntly.com** inbox
2. Also check **spam/junk folder**
3. Look for email from **help@woophone.io**
4. Subject: "Test Email from Cloudflare Workers"

---

### Option 2: Test Locally with Wrangler Dev

```bash
cd /root/Claude-wootest/backend
npm install
npx wrangler dev --env staging
```

Then in another terminal or browser:
```bash
curl http://localhost:8787/test-email
```

**Note:** Local testing may have limitations with Email Sending. Deploying to staging is more reliable.

---

## Expected Behavior

### If Email Sending IS Working:

1. The API endpoint returns `{"success": true}`
2. You receive an email at **chris@abuntly.com** within 1-2 minutes
3. The email has:
   - **From:** help@woophone.io
   - **Subject:** Test Email from Cloudflare Workers
   - **Content:** HTML-formatted test message confirming Email Sending is working

### If Email Sending IS NOT Working:

You'll get an error response with one of these issues:

#### Issue 1: Email Binding Not Found
```json
{
  "error": {
    "code": "EMAIL_BINDING_NOT_FOUND",
    "message": "Email Sending binding not configured...",
    "instructions": [...]
  }
}
```

**Solution:**
- Check that `wrangler.toml` has the `[[env.staging.send_email]]` binding (already added)
- Redeploy: `wrangler deploy --env staging`

#### Issue 2: Email Routing Not Enabled
```json
{
  "error": {
    "code": "EMAIL_SEND_FAILED",
    "message": "Email Routing not enabled"
  }
}
```

**Solution:**
1. Go to Cloudflare Dashboard → woophone.io → Email → Email Routing
2. Click "Get Started" and complete setup
3. Verify DNS records are configured
4. Try the test endpoint again

#### Issue 3: Beta Not Available
```json
{
  "error": {
    "code": "EMAIL_SEND_FAILED",
    "message": "Email Sending beta not enabled"
  }
}
```

**Solution:**
- Email Sending is in private beta
- Request access at https://www.cloudflare.com/products/email-routing/
- Alternative: Use a third-party email service like Resend, SendGrid, or Postmark temporarily

---

## What Happens Next?

### If It Works ✅

Great! You're ready to implement:
- **Account verification emails** (send verification links to new users)
- **Team invitations** (invite users to join your workspace)
- **Password reset emails** (send password reset links)
- **Notification emails** (notify users of events)

You can proceed with building your email-based features using the same `SEND_EMAIL` binding.

### If It Doesn't Work ❌

Don't worry! You have options:

**Option A: Wait for beta access**
- Email Sending is currently in beta
- General availability coming soon
- You can continue building other features in the meantime

**Option B: Use a third-party service**
- **Resend** (https://resend.com/) - Simple, developer-friendly, free tier
- **SendGrid** - Reliable, widely used
- **Postmark** - Focus on transactional emails
- **Mailgun** - Powerful API

I can help integrate any of these if Cloudflare Email Sending isn't available yet.

---

## Troubleshooting

### Email Not Received

1. **Check spam folder** - First-time senders often land in spam
2. **Wait a few minutes** - Email delivery can take 1-5 minutes
3. **Check Cloudflare Dashboard** - Look for Email Routing logs
4. **Verify DNS records** - SPF, DKIM, DMARC must be configured

### DNS Records

Email Sending requires these DNS records (Cloudflare should auto-configure):

- **SPF** - Identifies authorized senders
- **DKIM** - Cryptographic signature
- **DMARC** - Email authentication policy

Check these in Cloudflare Dashboard → DNS → Records

---

## Next Steps

Once you confirm email is working (or decide on an alternative), we can implement:

1. **User account verification flow**
   - Send verification email on signup
   - Token-based email verification
   - Resend verification email option

2. **Team invitation system**
   - Send invite emails to new team members
   - Token-based invitation acceptance
   - Role-based invitations

3. **Password reset flow**
   - Send reset link via email
   - Time-limited reset tokens
   - Secure password update

Let me know the results of your test!
