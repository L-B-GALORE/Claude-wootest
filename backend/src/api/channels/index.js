/**
 * Channels API Router
 *
 * Purpose: Manage communication channels (view, configure routing, delete)
 *
 * Routes:
 * - GET   /channels - List all channels
 * - GET   /channels/:id - Get channel details
 * - PATCH /channels/:id/routing - Update channel routing configuration
 * - DELETE /channels/:id - Remove channel
 *
 * BEFORE MODIFYING:
 * - Will this break existing channel routing?
 * - Are permissions properly checked?
 * - Do we validate routing configuration?
 */

import { Hono } from 'hono';
import { getPrisma } from '../../lib/prisma.js';

const app = new Hono();

// List all channels for company
app.get('/', async (c) => {
  try {
    const companyId = c.get('companyId');
    const prisma = getPrisma(c.env.DATABASE_URL);

    const channels = await prisma.channel.findMany({
      where: {
        companyId: companyId,
      },
      include: {
        provider: {
          select: {
            id: true,
            type: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return c.json({
      success: true,
      data: {
        channels,
      },
    });
  } catch (error) {
    console.error('Failed to fetch channels:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch channels',
        },
      },
      500
    );
  }
});

// Get channel by ID
app.get('/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const companyId = c.get('companyId');
    const prisma = getPrisma(c.env.DATABASE_URL);

    const channel = await prisma.channel.findFirst({
      where: {
        id,
        companyId: companyId,
      },
      include: {
        provider: {
          select: {
            id: true,
            type: true,
          },
        },
      },
    });

    if (!channel) {
      return c.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Channel not found',
          },
        },
        404
      );
    }

    return c.json({
      success: true,
      data: {
        channel,
      },
    });
  } catch (error) {
    console.error('Failed to fetch channel:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch channel',
        },
      },
      500
    );
  }
});

// Update channel routing
app.patch('/:id/routing', async (c) => {
  try {
    const { id } = c.req.param();
    const { routingType, routingTargetId } = await c.req.json();
    const companyId = c.get('companyId');
    const prisma = getPrisma(c.env.DATABASE_URL);

    // Validate routing type
    const validRoutingTypes = ['UNASSIGNED', 'INBOX', 'USER', 'VOICEMAIL', 'CUSTOM'];
    if (!validRoutingTypes.includes(routingType)) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid routing type',
          },
        },
        400
      );
    }

    // Validate routingTargetId based on routingType
    if (routingType === 'INBOX' && !routingTargetId) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'routingTargetId is required for INBOX routing',
          },
        },
        400
      );
    }

    if (routingType === 'USER' && !routingTargetId) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'routingTargetId is required for USER routing',
          },
        },
        400
      );
    }

    // Check if channel exists
    const channel = await prisma.channel.findFirst({
      where: {
        id,
        companyId: companyId,
      },
    });

    if (!channel) {
      return c.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Channel not found',
          },
        },
        404
      );
    }

    // Validate target exists
    if (routingType === 'INBOX' && routingTargetId) {
      const inbox = await prisma.inbox.findFirst({
        where: {
          id: routingTargetId,
          companyId: companyId,
        },
      });

      if (!inbox) {
        return c.json(
          {
            success: false,
            error: {
              code: 'INBOX_NOT_FOUND',
              message: 'Inbox not found',
            },
          },
          404
        );
      }
    }

    if (routingType === 'USER' && routingTargetId) {
      const targetUser = await prisma.user.findFirst({
        where: {
          id: routingTargetId,
          companyId: companyId,
        },
      });

      if (!targetUser) {
        return c.json(
          {
            success: false,
            error: {
              code: 'USER_NOT_FOUND',
              message: 'User not found',
            },
          },
          404
        );
      }
    }

    // Update channel routing
    const updatedChannel = await prisma.channel.update({
      where: {
        id,
      },
      data: {
        routingType,
        routingTargetId: routingType === 'UNASSIGNED' ? null : routingTargetId,
      },
      include: {
        provider: {
          select: {
            id: true,
            type: true,
          },
        },
      },
    });

    return c.json({
      success: true,
      data: {
        channel: updatedChannel,
      },
    });
  } catch (error) {
    console.error('Failed to update channel routing:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update channel routing',
        },
      },
      500
    );
  }
});

// Delete channel
app.delete('/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const companyId = c.get('companyId');
    const prisma = getPrisma(c.env.DATABASE_URL);

    // Check if channel exists
    const channel = await prisma.channel.findFirst({
      where: {
        id,
        companyId: companyId,
      },
    });

    if (!channel) {
      return c.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Channel not found',
          },
        },
        404
      );
    }

    // TODO: Optionally unconfigure webhooks on Twilio side

    // Delete channel
    await prisma.channel.delete({
      where: {
        id,
      },
    });

    return c.json({
      success: true,
      data: {
        message: 'Channel removed successfully',
      },
    });
  } catch (error) {
    console.error('Failed to delete channel:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'DELETE_FAILED',
          message: 'Failed to delete channel',
        },
      },
      500
    );
  }
});

export default app;
