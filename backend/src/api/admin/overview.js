/**
 * Admin Overview Endpoint
 *
 * GET /api/v1/admin/overview
 *
 * Purpose: Provide WooPhone product admin with overview of all companies/users
 *
 * Returns:
 * - All companies registered
 * - User verification status
 * - Twilio configuration status
 * - SMS/Call activity metrics
 * - Registration dates
 *
 * Security:
 * - Only accessible by admin users (checked via ADMIN_EMAIL env var)
 * - Requires authentication
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     companies: [
 *       {
 *         id: string,
 *         name: string,
 *         createdAt: string,
 *         owner: {
 *           id: string,
 *           email: string,
 *           name: string,
 *           emailVerified: boolean,
 *         },
 *         twilioConfigured: boolean,
 *         hasActivity: boolean,
 *         stats: {
 *           smsSent: number,
 *           smsReceived: number,
 *           callsMade: number,
 *           callsReceived: number,
 *         }
 *       }
 *     ],
 *     totalCompanies: number,
 *     totalUsers: number,
 *     verifiedUsers: number,
 *   }
 * }
 */

import { Hono } from 'hono';
import { getPrisma } from '../../lib/prisma.js';
import { APIError, asyncHandler } from '../../middleware/error-handler.js';
import { authMiddleware } from '../../middleware/auth.js';
import { logger } from '../../utils/logger.js';

const app = new Hono();

// Apply auth middleware - must be logged in
app.use('*', authMiddleware);

app.get('/', asyncHandler(async (c) => {
  const authUser = c.get('user');
  const adminEmail = c.env.ADMIN_EMAIL;

  const db = getPrisma(c.env.DATABASE_URL);

  // Fetch full user record to get email
  const user = await db.user.findUnique({
    where: { id: authUser.userId },
    select: {
      id: true,
      email: true,
    },
  });

  if (!user) {
    throw new APIError(
      'USER_NOT_FOUND',
      'User not found',
      404
    );
  }

  // Check if user is admin
  if (!adminEmail || user.email !== adminEmail) {
    logger.warn('Unauthorized admin access attempt', {
      userId: user.id,
      email: user.email,
    });
    throw new APIError(
      'UNAUTHORIZED',
      'Access denied. Admin privileges required.',
      403
    );
  }

  logger.info('Admin overview accessed', { adminEmail: user.email });

  // Get all companies with their owner and stats
  const companies = await db.company.findMany({
    include: {
      users: {
        where: { role: 'OWNER' },
        select: {
          id: true,
          email: true,
          name: true,
          emailVerified: true,
          createdAt: true,
        },
      },
      twilioProviders: {
        select: {
          id: true,
          accountSid: true,
          isActive: true,
        },
      },
      channels: {
        select: {
          id: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Get message stats for each company
  const companiesWithStats = await Promise.all(
    companies.map(async (company) => {
      // Get SMS stats
      const [smsSent, smsReceived] = await Promise.all([
        db.message.count({
          where: {
            companyId: company.id,
            direction: 'outbound',
          },
        }),
        db.message.count({
          where: {
            companyId: company.id,
            direction: 'inbound',
          },
        }),
      ]);

      // Get call stats
      const [callsMade, callsReceived] = await Promise.all([
        db.voiceCall.count({
          where: {
            companyId: company.id,
            direction: 'outbound',
          },
        }),
        db.voiceCall.count({
          where: {
            companyId: company.id,
            direction: 'inbound',
          },
        }),
      ]);

      const owner = company.users[0]; // Should always have an owner

      return {
        id: company.id,
        name: company.name,
        createdAt: company.createdAt,
        owner: owner || null,
        twilioConfigured: company.twilioProviders.length > 0,
        hasActivity: (smsSent + smsReceived + callsMade + callsReceived) > 0,
        stats: {
          smsSent,
          smsReceived,
          callsMade,
          callsReceived,
        },
      };
    })
  );

  // Calculate totals
  const totalUsers = await db.user.count();
  const verifiedUsers = await db.user.count({
    where: { emailVerified: true },
  });

  return c.json({
    success: true,
    data: {
      companies: companiesWithStats,
      totalCompanies: companies.length,
      totalUsers,
      verifiedUsers,
    },
  });
}));

export default app;
