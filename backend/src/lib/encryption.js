/**
 * Encryption Utilities (Web Crypto API version for Cloudflare Workers)
 *
 * Purpose: Encrypt/decrypt sensitive data (provider credentials, API keys)
 *
 * Uses AES-256-GCM for encryption with Web Crypto API
 *
 * BEFORE MODIFYING:
 * - Will this change break existing encrypted data?
 * - Do we need a migration for re-encryption?
 * - Is the algorithm still secure?
 */

/**
 * Convert hex string to ArrayBuffer
 */
function hexToArrayBuffer(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes.buffer;
}

/**
 * Convert ArrayBuffer to hex string
 */
function arrayBufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 string to ArrayBuffer
 */
function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Encrypt a string using AES-256-GCM
 * @param {string} text - Plain text to encrypt
 * @param {string} encryptionKey - Hex encoded 256-bit key
 * @returns {Promise<string>} - Encrypted data as base64 string (iv:authTag:ciphertext)
 */
export async function encrypt(text, encryptionKey) {
  if (!text) return null;
  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }

  try {
    // Convert hex key to ArrayBuffer
    const keyData = hexToArrayBuffer(encryptionKey);

    // Import the key
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    // Generate random IV (12 bytes for GCM)
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encode text to bytes
    const encoder = new TextEncoder();
    const data = encoder.encode(text);

    // Encrypt
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128, // 128-bit auth tag
      },
      key,
      data
    );

    // Split encrypted data: last 16 bytes are auth tag, rest is ciphertext
    const encryptedArray = new Uint8Array(encrypted);
    const ciphertext = encryptedArray.slice(0, -16);
    const authTag = encryptedArray.slice(-16);

    // Convert to base64 and return format: iv:authTag:ciphertext
    const ivBase64 = arrayBufferToBase64(iv);
    const authTagBase64 = arrayBufferToBase64(authTag);
    const ciphertextBase64 = arrayBufferToBase64(ciphertext);

    return `${ivBase64}:${authTagBase64}:${ciphertextBase64}`;
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt a string using AES-256-GCM
 * @param {string} encryptedData - Encrypted data (iv:authTag:ciphertext)
 * @param {string} encryptionKey - Hex encoded 256-bit key
 * @returns {Promise<string>} - Decrypted plain text
 */
export async function decrypt(encryptedData, encryptionKey) {
  if (!encryptedData) return null;
  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }

  try {
    // Parse the encrypted data
    const [ivBase64, authTagBase64, ciphertextBase64] = encryptedData.split(':');

    if (!ivBase64 || !authTagBase64 || !ciphertextBase64) {
      throw new Error('Invalid encrypted data format');
    }

    // Convert from base64
    const iv = base64ToArrayBuffer(ivBase64);
    const authTag = base64ToArrayBuffer(authTagBase64);
    const ciphertext = base64ToArrayBuffer(ciphertextBase64);

    // Combine ciphertext and auth tag (Web Crypto expects them together)
    const combined = new Uint8Array(ciphertext.byteLength + authTag.byteLength);
    combined.set(new Uint8Array(ciphertext), 0);
    combined.set(new Uint8Array(authTag), ciphertext.byteLength);

    // Convert hex key to ArrayBuffer
    const keyData = hexToArrayBuffer(encryptionKey);

    // Import the key
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: new Uint8Array(iv),
        tagLength: 128,
      },
      key,
      combined
    );

    // Decode to string
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error.message);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Encrypt provider credentials as JSON
 * @param {object} credentials - Credentials object
 * @param {string} encryptionKey - Encryption key
 * @returns {Promise<string>} - Encrypted JSON string
 */
export async function encryptCredentials(credentials, encryptionKey) {
  const json = JSON.stringify(credentials);
  return await encrypt(json, encryptionKey);
}

/**
 * Decrypt provider credentials from JSON
 * @param {string} encryptedData - Encrypted credentials
 * @param {string} encryptionKey - Encryption key
 * @returns {Promise<object>} - Decrypted credentials object
 */
export async function decryptCredentials(encryptedData, encryptionKey) {
  const json = await decrypt(encryptedData, encryptionKey);
  return json ? JSON.parse(json) : null;
}
