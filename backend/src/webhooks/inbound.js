/**
 * Inbound Webhook Handler
 *
 * POST /webhooks/inbound/:channelId
 *
 * Purpose: Handle incoming calls and SMS from Twilio
 *
 * This endpoint:
 * - Receives voice calls and SMS messages
 * - Validates the channel exists
 * - Implements routing logic based on inbox strategy
 * - Returns appropriate TwiML response
 *
 * BEFORE MODIFYING:
 * - This is called by Twilio for EVERY incoming call/SMS
 * - Response must be valid TwiML (XML format)
 * - Must respond quickly (Twilio has timeout limits)
 * - Signature validation should be added for production
 */

import { Hono } from 'hono';
import { getPrisma } from '../lib/prisma.js';
import { validateWebhookSignature } from '../lib/twilio.js';
import { decryptCredentials } from '../lib/encryption.js';
import { findOrCreateContact } from '../services/contact-service.js';

const app = new Hono();

/**
 * Find or create conversation for contact-channel pair
 *
 * For voice calls, each call is a separate TRANSACTIONAL conversation.
 * For SMS, conversations are LINEAR (ongoing thread per contact-channel).
 *
 * @param {object} prisma - Prisma client
 * @param {string} companyId - Company ID
 * @param {string} contactId - Contact ID
 * @param {string} channelId - Channel ID
 * @param {string} type - Conversation type (TRANSACTIONAL or LINEAR)
 * @returns {Promise<object>} - Conversation object
 */
async function findOrCreateConversation(prisma, companyId, contactId, channelId, type) {
  // For TRANSACTIONAL (voice calls), always create a new conversation
  if (type === 'TRANSACTIONAL') {
    return await prisma.conversation.create({
      data: {
        companyId,
        contactId,
        channelId,
        type,
        status: 'OPEN',
        lastMessageAt: new Date(),
      },
    });
  }

  // For LINEAR (SMS), find existing or create new
  // First, try to find an OPEN conversation
  let conversation = await prisma.conversation.findFirst({
    where: {
      companyId,
      contactId,
      channelId,
      type: 'LINEAR',
      status: 'OPEN',
    },
    orderBy: {
      lastMessageAt: 'desc',
    },
  });

  // If no OPEN conversation, find a CLOSED one and reopen it
  if (!conversation) {
    conversation = await prisma.conversation.findFirst({
      where: {
        companyId,
        contactId,
        channelId,
        type: 'LINEAR',
        status: 'CLOSED',
      },
      orderBy: {
        lastMessageAt: 'desc',
      },
    });

    // If found a CLOSED conversation, reopen it
    if (conversation) {
      console.log(`[Inbound] Reopening CLOSED conversation ${conversation.id}`);
      conversation = await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          status: 'OPEN',
          lastMessageAt: new Date(),
        },
      });
    }
  }

  // If still no conversation (neither OPEN nor CLOSED), create a new one
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        companyId,
        contactId,
        channelId,
        type: 'LINEAR',
        status: 'OPEN',
        lastMessageAt: new Date(),
      },
    });
  } else {
    // Update lastMessageAt for existing OPEN conversation
    conversation = await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    });
  }

  return conversation;
}

/**
 * Generate TwiML response for RING_ALL strategy
 * Rings all logged-in users' browsers simultaneously
 */
async function generateRingAllTwiML(memberIdentities, statusCallbackUrl) {
  const twilio = await import('twilio');
  const VoiceResponse = twilio.default.twiml.VoiceResponse;

  const response = new VoiceResponse();
  const dial = response.dial({
    timeout: 30,
    action: statusCallbackUrl, // Called when dial completes (answered, no-answer, busy, etc.)
  });

  // Add each member as a client to dial
  memberIdentities.forEach((identity) => {
    dial.client(identity);
  });

  // If no one answers, play a message
  response.say('Sorry, no one is available to take your call. Please try again later.');

  return response.toString();
}

/**
 * Generate TwiML response for voicemail (placeholder)
 */
async function generateVoicemailTwiML() {
  const twilio = await import('twilio');
  const VoiceResponse = twilio.default.twiml.VoiceResponse;

  const response = new VoiceResponse();
  response.say('This feature is coming soon. Please call back later.');

  return response.toString();
}

/**
 * Generate fallback TwiML for unrouted calls
 */
async function generateUnroutedTwiML() {
  const twilio = await import('twilio');
  const VoiceResponse = twilio.default.twiml.VoiceResponse;

  const response = new VoiceResponse();
  response.say('This phone number is not configured. Please contact support.');

  return response.toString();
}

/**
 * Generate TwiML response for SMS
 * Returns empty response (no automatic reply)
 */
async function generateSMSTwiML() {
  const twilio = await import('twilio');
  const MessagingResponse = twilio.default.twiml.MessagingResponse;

  const response = new MessagingResponse();
  // Don't add any message - return empty response so no auto-reply is sent

  return response.toString();
}

app.post('/:channelId', async (c) => {
  try {
    const { channelId } = c.req.param();
    const prisma = getPrisma(c.env.DATABASE_URL);

    // Get the request body (Twilio webhook parameters)
    const body = await c.req.parseBody();

    console.log('Inbound webhook received:', {
      channelId,
      from: body.From,
      to: body.To,
      messageSid: body.MessageSid,
      callSid: body.CallSid,
    });

    // Validate channel exists
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        company: true,
        provider: true,
      },
    });

    if (!channel) {
      console.error('Channel not found:', channelId);
      return c.text(
        await generateUnroutedTwiML(),
        200,
        { 'Content-Type': 'text/xml' }
      );
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
          return c.text('Forbidden', 403);
        }
      }
    }

    // Determine if this is voice or SMS
    const isVoice = body.CallSid ? true : false;
    const isSMS = body.MessageSid ? true : false;

    // ========================================================================
    // CALL/SMS LOGGING
    // - Voice calls: Create VoiceCall record directly (no conversation/message)
    // - SMS: Create Conversation → Message → SmsMessage (threaded)
    // ========================================================================

    let contact = null;
    let conversation = null;
    let message = null;
    let voiceCall = null;
    let smsMessage = null;

    try {
      console.log('[Inbound] Creating/finding contact for:', body.From);

      // 1. Find or create contact from caller
      contact = await findOrCreateContact(
        channel.companyId,
        {
          phoneNumber: body.From,
        },
        'US', // Default country
        prisma // Pass prisma instance
      );

      console.log('[Inbound] Contact:', contact.id, contact.name);

      // 2. Create type-specific record
      if (isVoice) {
        // For VOICE: Create call record directly (no conversation needed)
        voiceCall = await prisma.voiceCall.create({
          data: {
            contactId: contact.id,
            channelId: channel.id,
            providerCallId: body.CallSid,
            direction: 'INBOUND',
            callStatus: 'RINGING',
          },
        });

        console.log('[Inbound] VoiceCall created:', voiceCall.id, 'CallSid:', body.CallSid);
      } else if (isSMS) {
        // For SMS: Create conversation → message → sms_message (threaded)
        conversation = await findOrCreateConversation(
          prisma,
          channel.companyId,
          contact.id,
          channel.id,
          'LINEAR'
        );

        console.log('[Inbound] Conversation:', conversation.id, 'LINEAR');

        const messageBody = body.Body || '(No message body)';

        message = await prisma.message.create({
          data: {
            conversationId: conversation.id,
            direction: 'INBOUND',
            senderType: 'CONTACT',
            body: messageBody,
            status: 'SENT',
          },
        });

        console.log('[Inbound] Message created:', message.id);

        smsMessage = await prisma.smsMessage.create({
          data: {
            messageId: message.id,
            providerMessageId: body.MessageSid,
            segments: body.NumSegments ? parseInt(body.NumSegments, 10) : 1,
            providerStatus: body.SmsStatus || 'received',
          },
        });

        console.log('[Inbound] SmsMessage created:', smsMessage.id, 'MessageSid:', body.MessageSid);

        // Broadcast new SMS message via WebSocket
        try {
          console.log('[Inbound] Broadcasting new SMS message via WebSocket to company:', channel.company.id);

          const durableObjectId = c.env.COMPANY_ROOM.idFromName(channel.company.id);
          const companyRoom = c.env.COMPANY_ROOM.get(durableObjectId);

          await companyRoom.fetch('https://do.internal/broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'new_message',
              data: {
                conversationId: conversation.id,
                messageId: message.id,
                contactId: contact.id,
                channelId: channel.id,
                direction: 'INBOUND',
                body: messageBody,
                timestamp: new Date().toISOString(),
              },
            }),
          });

          console.log('[Inbound] ✅ Broadcasted new_message event');
        } catch (broadcastError) {
          console.error('[Inbound] ⚠️ Failed to broadcast SMS via WebSocket:', broadcastError);
          // Continue anyway
        }

        // If conversation was reopened (went from CLOSED to OPEN), broadcast status change
        // This ensures the UI updates conversation lists in real-time
        const conversationWasReopened = await prisma.conversation.findUnique({
          where: { id: conversation.id },
          select: { status: true },
        });

        if (conversationWasReopened && conversationWasReopened.status === 'OPEN') {
          try {
            const durableObjectId = c.env.COMPANY_ROOM.idFromName(channel.company.id);
            const companyRoom = c.env.COMPANY_ROOM.get(durableObjectId);

            await companyRoom.fetch('https://do.internal/broadcast', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                event: 'conversation_reopened',
                data: {
                  conversationId: conversation.id,
                  contactId: contact.id,
                  channelId: channel.id,
                  timestamp: new Date().toISOString(),
                },
              }),
            });

            console.log('[Inbound] ✅ Broadcasted conversation_reopened event');
          } catch (broadcastError) {
            console.error('[Inbound] ⚠️ Failed to broadcast conversation_reopened:', broadcastError);
            // Continue anyway
          }
        }
      }

      console.log('[Inbound] ✅ Successfully logged communication to database');
    } catch (loggingError) {
      console.error('[Inbound] ⚠️ Failed to log to database (call will continue):', loggingError);
      // Don't fail the request - let the call/SMS still route properly
      // The important thing is that communication still works even if logging fails
    }

    // ========================================================================
    // ROUTING LOGIC (unchanged from original)
    // ========================================================================

    if (isVoice) {
      // Handle voice call routing
      if (channel.routingType === 'UNASSIGNED') {
        return c.text(await generateUnroutedTwiML(), 200, {
          'Content-Type': 'text/xml',
        });
      }

      if (channel.routingType === 'INBOX' && channel.routingTargetId) {
        // Get inbox and its routing strategy
        const inbox = await prisma.inbox.findUnique({
          where: { id: channel.routingTargetId },
          include: {
            inboxMembers: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        });

        if (!inbox) {
          return c.text(await generateUnroutedTwiML(), 200, {
            'Content-Type': 'text/xml',
          });
        }

        // Get routing strategy for PHONE channel type
        const strategy = await prisma.routingStrategy.findUnique({
          where: {
            inboxId_channelType: {
              inboxId: inbox.id,
              channelType: 'PHONE',
            },
          },
        });

        if (!strategy || strategy.strategyType === 'RING_ALL') {
          // RING_ALL strategy (default if no strategy set)
          if (inbox.inboxMembers.length === 0) {
            return c.text(
              `<?xml version="1.0" encoding="UTF-8"?><Response><Say>No agents are assigned to this inbox.</Say></Response>`,
              200,
              { 'Content-Type': 'text/xml' }
            );
          }

          // Get all member user IDs (these are their Twilio client identities)
          const memberIdentities = inbox.inboxMembers.map((m) => m.userId);

          console.log('[Inbound] Ringing members:', memberIdentities);

          // Broadcast incoming call to all inbox members via Socket.IO
          try {
            console.log('[Inbound] Broadcasting incoming call via Socket.IO to company:', channel.company.id);

            // Get CompanyRoom Durable Object
            const durableObjectId = c.env.COMPANY_ROOM.idFromName(channel.company.id);
            const companyRoom = c.env.COMPANY_ROOM.get(durableObjectId);

            // Broadcast to inbox members
            await companyRoom.fetch('https://do.internal/broadcast', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                event: 'incoming_call',
                data: {
                  callSid: body.CallSid,
                  from: body.From,
                  to: body.To,
                  channelId: channel.id,
                  inboxId: inbox.id,
                  inboxName: inbox.name,
                  timestamp: new Date().toISOString(),
                },
                targetUsers: memberIdentities, // Send to specific inbox members
              }),
            });

            console.log('[Inbound] ✅ Broadcasted incoming call to', memberIdentities.length, 'members');
          } catch (broadcastError) {
            console.error('[Inbound] ⚠️ Failed to broadcast via Socket.IO:', broadcastError);
            // Continue anyway - TwiML will still ring the clients
          }

          // Generate TwiML to ring all members with status callback
          const baseUrl = new URL(c.req.url).origin;
          const statusCallbackUrl = `${baseUrl}/webhooks/status/${channel.id}`;
          const twiml = await generateRingAllTwiML(memberIdentities, statusCallbackUrl);
          console.log('[Inbound] Generated TwiML with statusCallback:', statusCallbackUrl);
          return c.text(twiml, 200, { 'Content-Type': 'text/xml' });
        } else if (strategy.strategyType === 'NOTIFY_ALL') {
          // Voicemail strategy (not implemented yet)
          return c.text(await generateVoicemailTwiML(), 200, {
            'Content-Type': 'text/xml',
          });
        } else {
          // Other strategies not yet implemented
          return c.text(
            `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Routing strategy not yet implemented.</Say></Response>`,
            200,
            { 'Content-Type': 'text/xml' }
          );
        }
      }

      // USER routing (private line)
      if (channel.routingType === 'USER' && channel.routingTargetId) {
        const baseUrl = new URL(c.req.url).origin;
        const statusCallbackUrl = `${baseUrl}/webhooks/status/${channel.id}`;
        const twiml = await generateRingAllTwiML([channel.routingTargetId], statusCallbackUrl);
        return c.text(twiml, 200, { 'Content-Type': 'text/xml' });
      }

      // Fallback
      return c.text(await generateUnroutedTwiML(), 200, {
        'Content-Type': 'text/xml',
      });
    } else if (isSMS) {
      // TODO: Implement SMS routing to inbox
      // TODO: Create conversation and message records
      const twiml = await generateSMSTwiML();
      return c.text(twiml, 200, { 'Content-Type': 'text/xml' });
    } else {
      // Unknown webhook type
      console.error('Unknown webhook type:', body);
      return c.text(
        `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
        200,
        { 'Content-Type': 'text/xml' }
      );
    }
  } catch (error) {
    console.error('Inbound webhook error:', error);

    // Return valid TwiML even on error to avoid Twilio failures
    return c.text(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say>An error occurred. Please try again later.</Say></Response>`,
      200,
      { 'Content-Type': 'text/xml' }
    );
  }
});

export default app;
