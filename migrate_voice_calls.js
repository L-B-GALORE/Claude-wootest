// Migration script to add contactId, channelId, and direction to existing voice_calls
const { PrismaClient } = require('./database/node_modules/@prisma/client');

const prisma = new PrismaClient();

async function migrateVoiceCalls() {
  try {
    console.log('Starting voice call migration...');

    // Get all existing voice calls with their related data
    const voiceCalls = await prisma.voiceCall.findMany({
      include: {
        message: {
          include: {
            conversation: {
              include: {
                contact: true,
                channel: true,
              },
            },
          },
        },
      },
    });

    console.log(`Found ${voiceCalls.length} voice calls to migrate`);

    // Update each voice call with contactId, channelId, and direction
    for (const call of voiceCalls) {
      if (!call.message || !call.message.conversation) {
        console.error(`Voice call ${call.id} has no associated message/conversation - skipping`);
        continue;
      }

      const contactId = call.message.conversation.contactId;
      const channelId = call.message.conversation.channelId;
      const direction = call.message.direction;

      console.log(`Migrating call ${call.id}: contactId=${contactId}, channelId=${channelId}, direction=${direction}`);

      // Note: We'll need to run raw SQL since Prisma doesn't yet know about these fields
      await prisma.$executeRaw`
        UPDATE voice_calls
        SET contact_id = ${contactId}::uuid,
            channel_id = ${channelId}::uuid,
            direction = ${direction}::message_direction
        WHERE id = ${call.id}::uuid
      `;
    }

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrateVoiceCalls();
