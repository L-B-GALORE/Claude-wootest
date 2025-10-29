/**
 * Contacts API Router
 *
 * Purpose: Manage contacts (customers who have called/messaged)
 *
 * Routes:
 * - GET /contacts - List all contacts with search/filter
 * - POST /contacts - Create a new contact manually
 * - GET /contacts/:id - Get contact details
 * - PUT /contacts/:id - Update contact (name, notes, etc.)
 * - DELETE /contacts/:id - Delete contact
 * - GET /contacts/:id/history - Get all communications for contact
 *
 * BEFORE MODIFYING:
 * - Validate user has access to company's contacts
 * - Ensure proper pagination for large contact lists
 */

import { Hono } from 'hono';
import { getPrisma } from '../../lib/prisma.js';

const app = new Hono();

/**
 * GET /contacts
 * List all contacts for the authenticated user's company
 *
 * Query params:
 * - search: Search by name, phone, or email
 * - limit: Number of results (default: 50, max: 100)
 * - offset: Pagination offset (default: 0)
 */
app.get('/', async (c) => {
  try {
    const companyId = c.get('companyId');
    const prisma = getPrisma(c.env.DATABASE_URL);

    const search = c.req.query('search') || '';
    const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 100);
    const offset = parseInt(c.req.query('offset') || '0', 10);

    // Build where clause
    const where = {
      companyId,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get contacts with conversation count and last contact date
    const contacts = await prisma.contact.findMany({
      where,
      select: {
        id: true,
        phoneNumber: true,
        email: true,
        name: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            conversations: true,
            voiceCalls: true,
          },
        },
        conversations: {
          select: {
            lastMessageAt: true,
          },
          orderBy: {
            lastMessageAt: 'desc',
          },
          take: 1,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    });

    // Get total count for pagination
    const total = await prisma.contact.count({ where });

    return c.json({
      success: true,
      data: {
        contacts: contacts.map(contact => ({
          id: contact.id,
          phoneNumber: contact.phoneNumber,
          email: contact.email,
          name: contact.name,
          notes: contact.notes,
          createdAt: contact.createdAt,
          updatedAt: contact.updatedAt,
          conversationCount: contact._count.conversations,
          callCount: contact._count.voiceCalls,
          lastContactAt: contact.conversations[0]?.lastMessageAt || null,
        })),
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      },
    });
  } catch (error) {
    console.error('[Contacts API] Error listing contacts:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'CONTACTS_LIST_FAILED',
          message: 'Failed to retrieve contacts',
        },
      },
      500
    );
  }
});

/**
 * POST /contacts
 * Create a new contact manually
 *
 * Body: { phoneNumber (required), name?, email?, notes? }
 */
app.post('/', async (c) => {
  try {
    const companyId = c.get('companyId');
    const prisma = getPrisma(c.env.DATABASE_URL);

    const body = await c.req.json();
    const { phoneNumber, name, email, notes } = body;

    // Validate required fields
    if (!phoneNumber) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Phone number is required',
          },
        },
        400
      );
    }

    // Check if contact already exists for this company
    const existingContact = await prisma.contact.findFirst({
      where: {
        phoneNumber,
        companyId,
      },
    });

    if (existingContact) {
      return c.json(
        {
          success: false,
          error: {
            code: 'CONTACT_EXISTS',
            message: 'A contact with this phone number already exists',
          },
        },
        409
      );
    }

    // Create the contact
    const contact = await prisma.contact.create({
      data: {
        phoneNumber,
        name: name || null,
        email: email ? email.toLowerCase().trim() : null,
        notes: notes || null,
        companyId,
      },
    });

    return c.json(
      {
        success: true,
        data: { contact },
      },
      201
    );
  } catch (error) {
    console.error('[Contacts API] Error creating contact:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'CONTACT_CREATE_FAILED',
          message: 'Failed to create contact',
        },
      },
      500
    );
  }
});

/**
 * GET /contacts/:id
 * Get contact details including conversation count
 */
app.get('/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const companyId = c.get('companyId');
    const prisma = getPrisma(c.env.DATABASE_URL);

    const contact = await prisma.contact.findFirst({
      where: {
        id,
        companyId, // Ensure company isolation
      },
      include: {
        _count: {
          select: {
            conversations: true,
            voiceCalls: true,
          },
        },
      },
    });

    if (!contact) {
      return c.json(
        {
          success: false,
          error: {
            code: 'CONTACT_NOT_FOUND',
            message: 'Contact not found',
          },
        },
        404
      );
    }

    return c.json({
      success: true,
      data: {
        contact: {
          ...contact,
          conversationCount: contact._count.conversations,
          callCount: contact._count.voiceCalls,
          _count: undefined,
        },
      },
    });
  } catch (error) {
    console.error('[Contacts API] Error getting contact:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'CONTACT_GET_FAILED',
          message: 'Failed to retrieve contact',
        },
      },
      500
    );
  }
});

/**
 * PUT /contacts/:id
 * Update contact information
 *
 * Body: { name?, email?, notes? }
 */
app.put('/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const companyId = c.get('companyId');
    const prisma = getPrisma(c.env.DATABASE_URL);

    const body = await c.req.json();
    const { name, email, notes } = body;

    // Build update data (only include provided fields)
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email ? email.toLowerCase().trim() : null;
    if (notes !== undefined) updateData.notes = notes;

    const contact = await prisma.contact.update({
      where: {
        id,
        companyId, // Ensure company isolation
      },
      data: updateData,
    });

    return c.json({
      success: true,
      data: { contact },
    });
  } catch (error) {
    console.error('[Contacts API] Error updating contact:', error);

    if (error.code === 'P2025') {
      return c.json(
        {
          success: false,
          error: {
            code: 'CONTACT_NOT_FOUND',
            message: 'Contact not found',
          },
        },
        404
      );
    }

    return c.json(
      {
        success: false,
        error: {
          code: 'CONTACT_UPDATE_FAILED',
          message: 'Failed to update contact',
        },
      },
      500
    );
  }
});

/**
 * DELETE /contacts/:id
 * Delete contact (and all associated conversations/messages)
 */
app.delete('/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const companyId = c.get('companyId');
    const prisma = getPrisma(c.env.DATABASE_URL);

    await prisma.contact.delete({
      where: {
        id,
        companyId, // Ensure company isolation
      },
    });

    return c.json({
      success: true,
      data: { message: 'Contact deleted successfully' },
    });
  } catch (error) {
    console.error('[Contacts API] Error deleting contact:', error);

    if (error.code === 'P2025') {
      return c.json(
        {
          success: false,
          error: {
            code: 'CONTACT_NOT_FOUND',
            message: 'Contact not found',
          },
        },
        404
      );
    }

    return c.json(
      {
        success: false,
        error: {
          code: 'CONTACT_DELETE_FAILED',
          message: 'Failed to delete contact',
        },
      },
      500
    );
  }
});

/**
 * GET /contacts/:id/history
 * Get all communications (calls + messages) for a contact
 *
 * Returns conversations with messages, ordered by most recent
 */
app.get('/:id/history', async (c) => {
  try {
    const { id } = c.req.param();
    const companyId = c.get('companyId');
    const prisma = getPrisma(c.env.DATABASE_URL);

    const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 100);
    const offset = parseInt(c.req.query('offset') || '0', 10);

    // Verify contact belongs to company
    const contact = await prisma.contact.findFirst({
      where: { id, companyId },
    });

    if (!contact) {
      return c.json(
        {
          success: false,
          error: {
            code: 'CONTACT_NOT_FOUND',
            message: 'Contact not found',
          },
        },
        404
      );
    }

    // Get conversations with messages
    const conversations = await prisma.conversation.findMany({
      where: {
        contactId: id,
        companyId,
      },
      include: {
        channel: {
          select: {
            id: true,
            phoneNumber: true,
            type: true,
          },
        },
        messages: {
          include: {
            voiceCall: true,
            smsMessage: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 10, // Limit messages per conversation
        },
      },
      orderBy: {
        lastMessageAt: 'desc',
      },
      take: limit,
      skip: offset,
    });

    const total = await prisma.conversation.count({
      where: { contactId: id, companyId },
    });

    return c.json({
      success: true,
      data: {
        conversations,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      },
    });
  } catch (error) {
    console.error('[Contacts API] Error getting contact history:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'CONTACT_HISTORY_FAILED',
          message: 'Failed to retrieve contact history',
        },
      },
      500
    );
  }
});

export default app;
