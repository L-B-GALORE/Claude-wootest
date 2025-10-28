/**
 * TwiML App Voice Webhook
 *
 * POST /webhooks/twiml/voice
 *
 * Purpose: Handle voice routing for TwiML Application
 *
 * This endpoint handles:
 * - Outbound calls from browser (Device.connect)
 * - Incoming calls to Twilio numbers
 *
 * Call Direction Detection:
 * - Outbound: To parameter is external number (not our Twilio number)
 * - Inbound: To parameter is our Twilio number
 *
 * BEFORE MODIFYING:
 * - This is the VoiceUrl for the TwiML Application
 * - Must return valid TwiML for all scenarios
 * - Performance critical - Twilio has timeout limits
 */

import { Hono } from 'hono';
import { getPrisma } from '../../lib/prisma.js';

const app = new Hono();

/**
 * Generate TwiML for outbound call
 */
async function generateOutboundTwiML(destinationNumber, callerIdNumber) {
  const twilio = await import('twilio');
  const VoiceResponse = twilio.default.twiml.VoiceResponse;

  const response = new VoiceResponse();
  const dial = response.dial({
    callerId: callerIdNumber, // Use selected caller ID
  });
  dial.number(destinationNumber);

  return response.toString();
}

/**
 * Generate TwiML to route incoming call to browser client
 */
async function generateInboundToBrowserTwiML(clientIdentity) {
  const twilio = await import('twilio');
  const VoiceResponse = twilio.default.twiml.VoiceResponse;

  const response = new VoiceResponse();
  const dial = response.dial();
  dial.client(clientIdentity);

  return response.toString();
}

app.post('/', async (c) => {
  try {
    const prisma = getPrisma(c.env.DATABASE_URL);
    const body = await c.req.parseBody();

    console.log('[TwiML Voice] Webhook received:', {
      from: body.From,
      to: body.To,
      direction: body.Direction,
      callSid: body.CallSid,
    });

    // Determine if this is an outbound or inbound call
    // Outbound: User called from browser, To is external number
    // Inbound: External number called our Twilio number

    // Check if To number is one of our Twilio numbers
    const channel = await prisma.channel.findFirst({
      where: {
        type: 'PHONE',
        identifier: body.To,
      },
      include: {
        company: true,
      },
    });

    if (!channel) {
      // To number is NOT our Twilio number = Outbound call from browser
      console.log('[TwiML Voice] Outbound call detected:', {
        to: body.To,
        from: body.From,
      });

      // For outbound calls, we need the caller ID
      // The From parameter should be passed from the browser
      // If not provided, we cannot complete the call
      const callerIdNumber = body.From;

      if (!callerIdNumber) {
        const twilio = await import('twilio');
        const VoiceResponse = twilio.default.twiml.VoiceResponse;
        const response = new VoiceResponse();
        response.say('Error: No caller ID specified. Please try again.');
        return c.text(response.toString(), 200, { 'Content-Type': 'text/xml' });
      }

      // Generate TwiML to dial the destination number
      const twiml = await generateOutboundTwiML(body.To, callerIdNumber);
      console.log('[TwiML Voice] Generated outbound TwiML');
      return c.text(twiml, 200, { 'Content-Type': 'text/xml' });
    } else {
      // To number IS our Twilio number = Inbound call
      console.log('[TwiML Voice] Inbound call detected to channel:', channel.id);

      // Route to the inbound webhook handler for proper routing logic
      // This allows us to reuse all the inbox routing logic
      // Redirect to /webhooks/inbound/:channelId
      const redirectUrl = `/webhooks/inbound/${channel.id}`;

      const twilio = await import('twilio');
      const VoiceResponse = twilio.default.twiml.VoiceResponse;
      const response = new VoiceResponse();
      response.redirect(redirectUrl);

      return c.text(response.toString(), 200, { 'Content-Type': 'text/xml' });
    }
  } catch (error) {
    console.error('[TwiML Voice] Error:', error);

    // Return error TwiML
    const twilio = await import('twilio');
    const VoiceResponse = twilio.default.twiml.VoiceResponse;
    const response = new VoiceResponse();
    response.say('An error occurred. Please try again later.');

    return c.text(response.toString(), 200, { 'Content-Type': 'text/xml' });
  }
});

export default app;
