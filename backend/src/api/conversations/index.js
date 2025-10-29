/**
 * Conversations API Router
 *
 * Purpose: Manage SMS conversations (threaded messaging)
 *
 * Routes:
 * - GET /conversations - List all LINEAR conversations (SMS threads)
 * - GET /conversations/:id - Get conversation with all messages
 * - POST /conversations/:id/messages - Send a new SMS message
 *
 * Note: Only LINEAR conversations (SMS) are shown here.
 * TRANSACTIONAL conversations (old voice calls) are excluded.
 */

import { Hono } from 'hono';
import { getPrisma } from '../../lib/prisma.js';

const app = new Hono();

/**
 * GET /conversations
 * List all LINEAR conversations for the company
 *
 * Query params:
 * - status: Filter by status (OPEN, CLOSED, ARCHIVED)
 * - limit: Number of results (default: 50)
 * - offset: Pagination offset (default: 0)
 */
app.get('/', async (c) => {
  try {
    const companyId = c.get('companyId');
    const prisma = getPrisma(c.env.DATABASE_URL);

    const status = c.req.query('status') || 'OPEN';
    const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 100);
    const offset = parseInt(c.req.query('offset') || '0', 10);

    // Build where clause - only LINEAR conversations (SMS)
    const where = {
      companyId,
      type: 'LINEAR', // Exclude TRANSACTIONAL (voice calls)
    };

    if (status) {
      where.status = status;
    }

    // Get conversations with latest message and contact info
    const conversations = await prisma.conversation.findMany({
      where,
      select: {
        id: true,
        type: true,
        status: true,
        lastMessageAt: true,
        createdAt: true,
        contact: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
            email: true,
          },
        },
        channel: {
          select: {
            id: true,
            identifier: true,
            type: true,
          },
        },
        messages: {
          select: {
            id: true,
            body: true,
            direction: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1, // Just get the latest message for preview
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
      orderBy: {
        lastMessageAt: 'desc',
      },
      take: limit,
      skip: offset,
    });

    // Get total count for pagination
    const total = await prisma.conversation.count({ where });

    return c.json({
      success: true,
      data: {
        conversations: conversations.map(conv => ({
          id: conv.id,
          type: conv.type,
          status: conv.status,
          lastMessageAt: conv.lastMessageAt,
          createdAt: conv.createdAt,
          contact: conv.contact,
          channel: conv.channel,
          messageCount: conv._count.messages,
          lastMessage: conv.messages[0] || null,
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
    console.error('[Conversations API] Error listing conversations:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'CONVERSATIONS_LIST_FAILED',
          message: 'Failed to retrieve conversations',
        },
      },
      500
    );
  }
});

/**
 * GET /conversations/:id
 * Get a specific conversation with all messages
 */
app.get('/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const companyId = c.get('companyId');
    const prisma = getPrisma(c.env.DATABASE_URL);

    const conversation = await prisma.conversation.findFirst({
      where: {
        id,
        companyId, // Ensure company isolation
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
            email: true,
          },
        },
        channel: {
          select: {
            id: true,
            identifier: true,
            type: true,
          },
        },
        messages: {
          include: {
            smsMessage: true,
          },
          orderBy: {
            createdAt: 'asc', // Oldest first (chronological order)
          },
        },
      },
    });

    if (!conversation) {
      return c.json(
        {
          success: false,
          error: {
            code: 'CONVERSATION_NOT_FOUND',
            message: 'Conversation not found',
          },
        },
        404
      );
    }

    return c.json({
      success: true,
      data: {
        conversation,
      },
    });
  } catch (error) {
    console.error('[Conversations API] Error getting conversation:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'CONVERSATION_GET_FAILED',
          message: 'Failed to retrieve conversation',
        },
      },
      500
    );
  }
});

/**
 * POST /conversations/:id/messages
 * Send a new SMS message in a conversation
 *
 * Body: { body: string }
 */
app.post('/:id/messages', async (c) => {
  try {
    const { id } = c.req.param();
    const companyId = c.get('companyId');
    const userId = c.get('userId');
    const prisma = getPrisma(c.env.DATABASE_URL);

    const body = await c.req.json();
    const { body: messageBody } = body;

    // Validate required fields
    if (!messageBody || !messageBody.trim()) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Message body is required',
          },
        },
        400
      );
    }

    // Get conversation with channel and contact
    const conversation = await prisma.conversation.findFirst({
      where: {
        id,
        companyId,
      },
      include: {
        channel: {
          include: {
            provider: true,
          },
        },
        contact: true,
      },
    });

    if (!conversation) {
      return c.json(
        {
          success: false,
          error: {
            code: 'CONVERSATION_NOT_FOUND',
            message: 'Conversation not found',
          },
        },
        404
      );
    }

    // Create message record
    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: 'OUTBOUND',
        senderType: 'USER',
        senderId: userId,
        body: messageBody,
        status: 'SENT',
      },
    });

    // Send SMS via Twilio (if provider is Twilio)
    if (conversation.channel.provider.type === 'TWILIO') {
      const twilio = await import('twilio');
      const { decryptCredentials } = await import('../../lib/encryption.js');

      const credentials = await decryptCredentials(
        conversation.channel.provider.credentials,
        c.env.ENCRYPTION_KEY
      );

      const twilioClient = twilio.default(credentials.accountSid, credentials.authToken);

      try {
        // Construct status callback URL
        const baseUrl = c.req.url.split('/api/')[0]; // Get base URL from request
        const statusCallbackUrl = `${baseUrl}/webhooks/status/${conversation.channel.id}`;

        console.log('[Conversations API] Sending SMS with status callback:', statusCallbackUrl);

        const twilioMessage = await twilioClient.messages.create({
          body: messageBody,
          from: conversation.channel.identifier,
          to: conversation.contact.phoneNumber,
          statusCallback: statusCallbackUrl,
        });

        // Create SMS message record
        await prisma.smsMessage.create({
          data: {
            messageId: message.id,
            providerMessageId: twilioMessage.sid,
            segments: 1,
            providerStatus: twilioMessage.status,
          },
        });

        // Update conversation lastMessageAt
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { lastMessageAt: new Date() },
        });

        console.log('[Conversations API] SMS sent:', twilioMessage.sid);

        // Broadcast new outbound message via WebSocket
        try {
          console.log('[Conversations API] Broadcasting outbound SMS via WebSocket');

          const durableObjectId = c.env.COMPANY_ROOM.idFromName(conversation.channel.provider.companyId);
          const companyRoom = c.env.COMPANY_ROOM.get(durableObjectId);

          await companyRoom.fetch('https://do.internal/broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'message_sent',
              data: {
                conversationId: conversation.id,
                messageId: message.id,
                contactId: conversation.contact.id,
                channelId: conversation.channel.id,
                direction: 'OUTBOUND',
                body: messageBody,
                status: 'SENT',
                timestamp: new Date().toISOString(),
              },
            }),
          });

          console.log('[Conversations API] ✅ Broadcasted message_sent event');
        } catch (broadcastError) {
          console.error('[Conversations API] ⚠️ Failed to broadcast via WebSocket:', broadcastError);
          // Continue anyway
        }
      } catch (twilioError) {
        console.error('[Conversations API] Twilio error:', twilioError);

        // Update message status to FAILED
        await prisma.message.update({
          where: { id: message.id },
          data: { status: 'FAILED' },
        });

        return c.json(
          {
            success: false,
            error: {
              code: 'SMS_SEND_FAILED',
              message: 'Failed to send SMS',
            },
          },
          500
        );
      }
    }

    return c.json(
      {
        success: true,
        data: { message },
      },
      201
    );
  } catch (error) {
    console.error('[Conversations API] Error sending message:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'MESSAGE_SEND_FAILED',
          message: 'Failed to send message',
        },
      },
      500
    );
  }
});

export default app;
