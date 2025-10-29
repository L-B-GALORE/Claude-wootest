const { PrismaClient } = require('./database/node_modules/@prisma/client');

const prisma = new PrismaClient();

async function checkConversations() {
  try {
    console.log('Checking conversations and messages in database...\n');

    const conversations = await prisma.conversation.findMany({
      include: {
        contact: true,
        channel: true,
        messages: {
          include: {
            smsMessage: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
      orderBy: {
        lastMessageAt: 'desc',
      },
    });

    console.log(`Found ${conversations.length} conversations:\n`);

    conversations.forEach((conv, index) => {
      console.log(`${index + 1}. Conversation ${conv.id.substring(0, 8)}...`);
      console.log(`   Type: ${conv.type}`);
      console.log(`   Contact: ${conv.contact.name || conv.contact.phoneNumber}`);
      console.log(`   Channel: ${conv.channel.identifier}`);
      console.log(`   Status: ${conv.status}`);
      console.log(`   Messages: ${conv.messages.length}`);

      if (conv.type === 'LINEAR' && conv.messages.length > 0) {
        console.log(`   Message preview:`);
        conv.messages.slice(0, 3).forEach((msg, i) => {
          console.log(`     ${i + 1}. [${msg.direction}] ${msg.body.substring(0, 50)}...`);
        });
      }
      console.log('');
    });

    // Count by type
    const linearCount = conversations.filter(c => c.type === 'LINEAR').length;
    const transactionalCount = conversations.filter(c => c.type === 'TRANSACTIONAL').length;

    console.log('Summary:');
    console.log(`  - LINEAR conversations (SMS): ${linearCount}`);
    console.log(`  - TRANSACTIONAL conversations (old calls): ${transactionalCount}`);
    console.log(`  - Total messages: ${conversations.reduce((sum, c) => sum + c.messages.length, 0)}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkConversations();
