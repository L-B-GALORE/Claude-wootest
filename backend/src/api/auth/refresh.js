/**
 * Refresh Token Endpoint
 *
 * POST /api/v1/auth/refresh
 *
 * Purpose: Generate new access token using refresh token.
 *
 * Flow:
 * 1. Extract refresh token from request body
 * 2. Verify refresh token is valid and not expired
 * 3. Ensure it's a refresh token (not access token)
 * 4. Generate new access token
 * 5. Optionally rotate refresh token (security best practice)
 * 6. Return new tokens
 *
 * Request Body:
 * {
 *   refreshToken: string
 * }
 *
 * Response (200 OK):
 * {
 *   success: true,
 *   data: {
 *     accessToken: string,
 *     refreshToken: string  // New refresh token (rotation)
 *   }
 * }
 *
 * Security:
 * - Refresh token rotation: Each use generates a new refresh token
 * - Old refresh token becomes invalid
 * - Prevents replay attacks
 *
 * BEFORE MODIFYING:
 * - Will this break existing refresh token logic in frontend?
 * - Should we store used refresh tokens (revocation list)?
 * - Do we need to invalidate all refresh tokens on password change?
 *
 * Used by:
 * - Frontend axios interceptor (auto-refresh on 401)
 * - App initialization (restore session)
 */

import { Hono } from 'hono';
import { verifyToken } from '../../utils/jwt.js';
import { generateAccessToken, generateRefreshToken } from '../../utils/jwt.js';
import { APIError, asyncHandler } from '../../middleware/error-handler.js';
import { logger } from '../../utils/logger.js';

const app = new Hono();

app.post('/refresh', asyncHandler(async (c) => {
  const body = await c.req.json();
  const { refreshToken } = body;

  // Validate refresh token provided
  if (!refreshToken) {
    throw new APIError(
      'VALIDATION_ERROR',
      'Missing required field: refreshToken',
      400
    );
  }

  // Verify refresh token
  const jwtSecret = c.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new APIError(
      'SERVER_CONFIGURATION_ERROR',
      'JWT secret not configured',
      500
    );
  }

  const { valid, payload, error } = await verifyToken(refreshToken, jwtSecret);

  if (!valid) {
    throw new APIError(
      'INVALID_REFRESH_TOKEN',
      'Invalid or expired refresh token',
      401,
      { reason: error }
    );
  }

  // Ensure it's a refresh token (not access token)
  if (payload.type !== 'refresh') {
    throw new APIError(
      'INVALID_TOKEN_TYPE',
      'Invalid token type. Expected refresh token.',
      401
    );
  }

  logger.info('Refresh token used', {
    userId: payload.userId,
    companyId: payload.companyId,
  });

  // Generate new tokens
  const tokenPayload = {
    userId: payload.userId,
    companyId: payload.companyId,
    role: payload.role,
  };

  const newAccessToken = await generateAccessToken(tokenPayload, jwtSecret);
  const newRefreshToken = await generateRefreshToken(tokenPayload, jwtSecret);

  // Return new tokens
  return c.json({
    success: true,
    data: {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    },
  });
}));

export default app;
