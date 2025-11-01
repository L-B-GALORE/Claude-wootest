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
 * - status: Filter by status (OPEN, CLOSED, ARCHIVED, BOTH)
 * - limit: Number of results (default: 20)
 * - offset: Pagination offset (default: 0)
 */
app.get('/', async (c) => {
  try {
    const companyId = c.get('companyId');
    const prisma = getPrisma(c.env.DATABASE_URL);

    const statusParam = c.req.query('status') || 'OPEN';
    const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 100);
    const offset = parseInt(c.req.query('offset') || '0', 10);

    // Build where clause - only LINEAR conversations (SMS)
    const where = {
      companyId,
      type: 'LINEAR', // Exclude TRANSACTIONAL (voice calls)
    };

    // Handle "BOTH" filter (show OPEN and CLOSED, exclude ARCHIVED)
    if (statusParam && statusParam !== 'BOTH') {
      where.status = statusParam;
    } else if (statusParam === 'BOTH') {
      where.status = { in: ['OPEN', 'CLOSED'] };
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
            media: true, // Include media attachments
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
 * Send a new SMS/MMS message in a conversation
 *
 * Body: { body: string, media?: Array<{ url: string, type: string, filename: string, size: number }> }
 */
app.post('/:id/messages', async (c) => {
  try {
    const { id } = c.req.param();
    const companyId = c.get('companyId');
    const userId = c.get('userId');
    const prisma = getPrisma(c.env.DATABASE_URL);

    const body = await c.req.json();
    const { body: messageBody, media } = body;

    // Validate: either body or media is required
    if ((!messageBody || !messageBody.trim()) && (!media || media.length === 0)) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Message body or media attachments are required',
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
        body: messageBody || (media && media.length > 0 ? '(Media message)' : ''),
        status: 'SENT',
      },
    });

    // Create MessageMedia records for attachments
    if (media && media.length > 0) {
      for (const attachment of media) {
        await prisma.messageMedia.create({
          data: {
            messageId: message.id,
            type: attachment.type,
            url: attachment.url,
            filename: attachment.filename,
            sizeBytes: attachment.size,
            metadata: {
              contentType: attachment.contentType,
            },
          },
        });
      }
      console.log('[Conversations API] Created', media.length, 'media records');
    }

    // Send SMS/MMS via Twilio (if provider is Twilio)
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

        console.log('[Conversations API] Sending SMS/MMS with status callback:', statusCallbackUrl);

        // Prepare message params
        const messageParams = {
          body: messageBody || undefined, // Twilio allows MMS without body
          from: conversation.channel.identifier,
          to: conversation.contact.phoneNumber,
          statusCallback: statusCallbackUrl,
        };

        // Add media URLs if present
        if (media && media.length > 0) {
          // Import token generation
          const { generateMediaToken } = await import('../../lib/storage.js');

          // Convert R2 keys to public URLs with tokens
          const mediaUrls = media.map((m) => {
            // Generate temporary token for this media file (valid 1 hour)
            const token = generateMediaToken(m.url, c.env.ENCRYPTION_KEY, 3600);
            // Return public URL with token (no auth required)
            return `${baseUrl}/api/v1/public-media/${token}`;
          });
          messageParams.mediaUrl = mediaUrls;
          console.log('[Conversations API] Sending MMS with', mediaUrls.length, 'public URLs');
          console.log('[Conversations API] Media URLs:', mediaUrls);
        }

        const twilioMessage = await twilioClient.messages.create(messageParams);

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
        console.error('[Conversations API] Twilio error details:', {
          message: twilioError.message,
          code: twilioError.code,
          status: twilioError.status,
          moreInfo: twilioError.moreInfo,
        });

        // Update message status to FAILED
        await prisma.message.update({
          where: { id: message.id },
          data: { status: 'FAILED' },
        });

        // Extract meaningful error message from Twilio
        let errorMessage = 'Failed to send message';
        if (twilioError.message) {
          errorMessage = twilioError.message;
        }

        // Add specific error details
        const errorDetails = {
          twilioCode: twilioError.code,
          twilioStatus: twilioError.status,
        };

        // Provide user-friendly messages for common errors
        if (twilioError.code === 21408) {
          errorMessage = 'Permission denied: Your Twilio account does not have permission to send to this number';
        } else if (twilioError.code === 21610) {
          errorMessage = 'Unsubscribed number: This recipient has unsubscribed from messages';
        } else if (twilioError.code === 21614) {
          errorMessage = 'Invalid phone number: The recipient number is not valid';
        } else if (twilioError.code === 30007) {
          errorMessage = 'Message blocked: Carrier has blocked message delivery';
        } else if (twilioError.code === 21606) {
          errorMessage = 'Invalid from number: The sender number is not enabled for MMS';
        } else if (twilioError.code === 21623) {
          errorMessage = 'Media size too large: MMS attachments exceed carrier limits (usually 5MB)';
        }

        return c.json(
          {
            success: false,
            error: {
              code: 'SMS_SEND_FAILED',
              message: errorMessage,
              details: errorDetails,
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

/**
 * PATCH /conversations/:id/status
 * Update conversation status (OPEN, CLOSED, ARCHIVED)
 *
 * Body: { status: 'OPEN' | 'CLOSED' | 'ARCHIVED' }
 */
app.patch('/:id/status', async (c) => {
  try {
    const { id } = c.req.param();
    const companyId = c.get('companyId');
    const userId = c.get('userId');
    const prisma = getPrisma(c.env.DATABASE_URL);

    const body = await c.req.json();
    const { status } = body;

    // Validate status
    if (!['OPEN', 'CLOSED', 'ARCHIVED'].includes(status)) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid status. Must be OPEN, CLOSED, or ARCHIVED',
          },
        },
        400
      );
    }

    // Get conversation
    const conversation = await prisma.conversation.findFirst({
      where: {
        id,
        companyId,
      },
      include: {
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

    // Update status
    const updatedConversation = await prisma.conversation.update({
      where: { id },
      data: { status },
      include: {
        contact: true,
        channel: true,
      },
    });

    console.log(`[Conversations API] Updated conversation ${id} status to ${status}`);

    // Broadcast status change via WebSocket
    try {
      console.log('[Conversations API] Broadcasting conversation status change via WebSocket');

      const durableObjectId = c.env.COMPANY_ROOM.idFromName(companyId);
      const companyRoom = c.env.COMPANY_ROOM.get(durableObjectId);

      await companyRoom.fetch('https://do.internal/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'conversation_status_updated',
          data: {
            conversationId: id,
            contactId: conversation.contact.id,
            status,
            userId,
            timestamp: new Date().toISOString(),
          },
        }),
      });

      console.log('[Conversations API] ✅ Broadcasted conversation_status_updated event');
    } catch (broadcastError) {
      console.error('[Conversations API] ⚠️ Failed to broadcast via WebSocket:', broadcastError);
      // Continue anyway
    }

    return c.json({
      success: true,
      data: { conversation: updatedConversation },
    });
  } catch (error) {
    console.error('[Conversations API] Error updating conversation status:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'STATUS_UPDATE_FAILED',
          message: 'Failed to update conversation status',
        },
      },
      500
    );
  }
});

export default app;
