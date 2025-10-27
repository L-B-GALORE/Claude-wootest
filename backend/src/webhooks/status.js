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
      // TODO: Update VoiceCall record with status
      // TODO: Update conversation status based on call completion

      console.log('[Status] Call status update:', {
        callSid: body.CallSid,
        status: body.CallStatus,
        duration: body.CallDuration,
        recordingUrl: body.RecordingUrl,
      });

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
      // TODO: Update Message record with delivery status
      // TODO: Trigger WebSocket event for message status change

      console.log('Message status update:', {
        messageSid: body.MessageSid,
        status: body.MessageStatus,
        errorCode: body.ErrorCode,
        errorMessage: body.ErrorMessage,
      });
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
