/**
 * Database Service
 *
 * Purpose: Prisma client setup for Neon Serverless Postgres.
 *
 * Connection:
 * - Neon Serverless Postgres via DATABASE_URL secret
 * - Connection pooling handled by Neon
 * - For Cloudflare Workers compatibility, we use Prisma with pg adapter
 *
 * Note: Prisma in Cloudflare Workers requires special setup:
 * - Use @prisma/adapter-pg for connection
 * - Database URL from environment secrets
 * - Prisma Client generated during build
 *
 * BEFORE MODIFYING:
 * - Will this change affect all database queries?
 * - Do we need to update Prisma schema?
 * - Should we add connection pooling configuration?
 *
 * Used by:
 * - All API endpoints that need database access
 * - Auth endpoints (user registration, login)
 * - User management
 * - Provider/channel management
 *
 * TODO: Once Prisma engines are available, uncomment the Prisma import
 * For now, this is a placeholder that shows the structure
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

/**
 * Get Prisma client for the current request
 *
 * In production (Cloudflare Workers):
 * - Creates Prisma client with pg adapter
 * - Uses DATABASE_URL from environment
 * - Connection pooling via Neon
 *
 * @param {Object} env - Cloudflare Worker environment (contains DATABASE_URL)
 * @returns {PrismaClient} - Prisma client instance
 */
export function getPrismaClient(env) {
  const databaseUrl = env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // Create PostgreSQL pool
  const pool = new pg.Pool({
    connectionString: databaseUrl,
  });

  // Create Prisma adapter
  const adapter = new PrismaPg(pool);

  // Create and return Prisma client
  const prisma = new PrismaClient({ adapter });

  return prisma;
}

/**
 * Mock Prisma client for development
 * This allows the Worker to deploy without database being fully configured
 * Remove this once Prisma is set up
 */
function createMockPrismaClient() {
  return {
    company: {
      findMany: async () => [],
      findUnique: async () => null,
      create: async (data) => ({ id: 'mock-id', ...data.data }),
      update: async (data) => ({ id: data.where.id, ...data.data }),
      delete: async () => ({ id: 'mock-id' }),
    },
    user: {
      findMany: async () => [],
      findUnique: async () => null,
      findFirst: async () => null,
      create: async (data) => ({
        id: 'mock-user-id',
        email: data.data.email,
        name: data.data.name,
        role: data.data.role || 'AGENT',
        companyId: data.data.companyId,
        createdAt: new Date(),
      }),
      update: async (data) => ({ id: data.where.id, ...data.data }),
      delete: async () => ({ id: 'mock-id' }),
    },
    // Add other models as needed
  };
}

/**
 * Close Prisma connection (cleanup)
 * Call this in Worker cleanup if needed
 */
export async function closePrismaClient(prisma) {
  if (prisma && typeof prisma.$disconnect === 'function') {
    await prisma.$disconnect();
  }
}
