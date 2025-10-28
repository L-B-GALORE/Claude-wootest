/**
 * Voice API Router
 *
 * Purpose: Handle voice call operations
 *
 * Routes:
 * - POST /voice/token - Generate Twilio access token for browser calls
 * - GET /voice/caller-ids - Get available caller IDs for outbound calls
 *
 * BEFORE MODIFYING:
 * - Tokens should expire appropriately
 * - Validate user has permission to make calls
 */

import { Hono } from 'hono';
import { getPrisma } from '../../lib/prisma.js';
import { generateAccessToken } from '../../lib/twilio.js';
import { decryptCredentials } from '../../lib/encryption.js';
import callerIdsRouter from './caller-ids.js';

const app = new Hono();

// Mount caller IDs router
app.route('/caller-ids', callerIdsRouter);

// Generate Twilio access token for browser SDK
app.post('/token', async (c) => {
  try {
    const userId = c.get('userId');
    const companyId = c.get('companyId');
    const prisma = getPrisma(c.env.DATABASE_URL);

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (!user) {
      return c.json(
        {
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          },
        },
        404
      );
    }

    // Get Twilio provider for this company
    const provider = await prisma.provider.findFirst({
      where: {
        companyId: companyId,
        type: 'TWILIO',
        status: 'ACTIVE',
      },
    });

    if (!provider) {
      return c.json(
        {
          success: false,
          error: {
            code: 'PROVIDER_NOT_FOUND',
            message: 'No active Twilio provider found',
          },
        },
        404
      );
    }

    // Decrypt credentials
    const credentials = await decryptCredentials(
      provider.credentials,
      c.env.ENCRYPTION_KEY
    );

    console.log('[Voice Token] Generating token for user:', userId);

    // Generate access token using the API key and TwiML App SID
    const token = await generateAccessToken(
      credentials.accountSid,
      credentials.apiKeySid,
      credentials.apiKeySecret,
      credentials.twimlAppSid,
      userId,
      user.name
    );

    return c.json({
      success: true,
      data: {
        token,
        identity: userId,
      },
    });
  } catch (error) {
    console.error('Failed to generate access token:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'TOKEN_GENERATION_FAILED',
          message: error.message || 'Failed to generate access token',
        },
      },
      500
    );
  }
});

export default app;
