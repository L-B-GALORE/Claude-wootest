/**
 * Cloudflare R2 Storage Utilities
 *
 * Purpose: Handle media file uploads/downloads for MMS messages
 *
 * Storage Structure:
 * - media/{companyId}/{messageId}/{filename}
 *
 * Supported File Types:
 * - Images: image/jpeg, image/png, image/gif, image/webp
 * - Videos: video/mp4, video/quicktime
 * - Audio: audio/mpeg, audio/ogg, audio/wav
 * - Documents: application/pdf, text/plain
 *
 * BEFORE MODIFYING:
 * - Will this affect existing media URLs?
 * - Are we handling file size limits?
 * - Is the storage bucket correctly configured?
 */

/**
 * Upload a file to R2 storage
 *
 * @param {R2Bucket} bucket - R2 bucket binding from env
 * @param {string} key - Storage key (path)
 * @param {ArrayBuffer|ReadableStream} data - File data
 * @param {object} metadata - File metadata (contentType, size, etc.)
 * @returns {Promise<string>} - Storage key
 */
export async function uploadFile(bucket, key, data, metadata = {}) {
  try {
    await bucket.put(key, data, {
      httpMetadata: {
        contentType: metadata.contentType || 'application/octet-stream',
      },
      customMetadata: {
        uploadedAt: new Date().toISOString(),
        ...metadata.custom,
      },
    });

    console.log('[Storage] Uploaded file to R2:', key);
    return key;
  } catch (error) {
    console.error('[Storage] Failed to upload file:', error);
    throw new Error('Failed to upload file to storage');
  }
}

/**
 * Download a file from R2 storage
 *
 * @param {R2Bucket} bucket - R2 bucket binding from env
 * @param {string} key - Storage key (path)
 * @returns {Promise<{data: ArrayBuffer, metadata: object}>} - File data and metadata
 */
export async function downloadFile(bucket, key) {
  try {
    const object = await bucket.get(key);

    if (!object) {
      throw new Error('File not found');
    }

    const data = await object.arrayBuffer();
    const metadata = {
      contentType: object.httpMetadata?.contentType,
      size: object.size,
      uploaded: object.uploaded,
      customMetadata: object.customMetadata,
    };

    return { data, metadata };
  } catch (error) {
    console.error('[Storage] Failed to download file:', error);
    throw new Error('Failed to download file from storage');
  }
}

/**
 * Delete a file from R2 storage
 *
 * @param {R2Bucket} bucket - R2 bucket binding from env
 * @param {string} key - Storage key (path)
 * @returns {Promise<void>}
 */
export async function deleteFile(bucket, key) {
  try {
    await bucket.delete(key);
    console.log('[Storage] Deleted file from R2:', key);
  } catch (error) {
    console.error('[Storage] Failed to delete file:', error);
    throw new Error('Failed to delete file from storage');
  }
}

/**
 * Generate a storage key for a media file
 *
 * @param {string} companyId - Company ID
 * @param {string} messageId - Message ID
 * @param {string} filename - Original filename
 * @returns {string} - Storage key
 */
export function generateStorageKey(companyId, messageId, filename) {
  // Sanitize filename (remove special characters)
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `media/${companyId}/${messageId}/${sanitized}`;
}

/**
 * Download media from external URL (Twilio MMS)
 *
 * @param {string} url - Media URL
 * @param {string} authToken - Twilio auth token (for Basic Auth)
 * @param {string} accountSid - Twilio account SID (for Basic Auth)
 * @returns {Promise<{data: ArrayBuffer, contentType: string, size: number}>}
 */
export async function downloadExternalMedia(url, authToken, accountSid) {
  try {
    console.log('[Storage] Downloading external media:', url);

    // Twilio requires Basic Auth for media downloads
    const auth = btoa(`${accountSid}:${authToken}`);

    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download media: ${response.status} ${response.statusText}`);
    }

    const data = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const size = data.byteLength;

    console.log('[Storage] Downloaded external media:', {
      size,
      contentType,
    });

    return { data, contentType, size };
  } catch (error) {
    console.error('[Storage] Failed to download external media:', error);
    throw error;
  }
}

/**
 * Get file type category from content type
 *
 * @param {string} contentType - MIME type
 * @returns {string} - Category (image, video, audio, document)
 */
export function getFileCategory(contentType) {
  if (contentType.startsWith('image/')) return 'image';
  if (contentType.startsWith('video/')) return 'video';
  if (contentType.startsWith('audio/')) return 'audio';
  return 'document';
}

/**
 * Validate file type for MMS
 *
 * @param {string} contentType - MIME type
 * @returns {boolean} - True if valid
 */
export function isValidMmsFileType(contentType) {
  const allowedTypes = [
    // Images
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    // Videos
    'video/mp4',
    'video/quicktime',
    'video/3gpp',
    // Audio
    'audio/mpeg',
    'audio/mp3',
    'audio/ogg',
    'audio/wav',
    'audio/amr',
    // Documents
    'application/pdf',
    'text/plain',
    'text/vcard',
  ];

  return allowedTypes.includes(contentType);
}

/**
 * Get file extension from content type
 *
 * @param {string} contentType - MIME type
 * @returns {string} - File extension
 */
export function getExtensionFromContentType(contentType) {
  const map = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/3gpp': '3gp',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'audio/amr': 'amr',
    'application/pdf': 'pdf',
    'text/plain': 'txt',
    'text/vcard': 'vcf',
  };

  return map[contentType] || 'bin';
}

/**
 * Generate a presigned URL for R2 object (for Twilio MMS)
 *
 * NOTE: R2 doesn't natively support presigned URLs like S3.
 * We need to create a public access endpoint or use a token-based system.
 *
 * For now, we'll create a public endpoint with a temporary token.
 *
 * @param {string} storageKey - Storage key (path)
 * @param {number} expiresIn - Expiration time in seconds (default: 3600 = 1 hour)
 * @returns {string} - Token to append to public URL
 */
export function generateMediaToken(storageKey, secret, expiresIn = 3600) {
  const encoder = new TextEncoder();
  const data = encoder.encode(storageKey + ':' + (Date.now() + expiresIn * 1000));

  // Simple HMAC-like token (in production, use proper HMAC)
  // For now, just base64 encode with expiry
  const token = btoa(`${storageKey}:${Date.now() + expiresIn * 1000}:${secret.substring(0, 16)}`);
  return token;
}

/**
 * Verify media token
 *
 * @param {string} token - Token to verify
 * @param {string} secret - Secret key
 * @returns {object|null} - { storageKey, valid } or null if invalid
 */
export function verifyMediaToken(token, secret) {
  try {
    const decoded = atob(token);
    const [storageKey, expiryStr, tokenSecret] = decoded.split(':');
    const expiry = parseInt(expiryStr, 10);

    // Check expiry
    if (Date.now() > expiry) {
      return { valid: false, reason: 'expired' };
    }

    // Check secret
    if (tokenSecret !== secret.substring(0, 16)) {
      return { valid: false, reason: 'invalid' };
    }

    return { valid: true, storageKey };
  } catch (error) {
    return { valid: false, reason: 'malformed' };
  }
}
