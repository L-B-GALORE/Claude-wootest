import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL
});

async function testInboxes() {
  try {
    console.log('Testing inbox query...');
    const inboxes = await prisma.inbox.findMany({
      include: {
        _count: {
          select: {
            members: true,
          },
        },
      },
    });
    console.log('Inboxes found:', inboxes.length);
    
    // Test channel count query
    if (inboxes.length > 0) {
      console.log('Testing channel count...');
      const channelCount = await prisma.channel.count({
        where: {
          routingType: 'INBOX',
          routingTargetId: inboxes[0].id,
        },
      });
      console.log('Channel count:', channelCount);
    }
    
    console.log('✅ All queries work!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

testInboxes();
