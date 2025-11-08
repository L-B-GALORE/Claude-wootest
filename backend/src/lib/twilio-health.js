/**
 * Twilio Health Check Library
 *
 * Purpose: Diagnose Twilio integration issues and provide detailed reports
 *
 * Functions:
 * - checkCredentials: Validate Account SID + Auth Token
 * - checkTwiMLApp: Verify TwiML App exists and URLs are correct
 * - checkAPIKey: Validate API Key for access token generation
 * - checkPhoneNumber: Verify phone number webhook configuration
 * - runFullHealthCheck: Comprehensive health check of entire integration
 *
 * BEFORE MODIFYING:
 * - Health checks should be non-destructive (read-only)
 * - All checks should handle errors gracefully
 * - Return structured data for UI consumption
 */

import { decryptCredentials } from './encryption.js';

/**
 * Check if Twilio account credentials are valid
 * @param {string} accountSid - Twilio Account SID
 * @param {string} authToken - Twilio Auth Token
 * @returns {Promise<{status: string, message: string, canAutoFix: boolean}>}
 */
export async function checkCredentials(accountSid, authToken) {
  try {
    const twilio = await import('twilio');
    const client = twilio.default(accountSid, authToken);

    // Try to fetch account info - will fail if credentials are invalid
    await client.api.v2010.accounts(accountSid).fetch();

    return {
      status: 'pass',
      message: 'Account credentials are valid',
      canAutoFix: false,
    };
  } catch (error) {
    console.error('[Health Check] Credentials check failed:', error.message);
    return {
      status: 'fail',
      message: `Invalid credentials: ${error.message}`,
      canAutoFix: false, // User must reconnect provider
      error: error.message,
    };
  }
}

/**
 * Check if TwiML Application exists and is configured correctly
 * @param {object} client - Twilio client instance
 * @param {string} twimlAppSid - TwiML App SID to check
 * @param {string} expectedBaseUrl - Expected base URL for webhooks
 * @returns {Promise<{status: string, message: string, canAutoFix: boolean, issues: array}>}
 */
export async function checkTwiMLApp(client, twimlAppSid, expectedBaseUrl) {
  try {
    // Fetch the TwiML App
    const app = await client.applications(twimlAppSid).fetch();

    const issues = [];
    const expectedVoiceUrl = `${expectedBaseUrl}/webhooks/twiml/voice`;
    const expectedStatusCallback = `${expectedBaseUrl}/webhooks/twiml/status`;

    // Check voice URL
    if (app.voiceUrl !== expectedVoiceUrl) {
      issues.push({
        field: 'voiceUrl',
        expected: expectedVoiceUrl,
        actual: app.voiceUrl,
        message: 'Voice URL is incorrect',
      });
    }

    // Check voice method
    if (app.voiceMethod !== 'POST') {
      issues.push({
        field: 'voiceMethod',
        expected: 'POST',
        actual: app.voiceMethod,
        message: 'Voice method should be POST',
      });
    }

    // Check status callback
    if (app.statusCallback !== expectedStatusCallback) {
      issues.push({
        field: 'statusCallback',
        expected: expectedStatusCallback,
        actual: app.statusCallback,
        message: 'Status callback URL is incorrect',
      });
    }

    // Check status callback method
    if (app.statusCallbackMethod !== 'POST') {
      issues.push({
        field: 'statusCallbackMethod',
        expected: 'POST',
        actual: app.statusCallbackMethod,
        message: 'Status callback method should be POST',
      });
    }

    if (issues.length > 0) {
      return {
        status: 'fail',
        message: `TwiML App has ${issues.length} configuration issue(s)`,
        canAutoFix: true,
        issues,
        exists: true,
      };
    }

    return {
      status: 'pass',
      message: 'TwiML App is configured correctly',
      canAutoFix: false,
      issues: [],
      exists: true,
    };
  } catch (error) {
    console.error('[Health Check] TwiML App check failed:', error.message);

    // Check if it's a 404 (app deleted)
    if (error.status === 404 || error.code === 20404) {
      return {
        status: 'fail',
        message: 'TwiML App no longer exists in Twilio account',
        canAutoFix: true,
        issues: [{ message: 'TwiML App was deleted' }],
        exists: false,
      };
    }

    return {
      status: 'fail',
      message: `Failed to check TwiML App: ${error.message}`,
      canAutoFix: false,
      issues: [{ message: error.message }],
      exists: false,
      error: error.message,
    };
  }
}

/**
 * Check if API Key is valid by actually connecting to Twilio with it
 * @param {string} accountSid - Twilio Account SID
 * @param {string} apiKeySid - API Key SID
 * @param {string} apiKeySecret - API Key Secret
 * @param {string} twimlAppSid - TwiML App SID (for token generation)
 * @returns {Promise<{status: string, message: string, canAutoFix: boolean}>}
 */
export async function checkAPIKey(accountSid, apiKeySid, apiKeySecret, twimlAppSid) {
  try {
    console.log('[Health Check] Testing API Key using same validation as dashboard...');
    console.log('[Health Check] Checking API Key SID:', apiKeySid);

    const twilio = await import('twilio');

    // Step 1: Generate JWT token locally (same as backend does for dashboard)
    // This checks if credentials are well-formed
    const AccessToken = twilio.default.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
      identity: 'health-check-test',
      ttl: 60,
    });

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: true,
    });

    token.addGrant(voiceGrant);
    const jwt = token.toJwt();

    if (!jwt || jwt.length === 0) {
      console.error('[Health Check] ✗ Token generation returned empty JWT');
      return {
        status: 'fail',
        message: 'Token generation failed',
        canAutoFix: true,
        error: 'Empty JWT',
      };
    }

    console.log('[Health Check] ✓ Token generated successfully');

    // Step 2: Validate API Key with Twilio (same as Device.register() does in browser)
    // This checks if API Key actually exists in Twilio account
    // We make a lightweight API call that will fail if API Key is deleted
    console.log('[Health Check] Validating API Key exists in Twilio...');
    const client = twilio.default(apiKeySid, apiKeySecret, {
      accountSid: accountSid,
    });

    // Make a simple API call - if API Key is deleted, this will fail
    await client.incomingPhoneNumbers.list({ limit: 1 });

    console.log('[Health Check] ✓ API Key validated with Twilio successfully');

    return {
      status: 'pass',
      message: 'API Key is valid',
      canAutoFix: false,
    };
  } catch (error) {
    console.error('[Health Check] ✗ API Key validation failed:', error.message);
    console.error('[Health Check] Failed API Key SID:', apiKeySid);
    console.error('[Health Check] Error code:', error.code);
    console.error('[Health Check] Full error:', error);

    return {
      status: 'fail',
      message: `API Key validation failed: ${error.message}`,
      canAutoFix: true,
      error: error.message,
    };
  }
}

/**
 * Check if a phone number's webhooks are configured correctly
 * @param {object} client - Twilio client instance
 * @param {string} twilioSid - Phone number SID in Twilio
 * @param {string} channelId - Our channel ID
 * @param {string} baseUrl - Base URL for webhooks
 * @param {object} capabilities - Channel capabilities {voice: bool, sms: bool}
 * @param {string} phoneNumber - Phone number (for display)
 * @returns {Promise<{status: string, message: string, canAutoFix: boolean, issues: array}>}
 */
export async function checkPhoneNumber(
  client,
  twilioSid,
  channelId,
  baseUrl,
  capabilities,
  phoneNumber
) {
  try {
    // Fetch the phone number configuration
    const number = await client.incomingPhoneNumbers(twilioSid).fetch();

    const issues = [];
    const expectedInboundUrl = `${baseUrl}/webhooks/inbound/${channelId}`;
    const expectedStatusCallback = `${baseUrl}/webhooks/status/${channelId}`;

    // Check voice configuration (if voice capability enabled)
    if (capabilities.voice) {
      if (number.voiceUrl !== expectedInboundUrl) {
        issues.push({
          field: 'voiceUrl',
          expected: expectedInboundUrl,
          actual: number.voiceUrl,
          message: 'Voice webhook URL is incorrect',
        });
      }

      if (number.voiceMethod !== 'POST') {
        issues.push({
          field: 'voiceMethod',
          expected: 'POST',
          actual: number.voiceMethod,
          message: 'Voice webhook method should be POST',
        });
      }

      // Check if it's using TwiML App instead of direct webhook (wrong config)
      if (number.voiceApplicationSid && number.voiceApplicationSid !== '') {
        issues.push({
          field: 'voiceApplicationSid',
          expected: '',
          actual: number.voiceApplicationSid,
          message: 'Should use direct webhook, not TwiML App',
        });
      }
    }

    // Check SMS configuration (if sms capability enabled)
    if (capabilities.sms) {
      if (number.smsUrl !== expectedInboundUrl) {
        issues.push({
          field: 'smsUrl',
          expected: expectedInboundUrl,
          actual: number.smsUrl,
          message: 'SMS webhook URL is incorrect',
        });
      }

      if (number.smsMethod !== 'POST') {
        issues.push({
          field: 'smsMethod',
          expected: 'POST',
          actual: number.smsMethod,
          message: 'SMS webhook method should be POST',
        });
      }

      if (number.statusCallback !== expectedStatusCallback) {
        issues.push({
          field: 'statusCallback',
          expected: expectedStatusCallback,
          actual: number.statusCallback,
          message: 'Status callback URL is incorrect',
        });
      }

      // Check if it's using TwiML App instead of direct webhook
      if (number.smsApplicationSid && number.smsApplicationSid !== '') {
        issues.push({
          field: 'smsApplicationSid',
          expected: '',
          actual: number.smsApplicationSid,
          message: 'Should use direct webhook, not TwiML App',
        });
      }
    }

    if (issues.length > 0) {
      return {
        status: 'fail',
        message: `${phoneNumber} has ${issues.length} webhook issue(s)`,
        canAutoFix: true,
        issues,
        phoneNumber,
        channelId,
      };
    }

    return {
      status: 'pass',
      message: `${phoneNumber} is configured correctly`,
      canAutoFix: false,
      issues: [],
      phoneNumber,
      channelId,
    };
  } catch (error) {
    console.error(`[Health Check] Phone number ${phoneNumber} check failed:`, error.message);

    // Check if it's a 404 (number no longer exists)
    if (error.status === 404 || error.code === 20404) {
      return {
        status: 'fail',
        message: `${phoneNumber} no longer exists in Twilio account`,
        canAutoFix: false, // User must re-import or delete the channel
        issues: [{ message: 'Phone number was deleted from Twilio' }],
        phoneNumber,
        channelId,
        exists: false,
      };
    }

    return {
      status: 'fail',
      message: `Failed to check ${phoneNumber}: ${error.message}`,
      canAutoFix: false,
      issues: [{ message: error.message }],
      phoneNumber,
      channelId,
      error: error.message,
    };
  }
}

/**
 * Run a comprehensive health check on the entire Twilio integration
 * @param {object} provider - Provider record from database
 * @param {array} channels - Array of channel records
 * @param {string} baseUrl - Base URL for webhooks
 * @param {string} encryptionKey - Encryption key for decrypting credentials
 * @returns {Promise<{overall: string, checks: object, summary: object}>}
 */
export async function runFullHealthCheck(provider, channels, baseUrl, encryptionKey) {
  console.log('[Health Check] Starting full health check...');
  console.log('[Health Check] Provider ID:', provider.id);
  console.log('[Health Check] Provider last updated:', provider.updatedAt);

  const results = {
    overall: 'healthy',
    checks: {},
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      canAutoFix: false,
    },
  };

  try {
    // Decrypt credentials
    const credentials = await decryptCredentials(provider.credentials, encryptionKey);

    console.log('[Health Check] Decrypted credentials:', {
      accountSid: credentials.accountSid,
      apiKeySid: credentials.apiKeySid,
      twimlAppSid: credentials.twimlAppSid,
      hasAuthToken: !!credentials.authToken,
      hasApiKeySecret: !!credentials.apiKeySecret,
    });

    // Check 1: Credentials
    console.log('[Health Check] Checking credentials...');
    const credentialsCheck = await checkCredentials(credentials.accountSid, credentials.authToken);
    results.checks.credentials = credentialsCheck;
    results.summary.total++;

    if (credentialsCheck.status === 'pass') {
      results.summary.passed++;
    } else {
      results.summary.failed++;
      results.overall = 'broken'; // Credentials failure is critical
      return results; // No point checking further if credentials are bad
    }

    // Create Twilio client for remaining checks
    const twilio = await import('twilio');
    const client = twilio.default(credentials.accountSid, credentials.authToken);

    // Check 2: TwiML App
    console.log('[Health Check] Checking TwiML App...');
    const twimlAppCheck = await checkTwiMLApp(client, credentials.twimlAppSid, baseUrl);
    results.checks.twimlApp = twimlAppCheck;
    results.summary.total++;

    if (twimlAppCheck.status === 'pass') {
      results.summary.passed++;
    } else {
      results.summary.failed++;
      if (twimlAppCheck.canAutoFix) {
        results.summary.canAutoFix = true;
      }
      if (results.overall === 'healthy') {
        results.overall = 'degraded';
      }
    }

    // Check 3: API Key
    console.log('[Health Check] Checking API Key...');
    const apiKeyCheck = await checkAPIKey(
      credentials.accountSid,
      credentials.apiKeySid,
      credentials.apiKeySecret,
      credentials.twimlAppSid
    );
    results.checks.apiKey = apiKeyCheck;
    results.summary.total++;

    if (apiKeyCheck.status === 'pass') {
      results.summary.passed++;
    } else {
      results.summary.failed++;
      if (apiKeyCheck.canAutoFix) {
        results.summary.canAutoFix = true;
      }
      if (results.overall === 'healthy') {
        results.overall = 'degraded';
      }
    }

    // Check 4: Phone Numbers
    console.log(`[Health Check] Checking ${channels.length} phone numbers...`);
    const phoneNumberResults = {
      status: 'pass',
      message: 'All phone numbers are configured correctly',
      canAutoFix: false,
      total: channels.length,
      healthy: 0,
      broken: 0,
      details: [],
    };

    for (const channel of channels) {
      const twilioSid = channel.metadata?.twilioSid;
      if (!twilioSid) {
        console.log(`[Health Check] Skipping channel ${channel.id} - no Twilio SID`);
        continue;
      }

      const phoneCheck = await checkPhoneNumber(
        client,
        twilioSid,
        channel.id,
        baseUrl,
        channel.capabilities,
        channel.identifier
      );

      if (phoneCheck.status === 'pass') {
        phoneNumberResults.healthy++;
      } else {
        phoneNumberResults.broken++;
        phoneNumberResults.details.push(phoneCheck);
        if (phoneCheck.canAutoFix) {
          phoneNumberResults.canAutoFix = true;
        }
      }
    }

    if (phoneNumberResults.broken > 0) {
      phoneNumberResults.status = 'fail';
      phoneNumberResults.message = `${phoneNumberResults.broken} out of ${phoneNumberResults.total} phone numbers have issues`;
      results.summary.failed++;
      if (phoneNumberResults.canAutoFix) {
        results.summary.canAutoFix = true;
      }
      if (results.overall === 'healthy') {
        results.overall = 'degraded';
      }
    } else {
      results.summary.passed++;
    }

    results.checks.phoneNumbers = phoneNumberResults;
    results.summary.total++;

    console.log('[Health Check] Complete:', results.summary);
    return results;
  } catch (error) {
    console.error('[Health Check] Failed:', error);
    throw error;
  }
}
