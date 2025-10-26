/**
 * Import Channels from Provider
 *
 * POST /api/v1/providers/:providerId/import-channels
 *
 * Purpose: Import selected phone numbers from Twilio as channels
 *
 * Process for each number:
 * 1. Configure webhooks on the Twilio number
 * 2. Create Channel record in database
 * 3. Set routing to UNASSIGNED by default
 *
 * BEFORE MODIFYING:
 * - Will this handle failures gracefully (partial imports)?
 * - Are we properly rolling back on errors?
 * - Do we validate that numbers exist in Twilio?
 */

import { Hono } from 'hono';
import { getPrisma } from '../../lib/prisma.js';
import { configurePhoneNumberWebhooks } from '../../lib/twilio.js';
import { decryptCredentials } from '../../lib/encryption.js';

const app = new Hono();

app.post('/', async (c) => {
  try {
    const { providerId } = c.req.param();
    const { numbers } = await c.req.json(); // Array of {sid, phoneNumber, friendlyName, capabilities}
    const companyId = c.get('companyId');
    const prisma = getPrisma(c.env.DATABASE_URL);

    // Validation
    if (!Array.isArray(numbers) || numbers.length === 0) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Numbers array is required and must not be empty',
          },
        },
        400
      );
    }

    // Get provider
    const provider = await prisma.provider.findFirst({
      where: {
        id: providerId,
        companyId: companyId,
        type: 'TWILIO',
      },
    });

    if (!provider) {
      return c.json(
        {
          success: false,
          error: {
            code: 'PROVIDER_NOT_FOUND',
            message: 'Twilio provider not found',
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

    const baseUrl = new URL(c.req.url).origin;

    const importResults = [];
    const errors = [];

    // Process each number
    for (const number of numbers) {
      try {
        // Check if already imported
        const existing = await prisma.channel.findUnique({
          where: {
            companyId_identifier: {
              companyId: companyId,
              identifier: number.phoneNumber,
            },
          },
        });

        if (existing) {
          errors.push({
            phoneNumber: number.phoneNumber,
            error: 'Number already imported',
          });
          continue;
        }

        // Create channel first to get ID for webhook URL
        const channel = await prisma.channel.create({
          data: {
            companyId: companyId,
            providerId: provider.id,
            type: 'PHONE',
            identifier: number.phoneNumber,
            capabilities: number.capabilities,
            status: 'ACTIVE',
            routingType: 'UNASSIGNED',
            routingTargetId: null,
            metadata: {
              twilioSid: number.sid,
              friendlyName: number.friendlyName,
            },
          },
        });

        // Configure webhooks on Twilio number
        await configurePhoneNumberWebhooks(
          credentials.accountSid,
          credentials.authToken,
          number.sid,
          channel.id,
          baseUrl
        );

        importResults.push({
          phoneNumber: number.phoneNumber,
          channelId: channel.id,
          success: true,
        });
      } catch (error) {
        console.error(`Failed to import ${number.phoneNumber}:`, error);
        errors.push({
          phoneNumber: number.phoneNumber,
          error: error.message,
        });
      }
    }

    return c.json({
      success: true,
      data: {
        imported: importResults,
        failed: errors,
        total: numbers.length,
        successCount: importResults.length,
        failureCount: errors.length,
      },
    });
  } catch (error) {
    console.error('Failed to import channels:', error);

    return c.json(
      {
        success: false,
        error: {
          code: 'IMPORT_FAILED',
          message: error.message || 'Failed to import channels',
        },
      },
      500
    );
  }
});

export default app;
