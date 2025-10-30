/**
 * Registration Endpoint
 *
 * POST /api/v1/auth/register
 *
 * Purpose: Register a new company with owner user.
 *
 * Flow:
 * 1. Validate request body (company name, user email, password)
 * 2. Check if email already exists
 * 3. Hash password
 * 4. Generate verification token (single-use, 24-hour expiry)
 * 5. Create company record
 * 6. Create owner user record (emailVerified=false)
 * 7. Send verification email with magic link
 * 8. Return success (NO tokens - user must verify email first)
 *
 * Request Body:
 * {
 *   companyName: string,
 *   name: string,
 *   email: string,
 *   password: string
 * }
 *
 * Response (201 Created):
 * {
 *   success: true,
 *   message: "Account created! Check your email to verify and login.",
 *   data: {
 *     user: { id, email, name },
 *     company: { id, name },
 *     emailSent: boolean
 *   }
 * }
 *
 * Email Verification:
 * - Sends email with one-click verification link
 * - Link format: {FRONTEND_URL}/verify-email?token={verificationToken}
 * - Clicking link verifies email AND logs user in automatically
 * - Token is single-use and expires in 24 hours
 *
 * Used by:
 * - Frontend registration page
 */

import { Hono } from 'hono';
import { getPrisma } from '../../lib/prisma.js';
import { hashPassword, validatePasswordStrength } from '../../utils/password.js';
import { APIError, asyncHandler } from '../../middleware/error-handler.js';
import { logger } from '../../utils/logger.js';
import { sendVerificationEmail } from '../../lib/email.js';

const app = new Hono();

app.post('/', asyncHandler(async (c) => {
  const body = await c.req.json();
  const { companyName, name, email, password } = body;

  // Validate required fields
  if (!companyName || !name || !email || !password) {
    throw new APIError(
      'VALIDATION_ERROR',
      'Missing required fields: companyName, name, email, password',
      400
    );
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new APIError(
      'INVALID_EMAIL',
      'Invalid email format',
      400
    );
  }

  // Validate password strength
  const passwordValidation = validatePasswordStrength(password);
  if (!passwordValidation.valid) {
    throw new APIError(
      'WEAK_PASSWORD',
      'Password does not meet requirements',
      400,
      { errors: passwordValidation.errors }
    );
  }

  // Get database client
  const db = getPrisma(c.env.DATABASE_URL);

  // Check if email already exists
  const existingUser = await db.user.findFirst({
    where: { email: email.toLowerCase() },
  });

  if (existingUser) {
    throw new APIError(
      'EMAIL_ALREADY_EXISTS',
      'An account with this email already exists',
      409
    );
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Generate verification token (single-use, cryptographically random)
  // Using 32 bytes = 64 hex characters for strong uniqueness
  const verificationToken = crypto.randomUUID() + '-' + Date.now() + '-' + crypto.randomUUID();
  const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Create company
  const company = await db.company.create({
    data: {
      name: companyName,
    },
  });

  logger.info('Company created', { companyId: company.id, companyName });

  // Create owner user (emailVerified=false by default)
  const user = await db.user.create({
    data: {
      companyId: company.id,
      email: email.toLowerCase(),
      name,
      passwordHash,
      role: 'OWNER',
      emailVerified: false,
      verificationToken,
      verificationTokenExpiry,
    },
  });

  logger.info('User registered - email verification required', {
    userId: user.id,
    companyId: company.id,
    email: user.email,
  });

  // Determine frontend URL based on environment
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
    logger.info('Verification email sent', { userId: user.id, email: user.email });
  } else {
    logger.error('Failed to send verification email', {
      userId: user.id,
      email: user.email,
      error: emailResult.error,
    });
  }

  // Return success WITHOUT tokens
  // User must verify email first - clicking link will auto-login
  return c.json({
    success: true,
    message: 'Account created! Check your email to verify and login.',
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      company: {
        id: company.id,
        name: company.name,
      },
      emailSent: emailResult.success,
    },
  }, 201);
}));

export default app;
