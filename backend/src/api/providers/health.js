/**
 * Provider Health Check API
 *
 * GET /api/v1/providers/:providerId/health
 *
 * Purpose: Run comprehensive health check on Twilio provider integration
 *
 * Returns detailed status of:
 * - Account credentials
 * - TwiML Application
 * - API Key
 * - Phone number webhooks
 *
 * BEFORE MODIFYING:
 * - Health checks are read-only operations
 * - Must handle provider not found gracefully
 * - Only works for TWILIO providers currently
 */

import { Hono } from 'hono';
import { getPrisma } from '../../lib/prisma.js';
import { runFullHealthCheck } from '../../lib/twilio-health.js';

const app = new Hono();

app.get('/', async (c) => {
  try {
    const { providerId } = c.req.param();
    const companyId = c.get('companyId');
    const prisma = getPrisma(c.env.DATABASE_URL);

    console.log(`[Health Check API] Checking provider ${providerId}...`);

    // Get provider
    const provider = await prisma.provider.findFirst({
      where: {
        id: providerId,
        companyId: companyId,
      },
    });

    if (!provider) {
      return c.json(
        {
          success: false,
          error: {
            code: 'PROVIDER_NOT_FOUND',
            message: 'Provider not found',
          },
        },
        404
      );
    }

    // Currently only supports Twilio
    if (provider.type !== 'TWILIO') {
      return c.json(
        {
          success: false,
          error: {
            code: 'UNSUPPORTED_PROVIDER',
            message: 'Health check only supports Twilio providers',
          },
        },
        400
      );
    }

    // Get all channels for this provider
    const channels = await prisma.channel.findMany({
      where: {
        companyId: companyId,
        providerId: provider.id,
      },
    });

    console.log(`[Health Check API] Found ${channels.length} channels to check`);

    // Get base URL for webhook comparison
    const baseUrl = new URL(c.req.url).origin;

    // Run full health check
    const healthResults = await runFullHealthCheck(
      provider,
      channels,
      baseUrl,
      c.env.ENCRYPTION_KEY
    );

    return c.json({
      success: true,
      data: healthResults,
    });
  } catch (error) {
    console.error('[Health Check API] Error:', error);

    return c.json(
      {
        success: false,
        error: {
          code: 'HEALTH_CHECK_FAILED',
          message: error.message || 'Health check failed',
        },
      },
      500
    );
  }
});

export default app;
