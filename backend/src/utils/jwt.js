/**
 * JWT Utilities
 *
 * Purpose: Generate and verify JWT tokens for authentication.
 *
 * Token Types:
 * - Access Token: Short-lived (15 minutes), for API requests
 * - Refresh Token: Long-lived (7 days), for getting new access tokens
 *
 * Token Payload:
 * - userId: User ID
 * - companyId: Company ID (for tenant isolation)
 * - role: User role (owner, admin, agent)
 * - type: 'access' or 'refresh'
 * - iat: Issued at (timestamp)
 * - exp: Expires at (timestamp)
 *
 * BEFORE MODIFYING:
 * - Will this change break existing token validation?
 * - Do we need to update the frontend token handling?
 * - Should we add token versioning for migration?
 *
 * Used by:
 * - /api/auth/register - Generate tokens on registration
 * - /api/auth/login - Generate tokens on login
 * - /api/auth/refresh - Generate new access token from refresh token
 * - Auth middleware - Verify tokens on protected routes
 */

import * as jose from 'jose';

/**
 * Generate JWT access token (15 minute expiry)
 */
export async function generateAccessToken(payload, secret) {
  const encoder = new TextEncoder();
  const secretKey = encoder.encode(secret);

  const jwt = await new jose.SignJWT({
    userId: payload.userId,
    companyId: payload.companyId,
    role: payload.role,
    type: 'access',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(secretKey);

  return jwt;
}

/**
 * Generate JWT refresh token (7 day expiry)
 */
export async function generateRefreshToken(payload, secret) {
  const encoder = new TextEncoder();
  const secretKey = encoder.encode(secret);

  const jwt = await new jose.SignJWT({
    userId: payload.userId,
    companyId: payload.companyId,
    type: 'refresh',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secretKey);

  return jwt;
}

/**
 * Verify JWT token
 */
export async function verifyToken(token, secret) {
  try {
    const encoder = new TextEncoder();
    const secretKey = encoder.encode(secret);

    const { payload } = await jose.jwtVerify(token, secretKey);
    return { valid: true, payload };
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return { valid: false, error: error.message };
  }
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.substring(7); // Remove 'Bearer ' prefix
}
