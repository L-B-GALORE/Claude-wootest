/**
 * Notifications API Routes
 *
 * Purpose: Send push notifications via OneSignal
 *
 * Routes:
 * - POST /notifications/test - Send test notification to a specific player
 *
 * OneSignal API Documentation:
 * https://documentation.onesignal.com/reference/create-notification
 */

import { Hono } from 'hono';

const app = new Hono();

/**
 * POST /notifications/test
 *
 * Send a test push notification to a specific OneSignal player
 *
 * Body:
 * - playerId: OneSignal Player ID (subscription ID)
 *
 * Returns:
 * - success: boolean
 * - message: string
 * - notificationId: OneSignal notification ID
 */
app.post('/test', async (c) => {
  try {
    const { playerId } = await c.req.json();

    if (!playerId) {
      return c.json(
        {
          success: false,
          error: {
            code: 'MISSING_PLAYER_ID',
            message: 'Player ID is required',
          },
        },
        400
      );
    }

    // Get OneSignal credentials from environment
    const appId = c.env.ONESIGNAL_APP_ID;
    const restApiKey = c.env.ONESIGNAL_REST_API_KEY;

    if (!appId || !restApiKey) {
      console.error('[Notifications] OneSignal credentials not configured');
      return c.json(
        {
          success: false,
          error: {
            code: 'ONESIGNAL_NOT_CONFIGURED',
            message: 'OneSignal credentials are not configured',
          },
        },
        500
      );
    }

    // Send notification via OneSignal REST API
    // For OneSignal SDK v16 (User Model), use include_subscription_ids instead of include_player_ids
    const notificationPayload = {
      app_id: appId,
      include_subscription_ids: [playerId],
      target_channel: 'push',
      headings: { en: '🔔 Test Notification' },
      contents: { en: 'This is a test push notification from your Customer Service Platform!' },
      data: {
        type: 'test',
        timestamp: new Date().toISOString(),
      },
    };

    console.log('[Notifications] Sending test notification to player:', playerId);

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${restApiKey}`,
      },
      body: JSON.stringify(notificationPayload),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('[Notifications] OneSignal API error:', result);
      return c.json(
        {
          success: false,
          error: {
            code: 'ONESIGNAL_API_ERROR',
            message: result.errors?.[0] || 'Failed to send notification',
            details: result,
          },
        },
        response.status
      );
    }

    console.log('[Notifications] Test notification sent successfully:', {
      notificationId: result.id,
      recipients: result.recipients,
      errors: result.errors,
    });

    return c.json({
      success: true,
      message: 'Test notification sent successfully',
      notificationId: result.id,
      recipients: result.recipients,
      ...(result.errors && { warnings: result.errors }),
    });
  } catch (error) {
    console.error('[Notifications] Error sending test notification:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message,
        },
      },
      500
    );
  }
});

export default app;
