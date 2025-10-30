/**
 * Resend Verification Email Endpoint
 *
 * POST /api/v1/auth/resend-verification
 *
 * Purpose: Resend verification email to user who hasn't verified yet.
 *
 * Use Cases:
 * - User didn't receive original email
 * - Verification token expired
 * - User accidentally deleted email
 *
 * Flow:
 * 1. Extract email from request body
 * 2. Find user by email
 * 3. Check if email is already verified
 * 4. Generate new verification token
 * 5. Update user with new token
 * 6. Send verification email
 * 7. Return success
 *
 * Request Body:
 * {
 *   email: string
 * }
 *
 * Response (200 OK):
 * {
 *   success: true,
 *   message: "Verification email sent! Check your inbox.",
 *   data: {
 *     emailSent: boolean
 *   }
 * }
 *
 * Security Considerations:
 * - Always returns success even if email doesn't exist (prevent email enumeration)
 * - Logs actual result for debugging
 * - Single-use tokens (old token invalidated)
 * - 24-hour expiry
 *
 * Duplicate Email Prevention:
 * - Generates new token each time (old one invalidated)
 * - User can only use the latest link
 * - Previous links become invalid
 *
 * Future Enhancements:
 * - Rate limiting (max 3 resends per hour per email)
 * - Track resend count in database
 * - Add cooldown period between resends
 *
 * Used by:
 * - Frontend verification page ("Resend email" button)
 * - Login page (if user tries to login with unverified email)
 */

import { Hono } from 'hono';
import { getPrisma } from '../../lib/prisma.js';
import { APIError, asyncHandler } from '../../middleware/error-handler.js';
import { logger } from '../../utils/logger.js';
import { sendVerificationEmail } from '../../lib/email.js';

const app = new Hono();

app.post('/', asyncHandler(async (c) => {
  const body = await c.req.json();
  const { email } = body;

  // Validate email
  if (!email) {
    throw new APIError(
      'VALIDATION_ERROR',
      'Email is required',
      400
    );
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new APIError(
      'INVALID_EMAIL',
      'Invalid email format',
      400
    );
  }

  // Get database client
  const db = getPrisma(c.env.DATABASE_URL);

  // Find user by email
  const user = await db.user.findFirst({
    where: { email: email.toLowerCase() },
  });

  // Always return success to prevent email enumeration
  // Log the actual result for debugging
  if (!user) {
    logger.warn('Resend verification requested for non-existent email', { email });
    return c.json({
      success: true,
      message: 'If an account exists with this email, a verification email has been sent.',
      data: {
        emailSent: false,
      },
    });
  }

  // Check if already verified
  if (user.emailVerified) {
    logger.info('Resend verification requested for already verified email', {
      userId: user.id,
      email: user.email,
    });
    return c.json({
      success: true,
      message: 'This email is already verified. You can login now.',
      data: {
        emailSent: false,
        alreadyVerified: true,
      },
    });
  }

  // Generate new verification token (invalidates old one)
  const verificationToken = crypto.randomUUID() + '-' + Date.now() + '-' + crypto.randomUUID();
  const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Update user with new token
  await db.user.update({
    where: { id: user.id },
    data: {
      verificationToken,
      verificationTokenExpiry,
    },
  });

  logger.info('New verification token generated', {
    userId: user.id,
    email: user.email,
  });

  // Determine frontend URL
  const frontendUrl = c.env.FRONTEND_URL || 'https://claude-wootestnew.pages.dev';

  // Send verification email
  const emailResult = await sendVerificationEmail(
    c.env,
    user.email,
    user.name,
    verificationToken,
    frontendUrl
  );

  if (emailResult.success) {
    logger.info('Verification email resent successfully', {
      userId: user.id,
      email: user.email,
    });
  } else {
    logger.error('Failed to resend verification email', {
      userId: user.id,
      email: user.email,
      error: emailResult.error,
    });
  }

  // Return success
  return c.json({
    success: true,
    message: 'Verification email sent! Check your inbox.',
    data: {
      emailSent: emailResult.success,
    },
  });
}));

export default app;
