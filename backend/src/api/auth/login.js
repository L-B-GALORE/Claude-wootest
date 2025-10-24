/**
 * Login Endpoint
 *
 * POST /api/v1/auth/login
 *
 * Purpose: Authenticate user and return JWT tokens.
 *
 * Flow:
 * 1. Validate request body (email, password)
 * 2. Find user by email
 * 3. Verify password
 * 4. Generate JWT tokens (access + refresh)
 * 5. Update lastActiveAt timestamp
 * 6. Return user data + tokens
 *
 * Request Body:
 * {
 *   email: string,
 *   password: string
 * }
 *
 * Response (200 OK):
 * {
 *   success: true,
 *   data: {
 *     user: { id, email, name, role, companyId },
 *     company: { id, name },
 *     tokens: {
 *       accessToken: string,
 *       refreshToken: string
 *     }
 *   }
 * }
 *
 * BEFORE MODIFYING:
 * - Will this change affect existing login sessions?
 * - Do we need rate limiting? (add later)
 * - Should we log failed login attempts? (security feature)
 *
 * Used by:
 * - Frontend login page
 */

import { Hono } from 'hono';
import { getPrismaClient } from '../../services/database.js';
import { verifyPassword } from '../../utils/password.js';
import { generateAccessToken, generateRefreshToken } from '../../utils/jwt.js';
import { APIError, asyncHandler } from '../../middleware/error-handler.js';
import { logger } from '../../utils/logger.js';

const app = new Hono();

app.post('/', asyncHandler(async (c) => {
  const body = await c.req.json();
  const { email, password } = body;

  // Validate required fields
  if (!email || !password) {
    throw new APIError(
      'VALIDATION_ERROR',
      'Missing required fields: email, password',
      400
    );
  }

  // Get database client
  const db = getPrismaClient(c.env);

  // Find user by email (include company data)
  const user = await db.user.findFirst({
    where: { email: email.toLowerCase() },
    include: {
      company: true,
    },
  });

  if (!user) {
    // Don't reveal if email exists or not (security)
    throw new APIError(
      'INVALID_CREDENTIALS',
      'Invalid email or password',
      401
    );
  }

  // Verify password
  const isPasswordValid = await verifyPassword(password, user.passwordHash);

  if (!isPasswordValid) {
    logger.warn('Failed login attempt', { email, userId: user.id });

    throw new APIError(
      'INVALID_CREDENTIALS',
      'Invalid email or password',
      401
    );
  }

  // Update last active timestamp
  await db.user.update({
    where: { id: user.id },
    data: { lastActiveAt: new Date() },
  });

  logger.info('User logged in', {
    userId: user.id,
    companyId: user.companyId,
    email: user.email,
  });

  // Generate JWT tokens
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

  // Return user data and tokens
  return c.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        companyId: user.companyId,
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
