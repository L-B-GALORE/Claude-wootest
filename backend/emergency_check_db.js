/**
 * EMERGENCY DEBUG - Check what credentials are actually in the database
 *
 * Run this in backend directory:
 * node emergency_check_db.js
 */

import { getPrisma } from './src/lib/prisma.js';
import { decryptCredentials } from './src/lib/encryption.js';

async function checkDatabase() {
  console.log('=== EMERGENCY DATABASE CHECK ===\n');

  const DATABASE_URL = process.env.DATABASE_URL;
  const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

  if (!DATABASE_URL || !ENCRYPTION_KEY) {
    console.error('❌ Missing environment variables');
    process.exit(1);
  }

  const prisma = getPrisma(DATABASE_URL);

  // Find Twilio provider
  const provider = await prisma.provider.findFirst({
    where: {
      type: 'TWILIO',
      status: 'ACTIVE',
    },
  });

  if (!provider) {
    console.error('❌ No Twilio provider found');
    process.exit(1);
  }

  console.log('Provider ID:', provider.id);
  console.log('Last updated:', provider.updatedAt);
  console.log('\nDecrypting credentials...\n');

  const credentials = await decryptCredentials(provider.credentials, ENCRYPTION_KEY);

  console.log('Account SID:', credentials.accountSid);
  console.log('Auth Token:', credentials.authToken ? 'EXISTS' : 'MISSING');
  console.log('TwiML App SID:', credentials.twimlAppSid);
  console.log('API Key SID:', credentials.apiKeySid);
  console.log('API Key Secret:', credentials.apiKeySecret ? 'EXISTS' : 'MISSING');

  console.log('\n=== Go check these in your Twilio console ===');
  console.log('TwiML Apps: https://console.twilio.com/us1/develop/voice/manage/twiml-apps');
  console.log('API Keys: https://console.twilio.com/us1/account/keys-credentials/api-keys');
  console.log('\nIf the TwiML App or API Key with these SIDs dont exist in Twilio, thats the problem.');
}

checkDatabase().catch(console.error);
