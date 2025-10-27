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
    // Make a simple API call to verify credentials
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`,
      {
        method: 'GET',
        headers: {
          Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Invalid Twilio credentials');
    }

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
    // Create friendly name with timestamp
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const friendlyName = `Customer Service Platform - ${companyName} - ${timestamp}`;

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Applications.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          FriendlyName: friendlyName,
          VoiceUrl: `${baseUrl}/webhooks/twiml/voice`,
          VoiceMethod: 'POST',
          StatusCallback: `${baseUrl}/webhooks/twiml/status`,
          StatusCallbackMethod: 'POST',
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create TwiML App');
    }

    const data = await response.json();
    return {
      sid: data.sid,
      friendlyName: data.friendly_name,
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
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Keys.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          FriendlyName: friendlyName,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create API key');
    }

    const data = await response.json();
    return {
      sid: data.sid,
      secret: data.secret,
    };
  } catch (error) {
    console.error('Failed to create API key:', error);
    throw error;
  }
}

/**
 * Determine handler type from Twilio number config
 */
function getHandlerType(number) {
  // Check voice handler
  if (number.voice_url) return 'webhook';
  if (number.voice_application_sid) return 'twiml_app';
  if (number.voice_url && number.voice_url.includes('studio')) return 'studio_flow';
  return 'none';
}

/**
 * Get all phone numbers from Twilio account with current config
 * @param {string} accountSid - Twilio Account SID
 * @param {string} authToken - Twilio Auth Token
 * @returns {Promise<Array>} - Array of phone number objects with current config
 */
export async function getTwilioPhoneNumbers(accountSid, authToken) {
  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json?PageSize=1000`,
      {
        method: 'GET',
        headers: {
          Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch phone numbers');
    }

    const data = await response.json();

    // Map to format with current configuration
    return data.incoming_phone_numbers.map((number) => ({
      sid: number.sid,
      phoneNumber: number.phone_number,
      friendlyName: number.friendly_name,
      capabilities: {
        voice: number.capabilities.voice,
        sms: number.capabilities.sms,
        mms: number.capabilities.mms,
      },
      // Current configuration
      currentConfig: {
        voice: {
          type: number.voice_url ? 'webhook' : (number.voice_application_sid ? 'twiml_app' : 'none'),
          handler: number.voice_url || number.voice_application_sid || null,
          method: number.voice_method || null,
        },
        sms: {
          type: number.sms_url ? 'webhook' : (number.sms_application_sid ? 'twiml_app' : 'none'),
          handler: number.sms_url || number.sms_application_sid || null,
          method: number.sms_method || null,
        },
        statusCallback: number.status_callback || null,
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
    const params = {};

    // Only configure voice if requested
    if (capabilities.voice) {
      params.VoiceUrl = `${baseUrl}/webhooks/inbound/${channelId}`;
      params.VoiceMethod = 'POST';
      params.VoiceApplicationSid = ''; // Clear any TwiML App
      params.VoiceFallbackUrl = ''; // Clear fallback
    }

    // Only configure SMS if requested
    if (capabilities.sms) {
      params.SmsUrl = `${baseUrl}/webhooks/inbound/${channelId}`;
      params.SmsMethod = 'POST';
      params.SmsApplicationSid = ''; // Clear any TwiML App
      params.StatusCallback = `${baseUrl}/webhooks/status/${channelId}`;
      params.StatusCallbackMethod = 'POST';
    }

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers/${phoneNumberSid}.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(params),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to configure webhooks');
    }

    return true;
  } catch (error) {
    console.error('Failed to configure webhooks:', error);
    throw error;
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
    const { SignJWT } = await import('jose');

    const secret = new TextEncoder().encode(apiKeySecret);
    const now = Math.floor(Date.now() / 1000);

    // Create Voice Grant with TwiML App SID
    const grants = {
      voice: {
        incoming: {
          allow: true,
        },
        outgoing: {
          application_sid: twimlAppSid, // REQUIRED: TwiML App for routing
        },
      },
    };

    // Generate JWT token with identity
    const token = await new SignJWT({
      jti: `${apiKeySid}-${now}`,
      iss: apiKeySid,
      sub: accountSid,
      nbf: now,
      exp: now + 3600, // 1 hour expiration
      grants: grants,
      identity: identity, // CRITICAL: Must match <Client> name in TwiML
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT', cty: 'twilio-fpa;v=1' })
      .setIssuedAt(now)
      .sign(secret);

    console.log(`[Twilio] Generated access token for identity: ${identity}`);
    return token;
  } catch (error) {
    console.error('Failed to generate access token:', error);
    throw error;
  }
}
