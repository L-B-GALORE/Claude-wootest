/**
 * Cloudflare Worker Entry Point
 *
 * This is the main entry point for the Cloudflare Worker that powers
 * the backend API for the multi-tenant customer service platform.
 *
 * Architecture:
 * - Hono framework for routing (lightweight, fast, built for Workers)
 * - Neon Postgres via Prisma for database
 * - Cloudflare KV for caching and presence
 * - Cloudflare R2 for media storage
 * - Durable Objects for WebSocket connections
 *
 * Environment Bindings (from wrangler.toml):
 * - PRESENCE_KV: User online/offline status
 * - CACHE_KV: Session data, rate limiting
 * - MEDIA_STORAGE: R2 bucket for recordings/attachments
 * - COMPANY_ROOM: Durable Object for company WebSocket rooms
 *
 * Secrets (set via wrangler secret put):
 * - DATABASE_URL: Neon Postgres connection string
 * - JWT_SECRET: For signing JWT tokens
 * - ENCRYPTION_KEY: For encrypting provider credentials
 *
 * BEFORE MODIFYING:
 * - Is this the right place for this change?
 * - Does this affect routing for all requests?
 * - Will this break existing API endpoints?
 * - Should this be in a separate middleware file?
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';

// Import API routes
import authRoutes from './api/auth/index.js';
import providerRoutes from './api/providers/index.js';
import channelRoutes from './api/channels/index.js';
import inboxRoutes from './api/inboxes/index.js';
import userRoutes from './api/users/index.js';
import voiceRoutes from './api/voice/index.js';
import companyRoutes from './api/company/index.js';
import contactRoutes from './api/contacts/index.js';
import callRoutes from './api/calls/index.js';
import conversationRoutes from './api/conversations/index.js';
import testEmailRoutes from './api/test-email.js';

// Import webhook routes (no auth required - called by external services)
import webhookRoutes from './webhooks/index.js';

// Import middleware
import { authMiddleware } from './middleware/auth.js';
import { errorHandler } from './middleware/error-handler.js';

// Import Durable Objects
import { CompanyRoom } from './durable-objects/CompanyRoom';

// Export Durable Objects
export { CompanyRoom };

// Create Hono app
const app = new Hono();

// Global middleware
app.use('*', logger()); // Log all requests
app.use('*', prettyJSON()); // Pretty JSON responses in development
app.use('*', cors({
  origin: [
    'http://localhost:5173',
    'https://claude-wootestnew.pages.dev',
    'https://staging.claude-wootestnew.pages.dev'
  ],
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Health check endpoint (used for monitoring and uptime checks)
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.1',
    environment: c.env.ENVIRONMENT || 'production',
  });
});

// Test email endpoint (no authentication - for testing Email Sending setup)
app.route('/test-email', testEmailRoutes);

// Webhook routes (no authentication - called by external services like Twilio)
app.route('/webhooks', webhookRoutes);

// WebSocket route for real-time communication
app.get('/ws/company/:companyId', async (c) => {
  const { companyId } = c.req.param();

  console.log('[WebSocket] Connection request for company:', companyId);

  // Check if this is a WebSocket upgrade request
  const upgradeHeader = c.req.header('Upgrade');
  if (upgradeHeader !== 'websocket') {
    console.error('[WebSocket] Not a WebSocket upgrade request');
    return c.json({ error: 'Expected WebSocket upgrade' }, 426);
  }

  try {
    // Get the CompanyRoom Durable Object for this company
    const durableObjectId = c.env.COMPANY_ROOM.idFromName(companyId);
    const companyRoom = c.env.COMPANY_ROOM.get(durableObjectId);

    console.log('[WebSocket] Forwarding request to CompanyRoom Durable Object');

    // Forward the request to the Durable Object
    return companyRoom.fetch(c.req.raw);
  } catch (error) {
    console.error('[WebSocket] Error connecting to CompanyRoom:', error);
    return c.json({ error: 'Failed to establish WebSocket connection' }, 500);
  }
});

// API v1 routes
const api = new Hono();

// Authentication routes (public - no auth middleware required)
api.route('/auth', authRoutes);

// Protected routes (require authentication)
api.use('/providers/*', authMiddleware);
api.route('/providers', providerRoutes);

api.use('/channels/*', authMiddleware);
api.route('/channels', channelRoutes);

api.use('/inboxes/*', authMiddleware);
api.route('/inboxes', inboxRoutes);

api.use('/users/*', authMiddleware);
api.route('/users', userRoutes);

api.use('/voice/*', authMiddleware);
api.route('/voice', voiceRoutes);

api.use('/company/*', authMiddleware);
api.route('/company', companyRoutes);

api.use('/contacts/*', authMiddleware);
api.route('/contacts', contactRoutes);

api.use('/calls/*', authMiddleware);
api.route('/calls', callRoutes);

api.use('/conversations/*', authMiddleware);
api.route('/conversations', conversationRoutes);

// Mount API routes
app.route('/api/v1', api);

// 404 handler
app.notFound((c) => {
  return c.json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource was not found',
      path: c.req.path,
    },
  }, 404);
});

// Global error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);

  // Handle APIError (from middleware)
  if (err.name === 'APIError') {
    return c.json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details && { details: err.details }),
      },
    }, err.statusCode || 500);
  }

  // In development, return detailed error info
  const isDev = c.env?.ENVIRONMENT === 'development';

  return c.json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected error occurred',
      ...(isDev && {
        stack: err.stack,
        details: err.toString(),
      }),
    },
  }, 500);
});

// Export the Worker
export default {
  /**
   * Fetch handler - handles all HTTP requests
   */
  async fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },

  /**
   * Scheduled handler - for cron jobs (future)
   */
  async scheduled(event, env, ctx) {
    // Future: Run scheduled tasks
    // - Clean up old sessions
    // - Aggregate analytics
    // - Fetch emails from providers
  },
};
