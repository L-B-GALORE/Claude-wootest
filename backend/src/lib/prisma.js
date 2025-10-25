/**
 * Prisma Client Initialization
 *
 * Purpose: Create and manage Prisma Client instances for Cloudflare Workers
 *
 * Uses Prisma with driverAdapters for Neon Serverless Postgres
 *
 * IMPORTANT: In Cloudflare Workers, each request MUST have its own Prisma client
 * instance. We CANNOT reuse instances across requests due to Workers' isolation model.
 *
 * BEFORE MODIFYING:
 * - Will this break database connections?
 * - Are we properly handling connection pooling?
 * - Is this compatible with Cloudflare Workers?
 */

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Configure Neon for WebSocket
neonConfig.webSocketConstructor = ws;

/**
 * Get Prisma Client instance
 *
 * IMPORTANT: Creates a NEW instance for each request to comply with
 * Cloudflare Workers' isolation model. Do NOT cache/reuse instances.
 *
 * @param {string} databaseUrl - Database connection string
 * @returns {PrismaClient} - Prisma client instance
 */
export function getPrisma(databaseUrl) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  // Create Neon connection pool (new for each request)
  const pool = new Pool({ connectionString: databaseUrl });

  // Create Prisma adapter
  const adapter = new PrismaNeon(pool);

  // Create NEW Prisma client for this request
  const prisma = new PrismaClient({ adapter });

  return prisma;
}
