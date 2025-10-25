/**
 * Users API Router
 *
 * Purpose: Manage company users
 *
 * Routes:
 * - GET /users - List all users in company
 *
 * BEFORE MODIFYING:
 * - Are permissions properly checked?
 * - Do we expose sensitive data?
 */

import { Hono } from 'hono';
import { getPrisma } from '../../lib/prisma.js';

const app = new Hono();

// List all users in company
app.get('/', async (c) => {
  try {
    const companyId = c.get('companyId');
    const prisma = getPrisma(c.env.DATABASE_URL);

    const users = await prisma.user.findMany({
      where: {
        companyId: companyId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        lastActiveAt: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return c.json({
      success: true,
      data: {
        users,
      },
    });
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch users',
        },
      },
      500
    );
  }
});

export default app;
