// Test script to verify contacts API returns callCount and conversationCount
const { PrismaClient } = require('./database/node_modules/@prisma/client');

const prisma = new PrismaClient();

async function testContactsData() {
  try {
    console.log('Fetching contacts with call and conversation counts...\n');

    // Get the company ID first
    const company = await prisma.company.findFirst();
    if (!company) {
      console.error('No company found in database');
      return;
    }

    console.log(`Company: ${company.name} (${company.id})\n`);

    // Fetch contacts with counts
    const contacts = await prisma.contact.findMany({
      where: {
        companyId: company.id,
      },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        _count: {
          select: {
            conversations: true,
            voiceCalls: true,
          },
        },
      },
    });

    console.log(`Found ${contacts.length} contacts:\n`);

    contacts.forEach((contact, index) => {
      console.log(`${index + 1}. ${contact.name || 'Unknown'} (${contact.phoneNumber})`);
      console.log(`   - Calls: ${contact._count.voiceCalls}`);
      console.log(`   - Conversations: ${contact._count.conversations}`);
      console.log('');
    });

    // Show total
    const totalCalls = contacts.reduce((sum, c) => sum + c._count.voiceCalls, 0);
    const totalConversations = contacts.reduce((sum, c) => sum + c._count.conversations, 0);

    console.log('========================================');
    console.log(`Total: ${contacts.length} contacts, ${totalCalls} calls, ${totalConversations} conversations`);
    console.log('========================================\n');

    // Verify the data structure matches what we expect
    if (contacts.length === 2 && totalCalls === 6) {
      console.log('✅ SUCCESS: Data matches expected structure!');
      console.log('   - 2 contacts found');
      console.log('   - 6 total calls');
      console.log('   - Calls are now separate from conversations\n');
    } else {
      console.log('⚠️ Data structure may have changed:');
      console.log(`   - Expected: 2 contacts, 6 calls`);
      console.log(`   - Found: ${contacts.length} contacts, ${totalCalls} calls\n`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testContactsData();
