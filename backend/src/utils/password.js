/**
 * Password Utilities
 *
 * Purpose: Hash and verify passwords securely using bcrypt.
 *
 * Security:
 * - Uses bcrypt with 10 rounds (good balance of security vs performance)
 * - Never store plain text passwords
 * - Always hash before storing in database
 *
 * BEFORE MODIFYING:
 * - Will changing the salt rounds invalidate existing passwords?
 * - Do we need a password migration strategy?
 * - Should we add password strength validation here?
 *
 * Used by:
 * - /api/auth/register - Hash password on registration
 * - /api/auth/login - Verify password on login
 * - /api/users/update-password - Hash new password
 */

import bcrypt from 'bcryptjs';

/**
 * Hash a password
 * @param {string} password - Plain text password
 * @returns {Promise<string>} - Hashed password
 */
export async function hashPassword(password) {
  const saltRounds = 10;
  const hash = await bcrypt.hash(password, saltRounds);
  return hash;
}

/**
 * Verify a password against a hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password from database
 * @returns {Promise<boolean>} - True if password matches
 */
export async function verifyPassword(password, hash) {
  const isValid = await bcrypt.compare(password, hash);
  return isValid;
}

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
export function validatePasswordStrength(password) {
  const errors = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
