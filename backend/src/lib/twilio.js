/**
 * Twilio API Helper
 *
 * Purpose: Interact with Twilio API for provisioning and management
 *
 * Functions:
 * - Validate credentials
 * - Create TwiML App
 * - Generate API keys
 * - Fetch phone numbers
 * - Configure webhooks
 *
 * BEFORE MODIFYING:
 * - Will this break existing Twilio integrations?
 * - Do we need to update webhook URLs?
 * - Are we handling errors properly?
 */

/**
 * Validate Twilio credentials
 * @param {string} accountSid - Twilio Account SID
 * @param {string} authToken - Twilio Auth Token
 * @returns {Promise<boolean>} - True if valid, throws error if invalid
 */
export async function validateTwilioCredentials(accountSid, authToken) {
  try {
    // Use Twilio SDK to validate credentials
    const twilio = await import('twilio');
    const client = twilio.default(accountSid, authToken);

    // Fetch account info - will throw if credentials are invalid
    await client.api.v2010.accounts(accountSid).fetch();

    return true;
  } catch (error) {
    console.error('Twilio credential validation failed:', error);
    throw new Error('Invalid Twilio credentials');
  }
}

/**
 * Create TwiML Application
 * @param {string} accountSid - Twilio Account SID
 * @param {string} authToken - Twilio Auth Token
 * @param {string} companyName - Company name for friendly name
 * @param {string} baseUrl - Base URL for webhooks (e.g., https://yourapp.workers.dev)
 * @returns {Promise<object>} - {sid, friendlyName}
 */
export async function createTwiMLApp(accountSid, authToken, companyName, baseUrl) {
  try {
    // Use Twilio SDK to create TwiML App
    const twilio = await import('twilio');
    const client = twilio.default(accountSid, authToken);

    // Create friendly name with timestamp
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const friendlyName = `Customer Service Platform - ${companyName} - ${timestamp}`;

    const twimlApp = await client.applications.create({
      friendlyName: friendlyName,
      voiceUrl: `${baseUrl}/webhooks/twiml/voice`,
      voiceMethod: 'POST',
      statusCallback: `${baseUrl}/webhooks/twiml/status`,
      statusCallbackMethod: 'POST'
    });

    return {
      sid: twimlApp.sid,
      friendlyName: twimlApp.friendlyName,
    };
  } catch (error) {
    console.error('Failed to create TwiML App:', error);
    throw error;
  }
}

/**
 * Create Twilio API Key
 * @param {string} accountSid - Twilio Account SID
 * @param {string} authToken - Twilio Auth Token
 * @param {string} friendlyName - Key name (e.g., 'REST API Key' or 'Access Token Key')
 * @returns {Promise<object>} - {sid, secret}
 */
export async function createTwilioAPIKey(accountSid, authToken, friendlyName) {
  try {
    // Use Twilio SDK to create API Key
    const twilio = await import('twilio');
    const client = twilio.default(accountSid, authToken);

    const apiKey = await client.newKeys.create({
      friendlyName: friendlyName
    });

    return {
      sid: apiKey.sid,
      secret: apiKey.secret,
    };
  } catch (error) {
    console.error('Failed to create API key:', error);
    throw error;
  }
}

/**
 * Get all phone numbers from Twilio account with current config
 * @param {string} accountSid - Twilio Account SID
 * @param {string} authToken - Twilio Auth Token
 * @returns {Promise<Array>} - Array of phone number objects with current config
 */
export async function getTwilioPhoneNumbers(accountSid, authToken) {
  try {
    // Use Twilio SDK to fetch phone numbers
    const twilio = await import('twilio');
    const client = twilio.default(accountSid, authToken);

    const numbers = await client.incomingPhoneNumbers.list({ limit: 1000 });

    // Map to format with current configuration
    return numbers.map((number) => ({
      sid: number.sid,
      phoneNumber: number.phoneNumber,
      friendlyName: number.friendlyName,
      capabilities: {
        voice: number.capabilities.voice,
        sms: number.capabilities.sms,
        mms: number.capabilities.mms,
      },
      // Current configuration
      currentConfig: {
        voice: {
          type: number.voiceUrl ? 'webhook' : (number.voiceApplicationSid ? 'twiml_app' : 'none'),
          handler: number.voiceUrl || number.voiceApplicationSid || null,
          method: number.voiceMethod || null,
        },
        sms: {
          type: number.smsUrl ? 'webhook' : (number.smsApplicationSid ? 'twiml_app' : 'none'),
          handler: number.smsUrl || number.smsApplicationSid || null,
          method: number.smsMethod || null,
        },
        statusCallback: number.statusCallback || null,
      },
    }));
  } catch (error) {
    console.error('Failed to fetch phone numbers:', error);
    throw error;
  }
}

/**
 * Configure webhooks on a Twilio phone number
 * @param {string} accountSid - Twilio Account SID
 * @param {string} authToken - Twilio Auth Token
 * @param {string} phoneNumberSid - Phone number SID to configure
 * @param {string} channelId - Channel ID for webhook URLs
 * @param {string} baseUrl - Base URL for webhooks
 * @param {object} capabilities - Which capabilities to configure {voice: bool, sms: bool}
 * @returns {Promise<boolean>} - True if successful
 */
export async function configurePhoneNumberWebhooks(
  accountSid,
  authToken,
  phoneNumberSid,
  channelId,
  baseUrl,
  capabilities = { voice: true, sms: true }
) {
  try {
    // Use Twilio SDK to update phone number
    const twilio = await import('twilio');
    const client = twilio.default(accountSid, authToken);

    const updateParams = {};

    // Only configure voice if requested
    if (capabilities.voice) {
      updateParams.voiceUrl = `${baseUrl}/webhooks/inbound/${channelId}`;
      updateParams.voiceMethod = 'POST';
      updateParams.voiceApplicationSid = ''; // Clear any TwiML App
      updateParams.voiceFallbackUrl = ''; // Clear fallback
    }

    // Only configure SMS if requested
    if (capabilities.sms) {
      updateParams.smsUrl = `${baseUrl}/webhooks/inbound/${channelId}`;
      updateParams.smsMethod = 'POST';
      updateParams.smsApplicationSid = ''; // Clear any TwiML App
      updateParams.statusCallback = `${baseUrl}/webhooks/status/${channelId}`;
      updateParams.statusCallbackMethod = 'POST';
    }

    await client.incomingPhoneNumbers(phoneNumberSid).update(updateParams);

    return true;
  } catch (error) {
    console.error('Failed to configure webhooks:', error);
    throw error;
  }
}

/**
 * Validate Twilio webhook request signature
 * @param {string} authToken - Twilio Auth Token
 * @param {string} signature - X-Twilio-Signature header value
 * @param {string} url - Full webhook URL
 * @param {object} params - Request body parameters
 * @returns {boolean} - True if signature is valid
 */
export function validateWebhookSignature(authToken, signature, url, params) {
  try {
    // Import the validateRequest function from twilio SDK
    // Note: This is synchronous, no need for async
    const twilioLib = require('twilio');
    return twilioLib.validateRequest(authToken, signature, url, params);
  } catch (error) {
    console.error('Failed to validate webhook signature:', error);
    return false;
  }
}

/**
 * Generate Twilio Access Token for browser SDK
 * @param {string} accountSid - Twilio Account SID
 * @param {string} apiKeySid - API Key SID for access tokens
 * @param {string} apiKeySecret - API Key Secret
 * @param {string} twimlAppSid - TwiML Application SID
 * @param {string} identity - User identity (user ID)
 * @param {string} friendlyName - User friendly name
 * @returns {Promise<string>} - JWT access token
 */
export async function generateAccessToken(
  accountSid,
  apiKeySid,
  apiKeySecret,
  twimlAppSid,
  identity,
  friendlyName
) {
  try {
    // Use Twilio's native JWT classes (same as reference prototype)
    const twilio = await import('twilio');
    const AccessToken = twilio.default.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    // Create access token with identity
    const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
      identity: identity,
      ttl: 3600 // 1 hour
    });

    // Create voice grant
    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: true
    });

    // Add grant to token
    token.addGrant(voiceGrant);

    console.log(`[Twilio] Generated access token for identity: ${identity}`);
    return token.toJwt();
  } catch (error) {
    console.error('Failed to generate access token:', error);
    throw error;
  }
}
