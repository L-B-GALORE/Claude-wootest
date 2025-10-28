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

const app = new Hono();

/**
 * Generate TwiML response for RING_ALL strategy
 * Rings all logged-in users' browsers simultaneously
 */
async function generateRingAllTwiML(memberIdentities) {
  const twilio = await import('twilio');
  const VoiceResponse = twilio.default.twiml.VoiceResponse;

  const response = new VoiceResponse();
  const dial = response.dial({ timeout: 30 });

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
 */
async function generateSMSTwiML() {
  const twilio = await import('twilio');
  const MessagingResponse = twilio.default.twiml.MessagingResponse;

  const response = new MessagingResponse();
  response.message('Thank you for your message. We will respond shortly.');

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
            members: {
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
          if (inbox.members.length === 0) {
            return c.text(
              `<?xml version="1.0" encoding="UTF-8"?><Response><Say>No agents are assigned to this inbox.</Say></Response>`,
              200,
              { 'Content-Type': 'text/xml' }
            );
          }

          // Get all member user IDs (these are their Twilio client identities)
          const memberIdentities = inbox.members.map((m) => m.userId);

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

          // Generate TwiML to ring all members
          const twiml = await generateRingAllTwiML(memberIdentities);
          console.log('[Inbound] Generated TwiML:', twiml);
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
        const twiml = await generateRingAllTwiML([channel.routingTargetId]);
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
