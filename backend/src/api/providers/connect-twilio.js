/**
 * Connect Twilio Provider
 *
 * POST /api/v1/providers/twilio
 *
 * Purpose: Connect a Twilio account to the company
 *
 * Process:
 * 1. Validate Account SID + Auth Token
 * 2. Create TwiML App in Twilio account
 * 3. Generate REST API Key
 * 4. Generate Access Token API Key
 * 5. Encrypt and store all credentials
 *
 * BEFORE MODIFYING:
 * - Will this break existing provider connections?
 * - Are we properly cleaning up on failure?
 * - Is error handling comprehensive?
 */

import { Hono } from 'hono';
import { getPrisma } from '../../lib/prisma.js';
import {
  validateTwilioCredentials,
  createTwiMLApp,
  createTwilioAPIKey,
} from '../../lib/twilio.js';
import { encryptCredentials } from '../../lib/encryption.js';

const app = new Hono();

app.post('/', async (c) => {
  try {
    const { accountSid, authToken } = await c.req.json();
    const companyId = c.get('companyId'); // From auth middleware
    const prisma = getPrisma(c.env.DATABASE_URL);

    // Validation
    if (!accountSid || !authToken) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Account SID and Auth Token are required',
          },
        },
        400
      );
    }

    // Check if Twilio provider already exists for this company
    const existingProvider = await prisma.provider.findFirst({
      where: {
        companyId: companyId,
        type: 'TWILIO',
      },
    });

    if (existingProvider) {
      return c.json(
        {
          success: false,
          error: {
            code: 'PROVIDER_EXISTS',
            message: 'Twilio provider already connected. Disconnect it first.',
          },
        },
        400
      );
    }

    // Step 1: Validate credentials
    console.log('Validating Twilio credentials...');
    await validateTwilioCredentials(accountSid, authToken);

    // Get base URL for webhooks
    const baseUrl = new URL(c.req.url).origin;

    // Step 2: Create TwiML App
    console.log('Creating TwiML App...');
    const twilioApp = await createTwiMLApp(accountSid, authToken, baseUrl);

    // Step 3: Generate REST API Key
    console.log('Generating REST API Key...');
    const restApiKey = await createTwilioAPIKey(
      accountSid,
      authToken,
      'Customer Service Platform - REST API'
    );

    // Step 4: Generate Access Token API Key
    console.log('Generating Access Token API Key...');
    const accessTokenKey = await createTwilioAPIKey(
      accountSid,
      authToken,
      'Customer Service Platform - Access Tokens'
    );

    // Step 5: Encrypt and store credentials
    const credentials = {
      accountSid,
      authToken,
      twilioAppSid: twilioApp.sid,
      restApiKeySid: restApiKey.sid,
      restApiKeySecret: restApiKey.secret,
      accessTokenKeySid: accessTokenKey.sid,
      accessTokenKeySecret: accessTokenKey.secret,
    };

    const encryptedCredentials = encryptCredentials(
      credentials,
      c.env.ENCRYPTION_KEY
    );

    // Create provider record
    const provider = await prisma.provider.create({
      data: {
        companyId: companyId,
        type: 'TWILIO',
        credentials: encryptedCredentials,
        status: 'ACTIVE',
      },
    });

    return c.json({
      success: true,
      data: {
        provider: {
          id: provider.id,
          type: provider.type,
          status: provider.status,
          createdAt: provider.createdAt,
        },
      },
    });
  } catch (error) {
    console.error('Failed to connect Twilio provider:', error);

    return c.json(
      {
        success: false,
        error: {
          code: 'PROVIDER_CONNECTION_FAILED',
          message: error.message || 'Failed to connect Twilio provider',
        },
      },
      500
    );
  }
});

export default app;
