/**
 * Inboxes API Router
 *
 * Purpose: Manage inboxes for organizing conversations and team assignments
 *
 * Routes:
 * - GET    /inboxes - List all inboxes
 * - POST   /inboxes - Create inbox
 * - GET    /inboxes/:id - Get inbox details
 * - PATCH  /inboxes/:id - Update inbox
 * - DELETE /inboxes/:id - Delete inbox
 *
 * BEFORE MODIFYING:
 * - Will this break existing inbox assignments?
 * - Are all routes properly authenticated?
 * - Do we need permission checks (owner/admin only)?
 */

import { Hono } from 'hono';
import { getPrisma } from '../../lib/prisma.js';

const app = new Hono();

// Get all inboxes for company
app.get('/', async (c) => {
  try {
    const companyId = c.get('companyId');
    const prisma = getPrisma(c.env.DATABASE_URL);

    const inboxes = await prisma.inbox.findMany({
      where: {
        companyId: companyId,
      },
      include: {
        _count: {
          select: {
            members: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Count channels routed to each inbox
    const inboxesWithCounts = await Promise.all(
      inboxes.map(async (inbox) => {
        const channelCount = await prisma.channel.count({
          where: {
            companyId: companyId,
            routingType: 'INBOX',
            routingTargetId: inbox.id,
          },
        });

        return {
          id: inbox.id,
          name: inbox.name,
          description: inbox.description,
          memberCount: inbox._count.members,
          channelCount,
          createdAt: inbox.createdAt,
          updatedAt: inbox.updatedAt,
        };
      })
    );

    return c.json({
      success: true,
      data: {
        inboxes: inboxesWithCounts,
      },
    });
  } catch (error) {
    console.error('Failed to fetch inboxes:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch inboxes',
        },
      },
      500
    );
  }
});

// Create inbox
app.post('/', async (c) => {
  try {
    const { name, description } = await c.req.json();
    const companyId = c.get('companyId');
    const prisma = getPrisma(c.env.DATABASE_URL);

    // Validation
    if (!name || name.trim().length === 0) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Inbox name is required',
          },
        },
        400
      );
    }

    // Check if inbox with same name already exists
    const existingInbox = await prisma.inbox.findFirst({
      where: {
        companyId: companyId,
        name: name.trim(),
      },
    });

    if (existingInbox) {
      return c.json(
        {
          success: false,
          error: {
            code: 'INBOX_EXISTS',
            message: 'An inbox with this name already exists',
          },
        },
        400
      );
    }

    // Create inbox
    const inbox = await prisma.inbox.create({
      data: {
        companyId: companyId,
        name: name.trim(),
        description: description?.trim() || null,
      },
    });

    return c.json(
      {
        success: true,
        data: {
          inbox: {
            id: inbox.id,
            name: inbox.name,
            description: inbox.description,
            memberCount: 0,
            createdAt: inbox.createdAt,
            updatedAt: inbox.updatedAt,
          },
        },
      },
      201
    );
  } catch (error) {
    console.error('Failed to create inbox:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'CREATE_FAILED',
          message: 'Failed to create inbox',
        },
      },
      500
    );
  }
});

// Get inbox by ID
app.get('/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const companyId = c.get('companyId');
    const prisma = getPrisma(c.env.DATABASE_URL);

    const inbox = await prisma.inbox.findFirst({
      where: {
        id,
        companyId: companyId,
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
        _count: {
          select: {
            members: true,
          },
        },
      },
    });

    if (!inbox) {
      return c.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Inbox not found',
          },
        },
        404
      );
    }

    return c.json({
      success: true,
      data: {
        inbox: {
          id: inbox.id,
          name: inbox.name,
          description: inbox.description,
          members: inbox.members.map((m) => ({
            id: m.id,
            userId: m.userId,
            user: m.user,
            joinedAt: m.createdAt,
          })),
          memberCount: inbox._count.members,
          createdAt: inbox.createdAt,
          updatedAt: inbox.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error('Failed to fetch inbox:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch inbox',
        },
      },
      500
    );
  }
});

// Update inbox
app.patch('/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const { name, description } = await c.req.json();
    const companyId = c.get('companyId');
    const prisma = getPrisma(c.env.DATABASE_URL);

    // Check if inbox exists
    const inbox = await prisma.inbox.findFirst({
      where: {
        id,
        companyId: companyId,
      },
    });

    if (!inbox) {
      return c.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Inbox not found',
          },
        },
        404
      );
    }

    // Validation
    if (name !== undefined && (!name || name.trim().length === 0)) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Inbox name cannot be empty',
          },
        },
        400
      );
    }

    // Check if new name conflicts with existing inbox
    if (name && name.trim() !== inbox.name) {
      const existingInbox = await prisma.inbox.findFirst({
        where: {
          companyId: companyId,
          name: name.trim(),
          id: { not: id },
        },
      });

      if (existingInbox) {
        return c.json(
          {
            success: false,
            error: {
              code: 'INBOX_EXISTS',
              message: 'An inbox with this name already exists',
            },
          },
          400
        );
      }
    }

    // Update inbox
    const updatedInbox = await prisma.inbox.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
      },
      include: {
        _count: {
          select: {
            members: true,
          },
        },
      },
    });

    return c.json({
      success: true,
      data: {
        inbox: {
          id: updatedInbox.id,
          name: updatedInbox.name,
          description: updatedInbox.description,
          memberCount: updatedInbox._count.members,
          createdAt: updatedInbox.createdAt,
          updatedAt: updatedInbox.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error('Failed to update inbox:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update inbox',
        },
      },
      500
    );
  }
});

// Delete inbox
app.delete('/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const companyId = c.get('companyId');
    const prisma = getPrisma(c.env.DATABASE_URL);

    // Check if inbox exists
    const inbox = await prisma.inbox.findFirst({
      where: {
        id,
        companyId: companyId,
      },
    });

    if (!inbox) {
      return c.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Inbox not found',
          },
        },
        404
      );
    }

    // Check if inbox is being used by any channels
    const channelsUsingInbox = await prisma.channel.count({
      where: {
        companyId: companyId,
        routingType: 'INBOX',
        routingTargetId: id,
      },
    });

    if (channelsUsingInbox > 0) {
      return c.json(
        {
          success: false,
          error: {
            code: 'INBOX_IN_USE',
            message: `Cannot delete inbox. ${channelsUsingInbox} channel(s) are routing to this inbox. Please reassign them first.`,
          },
        },
        400
      );
    }

    // Delete inbox (members will cascade delete)
    await prisma.inbox.delete({
      where: { id },
    });

    return c.json({
      success: true,
      data: {
        message: 'Inbox deleted successfully',
      },
    });
  } catch (error) {
    console.error('Failed to delete inbox:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'DELETE_FAILED',
          message: 'Failed to delete inbox',
        },
      },
      500
    );
  }
});

export default app;
