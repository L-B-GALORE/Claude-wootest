/**
 * Message Retry API
 *
 * Purpose: Retry sending failed messages
 *
 * Routes:
 * - POST /messages/:id/retry - Retry sending a failed message
 */

import { Hono } from 'hono';
import { getPrisma } from '../../lib/prisma.js';
import { decryptCredentials } from '../../lib/encryption.js';
import { generateMediaToken } from '../../lib/storage.js';

const app = new Hono();

/**
 * POST /messages/:id/retry
 * Retry sending a failed message
 */
app.post('/:id/retry', async (c) => {
  try {
    const { id } = c.req.param();
    const companyId = c.get('companyId');
    const userId = c.get('userId');
    const prisma = getPrisma(c.env.DATABASE_URL);

    // Get the failed message
    const message = await prisma.message.findFirst({
      where: {
        id,
        conversation: {
          companyId,
        },
        status: 'FAILED', // Only retry failed messages
      },
      include: {
        conversation: {
          include: {
            channel: {
              include: {
                provider: true,
              },
            },
            contact: true,
          },
        },
        media: true,
      },
    });

    if (!message) {
      return c.json(
        {
          success: false,
          error: {
            code: 'MESSAGE_NOT_FOUND',
            message: 'Failed message not found',
          },
        },
        404
      );
    }

    const conversation = message.conversation;

    // Check retry count (max 3 retries)
    const retryCount = message.metadata?.retryCount || 0;
    if (retryCount >= 3) {
      return c.json(
        {
          success: false,
          error: {
            code: 'MAX_RETRIES_EXCEEDED',
            message: 'Maximum retry attempts exceeded (3)',
          },
        },
        400
      );
    }

    // Update message status to PENDING
    await prisma.message.update({
      where: { id: message.id },
      data: {
        status: 'PENDING',
        metadata: {
          ...message.metadata,
          retryCount: retryCount + 1,
          lastRetryAt: new Date().toISOString(),
        },
      },
    });

    // Retry sending via Twilio
    if (conversation.channel.provider.type === 'TWILIO') {
      const twilio = await import('twilio');

      const credentials = await decryptCredentials(
        conversation.channel.provider.credentials,
        c.env.ENCRYPTION_KEY
      );

      const twilioClient = twilio.default(credentials.accountSid, credentials.authToken);

      try {
        // Construct status callback URL
        const baseUrl = c.req.url.split('/api/')[0];
        const statusCallbackUrl = `${baseUrl}/webhooks/status/${conversation.channel.id}`;

        console.log('[Message Retry] Retrying message:', message.id, 'Attempt:', retryCount + 1);

        // Prepare message params
        const messageParams = {
          body: message.body || undefined,
          from: conversation.channel.identifier,
          to: conversation.contact.phoneNumber,
          statusCallback: statusCallbackUrl,
        };

        // Add media URLs if present
        if (message.media && message.media.length > 0) {
          const mediaUrls = message.media.map((m) => {
            const token = generateMediaToken(m.url, c.env.ENCRYPTION_KEY, 3600);
            return `${baseUrl}/api/v1/public-media/${token}`;
          });
          messageParams.mediaUrl = mediaUrls;
          console.log('[Message Retry] Retrying with', mediaUrls.length, 'attachments');
        }

        const twilioMessage = await twilioClient.messages.create(messageParams);

        // Update message status to SENT
        await prisma.message.update({
          where: { id: message.id },
          data: { status: 'SENT' },
        });

        // Update or create SMS message record
        await prisma.smsMessage.upsert({
          where: {
            messageId: message.id,
          },
          create: {
            messageId: message.id,
            providerMessageId: twilioMessage.sid,
            segments: 1,
            providerStatus: twilioMessage.status,
          },
          update: {
            providerMessageId: twilioMessage.sid,
            providerStatus: twilioMessage.status,
          },
        });

        console.log('[Message Retry] ✅ Message sent successfully:', twilioMessage.sid);

        // Broadcast retry success
        try {
          const durableObjectId = c.env.COMPANY_ROOM.idFromName(companyId);
          const companyRoom = c.env.COMPANY_ROOM.get(durableObjectId);

          await companyRoom.fetch('https://do.internal/broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'message_retried',
              data: {
                conversationId: conversation.id,
                messageId: message.id,
                status: 'SENT',
                timestamp: new Date().toISOString(),
              },
            }),
          });
        } catch (broadcastError) {
          console.error('[Message Retry] Failed to broadcast:', broadcastError);
        }

        return c.json({
          success: true,
          data: {
            message: {
              id: message.id,
              status: 'SENT',
              retryCount: retryCount + 1,
            },
          },
        });
      } catch (twilioError) {
        console.error('[Message Retry] Twilio error:', twilioError);

        // Update message back to FAILED with error details
        await prisma.message.update({
          where: { id: message.id },
          data: {
            status: 'FAILED',
            metadata: {
              ...message.metadata,
              retryCount: retryCount + 1,
              lastRetryAt: new Date().toISOString(),
              lastError: {
                message: twilioError.message,
                code: twilioError.code,
                timestamp: new Date().toISOString(),
              },
            },
          },
        });

        // Return user-friendly error
        let errorMessage = twilioError.message || 'Failed to retry message';

        // Map common errors
        if (twilioError.code === 21606) {
          errorMessage = 'Invalid from number: The sender number is not enabled for MMS';
        } else if (twilioError.code === 21623) {
          errorMessage = 'Media size too large: MMS attachments exceed carrier limits';
        }

        return c.json(
          {
            success: false,
            error: {
              code: 'RETRY_FAILED',
              message: errorMessage,
              details: {
                twilioCode: twilioError.code,
                retryCount: retryCount + 1,
              },
            },
          },
          500
        );
      }
    }

    return c.json(
      {
        success: false,
        error: {
          code: 'PROVIDER_NOT_SUPPORTED',
          message: 'Only Twilio provider is supported for retry',
        },
      },
      400
    );
  } catch (error) {
    console.error('[Message Retry] Error:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'RETRY_ERROR',
          message: 'Failed to retry message',
        },
      },
      500
    );
  }
});

export default app;
