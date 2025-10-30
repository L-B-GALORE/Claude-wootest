/**
 * Email Sending Utility
 *
 * Purpose: Send transactional emails using Cloudflare Email Sending
 *
 * Based on the test email endpoint (backend/src/api/test-email.js)
 * which successfully sent emails from help@woophone.io
 *
 * IMPORTANT: To prevent duplicate emails
 * - Each email type should have idempotency (check if already sent)
 * - Use single-use tokens that are invalidated after use
 * - Log email sends to detect duplicates
 *
 * NOTE: During testing, we observed duplicate emails being received.
 * This might be due to:
 * - Browser prefetching/double requests
 * - Cloudflare Email Sending beta behavior
 * - Network retries
 *
 * Mitigation strategies implemented:
 * - Single-use verification tokens
 * - Token invalidation after use
 * - Logging for debugging
 */

import { EmailMessage } from 'cloudflare:email';
import { createMimeMessage } from 'mimetext';

/**
 * Send verification email to new user
 * @param {object} env - Cloudflare environment bindings
 * @param {string} userEmail - Recipient email address
 * @param {string} userName - User's name
 * @param {string} verificationToken - Unique verification token
 * @param {string} frontendUrl - Frontend URL (staging or production)
 */
export async function sendVerificationEmail(env, userEmail, userName, verificationToken, frontendUrl) {
  if (!env.SEND_EMAIL) {
    console.error('[Email] SEND_EMAIL binding not found - skipping email send');
    // Don't throw error - allow signup to complete even if email fails
    return { success: false, error: 'Email sending not configured' };
  }

  try {
    const verificationUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;

    const msg = createMimeMessage();
    msg.setSender({ name: 'WooPhone', addr: 'help@woophone.io' });
    msg.setRecipient(userEmail);
    msg.setSubject('Verify your WooPhone account');

    // HTML version
    msg.addMessage({
      contentType: 'text/html',
      data: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .header h1 { margin: 0; font-size: 28px; }
              .content { background-color: #ffffff; padding: 40px 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none; }
              .greeting { font-size: 18px; margin-bottom: 20px; }
              .message { font-size: 16px; margin-bottom: 30px; color: #4b5563; }
              .button { display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; margin: 10px 0; }
              .button:hover { opacity: 0.9; }
              .security-note { margin-top: 30px; padding: 15px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px; font-size: 14px; }
              .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; text-align: center; }
              .footer a { color: #3b82f6; text-decoration: none; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Welcome to WooPhone!</h1>
              </div>
              <div class="content">
                <p class="greeting">Hi ${userName},</p>

                <p class="message">
                  Thanks for signing up! We're excited to have you on board.
                  To get started, please verify your email address by clicking the button below:
                </p>

                <div style="text-align: center;">
                  <a href="${verificationUrl}" class="button">Verify Email & Get Started</a>
                </div>

                <p class="message" style="margin-top: 30px;">
                  By verifying your email, you'll be automatically logged in and can start using WooPhone right away.
                </p>

                <div class="security-note">
                  <strong>🔒 Security Note:</strong> This link expires in 24 hours and can only be used once.
                  If you didn't create a WooPhone account, you can safely ignore this email.
                </div>

                <div class="footer">
                  <p>If the button doesn't work, copy and paste this link into your browser:</p>
                  <p><a href="${verificationUrl}">${verificationUrl}</a></p>
                  <p style="margin-top: 20px;">
                    Need help? Contact us at <a href="mailto:help@woophone.io">help@woophone.io</a>
                  </p>
                  <p style="margin-top: 10px; color: #9ca3af;">
                    © ${new Date().getFullYear()} WooPhone. All rights reserved.
                  </p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    // Plain text version (fallback)
    msg.addMessage({
      contentType: 'text/plain',
      data: `
Hi ${userName},

Welcome to WooPhone!

Thanks for signing up! To get started, please verify your email address by clicking the link below:

${verificationUrl}

By verifying your email, you'll be automatically logged in and can start using WooPhone right away.

SECURITY NOTE: This link expires in 24 hours and can only be used once. If you didn't create a WooPhone account, you can safely ignore this email.

Need help? Contact us at help@woophone.io

© ${new Date().getFullYear()} WooPhone. All rights reserved.
      `,
    });

    // Create and send email
    const message = new EmailMessage('help@woophone.io', userEmail, msg.asRaw());

    console.log(`[Email] Sending verification email to ${userEmail}`);
    await env.SEND_EMAIL.send(message);
    console.log(`[Email] ✅ Verification email sent to ${userEmail}`);

    return { success: true };
  } catch (error) {
    console.error('[Email] Error sending verification email:', error);
    // Don't throw - allow signup to complete even if email fails
    return { success: false, error: error.message };
  }
}

/**
 * Send password reset email
 * @param {object} env - Cloudflare environment bindings
 * @param {string} userEmail - Recipient email address
 * @param {string} userName - User's name
 * @param {string} resetToken - Unique reset token
 * @param {string} frontendUrl - Frontend URL
 */
export async function sendPasswordResetEmail(env, userEmail, userName, resetToken, frontendUrl) {
  if (!env.SEND_EMAIL) {
    console.error('[Email] SEND_EMAIL binding not found - skipping email send');
    return { success: false, error: 'Email sending not configured' };
  }

  try {
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    const msg = createMimeMessage();
    msg.setSender({ name: 'WooPhone', addr: 'help@woophone.io' });
    msg.setRecipient(userEmail);
    msg.setSubject('Reset your WooPhone password');

    // HTML version
    msg.addMessage({
      contentType: 'text/html',
      data: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .header h1 { margin: 0; font-size: 28px; }
              .content { background-color: #ffffff; padding: 40px 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none; }
              .message { font-size: 16px; margin-bottom: 30px; color: #4b5563; }
              .button { display: inline-block; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; margin: 10px 0; }
              .security-note { margin-top: 30px; padding: 15px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px; font-size: 14px; }
              .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; text-align: center; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🔒 Password Reset Request</h1>
              </div>
              <div class="content">
                <p>Hi ${userName},</p>

                <p class="message">
                  We received a request to reset your password. Click the button below to create a new password:
                </p>

                <div style="text-align: center;">
                  <a href="${resetUrl}" class="button">Reset Password</a>
                </div>

                <div class="security-note">
                  <strong>🔒 Security Note:</strong> This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
                </div>

                <div class="footer">
                  <p>If the button doesn't work, copy and paste this link:</p>
                  <p>${resetUrl}</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    // Plain text version
    msg.addMessage({
      contentType: 'text/plain',
      data: `
Hi ${userName},

We received a request to reset your password. Click the link below to create a new password:

${resetUrl}

SECURITY NOTE: This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
      `,
    });

    const message = new EmailMessage('help@woophone.io', userEmail, msg.asRaw());

    console.log(`[Email] Sending password reset email to ${userEmail}`);
    await env.SEND_EMAIL.send(message);
    console.log(`[Email] ✅ Password reset email sent to ${userEmail}`);

    return { success: true };
  } catch (error) {
    console.error('[Email] Error sending password reset email:', error);
    return { success: false, error: error.message };
  }
}
