/**
 * Encryption Utilities
 *
 * Purpose: Encrypt/decrypt sensitive data (provider credentials, API keys)
 *
 * Uses AES-256-GCM for encryption
 *
 * BEFORE MODIFYING:
 * - Will this change break existing encrypted data?
 * - Do we need a migration for re-encryption?
 * - Is the algorithm still secure?
 */

/**
 * Encrypt a string using AES-256-GCM
 * @param {string} text - Plain text to encrypt
 * @param {string} encryptionKey - Base64 encoded 256-bit key
 * @returns {string} - Encrypted data as base64 string (iv:authTag:ciphertext)
 */
export function encrypt(text, encryptionKey) {
  if (!text) return null;
  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }

  const crypto = require('crypto');

  // Decode the base64 key
  const key = Buffer.from(encryptionKey, 'base64');

  // Generate random IV (12 bytes for GCM)
  const iv = crypto.randomBytes(12);

  // Create cipher
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  // Encrypt the text
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  // Get auth tag
  const authTag = cipher.getAuthTag().toString('base64');

  // Return format: iv:authTag:ciphertext
  return `${iv.toString('base64')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt a string using AES-256-GCM
 * @param {string} encryptedData - Encrypted data (iv:authTag:ciphertext)
 * @param {string} encryptionKey - Base64 encoded 256-bit key
 * @returns {string} - Decrypted plain text
 */
export function decrypt(encryptedData, encryptionKey) {
  if (!encryptedData) return null;
  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }

  const crypto = require('crypto');

  try {
    // Parse the encrypted data
    const [ivBase64, authTagBase64, ciphertext] = encryptedData.split(':');

    if (!ivBase64 || !authTagBase64 || !ciphertext) {
      throw new Error('Invalid encrypted data format');
    }

    // Decode components
    const key = Buffer.from(encryptionKey, 'base64');
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');

    // Create decipher
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt
    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error.message);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Encrypt provider credentials as JSON
 * @param {object} credentials - Credentials object
 * @param {string} encryptionKey - Encryption key
 * @returns {string} - Encrypted JSON string
 */
export function encryptCredentials(credentials, encryptionKey) {
  const json = JSON.stringify(credentials);
  return encrypt(json, encryptionKey);
}

/**
 * Decrypt provider credentials from JSON
 * @param {string} encryptedData - Encrypted credentials
 * @param {string} encryptionKey - Encryption key
 * @returns {object} - Decrypted credentials object
 */
export function decryptCredentials(encryptedData, encryptionKey) {
  const json = decrypt(encryptedData, encryptionKey);
  return json ? JSON.parse(json) : null;
}
