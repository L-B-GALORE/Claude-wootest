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
 * 4. Create company record
 * 5. Create owner user record
 * 6. Generate JWT tokens (access + refresh)
 * 7. Return user data + tokens
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
 * - Will this change break existing registration flow?
 * - Do we need email verification? (not yet, but plan for it)
 * - Should we send welcome email? (future)
 *
 * Used by:
 * - Frontend registration page
 */

import { Hono } from 'hono';
import { getPrismaClient } from '../../services/database.js';
import { hashPassword, validatePasswordStrength } from '../../utils/password.js';
import { generateAccessToken, generateRefreshToken } from '../../utils/jwt.js';
import { APIError, asyncHandler } from '../../middleware/error-handler.js';
import { logger } from '../../utils/logger.js';

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
  const db = getPrismaClient(c.env);

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

  // Create company
  const company = await db.company.create({
    data: {
      name: companyName,
    },
  });

  logger.info('Company created', { companyId: company.id, companyName });

  // Create owner user
  const user = await db.user.create({
    data: {
      companyId: company.id,
      email: email.toLowerCase(),
      name,
      passwordHash,
      role: 'OWNER',
    },
  });

  logger.info('User registered', {
    userId: user.id,
    companyId: company.id,
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
    companyId: company.id,
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
        id: company.id,
        name: company.name,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    },
  }, 201);
}));

export default app;
