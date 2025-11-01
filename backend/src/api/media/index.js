/**
 * Media API Router
 *
 * Purpose: Handle media file uploads and downloads for MMS
 *
 * Routes:
 * - POST /media/upload - Upload media file for MMS
 * - GET /media/:key - Download/serve media file
 *
 * Security:
 * - Only authenticated users can upload
 * - Only users from same company can download media
 */

import { Hono } from 'hono';
import { getPrisma } from '../../lib/prisma.js';
import {
  uploadFile,
  downloadFile,
  generateStorageKey,
  getFileCategory,
  isValidMmsFileType,
  getExtensionFromContentType,
} from '../../lib/storage.js';

const app = new Hono();

/**
 * POST /media/upload
 * Upload a media file for sending via MMS
 *
 * Accepts multipart/form-data with file field
 * Returns: { url: string, type: string, filename: string, size: number }
 */
app.post('/upload', async (c) => {
  try {
    const companyId = c.get('companyId');
    const prisma = getPrisma(c.env.DATABASE_URL);

    // Parse multipart form data
    const formData = await c.req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'File is required',
          },
        },
        400
      );
    }

    // Validate file type
    if (!isValidMmsFileType(file.type)) {
      return c.json(
        {
          success: false,
          error: {
            code: 'INVALID_FILE_TYPE',
            message: 'Unsupported file type. Supported: images, videos, audio, PDFs',
          },
        },
        400
      );
    }

    // Validate file size (max 5MB for MMS)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return c.json(
        {
          success: false,
          error: {
            code: 'FILE_TOO_LARGE',
            message: 'File size must be less than 5MB',
          },
        },
        400
      );
    }

    // Generate temporary ID for upload (will be replaced when message is created)
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Get file extension
    const extension = getExtensionFromContentType(file.type) ||
                      file.name.split('.').pop() ||
                      'bin';

    const filename = file.name || `upload.${extension}`;

    // Generate storage key
    const storageKey = generateStorageKey(companyId, tempId, filename);

    // Convert file to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Upload to R2
    await uploadFile(c.env.MEDIA_STORAGE, storageKey, arrayBuffer, {
      contentType: file.type,
      custom: {
        companyId,
        uploadedBy: c.get('userId'),
        temporary: 'true', // Mark as temporary until attached to message
      },
    });

    console.log('[Media] Uploaded file:', storageKey);

    return c.json({
      success: true,
      data: {
        url: storageKey,
        type: getFileCategory(file.type),
        filename,
        size: file.size,
        contentType: file.type,
      },
    });
  } catch (error) {
    console.error('[Media] Upload error:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'UPLOAD_FAILED',
          message: 'Failed to upload file',
        },
      },
      500
    );
  }
});

/**
 * GET /media/:companyId/:messageId/:filename
 * Serve a media file from R2
 *
 * Validates user has access to the company's media
 */
app.get('/:companyId/:messageId/:filename', async (c) => {
  try {
    const { companyId, messageId, filename } = c.req.param();
    const userCompanyId = c.get('companyId');

    // Verify user belongs to the same company
    if (companyId !== userCompanyId) {
      return c.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied',
          },
        },
        403
      );
    }

    // Construct storage key
    const storageKey = `media/${companyId}/${messageId}/${filename}`;

    // Download from R2
    const { data, metadata } = await downloadFile(c.env.MEDIA_STORAGE, storageKey);

    // Return file with appropriate headers
    return new Response(data, {
      headers: {
        'Content-Type': metadata.contentType || 'application/octet-stream',
        'Content-Length': metadata.size.toString(),
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
        'Access-Control-Allow-Origin': '*', // Allow CORS
      },
    });
  } catch (error) {
    console.error('[Media] Download error:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'File not found',
        },
      },
      404
    );
  }
});

export default app;
