/**
 * Test script to verify Twilio token generation
 *
 * Run this in the backend directory:
 * node check_twilio_token.js
 */

import { getPrisma } from './src/lib/prisma.js';
import { generateAccessToken } from './src/lib/twilio.js';
import { decryptCredentials } from './src/lib/encryption.js';

async function testTokenGeneration() {
  console.log('=== Twilio Token Generation Test ===\n');

  // Get environment variables
  const DATABASE_URL = process.env.DATABASE_URL;
  const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable not set');
    process.exit(1);
  }

  if (!ENCRYPTION_KEY) {
    console.error('❌ ENCRYPTION_KEY environment variable not set');
    process.exit(1);
  }

  console.log('✅ Environment variables found\n');

  try {
    // Get Prisma client
    const prisma = getPrisma(DATABASE_URL);

    // Find first Twilio provider
    const provider = await prisma.provider.findFirst({
      where: {
        type: 'TWILIO',
        status: 'ACTIVE',
      },
    });

    if (!provider) {
      console.error('❌ No active Twilio provider found in database');
      process.exit(1);
    }

    console.log('✅ Found Twilio provider:', provider.id);

    // Decrypt credentials
    console.log('\nDecrypting credentials...');
    const credentials = await decryptCredentials(provider.credentials, ENCRYPTION_KEY);

    console.log('✅ Credentials decrypted:');
    console.log('  - Account SID:', credentials.accountSid);
    console.log('  - Auth Token:', credentials.authToken ? '***' : 'MISSING');
    console.log('  - TwiML App SID:', credentials.twimlAppSid);
    console.log('  - API Key SID:', credentials.apiKeySid);
    console.log('  - API Key Secret:', credentials.apiKeySecret ? '***' : 'MISSING');

    // Try to generate a token
    console.log('\nGenerating access token...');
    const token = await generateAccessToken(
      credentials.accountSid,
      credentials.apiKeySid,
      credentials.apiKeySecret,
      credentials.twimlAppSid,
      'test-user-123',
      'Test User'
    );

    if (token && token.length > 0) {
      console.log('✅ Token generated successfully!');
      console.log('  Token length:', token.length, 'characters');
      console.log('  Token preview:', token.substring(0, 50) + '...');
      console.log('\n✅✅✅ TOKEN GENERATION WORKS! ✅✅✅');
      console.log('\nIf you still see errors in the browser, the issue is:');
      console.log('  1. Frontend calling the wrong API endpoint');
      console.log('  2. API endpoint not deployed to Cloudflare');
      console.log('  3. CORS issue');
      console.log('  4. Authentication issue (user not logged in)');
    } else {
      console.log('❌ Token generation returned empty/null');
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('\nFull error:', error);
  }
}

testTokenGeneration().catch(console.error);
