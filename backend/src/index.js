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
// import userRoutes from './api/users';
// import providerRoutes from './api/providers';
// import channelRoutes from './api/channels';
// import inboxRoutes from './api/inboxes';
// import conversationRoutes from './api/conversations';
// import messageRoutes from './api/messages';
// import voiceRoutes from './api/voice';

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
  origin: ['http://localhost:5173', 'https://customer-service-platform.pages.dev'],
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Health check endpoint (used for monitoring and uptime checks)
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: c.env.ENVIRONMENT || 'production',
  });
});

// API v1 routes
const api = new Hono();

// Authentication routes (public - no auth middleware required)
api.route('/auth', authRoutes);

// Protected routes (require authentication)
// TODO: Add protected route groups here with authMiddleware

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

  return c.json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected error occurred',
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
