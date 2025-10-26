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
 * - Returns appropriate TwiML response
 * - Creates conversation and message records
 *
 * BEFORE MODIFYING:
 * - This is called by Twilio for EVERY incoming call/SMS
 * - Response must be valid TwiML (XML format)
 * - Must respond quickly (Twilio has timeout limits)
 * - Signature validation should be added for production
 */

import { Hono } from 'hono';
import { getPrisma } from '../lib/prisma.js';

const app = new Hono();

/**
 * Generate TwiML response for voice calls
 * For now, plays a simple message. Will be replaced with routing logic.
 */
function generateVoiceTwiML() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Thank you for calling. Please hold while we connect you to an agent.</Say>
  <Pause length="60"/>
</Response>`;
}

/**
 * Generate TwiML response for SMS
 * For now, just acknowledges receipt. Will be replaced with inbox routing.
 */
function generateSMSTwiML() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Thank you for your message. We will respond shortly.</Message>
</Response>`;
}

app.post('/:channelId', async (c) => {
  try {
    const { channelId } = c.req.param();
    const companyId = c.get('companyId'); // May be undefined for webhook calls
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
    // Note: We don't filter by companyId here because Twilio doesn't send it
    // We'll look up the company from the channel
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        company: true,
      },
    });

    if (!channel) {
      console.error('Channel not found:', channelId);
      // Still return valid TwiML to avoid Twilio errors
      return c.text(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Invalid configuration.</Say></Response>`,
        200,
        { 'Content-Type': 'text/xml' }
      );
    }

    // Determine if this is voice or SMS based on request parameters
    const isVoice = body.CallSid ? true : false;
    const isSMS = body.MessageSid ? true : false;

    if (isVoice) {
      // TODO: Implement call routing based on channel.routingType
      // For now, return holding message
      const twiml = generateVoiceTwiML();
      return c.text(twiml, 200, { 'Content-Type': 'text/xml' });
    } else if (isSMS) {
      // TODO: Implement SMS routing to inbox
      // TODO: Create conversation and message records
      const twiml = generateSMSTwiML();
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
