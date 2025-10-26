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

    // Get company info for friendly names
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    });

    // Generate timestamp for friendly names
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

    // Step 1: Validate credentials
    console.log('Validating Twilio credentials...');
    await validateTwilioCredentials(accountSid, authToken);

    // Get base URL for webhooks
    const baseUrl = new URL(c.req.url).origin;

    // Step 2: Create TwiML App
    console.log('Creating TwiML App...');
    const twilioApp = await createTwiMLApp(accountSid, authToken, company.name, baseUrl);

    // Step 3: Generate API Key
    console.log('Generating API Key...');
    const apiKey = await createTwilioAPIKey(
      accountSid,
      authToken,
      `API Access - ${company.name} - ${timestamp}`
    );

    // Step 4: Encrypt and store credentials
    const credentials = {
      accountSid,
      authToken,
      twimlAppSid: twilioApp.sid,
      apiKeySid: apiKey.sid,
      apiKeySecret: apiKey.secret,
    };

    const encryptedCredentials = await encryptCredentials(
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
