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
 * @param {string} baseUrl - Base URL for webhooks (e.g., https://yourapp.workers.dev)
 * @returns {Promise<object>} - {sid, friendlyName}
 */
export async function createTwiMLApp(accountSid, authToken, baseUrl) {
  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Applications.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          FriendlyName: 'Customer Service Platform',
          VoiceUrl: `${baseUrl}/api/v1/webhooks/twilio/voice`,
          VoiceMethod: 'POST',
          SmsUrl: `${baseUrl}/api/v1/webhooks/twilio/sms`,
          SmsMethod: 'POST',
          StatusCallback: `${baseUrl}/api/v1/webhooks/twilio/status`,
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
 * Get all phone numbers from Twilio account
 * @param {string} accountSid - Twilio Account SID
 * @param {string} authToken - Twilio Auth Token
 * @returns {Promise<Array>} - Array of phone number objects
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

    // Map to simplified format
    return data.incoming_phone_numbers.map((number) => ({
      sid: number.sid,
      phoneNumber: number.phone_number,
      friendlyName: number.friendly_name,
      capabilities: {
        voice: number.capabilities.voice,
        sms: number.capabilities.sms,
        mms: number.capabilities.mms,
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
 * @returns {Promise<boolean>} - True if successful
 */
export async function configurePhoneNumberWebhooks(
  accountSid,
  authToken,
  phoneNumberSid,
  channelId,
  baseUrl
) {
  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers/${phoneNumberSid}.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          VoiceUrl: `${baseUrl}/api/v1/webhooks/twilio/voice/${channelId}`,
          VoiceMethod: 'POST',
          SmsUrl: `${baseUrl}/api/v1/webhooks/twilio/sms/${channelId}`,
          SmsMethod: 'POST',
          StatusCallback: `${baseUrl}/api/v1/webhooks/twilio/status/${channelId}`,
          StatusCallbackMethod: 'POST',
        }),
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
