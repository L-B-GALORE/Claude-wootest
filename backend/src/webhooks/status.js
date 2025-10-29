/**
 * Status Callback Webhook Handler
 *
 * POST /webhooks/status/:channelId
 *
 * Purpose: Receive call and SMS status updates from Twilio
 *
 * This endpoint:
 * - Receives status updates (ringing, answered, completed, failed, etc.)
 * - Updates call/message records in database
 * - Triggers WebSocket events to notify clients
 *
 * Twilio Call Status Values:
 * - queued, ringing, in-progress, completed, busy, failed, no-answer, canceled
 *
 * Twilio Message Status Values:
 * - queued, sending, sent, delivered, undelivered, failed
 *
 * BEFORE MODIFYING:
 * - This is called by Twilio for status updates
 * - May receive multiple updates for same call/message
 * - Must be idempotent (safe to call multiple times)
 * - Signature validation should be added for production
 */

import { Hono } from 'hono';
import { getPrisma } from '../lib/prisma.js';
import { validateWebhookSignature } from '../lib/twilio.js';
import { decryptCredentials } from '../lib/encryption.js';

const app = new Hono();

/**
 * Map Twilio call status to our CallStatus enum
 *
 * Twilio statuses: queued, ringing, in-progress, completed, busy, failed, no-answer, canceled
 * Our statuses: RINGING, IN_PROGRESS, COMPLETED, FAILED, NO_ANSWER, BUSY
 *
 * @param {string} twilioStatus - Twilio call status
 * @returns {string} - Our CallStatus enum value
 */
function mapTwilioCallStatus(twilioStatus) {
  const statusMap = {
    'queued': 'RINGING',
    'ringing': 'RINGING',
    'in-progress': 'IN_PROGRESS',
    'completed': 'COMPLETED',
    'busy': 'BUSY',
    'failed': 'FAILED',
    'no-answer': 'NO_ANSWER',
    'canceled': 'FAILED',
  };

  return statusMap[twilioStatus] || 'FAILED';
}

app.post('/:channelId', async (c) => {
  try {
    const { channelId } = c.req.param();
    const prisma = getPrisma(c.env.DATABASE_URL);

    // Get the request body (Twilio status parameters)
    const body = await c.req.parseBody();

    console.log('Status webhook received:', {
      channelId,
      callSid: body.CallSid,
      messageSid: body.MessageSid,
      callStatus: body.CallStatus,
      messageStatus: body.MessageStatus,
      from: body.From,
      to: body.To,
    });

    // Validate channel exists
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        provider: true,
        company: true,
      },
    });

    if (!channel) {
      console.error('Channel not found for status update:', channelId);
      // Return 200 to acknowledge receipt (avoid Twilio retries)
      return c.json({ success: true, message: 'Channel not found' }, 200);
    }

    // Validate Twilio webhook signature (security)
    // Only validate in production to avoid issues during development
    if (c.env.ENVIRONMENT === 'production') {
      const signature = c.req.header('X-Twilio-Signature');
      const url = c.req.url;

      if (signature && channel.provider) {
        const credentials = await decryptCredentials(
          channel.provider.credentials,
          c.env.ENCRYPTION_KEY
        );

        const isValid = validateWebhookSignature(
          credentials.authToken,
          signature,
          url,
          body
        );

        if (!isValid) {
          console.error('Invalid Twilio webhook signature');
          return c.json({ success: false, error: 'Forbidden' }, 403);
        }
      }
    }

    // Process call status updates
    if (body.CallSid) {
      console.log('[Status] Call status update:', {
        callSid: body.CallSid,
        status: body.CallStatus,
        duration: body.CallDuration,
        recordingUrl: body.RecordingUrl,
      });

      // ========================================================================
      // UPDATE DATABASE - VoiceCall and Conversation
      // ========================================================================

      try {
        // Find the VoiceCall record
        const voiceCall = await prisma.voiceCall.findFirst({
          where: {
            providerCallId: body.CallSid,
          },
          include: {
            message: {
              include: {
                conversation: true,
              },
            },
          },
        });

        if (voiceCall) {
          console.log('[Status] Found VoiceCall record:', voiceCall.id);

          // Prepare update data
          const updateData = {
            callStatus: mapTwilioCallStatus(body.CallStatus),
          };

          // Add duration if call completed
          if (body.CallDuration) {
            updateData.durationSeconds = parseInt(body.CallDuration, 10);
          }

          // Add recording URL if available
          if (body.RecordingUrl) {
            updateData.recordingUrl = body.RecordingUrl;
          }

          // Set endedAt timestamp if call is finished
          const finishedStatuses = ['completed', 'failed', 'no-answer', 'busy', 'canceled'];
          if (finishedStatuses.includes(body.CallStatus)) {
            updateData.endedAt = new Date();
          }

          // TODO: Set answeredByUserId if we can determine who answered
          // This would require tracking which client accepted the call via WebSocket

          // Update VoiceCall record
          await prisma.voiceCall.update({
            where: { id: voiceCall.id },
            data: updateData,
          });

          console.log('[Status] ✅ Updated VoiceCall:', voiceCall.id, 'to status:', updateData.callStatus);

          // Update conversation's lastMessageAt and potentially close it
          if (voiceCall.message?.conversation) {
            const conversationUpdate = {
              lastMessageAt: new Date(),
            };

            // Close conversation if call ended
            if (finishedStatuses.includes(body.CallStatus)) {
              conversationUpdate.status = 'CLOSED';
            }

            await prisma.conversation.update({
              where: { id: voiceCall.message.conversation.id },
              data: conversationUpdate,
            });

            console.log('[Status] ✅ Updated Conversation:', voiceCall.message.conversation.id);
          }
        } else {
          console.warn('[Status] ⚠️ VoiceCall not found for CallSid:', body.CallSid);
          // This might happen if status webhook arrives before inbound webhook
          // Or if call logging failed
        }
      } catch (dbError) {
        console.error('[Status] ⚠️ Failed to update database:', dbError);
        // Continue anyway - don't fail the webhook
      }

      // ========================================================================
      // WEBSOCKET BROADCAST (unchanged from original)
      // ========================================================================

      // Broadcast call status updates via Socket.IO
      try {
        const callStatus = body.CallStatus;

        // Only broadcast significant status changes
        if (['in-progress', 'completed', 'failed', 'no-answer', 'busy', 'canceled'].includes(callStatus)) {
          console.log(`[Status] Broadcasting call status '${callStatus}' via Socket.IO to company:`, channel.company.id);

          // Get CompanyRoom Durable Object
          const durableObjectId = c.env.COMPANY_ROOM.idFromName(channel.company.id);
          const companyRoom = c.env.COMPANY_ROOM.get(durableObjectId);

          // Determine which event to broadcast
          let eventName = 'call_status_update';
          if (callStatus === 'in-progress') {
            eventName = 'call_answered';
          } else if (['completed', 'failed', 'no-answer', 'busy', 'canceled'].includes(callStatus)) {
            eventName = 'call_ended';
          }

          // Broadcast to all users in the company
          await companyRoom.fetch('https://do.internal/broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: eventName,
              data: {
                callSid: body.CallSid,
                status: callStatus,
                duration: body.CallDuration,
                recordingUrl: body.RecordingUrl,
                from: body.From,
                to: body.To,
                timestamp: new Date().toISOString(),
              },
              // Broadcast to all users (they can filter on their end)
            }),
          });

          console.log(`[Status] ✅ Broadcasted '${eventName}' for call ${body.CallSid}`);
        }
      } catch (broadcastError) {
        console.error('[Status] ⚠️ Failed to broadcast via Socket.IO:', broadcastError);
        // Continue anyway
      }
    }

    // Process message status updates
    if (body.MessageSid) {
      console.log('[Status] Message status update:', {
        messageSid: body.MessageSid,
        status: body.MessageStatus,
        errorCode: body.ErrorCode,
        errorMessage: body.ErrorMessage,
      });

      // ========================================================================
      // UPDATE DATABASE - SmsMessage and Message
      // ========================================================================

      try {
        // Find the SmsMessage record
        const smsMessage = await prisma.smsMessage.findFirst({
          where: {
            providerMessageId: body.MessageSid,
          },
          include: {
            message: {
              include: {
                conversation: true,
              },
            },
          },
        });

        if (smsMessage) {
          console.log('[Status] Found SmsMessage record:', smsMessage.id);

          // Update SMS-specific status
          await prisma.smsMessage.update({
            where: { id: smsMessage.id },
            data: {
              providerStatus: body.MessageStatus,
            },
          });

          // Map Twilio message status to our MessageStatus enum
          let messageStatus = 'SENT';
          if (body.MessageStatus === 'delivered') {
            messageStatus = 'DELIVERED';
          } else if (body.MessageStatus === 'failed' || body.MessageStatus === 'undelivered') {
            messageStatus = 'FAILED';
          }

          // Update Message status
          await prisma.message.update({
            where: { id: smsMessage.messageId },
            data: {
              status: messageStatus,
            },
          });

          console.log('[Status] ✅ Updated SmsMessage and Message:', smsMessage.id, 'to status:', messageStatus);

          // Update conversation's lastMessageAt
          if (smsMessage.message?.conversation) {
            await prisma.conversation.update({
              where: { id: smsMessage.message.conversation.id },
              data: {
                lastMessageAt: new Date(),
              },
            });
          }

          // Broadcast message status update via WebSocket
          try {
            console.log('[Status] Broadcasting message status update via WebSocket');

            const durableObjectId = c.env.COMPANY_ROOM.idFromName(channel.company.id);
            const companyRoom = c.env.COMPANY_ROOM.get(durableObjectId);

            await companyRoom.fetch('https://do.internal/broadcast', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                event: 'message_status_updated',
                data: {
                  messageId: smsMessage.messageId,
                  conversationId: smsMessage.message.conversation.id,
                  status: messageStatus,
                  providerStatus: body.MessageStatus,
                  messageSid: body.MessageSid,
                  timestamp: new Date().toISOString(),
                },
              }),
            });

            console.log('[Status] ✅ Broadcasted message_status_updated event');
          } catch (broadcastError) {
            console.error('[Status] ⚠️ Failed to broadcast status via WebSocket:', broadcastError);
            // Continue anyway
          }
        } else {
          console.warn('[Status] ⚠️ SmsMessage not found for MessageSid:', body.MessageSid);
        }
      } catch (dbError) {
        console.error('[Status] ⚠️ Failed to update SMS database:', dbError);
        // Continue anyway - don't fail the webhook
      }
    }

    // Acknowledge receipt
    return c.json({ success: true }, 200);
  } catch (error) {
    console.error('Status webhook error:', error);

    // Return 200 to avoid Twilio retries on our errors
    return c.json(
      {
        success: false,
        error: 'Internal error processing status',
      },
      200
    );
  }
});

export default app;
