/**
 * Public Media API Router
 *
 * Purpose: Serve media files for external services (Twilio MMS)
 *
 * Routes:
 * - GET /public-media/:token - Serve media file with token authentication
 *
 * Security:
 * - Token-based authentication (no user login required)
 * - Tokens expire after 1 hour
 * - Tokens are single-use for specific files
 */

import { Hono } from 'hono';
import { downloadFile, verifyMediaToken } from '../../lib/storage.js';

const app = new Hono();

/**
 * GET /public-media/:token
 * Serve a media file with token authentication
 *
 * Used by Twilio to fetch MMS attachments
 */
app.get('/:token', async (c) => {
  try {
    const { token } = c.req.param();

    // Verify token
    const verification = verifyMediaToken(token, c.env.ENCRYPTION_KEY);

    if (!verification.valid) {
      console.error('[Public Media] Invalid token:', verification.reason);
      return c.json(
        {
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid or expired media token',
          },
        },
        403
      );
    }

    const { storageKey } = verification;

    console.log('[Public Media] Serving file:', storageKey);

    // Download from R2
    const { data, metadata } = await downloadFile(c.env.MEDIA_STORAGE, storageKey);

    // Return file with appropriate headers
    return new Response(data, {
      headers: {
        'Content-Type': metadata.contentType || 'application/octet-stream',
        'Content-Length': metadata.size.toString(),
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Access-Control-Allow-Origin': '*', // Allow CORS
      },
    });
  } catch (error) {
    console.error('[Public Media] Download error:', error);
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
