/**
 * Inbox Routing Strategy Management
 *
 * POST   /api/v1/inboxes/:id/routing - Set routing strategy
 * GET    /api/v1/inboxes/:id/routing - Get routing strategies
 * DELETE /api/v1/inboxes/:id/routing/:channelType - Remove routing strategy
 *
 * Purpose: Configure how calls/messages are routed to inbox members
 */

import { Hono } from 'hono';
import { getPrisma } from '../../lib/prisma.js';

const app = new Hono();

// Get routing strategies for an inbox
app.get('/:id/routing', async (c) => {
  try {
    const { id } = c.req.param();
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

    // Get all routing strategies for this inbox
    const strategies = await prisma.routingStrategy.findMany({
      where: {
        inboxId: id,
      },
    });

    return c.json({
      success: true,
      data: {
        strategies,
      },
    });
  } catch (error) {
    console.error('Failed to fetch routing strategies:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch routing strategies',
        },
      },
      500
    );
  }
});

// Set routing strategy for an inbox
app.post('/:id/routing', async (c) => {
  try {
    const { id } = c.req.param();
    const { channelType, strategyType, config } = await c.req.json();
    const companyId = c.get('companyId');
    const prisma = getPrisma(c.env.DATABASE_URL);

    // Validate channelType
    const validChannelTypes = ['PHONE', 'EMAIL', 'WHATSAPP', 'FACEBOOK', 'INSTAGRAM'];
    if (!channelType || !validChannelTypes.includes(channelType)) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid channel type',
          },
        },
        400
      );
    }

    // Validate strategyType
    const validStrategyTypes = ['RING_ALL', 'NOTIFY_ALL', 'ROUND_ROBIN', 'PRIORITY_QUEUE'];
    if (!strategyType || !validStrategyTypes.includes(strategyType)) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid strategy type',
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

    // Create or update routing strategy
    const strategy = await prisma.routingStrategy.upsert({
      where: {
        inboxId_channelType: {
          inboxId: id,
          channelType: channelType,
        },
      },
      update: {
        strategyType: strategyType,
        config: config || {},
      },
      create: {
        inboxId: id,
        channelType: channelType,
        strategyType: strategyType,
        config: config || {},
      },
    });

    return c.json({
      success: true,
      data: {
        strategy,
      },
    });
  } catch (error) {
    console.error('Failed to set routing strategy:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to set routing strategy',
        },
      },
      500
    );
  }
});

// Delete routing strategy
app.delete('/:id/routing/:channelType', async (c) => {
  try {
    const { id, channelType } = c.req.param();
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

    // Delete routing strategy
    await prisma.routingStrategy.delete({
      where: {
        inboxId_channelType: {
          inboxId: id,
          channelType: channelType,
        },
      },
    });

    return c.json({
      success: true,
      data: {
        message: 'Routing strategy removed',
      },
    });
  } catch (error) {
    console.error('Failed to delete routing strategy:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'DELETE_FAILED',
          message: 'Failed to delete routing strategy',
        },
      },
      500
    );
  }
});

export default app;
