/**
 * Notification Service
 *
 * Purpose: Handle push notifications for various events
 *
 * Features:
 * - Determine when to send notifications based on message source
 * - Send push notifications via OneSignal
 * - Track notification status
 *
 * Message Source Rules:
 * - WEBHOOK: Real-time SMS from Twilio - NOTIFY
 * - IMPORT: Bulk imported messages - DON'T NOTIFY
 * - MANUAL: Manually created by user - DON'T NOTIFY
 * - API: Created via API - DECIDE LATER
 */

import { getPrisma } from '../lib/prisma.js';

/**
 * Determine if we should send a notification for this message
 *
 * @param {object} message - Message object from database
 * @returns {boolean} - True if notification should be sent
 */
export function shouldNotifyForMessage(message) {
  // Only notify for real-time webhook messages
  if (message.source !== 'WEBHOOK') {
    console.log(`[NotificationService] Skipping notification for message ${message.id}: source=${message.source}`);
    return false;
  }

  // Don't notify twice
  if (message.notificationSent) {
    console.log(`[NotificationService] Skipping notification for message ${message.id}: already sent`);
    return false;
  }

  // Only notify for inbound messages
  if (message.direction !== 'INBOUND') {
    console.log(`[NotificationService] Skipping notification for message ${message.id}: direction=${message.direction}`);
    return false;
  }

  // Future: Add user notification preferences check here
  // if (!user.notificationsEnabled) return false;

  return true;
}

/**
 * Send push notification for a new message
 *
 * @param {string} companyId - Company ID
 * @param {object} message - Message object
 * @param {object} conversation - Conversation object
 * @param {object} contact - Contact object
 * @param {object} env - Cloudflare environment (for secrets)
 * @param {string} databaseUrl - Database URL
 */
export async function sendNewMessageNotification(companyId, message, conversation, contact, env, databaseUrl) {
  try {
    console.log(`[NotificationService] Checking if notification should be sent for message ${message.id}`);

    // Check if we should notify
    if (!shouldNotifyForMessage(message)) {
      return;
    }

    // Get OneSignal credentials
    const appId = env.ONESIGNAL_APP_ID;
    const restApiKey = env.ONESIGNAL_REST_API_KEY;

    if (!appId || !restApiKey) {
      console.warn('[NotificationService] OneSignal credentials not configured, skipping notification');
      return;
    }

    const prisma = getPrisma(databaseUrl);

    // Get all users in the company with push subscriptions
    // For now, we'll use OneSignal's external_id to target users
    // In the future, we might want to store player IDs in the database

    // Get all users in the company
    const users = await prisma.user.findMany({
      where: {
        companyId: companyId,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (users.length === 0) {
      console.log('[NotificationService] No users found for company:', companyId);
      return;
    }

    // Prepare notification payload
    const contactName = contact.name || contact.phoneNumber || 'Unknown';
    const messagePreview = message.body.substring(0, 100) + (message.body.length > 100 ? '...' : '');

    const notificationPayload = {
      app_id: appId,
      // Target users by their external_id (our user.id)
      include_aliases: {
        external_id: users.map(u => u.id),
      },
      target_channel: 'push',
      headings: { en: `New SMS from ${contactName}` },
      contents: { en: messagePreview },
      data: {
        type: 'new_message',
        conversationId: conversation.id,
        messageId: message.id,
        contactId: contact.id,
        timestamp: new Date().toISOString(),
      },
      // Optional: Add action buttons or custom sound
      // buttons: [
      //   { id: 'reply', text: 'Reply' },
      //   { id: 'view', text: 'View' },
      // ],
    };

    console.log(`[NotificationService] Sending notification to ${users.length} users for company ${companyId}`);

    // Send notification via OneSignal REST API
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
      console.error('[NotificationService] OneSignal API error:', result);
      return;
    }

    console.log(`[NotificationService] ✅ Notification sent successfully:`, {
      notificationId: result.id,
      recipients: result.recipients,
    });

    // Mark message as notified
    await prisma.message.update({
      where: { id: message.id },
      data: { notificationSent: true },
    });

    console.log(`[NotificationService] ✅ Marked message ${message.id} as notified`);
  } catch (error) {
    console.error('[NotificationService] Error sending notification:', error);
    // Don't throw - we don't want to fail the webhook if notifications fail
  }
}
