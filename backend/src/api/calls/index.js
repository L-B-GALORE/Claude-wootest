/**
 * Calls API Router
 *
 * Purpose: Manage call history and recordings
 *
 * Routes:
 * - GET /calls - List all calls with filters
 * - GET /calls/:id - Get call details
 *
 * BEFORE MODIFYING:
 * - Validate user has access to company's calls
 * - Ensure proper pagination for large call histories
 * - Handle recording URL security (signed URLs if needed)
 */

import { Hono } from 'hono';
import { getPrisma } from '../../lib/prisma.js';

const app = new Hono();

/**
 * GET /calls
 * List all calls for the authenticated user's company
 *
 * Query params:
 * - contactId: Filter by contact
 * - channelId: Filter by channel (phone number)
 * - inboxId: Filter by inbox
 * - status: Filter by call status (COMPLETED, FAILED, NO_ANSWER, etc.)
 * - dateFrom: Filter calls after this date (ISO 8601)
 * - dateTo: Filter calls before this date (ISO 8601)
 * - limit: Number of results (default: 50, max: 100)
 * - offset: Pagination offset (default: 0)
 */
app.get('/', async (c) => {
  try {
    const companyId = c.get('companyId');
    const prisma = getPrisma(c.env.DATABASE_URL);

    const contactId = c.req.query('contactId');
    const channelId = c.req.query('channelId');
    const inboxId = c.req.query('inboxId');
    const status = c.req.query('status');
    const dateFrom = c.req.query('dateFrom');
    const dateTo = c.req.query('dateTo');
    const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 100);
    const offset = parseInt(c.req.query('offset') || '0', 10);

    // Build where clause
    const where = {
      // Ensure company isolation through contact relation
      contact: {
        companyId,
      },
    };

    // Filter by contact
    if (contactId) {
      where.contactId = contactId;
    }

    // Filter by channel
    if (channelId) {
      where.channelId = channelId;
    }

    // Filter by inbox
    if (inboxId) {
      where.channel = {
        routingTargetId: inboxId,
      };
    }

    // Filter by call status
    if (status) {
      where.callStatus = status;
    }

    // Filter by date range
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    // Get calls with related data
    const calls = await prisma.voiceCall.findMany({
      where,
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
          },
        },
        channel: {
          select: {
            id: true,
            identifier: true,
            routingType: true,
            routingTargetId: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    });

    // Get total count for pagination
    const total = await prisma.voiceCall.count({ where });

    // Transform data for frontend
    const callsData = calls.map(call => ({
      id: call.id,
      providerCallId: call.providerCallId,
      callStatus: call.callStatus,
      durationSeconds: call.durationSeconds,
      recordingUrl: call.recordingUrl,
      answeredByUserId: call.answeredByUserId,
      createdAt: call.createdAt,
      endedAt: call.endedAt,
      contact: call.contact,
      channel: call.channel,
      direction: call.direction,
    }));

    return c.json({
      success: true,
      data: {
        calls: callsData,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      },
    });
  } catch (error) {
    console.error('[Calls API] Error listing calls:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'CALLS_LIST_FAILED',
          message: 'Failed to retrieve calls',
        },
      },
      500
    );
  }
});

/**
 * GET /calls/:id
 * Get detailed call information
 */
app.get('/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const companyId = c.get('companyId');
    const prisma = getPrisma(c.env.DATABASE_URL);

    const call = await prisma.voiceCall.findFirst({
      where: {
        id,
        contact: {
          companyId, // Ensure company isolation
        },
      },
      include: {
        contact: true,
        channel: true,
      },
    });

    if (!call) {
      return c.json(
        {
          success: false,
          error: {
            code: 'CALL_NOT_FOUND',
            message: 'Call not found',
          },
        },
        404
      );
    }

    return c.json({
      success: true,
      data: {
        call: {
          id: call.id,
          providerCallId: call.providerCallId,
          callStatus: call.callStatus,
          durationSeconds: call.durationSeconds,
          recordingUrl: call.recordingUrl,
          answeredByUserId: call.answeredByUserId,
          createdAt: call.createdAt,
          endedAt: call.endedAt,
          contact: call.contact,
          channel: call.channel,
          direction: call.direction,
        },
      },
    });
  } catch (error) {
    console.error('[Calls API] Error getting call:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'CALL_GET_FAILED',
          message: 'Failed to retrieve call',
        },
      },
      500
    );
  }
});

export default app;
