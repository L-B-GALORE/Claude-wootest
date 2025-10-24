/**
 * Error Handler Middleware
 *
 * Purpose: Centralized error handling for consistent error responses.
 *
 * Error Response Format:
 * {
 *   success: false,
 *   error: {
 *     code: string,        // e.g., 'VALIDATION_ERROR', 'UNAUTHORIZED'
 *     message: string,     // User-friendly error message
 *     details?: object     // Additional error details (only in development)
 *   }
 * }
 *
 * HTTP Status Codes:
 * - 400: Bad Request (validation errors)
 * - 401: Unauthorized (missing/invalid token)
 * - 403: Forbidden (insufficient permissions)
 * - 404: Not Found
 * - 409: Conflict (duplicate resource)
 * - 429: Too Many Requests (rate limit)
 * - 500: Internal Server Error
 *
 * BEFORE MODIFYING:
 * - Will this change affect frontend error handling?
 * - Are we exposing sensitive information in error messages?
 * - Should we log this error before returning response?
 *
 * Used by:
 * - All API endpoints (via try/catch or throw)
 * - Global error handler in index.js
 */

import { logger } from '../utils/logger.js';

/**
 * Custom error class for API errors
 */
export class APIError extends Error {
  constructor(code, message, statusCode = 500, details = null) {
    super(message);
    this.name = 'APIError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Error handler middleware
 */
export function errorHandler(err, c) {
  // Log the error
  logger.error('Request error', err, {
    path: c.req.path,
    method: c.req.method,
    companyId: c.get('companyId'),
    userId: c.get('userId'),
  });

  // Handle known API errors
  if (err instanceof APIError) {
    return c.json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details && { details: err.details }),
      },
    }, err.statusCode);
  }

  // Handle validation errors (from Zod or similar)
  if (err.name === 'ZodError') {
    return c.json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: err.errors,
      },
    }, 400);
  }

  // Handle unknown errors (don't expose internal details)
  return c.json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    },
  }, 500);
}

/**
 * Async handler wrapper (catches async errors)
 */
export function asyncHandler(fn) {
  return async (c) => {
    try {
      return await fn(c);
    } catch (error) {
      return errorHandler(error, c);
    }
  };
}
