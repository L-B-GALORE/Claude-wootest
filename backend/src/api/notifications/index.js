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

import { Router } from 'itty-router';

const router = Router({ base: '/notifications' });

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
router.post('/test', async (request, env, ctx) => {
  try {
    const { playerId } = await request.json();

    if (!playerId) {
      return new Response(JSON.stringify({ error: 'Player ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get OneSignal credentials from environment
    const appId = env.ONESIGNAL_APP_ID;
    const restApiKey = env.ONESIGNAL_REST_API_KEY;

    if (!appId || !restApiKey) {
      console.error('[Notifications] OneSignal credentials not configured');
      return new Response(JSON.stringify({ error: 'OneSignal not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Send notification via OneSignal REST API
    const notificationPayload = {
      app_id: appId,
      include_player_ids: [playerId],
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
      return new Response(
        JSON.stringify({
          error: result.errors?.[0] || 'Failed to send notification',
          details: result,
        }),
        {
          status: response.status,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[Notifications] Test notification sent successfully:', result.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Test notification sent successfully',
        notificationId: result.id,
        recipients: result.recipients,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[Notifications] Error sending test notification:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});

export default router;
