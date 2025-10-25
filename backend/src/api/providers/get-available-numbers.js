/**
 * Get Available Twilio Numbers
 *
 * GET /api/v1/providers/:providerId/available-numbers
 *
 * Purpose: Fetch all phone numbers from Twilio account that can be imported
 *
 * Returns numbers that:
 * - Exist in Twilio account
 * - Haven't been imported yet (not in our Channel table)
 *
 * BEFORE MODIFYING:
 * - Will this handle large numbers of phone numbers?
 * - Are we caching this data appropriately?
 * - Do we need pagination?
 */

import { Hono } from 'hono';
import { getPrisma } from '../../lib/prisma.js';
import { getTwilioPhoneNumbers } from '../../lib/twilio.js';
import { decryptCredentials } from '../../lib/encryption.js';

const app = new Hono();

app.get('/', async (c) => {
  try {
    const { providerId } = c.req.param();
    const companyId = c.get('companyId');
    const prisma = getPrisma(c.env.DATABASE_URL);

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
    const credentials = decryptCredentials(
      provider.credentials,
      c.env.ENCRYPTION_KEY
    );

    // Fetch numbers from Twilio
    const twilioNumbers = await getTwilioPhoneNumbers(
      credentials.accountSid,
      credentials.authToken
    );

    // Get already imported numbers
    const existingChannels = await prisma.channel.findMany({
      where: {
        companyId: companyId,
        providerId: provider.id,
        type: 'PHONE',
      },
      select: {
        identifier: true,
      },
    });

    const importedNumbers = new Set(
      existingChannels.map((ch) => ch.identifier)
    );

    // Filter out already imported numbers and mark them
    const availableNumbers = twilioNumbers.map((number) => ({
      sid: number.sid,
      phoneNumber: number.phoneNumber,
      friendlyName: number.friendlyName,
      capabilities: number.capabilities,
      imported: importedNumbers.has(number.phoneNumber),
    }));

    return c.json({
      success: true,
      data: {
        numbers: availableNumbers,
        total: availableNumbers.length,
        imported: availableNumbers.filter((n) => n.imported).length,
        available: availableNumbers.filter((n) => !n.imported).length,
      },
    });
  } catch (error) {
    console.error('Failed to fetch available numbers:', error);

    return c.json(
      {
        success: false,
        error: {
          code: 'FETCH_NUMBERS_FAILED',
          message: error.message || 'Failed to fetch available numbers',
        },
      },
      500
    );
  }
});

export default app;
