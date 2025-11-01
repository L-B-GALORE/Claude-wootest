/**
 * Check Twilio Configuration
 *
 * This script queries the database to get Twilio credentials,
 * then queries Twilio's API to check phone number configuration.
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const DATABASE_URL = process.env.DATABASE_URL;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!DATABASE_URL || !ENCRYPTION_KEY) {
  console.error('Missing DATABASE_URL or ENCRYPTION_KEY environment variables');
  process.exit(1);
}

// Decrypt credentials
function decryptCredentials(encryptedData, encryptionKey) {
  const parts = encryptedData.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encryptedText = Buffer.from(parts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(encryptionKey, 'hex'), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return JSON.parse(decrypted.toString());
}

async function checkTwilioConfig() {
  const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

  try {
    console.log('🔍 Checking Twilio configuration...\n');

    // Get all providers
    const providers = await prisma.provider.findMany({
      where: { type: 'TWILIO' },
      include: {
        company: {
          select: { id: true, name: true }
        },
        channels: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
            routingType: true,
            routingTargetId: true
          }
        }
      }
    });

    if (providers.length === 0) {
      console.log('❌ No Twilio providers found');
      return;
    }

    for (const provider of providers) {
      console.log(`\n📱 Provider: ${provider.company.name}`);
      console.log(`   Status: ${provider.status}`);
      console.log(`   Channels: ${provider.channels.length}`);

      // Decrypt credentials
      const credentials = decryptCredentials(provider.credentials, ENCRYPTION_KEY);
      console.log(`   Account SID: ${credentials.accountSid}`);

      // Query Twilio API for phone numbers
      console.log('\n   Querying Twilio API...');
      const twilioAuth = Buffer.from(`${credentials.accountSid}:${credentials.authToken}`).toString('base64');

      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}/IncomingPhoneNumbers.json`,
        {
          headers: {
            'Authorization': `Basic ${twilioAuth}`
          }
        }
      );

      if (!response.ok) {
        console.log(`   ❌ Twilio API Error: ${response.status} ${response.statusText}`);
        continue;
      }

      const data = await response.json();
      console.log(`\n   📞 Found ${data.incoming_phone_numbers.length} phone numbers in Twilio:\n`);

      for (const number of data.incoming_phone_numbers) {
        console.log(`   Phone: ${number.phone_number}`);
        console.log(`   Friendly Name: ${number.friendly_name}`);
        console.log(`   Voice URL: ${number.voice_url || '(not set)'}`);
        console.log(`   Voice Method: ${number.voice_method || '(not set)'}`);
        console.log(`   Status Callback: ${number.status_callback || '(not set)'}`);
        console.log(`   SMS URL: ${number.sms_url || '(not set)'}`);

        // Check if this phone number exists in our channels
        const channel = provider.channels.find(c => c.phoneNumber === number.phone_number);
        if (channel) {
          console.log(`   ✅ Matched to channel: ${channel.name} (${channel.id})`);
          console.log(`   Expected webhook: https://claude-wootestnew-api-staging.lilboo.workers.dev/webhooks/inbound/${channel.id}`);

          if (number.voice_url && number.voice_url.includes(channel.id)) {
            console.log(`   ✅ Webhook URL is correct!`);
          } else {
            console.log(`   ⚠️  Webhook URL mismatch!`);
            console.log(`      Current: ${number.voice_url}`);
            console.log(`      Expected: https://claude-wootestnew-api-staging.lilboo.workers.dev/webhooks/inbound/${channel.id}`);
          }
        } else {
          console.log(`   ⚠️  No matching channel in database`);
        }
        console.log('');
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTwilioConfig();
