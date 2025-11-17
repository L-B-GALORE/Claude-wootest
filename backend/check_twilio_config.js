/**
 * Query Twilio API to check phone number webhook configuration
 */
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

// Get from command line args
const DATABASE_URL = process.argv[2];
const ENCRYPTION_KEY = process.argv[3];

if (!DATABASE_URL || !ENCRYPTION_KEY) {
  console.error('Usage: node check_twilio_config.js <DATABASE_URL> <ENCRYPTION_KEY>');
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
    console.log('🔍 Checking Twilio webhook configuration...\n');

    const providers = await prisma.provider.findMany({
      where: { type: 'TWILIO' },
      include: {
        company: { select: { id: true, name: true } },
        channels: { select: { id: true, identifier: true } },
      },
    });

    if (providers.length === 0) {
      console.log('❌ No Twilio providers found');
      return;
    }

    for (const provider of providers) {
      console.log(`\n📱 Provider: ${provider.company.name}`);
      const credentials = decryptCredentials(provider.credentials, ENCRYPTION_KEY);
      console.log(`   Account SID: ${credentials.accountSid}\n`);

      const twilioAuth = Buffer.from(`${credentials.accountSid}:${credentials.authToken}`).toString('base64');
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}/IncomingPhoneNumbers.json`,
        { headers: { 'Authorization': `Basic ${twilioAuth}` } }
      );

      if (!response.ok) {
        console.log(`   ❌ Twilio API Error: ${response.status}`);
        continue;
      }

      const data = await response.json();
      console.log(`   📞 Found ${data.incoming_phone_numbers.length} phone numbers:\n`);

      for (const number of data.incoming_phone_numbers) {
        console.log(`   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`   Phone: ${number.phone_number}`);
        console.log(`   Voice URL: ${number.voice_url || '(not set)'}`);
        console.log(`   Voice Method: ${number.voice_method || '(not set)'}`);
        console.log(`   Status Callback: ${number.status_callback || '(not set)'}`);
        console.log(`   SMS URL: ${number.sms_url || '(not set)'}`);

        const channel = provider.channels.find(c => c.identifier === number.phone_number);
        if (channel) {
          console.log(`\n   ✅ Matched to channel ID: ${channel.id}`);
          console.log(`   Expected Voice URL: https://claude-wootestnew-api-staging.lilboo.workers.dev/webhooks/inbound/${channel.id}`);
          console.log(`   Expected Status URL: https://claude-wootestnew-api-staging.lilboo.workers.dev/webhooks/status/${channel.id}`);

          if (number.voice_url && number.voice_url.includes(channel.id)) {
            console.log(`   ✅ Voice webhook URL is CORRECT`);
          } else {
            console.log(`   ❌ Voice webhook URL MISMATCH or MISSING`);
          }

          if (number.status_callback && number.status_callback.includes(channel.id)) {
            console.log(`   ✅ Status callback URL is CORRECT`);
          } else {
            console.log(`   ⚠️  Status callback URL MISMATCH or MISSING`);
          }
        } else {
          console.log(`\n   ⚠️  No matching channel in database`);
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
