/**
 * Twilio Auto-Fix Library
 *
 * Purpose: Automatically repair broken Twilio integration components
 *
 * Functions:
 * - fixTwiMLApp: Recreate or update TwiML App configuration
 * - fixAPIKey: Create new API Key
 * - fixPhoneNumberWebhooks: Update phone number webhook configuration
 * - fixAll: Attempt to fix all fixable issues
 * - updateProviderCredentials: Update stored credentials after fixes
 *
 * BEFORE MODIFYING:
 * - All operations should be idempotent (safe to run multiple times)
 * - Never delete resources (only create/update)
 * - Always log operations for audit trail
 * - Handle partial failures gracefully
 */

import {
  createTwiMLApp,
  createTwilioAPIKey,
  configurePhoneNumberWebhooks,
} from './twilio.js';
import { encryptCredentials } from './encryption.js';

/**
 * Fix TwiML Application - recreate if deleted, update if misconfigured
 * @param {object} client - Twilio client instance
 * @param {string} twimlAppSid - Current TwiML App SID (may be invalid)
 * @param {string} accountSid - Twilio Account SID
 * @param {string} authToken - Twilio Auth Token
 * @param {string} companyName - Company name for friendly name
 * @param {string} baseUrl - Base URL for webhooks
 * @param {boolean} exists - Whether the app currently exists
 * @returns {Promise<{success: boolean, newAppSid: string, action: string, message: string}>}
 */
export async function fixTwiMLApp(
  client,
  twimlAppSid,
  accountSid,
  authToken,
  companyName,
  baseUrl,
  exists
) {
  try {
    const expectedVoiceUrl = `${baseUrl}/webhooks/twiml/voice`;
    const expectedStatusCallback = `${baseUrl}/webhooks/twiml/status`;

    // If app was deleted, create a new one
    if (!exists) {
      console.log('[Auto-Fix] TwiML App was deleted, creating new one...');
      const newApp = await createTwiMLApp(accountSid, authToken, companyName, baseUrl);

      return {
        success: true,
        newAppSid: newApp.sid,
        action: 'created',
        message: `Created new TwiML App: ${newApp.friendlyName}`,
      };
    }

    // If app exists but is misconfigured, update it
    console.log('[Auto-Fix] Updating TwiML App configuration...');
    await client.applications(twimlAppSid).update({
      voiceUrl: expectedVoiceUrl,
      voiceMethod: 'POST',
      statusCallback: expectedStatusCallback,
      statusCallbackMethod: 'POST',
    });

    return {
      success: true,
      newAppSid: twimlAppSid, // Same SID, just updated
      action: 'updated',
      message: 'Updated TwiML App configuration',
    };
  } catch (error) {
    console.error('[Auto-Fix] Failed to fix TwiML App:', error);
    return {
      success: false,
      action: 'failed',
      message: `Failed to fix TwiML App: ${error.message}`,
      error: error.message,
    };
  }
}

/**
 * Fix API Key - create a new one
 * @param {string} accountSid - Twilio Account SID
 * @param {string} authToken - Twilio Auth Token
 * @param {string} companyName - Company name for friendly name
 * @returns {Promise<{success: boolean, apiKeySid: string, apiKeySecret: string, message: string}>}
 */
export async function fixAPIKey(accountSid, authToken, companyName) {
  try {
    console.log('[Auto-Fix] Creating new API Key...');

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const friendlyName = `API Access (Auto-Fixed) - ${companyName} - ${timestamp}`;

    const newKey = await createTwilioAPIKey(accountSid, authToken, friendlyName);

    console.log('[Auto-Fix] ✓ Created API Key in Twilio:', {
      sid: newKey.sid,
      friendlyName: friendlyName,
    });

    return {
      success: true,
      apiKeySid: newKey.sid,
      apiKeySecret: newKey.secret,
      action: 'created',
      message: 'Created new API Key',
    };
  } catch (error) {
    console.error('[Auto-Fix] Failed to create API Key:', error);
    return {
      success: false,
      action: 'failed',
      message: `Failed to create API Key: ${error.message}`,
      error: error.message,
    };
  }
}

/**
 * Fix phone number webhooks
 * @param {object} client - Twilio client instance
 * @param {string} twilioSid - Phone number SID in Twilio
 * @param {string} channelId - Our channel ID
 * @param {string} baseUrl - Base URL for webhooks
 * @param {object} capabilities - Channel capabilities {voice: bool, sms: bool}
 * @param {string} phoneNumber - Phone number (for logging)
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function fixPhoneNumberWebhooks(
  client,
  twilioSid,
  channelId,
  baseUrl,
  capabilities,
  phoneNumber
) {
  try {
    console.log(`[Auto-Fix] Fixing webhooks for ${phoneNumber}...`);

    await configurePhoneNumberWebhooks(
      client.accountSid,
      client.password, // Auth token
      twilioSid,
      channelId,
      baseUrl,
      capabilities
    );

    return {
      success: true,
      action: 'updated',
      message: `Fixed webhooks for ${phoneNumber}`,
      phoneNumber,
    };
  } catch (error) {
    console.error(`[Auto-Fix] Failed to fix ${phoneNumber}:`, error);
    return {
      success: false,
      action: 'failed',
      message: `Failed to fix ${phoneNumber}: ${error.message}`,
      phoneNumber,
      error: error.message,
    };
  }
}

/**
 * Update provider credentials in database
 * @param {object} prisma - Prisma client instance
 * @param {string} providerId - Provider ID
 * @param {object} newCredentials - New credentials object
 * @param {string} encryptionKey - Encryption key
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function updateProviderCredentials(prisma, providerId, newCredentials, encryptionKey) {
  try {
    console.log('[Auto-Fix] Updating provider credentials in database...');
    console.log('[Auto-Fix] Provider ID to update:', providerId);

    const { encryptCredentials } = await import('./encryption.js');
    const encryptedCredentials = await encryptCredentials(newCredentials, encryptionKey);

    console.log('[Auto-Fix] Encrypted credentials, executing database update...');

    const updatedProvider = await prisma.provider.update({
      where: { id: providerId },
      data: {
        credentials: encryptedCredentials,
        updatedAt: new Date(),
      },
    });

    console.log('[Auto-Fix] ✓ Database update completed successfully');
    console.log('[Auto-Fix] Updated provider timestamp:', updatedProvider.updatedAt);

    // Verify by re-decrypting what we just saved
    const { decryptCredentials } = await import('./encryption.js');
    const verifyCredentials = await decryptCredentials(updatedProvider.credentials, encryptionKey);
    console.log('[Auto-Fix] ✓ Verified saved credentials:', {
      accountSid: verifyCredentials.accountSid,
      apiKeySid: verifyCredentials.apiKeySid,
      twimlAppSid: verifyCredentials.twimlAppSid,
    });

    return {
      success: true,
      message: 'Updated provider credentials',
    };
  } catch (error) {
    console.error('[Auto-Fix] ✗ Failed to update credentials:', error);
    console.error('[Auto-Fix] Error details:', error.message, error.stack);
    return {
      success: false,
      message: `Failed to update credentials: ${error.message}`,
      error: error.message,
    };
  }
}

/**
 * Verify that token generation works with the fixed credentials
 * @param {object} credentials - Provider credentials
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function verifyTokenGeneration(credentials) {
  try {
    console.log('[Auto-Fix] Verifying token generation works...');

    const { generateAccessToken } = await import('./twilio.js');

    // Try to generate a test token
    const token = await generateAccessToken(
      credentials.accountSid,
      credentials.apiKeySid,
      credentials.apiKeySecret,
      credentials.twimlAppSid,
      'test-user-id',
      'Test User'
    );

    if (token && token.length > 0) {
      console.log('[Auto-Fix] Token generation verified successfully');
      return {
        success: true,
        message: 'Token generation verified',
      };
    } else {
      return {
        success: false,
        message: 'Token generation returned empty token',
      };
    }
  } catch (error) {
    console.error('[Auto-Fix] Token generation verification failed:', error);
    return {
      success: false,
      message: `Token generation failed: ${error.message}`,
      error: error.message,
    };
  }
}

/**
 * Attempt to fix all fixable issues
 * @param {object} healthCheckResults - Results from runFullHealthCheck
 * @param {object} provider - Provider record from database
 * @param {array} channels - Array of channel records
 * @param {string} baseUrl - Base URL for webhooks
 * @param {string} encryptionKey - Encryption key
 * @param {object} prisma - Prisma client instance
 * @returns {Promise<{fixed: object, cantFix: object, credentialsUpdated: boolean, tokenVerified: boolean}>}
 */
export async function fixAll(
  healthCheckResults,
  provider,
  channels,
  baseUrl,
  encryptionKey,
  prisma
) {
  console.log('[Auto-Fix] Starting auto-fix process...');

  const results = {
    fixed: {},
    cantFix: {},
    credentialsUpdated: false,
    tokenVerified: false,
  };

  // Import required modules
  const { decryptCredentials } = await import('./encryption.js');
  const credentials = await decryptCredentials(provider.credentials, encryptionKey);

  // Create Twilio client
  const twilio = await import('twilio');
  const client = twilio.default(credentials.accountSid, credentials.authToken);

  // Track if we need to update credentials
  let needsCredentialUpdate = false;
  const updatedCredentials = { ...credentials };

  // Fix 1: Credentials (can't auto-fix)
  if (healthCheckResults.checks.credentials?.status === 'fail') {
    results.cantFix.credentials = 'Account credentials invalid - user must reconnect provider';
    // No point continuing if credentials are bad
    return results;
  }

  // Fix 2: TwiML App
  if (
    healthCheckResults.checks.twimlApp?.status === 'fail' &&
    healthCheckResults.checks.twimlApp?.canAutoFix
  ) {
    const company = await prisma.company.findUnique({
      where: { id: provider.companyId },
      select: { name: true },
    });

    const twimlFix = await fixTwiMLApp(
      client,
      credentials.twimlAppSid,
      credentials.accountSid,
      credentials.authToken,
      company.name,
      baseUrl,
      healthCheckResults.checks.twimlApp.exists
    );

    if (twimlFix.success) {
      results.fixed.twimlApp = twimlFix.message;
      if (twimlFix.newAppSid !== credentials.twimlAppSid) {
        updatedCredentials.twimlAppSid = twimlFix.newAppSid;
        needsCredentialUpdate = true;
      }
    } else {
      results.cantFix.twimlApp = twimlFix.message;
    }
  }

  // Fix 3: API Key
  if (
    healthCheckResults.checks.apiKey?.status === 'fail' &&
    healthCheckResults.checks.apiKey?.canAutoFix
  ) {
    const company = await prisma.company.findUnique({
      where: { id: provider.companyId },
      select: { name: true },
    });

    const apiKeyFix = await fixAPIKey(credentials.accountSid, credentials.authToken, company.name);

    if (apiKeyFix.success) {
      results.fixed.apiKey = apiKeyFix.message;
      updatedCredentials.apiKeySid = apiKeyFix.apiKeySid;
      updatedCredentials.apiKeySecret = apiKeyFix.apiKeySecret;
      needsCredentialUpdate = true;

      console.log('[Auto-Fix] ✓ Updated credentials object with new API Key:', {
        apiKeySid: apiKeyFix.apiKeySid,
        willSaveToDatabase: true,
      });
    } else {
      results.cantFix.apiKey = apiKeyFix.message;
    }
  }

  // Fix 4: Phone Numbers
  if (
    healthCheckResults.checks.phoneNumbers?.status === 'fail' &&
    healthCheckResults.checks.phoneNumbers?.canAutoFix
  ) {
    const phoneNumberFixes = [];
    const phoneNumberFailures = [];

    for (const phoneCheck of healthCheckResults.checks.phoneNumbers.details) {
      if (!phoneCheck.canAutoFix) {
        phoneNumberFailures.push(phoneCheck.message);
        continue;
      }

      // Find the channel
      const channel = channels.find((ch) => ch.id === phoneCheck.channelId);
      if (!channel) {
        phoneNumberFailures.push(`Channel not found: ${phoneCheck.phoneNumber}`);
        continue;
      }

      const twilioSid = channel.metadata?.twilioSid;
      if (!twilioSid) {
        phoneNumberFailures.push(`No Twilio SID for ${phoneCheck.phoneNumber}`);
        continue;
      }

      const phoneFix = await fixPhoneNumberWebhooks(
        client,
        twilioSid,
        channel.id,
        baseUrl,
        channel.capabilities,
        phoneCheck.phoneNumber
      );

      if (phoneFix.success) {
        phoneNumberFixes.push(phoneFix.message);
      } else {
        phoneNumberFailures.push(phoneFix.message);
      }
    }

    if (phoneNumberFixes.length > 0) {
      results.fixed.phoneNumbers = `Fixed ${phoneNumberFixes.length} phone number(s)`;
    }

    if (phoneNumberFailures.length > 0) {
      results.cantFix.phoneNumbers = phoneNumberFailures.join('; ');
    }
  }

  // Update credentials in database if needed
  if (needsCredentialUpdate) {
    console.log('[Auto-Fix] Credentials were updated, saving to database...');
    console.log('[Auto-Fix] Saving credentials:', {
      accountSid: updatedCredentials.accountSid,
      apiKeySid: updatedCredentials.apiKeySid,
      twimlAppSid: updatedCredentials.twimlAppSid,
      hasAuthToken: !!updatedCredentials.authToken,
      hasApiKeySecret: !!updatedCredentials.apiKeySecret,
    });

    const credentialUpdate = await updateProviderCredentials(
      prisma,
      provider.id,
      updatedCredentials,
      encryptionKey
    );

    if (credentialUpdate.success) {
      results.credentialsUpdated = true;
      console.log('[Auto-Fix] ✓ Credentials saved to database successfully');
    } else {
      results.cantFix.credentialUpdate = credentialUpdate.message;
    }
  }

  // Verify token generation works with final credentials
  const tokenCheck = await verifyTokenGeneration(updatedCredentials);
  results.tokenVerified = tokenCheck.success;

  if (!tokenCheck.success) {
    console.error('[Auto-Fix] Token generation verification failed after fixes');
    results.cantFix.tokenGeneration = tokenCheck.message;
  } else {
    console.log('[Auto-Fix] Token generation verified - calling should work now');
  }

  console.log('[Auto-Fix] Complete:', results);
  return results;
}
