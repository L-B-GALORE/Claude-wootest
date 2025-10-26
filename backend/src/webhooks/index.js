/**
 * Webhook Routes
 *
 * Purpose: Mount all webhook endpoints for external services (Twilio, etc.)
 *
 * Routes:
 * - POST /webhooks/inbound/:channelId - Incoming calls and SMS
 * - POST /webhooks/status/:channelId - Status callbacks
 *
 * BEFORE MODIFYING:
 * - These endpoints are called by external services (Twilio)
 * - Authentication works differently (no JWT, signature validation instead)
 * - Must return appropriate responses (TwiML for voice/SMS, JSON for status)
 */

import { Hono } from 'hono';
import inboundWebhook from './inbound.js';
import statusWebhook from './status.js';

const app = new Hono();

// Mount webhook routes
app.route('/inbound', inboundWebhook);
app.route('/status', statusWebhook);

export default app;
