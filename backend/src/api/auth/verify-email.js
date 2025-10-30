/**
 * Email Verification Endpoint
 *
 * GET /api/v1/auth/verify-email?token={verificationToken}
 *
 * Purpose: Verify user's email address and automatically log them in.
 *
 * Flow:
 * 1. Extract token from query parameter
 * 2. Find user by verification token
 * 3. Check if token is expired (24 hours)
 * 4. Check if email is already verified (idempotency - handle duplicate clicks)
 * 5. Mark email as verified
 * 6. Clear verification token (single-use)
 * 7. Generate JWT tokens (access + refresh)
 * 8. Return user data + tokens (auto-login)
 *
 * Query Parameters:
 * - token: string (verification token from email)
 *
 * Response (200 OK):
 * {
 *   success: true,
 *   message: "Email verified! You're now logged in.",
 *   data: {
 *     user: { id, email, name, role, companyId, emailVerified: true },
 *     company: { id, name },
 *     tokens: {
 *       accessToken: string,
 *       refreshToken: string
 *     }
 *   }
 * }
 *
 * Error Responses:
 * - 400: Missing token
 * - 404: Invalid token (user not found)
 * - 410: Token expired
 * - 200: Already verified (idempotent - returns same success response)
 *
 * Security Features:
 * - Single-use tokens (cleared after verification)
 * - Time-limited tokens (24-hour expiry)
 * - Idempotent (safe to click link multiple times)
 * - Prevents duplicate email issues
 *
 * Used by:
 * - Email verification link (one-click magic link)
 * - Frontend /verify-email page
 */

import { Hono } from 'hono';
import { getPrisma } from '../../lib/prisma.js';
import { generateAccessToken, generateRefreshToken } from '../../utils/jwt.js';
import { APIError, asyncHandler } from '../../middleware/error-handler.js';
import { logger } from '../../utils/logger.js';

const app = new Hono();

app.get('/', asyncHandler(async (c) => {
  const token = c.req.query('token');

  // Validate token parameter
  if (!token) {
    throw new APIError(
      'MISSING_TOKEN',
      'Verification token is required',
      400
    );
  }

  // Get database client
  const db = getPrisma(c.env.DATABASE_URL);

  // Find user by verification token
  const user = await db.user.findFirst({
    where: { verificationToken: token },
    include: { company: true },
  });

  // Invalid token - user not found
  if (!user) {
    throw new APIError(
      'INVALID_TOKEN',
      'Invalid verification token. This link may have already been used or is incorrect.',
      404
    );
  }

  // Check if already verified (idempotency - safe to click multiple times)
  if (user.emailVerified) {
    logger.info('Email already verified - returning success (idempotent)', {
      userId: user.id,
      email: user.email,
    });

    // Generate tokens and return success (same as if just verified)
    const jwtSecret = c.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new APIError(
        'SERVER_CONFIGURATION_ERROR',
        'JWT secret not configured',
        500
      );
    }

    const tokenPayload = {
      userId: user.id,
      companyId: user.companyId,
      role: user.role,
    };

    const accessToken = await generateAccessToken(tokenPayload, jwtSecret);
    const refreshToken = await generateRefreshToken(tokenPayload, jwtSecret);

    return c.json({
      success: true,
      message: "Email already verified! You're now logged in.",
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          companyId: user.companyId,
          emailVerified: true,
        },
        company: {
          id: user.company.id,
          name: user.company.name,
        },
        tokens: {
          accessToken,
          refreshToken,
        },
      },
    });
  }

  // Check if token is expired
  if (user.verificationTokenExpiry && user.verificationTokenExpiry < new Date()) {
    throw new APIError(
      'TOKEN_EXPIRED',
      'Verification link has expired. Please request a new verification email.',
      410,
      { canResend: true }
    );
  }

  // Verify email and clear token (single-use)
  const updatedUser = await db.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      verificationToken: null,
      verificationTokenExpiry: null,
    },
  });

  logger.info('Email verified successfully', {
    userId: updatedUser.id,
    email: updatedUser.email,
  });

  // Generate JWT tokens for auto-login
  const jwtSecret = c.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new APIError(
      'SERVER_CONFIGURATION_ERROR',
      'JWT secret not configured',
      500
    );
  }

  const tokenPayload = {
    userId: updatedUser.id,
    companyId: updatedUser.companyId,
    role: updatedUser.role,
  };

  const accessToken = await generateAccessToken(tokenPayload, jwtSecret);
  const refreshToken = await generateRefreshToken(tokenPayload, jwtSecret);

  // Return user data and tokens (auto-login)
  return c.json({
    success: true,
    message: "Email verified! You're now logged in.",
    data: {
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        companyId: updatedUser.companyId,
        emailVerified: true,
      },
      company: {
        id: user.company.id,
        name: user.company.name,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    },
  });
}));

export default app;
