/**
 * Get Available Caller IDs for User
 *
 * GET /api/v1/voice/caller-ids
 *
 * Purpose: Get phone numbers the user can call from
 *
 * Business Logic:
 * - User can call from any phone number assigned to an inbox they are a member of
 * - This ensures users only use caller IDs they have permission to use
 *
 * BEFORE MODIFYING:
 * - This determines which numbers appear in outbound dialer
 * - Security: Must verify inbox membership
 */

import { Hono } from 'hono';
import { getPrisma } from '../../lib/prisma.js';

const app = new Hono();

app.get('/', async (c) => {
  try {
    const userId = c.get('userId');
    const companyId = c.get('companyId');
    const prisma = getPrisma(c.env.DATABASE_URL);

    // Get all inboxes where user is a member
    const inboxMemberships = await prisma.inboxMember.findMany({
      where: {
        userId: userId,
        inbox: {
          companyId: companyId,
        },
      },
      include: {
        inbox: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const inboxIds = inboxMemberships.map((m) => m.inboxId);

    // Get all phone channels routed to those inboxes
    const channels = await prisma.channel.findMany({
      where: {
        companyId: companyId,
        type: 'PHONE',
        status: 'ACTIVE',
        routingType: 'INBOX',
        routingTargetId: {
          in: inboxIds,
        },
      },
      select: {
        id: true,
        identifier: true, // Phone number
        metadata: true,
        routingTargetId: true,
      },
    });

    // Map to caller ID format with inbox info
    const callerIds = channels.map((channel) => {
      const inbox = inboxMemberships.find((m) => m.inboxId === channel.routingTargetId);
      return {
        channelId: channel.id,
        phoneNumber: channel.identifier,
        friendlyName: channel.metadata?.friendlyName || channel.identifier,
        inboxId: inbox?.inboxId,
        inboxName: inbox?.inbox?.name,
      };
    });

    return c.json({
      success: true,
      data: {
        callerIds: callerIds,
        total: callerIds.length,
      },
    });
  } catch (error) {
    console.error('Failed to fetch caller IDs:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'FETCH_CALLER_IDS_FAILED',
          message: error.message || 'Failed to fetch available caller IDs',
        },
      },
      500
    );
  }
});

export default app;
