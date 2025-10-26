/**
 * Authentication Middleware
 *
 * Purpose: Verify JWT tokens and attach user/company context to requests.
 *
 * Flow:
 * 1. Extract token from Authorization header
 * 2. Verify token signature and expiration
 * 3. Attach user data to request context (c.set())
 * 4. Allow request to proceed or return 401
 *
 * Request Context (after successful auth):
 * - c.get('userId') - Current user ID
 * - c.get('companyId') - Current company ID (for tenant isolation)
 * - c.get('userRole') - User role (owner, admin, agent)
 *
 * BEFORE MODIFYING:
 * - Will this break existing authenticated endpoints?
 * - Do we need to update token structure?
 * - Should we check token revocation list?
 *
 * Used by:
 * - All protected API routes
 * - Applied via app.use() in route groups
 */

import { verifyToken, extractTokenFromHeader } from '../utils/jwt.js';
import { APIError } from './error-handler.js';

/**
 * Authentication middleware
 * Verifies JWT token and attaches user context
 */
export async function authMiddleware(c, next) {
  const authHeader = c.req.header('Authorization');
  const token = extractTokenFromHeader(authHeader);

  if (!token) {
    throw new APIError(
      'UNAUTHORIZED',
      'Missing authentication token',
      401
    );
  }

  const jwtSecret = c.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new APIError(
      'SERVER_CONFIGURATION_ERROR',
      'JWT secret not configured',
      500
    );
  }

  const { valid, payload, error } = await verifyToken(token, jwtSecret);

  if (!valid) {
    throw new APIError(
      'INVALID_TOKEN',
      'Invalid or expired token',
      401,
      { reason: error }
    );
  }

  // Ensure it's an access token (not refresh token)
  if (payload.type !== 'access') {
    throw new APIError(
      'INVALID_TOKEN_TYPE',
      'Invalid token type. Use access token for API requests.',
      401
    );
  }

  // Attach user context to request
  c.set('userId', payload.userId);
  c.set('companyId', payload.companyId);
  c.set('userRole', payload.role);

  await next();
}

/**
 * Optional authentication middleware
 * Attaches user context if token is valid, but doesn't require it
 */
export async function optionalAuthMiddleware(c, next) {
  const authHeader = c.req.header('Authorization');
  const token = extractTokenFromHeader(authHeader);

  if (token && c.env.JWT_SECRET) {
    const { valid, payload } = await verifyToken(token, c.env.JWT_SECRET);

    if (valid && payload.type === 'access') {
      c.set('userId', payload.userId);
      c.set('companyId', payload.companyId);
      c.set('userRole', payload.role);
    }
  }

  await next();
}
