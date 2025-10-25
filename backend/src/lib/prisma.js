/**
 * Prisma Client Initialization
 *
 * Purpose: Create and manage Prisma Client instances for Cloudflare Workers
 *
 * Uses Prisma with driverAdapters for Neon Serverless Postgres
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

let prismaInstance = null;

/**
 * Get Prisma Client instance
 * @param {string} databaseUrl - Database connection string
 * @returns {PrismaClient} - Prisma client instance
 */
export function getPrisma(databaseUrl) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  // Reuse existing instance if available
  if (prismaInstance) {
    return prismaInstance;
  }

  // Create Neon connection pool
  const pool = new Pool({ connectionString: databaseUrl });

  // Create Prisma adapter
  const adapter = new PrismaNeon(pool);

  // Create Prisma client
  prismaInstance = new PrismaClient({ adapter });

  return prismaInstance;
}

/**
 * Close Prisma connection
 */
export async function closePrisma() {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
  }
}
