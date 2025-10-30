/**
 * Test Email API Router
 *
 * Purpose: Test Cloudflare Email Sending capability
 *
 * Routes:
 * - GET /test-email - Send a test email to verify Email Sending is working
 *
 * Prerequisites:
 * - Email Routing must be enabled on woophone.io domain
 * - Cloudflare Email Sending must be available (currently in private beta)
 * - SEND_EMAIL binding configured in wrangler.toml
 */

import { Hono } from 'hono';
import { EmailMessage } from 'cloudflare:email';
import { createMimeMessage } from 'mimetext';

const app = new Hono();

/**
 * GET /test-email
 * Send a test email from help@woophone.io to chris@abuntly.com
 *
 * This endpoint tests if Cloudflare Email Sending is properly configured
 */
app.get('/', async (c) => {
  try {
    console.log('[Test Email] Attempting to send test email...');

    // Check if SEND_EMAIL binding exists
    if (!c.env.SEND_EMAIL) {
      console.error('[Test Email] SEND_EMAIL binding not found');
      return c.json(
        {
          success: false,
          error: {
            code: 'EMAIL_BINDING_NOT_FOUND',
            message:
              'Email Sending binding not configured. Check wrangler.toml and ensure Email Routing is enabled.',
            instructions: [
              '1. Enable Email Routing on woophone.io in Cloudflare Dashboard',
              '2. Verify help@woophone.io is set up as a sending address',
              '3. Ensure Cloudflare Email Sending private beta is enabled on your account',
              '4. Check that SEND_EMAIL binding is in wrangler.toml',
            ],
          },
        },
        500
      );
    }

    // Create MIME message
    const msg = createMimeMessage();
    msg.setSender({ name: 'WooPhone', addr: 'help@woophone.io' });
    msg.setRecipient('chris@abuntly.com');
    msg.setSubject('Test Email from Cloudflare Workers');
    msg.addMessage({
      contentType: 'text/html',
      data: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
              .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 5px 5px; }
              .badge { display: inline-block; background-color: #10b981; color: white; padding: 5px 15px; border-radius: 15px; font-size: 14px; }
              .footer { margin-top: 20px; font-size: 12px; color: #6b7280; text-align: center; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>✉️ Test Email Successful!</h1>
              </div>
              <div class="content">
                <p><span class="badge">✓ Email Sending Enabled</span></p>
                <h2>Cloudflare Email Sending is working!</h2>
                <p>This test email confirms that:</p>
                <ul>
                  <li>✅ Email Routing is properly configured on woophone.io</li>
                  <li>✅ Cloudflare Email Sending binding is active</li>
                  <li>✅ You can send transactional emails from Workers</li>
                  <li>✅ DNS records (SPF, DKIM, DMARC) are configured</li>
                </ul>
                <p><strong>You're ready to implement:</strong></p>
                <ul>
                  <li>Account verification emails</li>
                  <li>Team invitations</li>
                  <li>Password reset emails</li>
                  <li>Notification emails</li>
                </ul>
                <p><strong>Sender:</strong> help@woophone.io</p>
                <p><strong>Recipient:</strong> chris@abuntly.com</p>
                <p><strong>Sent via:</strong> Cloudflare Workers (Staging Environment)</p>
                <div class="footer">
                  <p>This is a test email from your WooPhone application.</p>
                  <p>Powered by Cloudflare Email Service</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    // Also add plain text version
    msg.addMessage({
      contentType: 'text/plain',
      data: `
Test Email Successful!

Cloudflare Email Sending is working!

This test email confirms that:
- Email Routing is properly configured on woophone.io
- Cloudflare Email Sending binding is active
- You can send transactional emails from Workers
- DNS records (SPF, DKIM, DMARC) are configured

You're ready to implement:
- Account verification emails
- Team invitations
- Password reset emails
- Notification emails

Sender: help@woophone.io
Recipient: chris@abuntly.com
Sent via: Cloudflare Workers (Staging Environment)

---
This is a test email from your WooPhone application.
Powered by Cloudflare Email Service
      `,
    });

    // Create EmailMessage
    const message = new EmailMessage('help@woophone.io', 'chris@abuntly.com', msg.asRaw());

    // Send email
    console.log('[Test Email] Sending email...');
    await c.env.SEND_EMAIL.send(message);

    console.log('[Test Email] ✅ Email sent successfully');

    return c.json({
      success: true,
      message: 'Test email sent successfully!',
      details: {
        from: 'help@woophone.io',
        to: 'chris@abuntly.com',
        subject: 'Test Email from Cloudflare Workers',
        sentAt: new Date().toISOString(),
      },
      instructions:
        'Check chris@abuntly.com inbox (and spam folder) for the test email. If you receive it, Email Sending is working!',
    });
  } catch (error) {
    console.error('[Test Email] Error sending test email:', error);

    // Provide helpful error messages based on common issues
    let errorMessage = 'Failed to send test email';
    let troubleshooting = [];

    if (error.message?.includes('binding')) {
      errorMessage = 'Email Sending binding not properly configured';
      troubleshooting = [
        'Check that wrangler.toml has [[env.staging.send_email]] binding',
        'Verify the binding name matches SEND_EMAIL in the code',
        'Ensure you deployed with the updated wrangler.toml',
      ];
    } else if (error.message?.includes('routing')) {
      errorMessage = 'Email Routing not enabled';
      troubleshooting = [
        'Enable Email Routing on woophone.io in Cloudflare Dashboard',
        'Verify help@woophone.io is configured as a sending address',
        'Check DNS records are properly configured',
      ];
    } else if (error.message?.includes('beta') || error.message?.includes('access')) {
      errorMessage = 'Email Sending beta not enabled';
      troubleshooting = [
        'Cloudflare Email Sending is currently in private beta',
        'Request access at https://www.cloudflare.com/products/email-routing/',
        'Check your Cloudflare account for beta access',
      ];
    }

    return c.json(
      {
        success: false,
        error: {
          code: 'EMAIL_SEND_FAILED',
          message: errorMessage,
          details: error.message,
          troubleshooting,
        },
      },
      500
    );
  }
});

export default app;
