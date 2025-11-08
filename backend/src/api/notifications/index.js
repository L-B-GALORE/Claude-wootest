/**
 * Notifications API Router
 *
 * Purpose: Handle push notification operations
 *
 * Routes:
 * - POST /notifications/register - Register FCM token for user device
 * - POST /notifications/test - Send test notification to current user
 * - POST /notifications/send - Send notification to specific users (admin only)
 */

import { Hono } from 'hono';
import { getPrisma } from '../../lib/prisma.js';
import { sendPushNotification } from '../../lib/firebase.js';

const app = new Hono();

/**
 * Register FCM token for the current user
 * POST /api/v1/notifications/register
 */
app.post('/register', async (c) => {
  try {
    const userId = c.get('userId');
    const prisma = getPrisma(c.env.DATABASE_URL);
    const body = await c.req.json();

    const { token, deviceInfo } = body;

    if (!token) {
      return c.json(
        {
          success: false,
          error: {
            code: 'MISSING_TOKEN',
            message: 'FCM token is required',
          },
        },
        400
      );
    }

    console.log('[Notifications] Registering token for user:', userId);

    // Check if token already exists for this user
    const existingToken = await prisma.pushToken.findFirst({
      where: {
        userId,
        token,
      },
    });

    if (existingToken) {
      // Update existing token
      await prisma.pushToken.update({
        where: { id: existingToken.id },
        data: {
          deviceInfo,
          updatedAt: new Date(),
        },
      });

      console.log('[Notifications] Updated existing token');
    } else {
      // Create new token
      await prisma.pushToken.create({
        data: {
          userId,
          token,
          deviceInfo,
        },
      });

      console.log('[Notifications] Created new token');
    }

    return c.json({
      success: true,
      message: 'Push token registered successfully',
    });
  } catch (error) {
    console.error('[Notifications] Failed to register token:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'REGISTRATION_FAILED',
          message: error.message || 'Failed to register push token',
        },
      },
      500
    );
  }
});

/**
 * Send test notification to current user
 * POST /api/v1/notifications/test
 */
app.post('/test', async (c) => {
  try {
    const userId = c.get('userId');
    const prisma = getPrisma(c.env.DATABASE_URL);

    console.log('[Notifications] Sending test notification to user:', userId);

    // Get user's push tokens
    const pushTokens = await prisma.pushToken.findMany({
      where: { userId },
    });

    if (pushTokens.length === 0) {
      return c.json(
        {
          success: false,
          error: {
            code: 'NO_TOKENS',
            message: 'No push tokens registered for this user',
          },
        },
        404
      );
    }

    // Send test notification to all user's devices
    const results = await Promise.allSettled(
      pushTokens.map((pt) =>
        sendPushNotification(c.env.FIREBASE_SERVICE_ACCOUNT_JSON, {
          token: pt.token,
          notification: {
            title: '🔔 Test Notification',
            body: 'This is a test push notification from your app!',
          },
          data: {
            type: 'test',
            timestamp: new Date().toISOString(),
          },
        })
      )
    );

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    console.log(
      `[Notifications] Test notification sent: ${successful} successful, ${failed} failed`
    );

    // Update lastUsedAt for successful tokens
    await prisma.pushToken.updateMany({
      where: {
        userId,
        token: { in: pushTokens.map((pt) => pt.token) },
      },
      data: {
        lastUsedAt: new Date(),
      },
    });

    return c.json({
      success: true,
      message: 'Test notification sent',
      data: {
        sent: successful,
        failed,
        total: pushTokens.length,
      },
    });
  } catch (error) {
    console.error('[Notifications] Failed to send test notification:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'SEND_FAILED',
          message: error.message || 'Failed to send test notification',
        },
      },
      500
    );
  }
});

export default app;
