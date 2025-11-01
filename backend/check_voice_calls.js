/**
 * Diagnostic Script: Check VoiceCall Records
 *
 * This script queries the database to check if VoiceCall records exist,
 * helping us determine if webhooks are creating records despite not appearing in logs.
 */

import { PrismaClient } from '@prisma/client';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL environment variable');
  process.exit(1);
}

async function checkVoiceCalls() {
  const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

  try {
    console.log('🔍 Checking VoiceCall records in database...\n');

    // Get all VoiceCall records from the last hour
    const oneHourAgo = new Date(Date.now() - 3600000);
    const recentCalls = await prisma.voiceCall.findMany({
      where: {
        createdAt: {
          gte: oneHourAgo,
        },
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
          },
        },
        channel: {
          select: {
            id: true,
            identifier: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(`📞 Found ${recentCalls.length} voice calls in the last hour:\n`);

    if (recentCalls.length === 0) {
      console.log('❌ No VoiceCall records found');
      console.log('\nThis indicates that webhooks are NOT reaching the backend.');
      console.log('Possible causes:');
      console.log('  1. Twilio webhook URL is incorrect');
      console.log('  2. Webhooks are being blocked');
      console.log('  3. Backend route is not properly configured');
      console.log('  4. Authentication/CORS issues');
    } else {
      for (const call of recentCalls) {
        console.log(`Call ID: ${call.id}`);
        console.log(`  Provider Call SID: ${call.providerCallId}`);
        console.log(`  Direction: ${call.direction}`);
        console.log(`  Status: ${call.callStatus}`);
        console.log(`  Duration: ${call.durationSeconds || 'N/A'} seconds`);
        console.log(`  Contact: ${call.contact?.name || 'Unknown'} (${call.contact?.phoneNumber})`);
        console.log(`  Channel: ${call.channel?.identifier}`);
        console.log(`  Created: ${call.createdAt.toISOString()}`);
        console.log(`  Ended: ${call.endedAt ? call.endedAt.toISOString() : 'Still active'}`);
        console.log('');
      }

      console.log('✅ VoiceCall records ARE being created!');
      console.log('This means webhooks ARE reaching the backend, but logs may not be visible in wrangler tail.');
    }

    // Get total count of all VoiceCall records
    console.log('\n📊 Overall Statistics:');
    const totalCalls = await prisma.voiceCall.count();
    const inboundCalls = await prisma.voiceCall.count({ where: { direction: 'INBOUND' } });
    const outboundCalls = await prisma.voiceCall.count({ where: { direction: 'OUTBOUND' } });

    console.log(`  Total calls: ${totalCalls}`);
    console.log(`  Inbound: ${inboundCalls}`);
    console.log(`  Outbound: ${outboundCalls}`);

    // Check call status distribution
    const statuses = await prisma.voiceCall.groupBy({
      by: ['callStatus'],
      _count: true,
    });

    console.log('\n📈 Call Status Distribution:');
    for (const status of statuses) {
      console.log(`  ${status.callStatus}: ${status._count}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkVoiceCalls();
