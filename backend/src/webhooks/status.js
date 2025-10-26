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
    });

    if (!channel) {
      console.error('Channel not found for status update:', channelId);
      // Return 200 to acknowledge receipt (avoid Twilio retries)
      return c.json({ success: true, message: 'Channel not found' }, 200);
    }

    // Process call status updates
    if (body.CallSid) {
      // TODO: Update VoiceCall record with status
      // TODO: Trigger WebSocket event for call status change
      // TODO: Update conversation status based on call completion

      console.log('Call status update:', {
        callSid: body.CallSid,
        status: body.CallStatus,
        duration: body.CallDuration,
        recordingUrl: body.RecordingUrl,
      });
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
