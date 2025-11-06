/**
 * Providers API Router
 *
 * Purpose: Manage communication providers (Twilio, Gmail, etc.)
 *
 * Routes:
 * - POST   /providers/twilio - Connect Twilio provider
 * - GET    /providers - List all providers
 * - GET    /providers/:id/available-numbers - Get importable Twilio numbers
 * - POST   /providers/:id/import-channels - Import selected numbers
 * - GET    /providers/:id/health - Run health check on provider integration
 * - POST   /providers/:id/fix - Auto-fix provider integration issues
 * - DELETE /providers/:id - Disconnect provider
 *
 * BEFORE MODIFYING:
 * - Will this break existing provider integrations?
 * - Are all routes properly authenticated?
 * - Do we need rate limiting?
 */

import { Hono } from 'hono';
import { getPrisma } from '../../lib/prisma.js';
import connectTwilio from './connect-twilio.js';
import getAvailableNumbers from './get-available-numbers.js';
import importChannels from './import-channels.js';
import healthCheck from './health.js';
import autoFix from './fix.js';

const app = new Hono();

// Connect Twilio provider
app.route('/twilio', connectTwilio);

// Get all providers for company
app.get('/', async (c) => {
  try {
    const companyId = c.get('companyId');
    const prisma = getPrisma(c.env.DATABASE_URL);

    const providers = await prisma.provider.findMany({
      where: {
        companyId: companyId,
      },
      select: {
        id: true,
        type: true,
        status: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            channels: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return c.json({
      success: true,
      data: {
        providers: providers.map((p) => ({
          ...p,
          channelCount: p._count.channels,
        })),
      },
    });
  } catch (error) {
    console.error('Failed to fetch providers:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch providers',
        },
      },
      500
    );
  }
});

// Get provider by ID
app.get('/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const companyId = c.get('companyId');
    const prisma = getPrisma(c.env.DATABASE_URL);

    const provider = await prisma.provider.findFirst({
      where: {
        id,
        companyId: companyId,
      },
      select: {
        id: true,
        type: true,
        status: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            channels: true,
          },
        },
      },
    });

    if (!provider) {
      return c.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Provider not found',
          },
        },
        404
      );
    }

    return c.json({
      success: true,
      data: {
        provider: {
          ...provider,
          channelCount: provider._count.channels,
        },
      },
    });
  } catch (error) {
    console.error('Failed to fetch provider:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch provider',
        },
      },
      500
    );
  }
});

// Get available numbers for provider
app.route('/:providerId/available-numbers', getAvailableNumbers);

// Import channels from provider
app.route('/:providerId/import-channels', importChannels);

// Health check provider integration
app.route('/:providerId/health', healthCheck);

// Auto-fix provider integration issues
app.route('/:providerId/fix', autoFix);

// Disconnect provider
app.delete('/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const companyId = c.get('companyId');
    const prisma = getPrisma(c.env.DATABASE_URL);

    // Check if provider exists
    const provider = await prisma.provider.findFirst({
      where: {
        id,
        companyId: companyId,
      },
      include: {
        channels: true,
      },
    });

    if (!provider) {
      return c.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Provider not found',
          },
        },
        404
      );
    }

    // Delete all channels associated with this provider
    // (Prisma cascade delete will handle related conversations/messages)
    if (provider.channels.length > 0) {
      await prisma.channel.deleteMany({
        where: {
          providerId: id,
        },
      });
    }

    // Delete provider (removes credentials, API keys, TwiML App SID, etc.)
    await prisma.provider.delete({
      where: {
        id,
      },
    });

    return c.json({
      success: true,
      data: {
        message: 'Provider disconnected successfully',
        channelsDeleted: provider.channels.length,
      },
    });
  } catch (error) {
    console.error('Failed to disconnect provider:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'DISCONNECT_FAILED',
          message: 'Failed to disconnect provider',
        },
      },
      500
    );
  }
});

export default app;
