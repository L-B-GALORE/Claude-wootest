/**
 * Inbox Members Management
 *
 * POST   /api/v1/inboxes/:id/members - Add member to inbox
 * DELETE /api/v1/inboxes/:id/members/:userId - Remove member from inbox
 * GET    /api/v1/inboxes/:id/members - Get all members (already in main index.js)
 *
 * Purpose: Manage which users have access to an inbox
 */

import { Hono } from 'hono';
import { getPrisma } from '../../lib/prisma.js';

const app = new Hono();

// Add member to inbox
app.post('/:id/members', async (c) => {
  try {
    const { id } = c.req.param();
    const { userId } = await c.req.json();
    const companyId = c.get('companyId');
    const prisma = getPrisma(c.env.DATABASE_URL);

    // Validate userId is provided
    if (!userId) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'userId is required',
          },
        },
        400
      );
    }

    // Verify inbox exists and belongs to company
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

    // Verify user exists and belongs to company
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        companyId: companyId,
      },
    });

    if (!user) {
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

    // Check if member already exists
    const existingMember = await prisma.inboxMember.findUnique({
      where: {
        inboxId_userId: {
          inboxId: id,
          userId: userId,
        },
      },
    });

    if (existingMember) {
      return c.json(
        {
          success: false,
          error: {
            code: 'MEMBER_EXISTS',
            message: 'User is already a member of this inbox',
          },
        },
        400
      );
    }

    // Add member
    const member = await prisma.inboxMember.create({
      data: {
        inboxId: id,
        userId: userId,
      },
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
    });

    return c.json(
      {
        success: true,
        data: {
          member: {
            id: member.id,
            userId: member.userId,
            user: member.user,
            joinedAt: member.createdAt,
          },
        },
      },
      201
    );
  } catch (error) {
    console.error('Failed to add member:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'ADD_MEMBER_FAILED',
          message: 'Failed to add member to inbox',
        },
      },
      500
    );
  }
});

// Remove member from inbox
app.delete('/:id/members/:userId', async (c) => {
  try {
    const { id, userId } = c.req.param();
    const companyId = c.get('companyId');
    const prisma = getPrisma(c.env.DATABASE_URL);

    // Verify inbox exists and belongs to company
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

    // Check if member exists
    const member = await prisma.inboxMember.findUnique({
      where: {
        inboxId_userId: {
          inboxId: id,
          userId: userId,
        },
      },
    });

    if (!member) {
      return c.json(
        {
          success: false,
          error: {
            code: 'MEMBER_NOT_FOUND',
            message: 'User is not a member of this inbox',
          },
        },
        404
      );
    }

    // Delete member
    await prisma.inboxMember.delete({
      where: {
        inboxId_userId: {
          inboxId: id,
          userId: userId,
        },
      },
    });

    return c.json({
      success: true,
      data: {
        message: 'Member removed from inbox',
      },
    });
  } catch (error) {
    console.error('Failed to remove member:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'REMOVE_MEMBER_FAILED',
          message: 'Failed to remove member from inbox',
        },
      },
      500
    );
  }
});

export default app;
