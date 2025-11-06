/**
 * Provider Auto-Fix API
 *
 * POST /api/v1/providers/:providerId/fix
 *
 * Purpose: Automatically fix detected Twilio integration issues
 *
 * Process:
 * 1. Run health check to identify issues
 * 2. Attempt to fix all fixable issues
 * 3. Update provider credentials if needed
 * 4. Return detailed report of fixes
 *
 * Request body (optional):
 * {
 *   "components": ["twimlApp", "apiKey", "phoneNumbers"]  // or omit to fix all
 * }
 *
 * BEFORE MODIFYING:
 * - All fixes should be safe and idempotent
 * - Must handle partial failures gracefully
 * - Never delete resources
 */

import { Hono } from 'hono';
import { getPrisma } from '../../lib/prisma.js';
import { runFullHealthCheck } from '../../lib/twilio-health.js';
import { fixAll } from '../../lib/twilio-fix.js';

const app = new Hono();

app.post('/', async (c) => {
  try {
    const { providerId } = c.req.param();
    const companyId = c.get('companyId');
    const prisma = getPrisma(c.env.DATABASE_URL);

    // Optional: specific components to fix
    let requestBody = {};
    try {
      requestBody = await c.req.json();
    } catch (e) {
      // No body is fine, we'll fix everything
    }

    console.log(`[Auto-Fix API] Fixing provider ${providerId}...`);

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
            message: 'Auto-fix only supports Twilio providers',
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

    console.log(`[Auto-Fix API] Found ${channels.length} channels`);

    // Get base URL for webhooks
    const baseUrl = new URL(c.req.url).origin;

    // Step 1: Run health check to identify issues
    console.log('[Auto-Fix API] Running health check first...');
    const healthResults = await runFullHealthCheck(
      provider,
      channels,
      baseUrl,
      c.env.ENCRYPTION_KEY
    );

    // If everything is healthy, nothing to fix
    if (healthResults.overall === 'healthy') {
      return c.json({
        success: true,
        data: {
          message: 'No issues detected - provider is healthy',
          healthCheck: healthResults,
          fixed: {},
          cantFix: {},
        },
      });
    }

    // Step 2: Attempt to fix issues
    console.log('[Auto-Fix API] Issues detected, attempting fixes...');
    const fixResults = await fixAll(
      healthResults,
      provider,
      channels,
      baseUrl,
      c.env.ENCRYPTION_KEY,
      prisma
    );

    // Step 3: Re-fetch provider to get updated credentials
    console.log('[Auto-Fix API] Re-fetching provider with updated credentials...');
    const updatedProvider = await prisma.provider.findFirst({
      where: {
        id: providerId,
        companyId: companyId,
      },
    });

    // Step 4: Wait a moment for Twilio to activate new credentials
    if (fixResults.credentialsUpdated) {
      console.log('[Auto-Fix API] Credentials were updated, waiting 3 seconds for Twilio activation...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Step 5: Run health check again with updated provider to confirm fixes
    console.log('[Auto-Fix API] Running post-fix health check...');
    const postFixHealthResults = await runFullHealthCheck(
      updatedProvider,
      channels,
      baseUrl,
      c.env.ENCRYPTION_KEY
    );

    return c.json({
      success: true,
      data: {
        message: 'Auto-fix complete',
        fixed: fixResults.fixed,
        cantFix: fixResults.cantFix,
        credentialsUpdated: fixResults.credentialsUpdated,
        beforeHealth: healthResults,
        afterHealth: postFixHealthResults,
      },
    });
  } catch (error) {
    console.error('[Auto-Fix API] Error:', error);

    return c.json(
      {
        success: false,
        error: {
          code: 'AUTO_FIX_FAILED',
          message: error.message || 'Auto-fix failed',
        },
      },
      500
    );
  }
});

export default app;
