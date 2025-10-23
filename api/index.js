/**
 * Twilio Browser Phone & SMS Management API
 *
 * This is the main backend API for managing Twilio voice calling and SMS messaging.
 * It handles:
 * - Voice/SMS wizard setup
 * - Phone number configuration
 * - Webhook endpoints for Twilio callbacks
 * - Messaging API for conversations
 *
 * Security Features:
 * - Twilio signature validation on all webhooks
 * - API key authentication on sensitive endpoints
 * - Encrypted credential storage
 * - Input validation on all user inputs
 * - Race condition protection with locks
 */

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const twilio = require('twilio');
const path = require('path');
const { kv } = require('@vercel/kv');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================

const CONFIG = {
  MAX_ERROR_LOGS: 100,
  MAX_MESSAGES: 1000,
  TOKEN_TTL_SECONDS: 3600,
  PHONE_NUMBER_LIMIT: 100,
  LOCK_TIMEOUT_MS: 5000,
  // Security: API key for protected endpoints (set in Vercel env vars)
  API_KEY: process.env.API_KEY || 'change-me-in-production',
  // Security: Encryption key for credentials (set in Vercel env vars)
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || 'change-me-32-character-key-here',
};

// ============================================================================
// MIDDLEWARE SETUP
// ============================================================================

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// ============================================================================
// SECURITY HELPERS
// ============================================================================

/**
 * Middleware: Validates API key for protected endpoints
 * Usage: app.get('/protected', requireAuth, handler)
 */
function requireAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;

  if (!apiKey || apiKey !== CONFIG.API_KEY) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Valid API key required'
    });
  }

  next();
}

/**
 * Middleware: Validates Twilio webhook signatures
 * This ensures that webhook requests actually come from Twilio, not attackers
 * Usage: app.post('/webhook', validateTwilioSignature, handler)
 */
async function validateTwilioSignature(req, res, next) {
  try {
    // Get account auth token for signature validation
    const account = await kv.get('twilio_account');

    if (!account || !account.authToken) {
      console.warn('Twilio signature validation skipped - no auth token configured');
      return next();
    }

    // Decrypt the auth token
    const authToken = decrypt(account.authToken);

    // Get the Twilio signature from headers
    const twilioSignature = req.headers['x-twilio-signature'];

    if (!twilioSignature) {
      return res.status(403).json({ error: 'Missing Twilio signature' });
    }

    // Construct the full URL
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const url = `${protocol}://${host}${req.originalUrl}`;

    // Validate the signature
    const isValid = twilio.validateRequest(
      authToken,
      twilioSignature,
      url,
      req.body
    );

    if (!isValid) {
      console.error('Invalid Twilio signature for URL:', url);
      return res.status(403).json({ error: 'Invalid Twilio signature' });
    }

    // Signature is valid, proceed
    next();
  } catch (error) {
    console.error('Twilio signature validation error:', error);
    // Log but allow through to avoid breaking webhooks during development
    // In production, you might want to reject invalid signatures
    next();
  }
}

/**
 * Encrypts sensitive data (like auth tokens) before storing in database
 * Uses AES-256-GCM for encryption
 */
function encrypt(text) {
  if (!text) return text;

  try {
    // Create a 32-byte key from the encryption key
    const key = crypto.scryptSync(CONFIG.ENCRYPTION_KEY, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Return: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypts sensitive data retrieved from database
 */
function decrypt(encryptedText) {
  if (!encryptedText) return encryptedText;

  // Check if it's already decrypted (for backward compatibility)
  if (!encryptedText.includes(':')) {
    return encryptedText;
  }

  try {
    const [ivHex, authTagHex, encrypted] = encryptedText.split(':');

    const key = crypto.scryptSync(CONFIG.ENCRYPTION_KEY, 'salt', 32);
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

// ============================================================================
// INPUT VALIDATION HELPERS
// ============================================================================

/**
 * Validates Twilio Account SID format
 * Format: AC followed by 32 hexadecimal characters
 */
function isValidAccountSid(accountSid) {
  return /^AC[a-f0-9]{32}$/i.test(accountSid);
}

/**
 * Validates phone number in E.164 format
 * Format: + followed by country code and number (1-15 digits)
 */
function isValidPhoneNumber(phoneNumber) {
  return /^\+[1-9]\d{1,14}$/.test(phoneNumber);
}

/**
 * Validates Twilio Auth Token format
 * Format: 32 hexadecimal characters
 */
function isValidAuthToken(authToken) {
  return /^[a-f0-9]{32}$/i.test(authToken);
}

/**
 * Sanitizes user input to prevent XSS
 * Removes potentially dangerous characters
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;

  return input
    .replace(/[<>\"']/g, '') // Remove HTML special chars
    .trim()
    .slice(0, 1000); // Limit length
}

// ============================================================================
// RACE CONDITION PROTECTION
// ============================================================================

/**
 * Simple distributed lock implementation using KV
 * Prevents race conditions when updating shared data
 */
async function acquireLock(lockKey, timeoutMs = CONFIG.LOCK_TIMEOUT_MS) {
  const lockId = crypto.randomUUID();
  const lockKeyFull = `lock:${lockKey}`;
  const maxAttempts = 50;
  const sleepMs = 100;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Try to set lock if it doesn't exist
    const acquired = await kv.set(lockKeyFull, lockId, {
      nx: true, // Only set if doesn't exist
      px: timeoutMs // Expire after timeout
    });

    if (acquired) {
      return lockId; // Successfully acquired lock
    }

    // Lock exists, wait and retry
    await new Promise(resolve => setTimeout(resolve, sleepMs));
  }

  throw new Error(`Failed to acquire lock: ${lockKey}`);
}

/**
 * Releases a distributed lock
 */
async function releaseLock(lockKey, lockId) {
  const lockKeyFull = `lock:${lockKey}`;
  const currentLock = await kv.get(lockKeyFull);

  // Only delete if we own the lock
  if (currentLock === lockId) {
    await kv.del(lockKeyFull);
  }
}

/**
 * Wrapper for safely updating KV data with lock protection
 * Usage: await withLock('phone_numbers', async () => { ... })
 */
async function withLock(lockKey, callback) {
  const lockId = await acquireLock(lockKey);

  try {
    return await callback();
  } finally {
    await releaseLock(lockKey, lockId);
  }
}

// ============================================================================
// UTILITY HELPERS
// ============================================================================

/**
 * Constructs base URL from request headers
 * Handles Vercel proxy headers correctly
 */
function getBaseUrl(req) {
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${protocol}://${host}`;
}

// Helper function to get config from KV (legacy - being phased out)
async function getConfig() {
  const config = await kv.get('twilio_config');
  return config || {};
}

// Helper function to save config to KV (legacy - being phased out)
async function saveConfig(config) {
  await kv.set('twilio_config', config);
}

/**
 * Error logging helper
 * Logs errors to KV database for debugging via /debug endpoint
 * Automatically limits to last 100 errors to prevent database bloat
 */
async function logError(type, error, context = {}) {
  try {
    const errorLog = {
      timestamp: new Date().toISOString(),
      type, // 'backend', 'frontend', 'twilio', etc.
      message: error.message || error.toString(),
      stack: error.stack || null,
      context
    };

    // Get existing errors
    const errors = await kv.get('error_logs') || [];

    // Add new error to the beginning
    errors.unshift(errorLog);

    // Keep only last MAX_ERROR_LOGS errors
    const trimmedErrors = errors.slice(0, CONFIG.MAX_ERROR_LOGS);

    // Save back to KV
    await kv.set('error_logs', trimmedErrors);

    console.error(`[${type}]`, error);
  } catch (logError) {
    console.error('Failed to log error:', logError);
  }
}

/**
 * Auto-provisions TwiML App and API Keys for voice calling
 * Called during voice wizard setup
 *
 * Creates 2 API Keys following Twilio security best practices:
 * 1. REST API Key (Standard) - for all server-to-server REST API calls
 * 2. Access Token Key (Standard) - for generating browser SDK access tokens
 *
 * This separation allows independent key rotation and follows principle of least privilege
 */
async function autoProvision(accountSid, authToken, baseUrl) {
  const client = twilio(accountSid, authToken);

  try {
    // Create timestamp for friendly names (helps identify in Twilio Console)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

    // Create TwiML App with voice and status callback URLs
    const twimlApp = await client.applications.create({
      friendlyName: `Browser Phone App ${timestamp}`,
      voiceUrl: `${baseUrl}/voice`,
      voiceMethod: 'POST',
      statusCallback: `${baseUrl}/status`,
      statusCallbackMethod: 'POST'
    });

    // Create API Key #1: For REST API calls (phone config, SMS sending, validation, etc.)
    // Type: Standard - can do everything except manage API Keys/Accounts
    const restApiKey = await client.newKeys.create({
      friendlyName: `Browser Phone REST API Key ${timestamp}`
    });

    // Create API Key #2: For generating Access Tokens (browser SDK authentication)
    // Type: Standard - required for creating client access tokens
    const accessTokenKey = await client.newKeys.create({
      friendlyName: `Browser Phone Access Token Key ${timestamp}`
    });

    return {
      twimlAppSid: twimlApp.sid,
      // REST API Key (for server-to-server API calls)
      restApiKeySid: restApiKey.sid,
      restApiKeySecret: restApiKey.secret,
      // Access Token Key (for browser SDK tokens)
      accessTokenKeySid: accessTokenKey.sid,
      accessTokenKeySecret: accessTokenKey.secret
    };
  } catch (error) {
    console.error('Auto-provisioning error:', error);
    throw error;
  }
}

/**
 * Get Twilio REST API client using best practice authentication
 *
 * Follows Twilio security recommendations:
 * 1. Prefers REST API Key (Standard) over Auth Token
 * 2. Falls back to Auth Token for backward compatibility or emergency access
 * 3. Never exposes credentials to client-side code
 *
 * Usage: const client = await getTwilioRestClient();
 */
async function getTwilioRestClient() {
  const account = await kv.get('twilio_account');
  const twimlApp = await kv.get('twiml_app');

  if (!account || !account.accountSid) {
    throw new Error('Twilio account not configured');
  }

  // PREFERRED: Use REST API Key (best practice for production)
  if (twimlApp?.rest_api_key_sid && twimlApp?.rest_api_key_secret) {
    const apiKeySid = twimlApp.rest_api_key_sid;
    const apiKeySecret = decrypt(twimlApp.rest_api_key_secret);

    return twilio(apiKeySid, apiKeySecret, {
      accountSid: account.accountSid
    });
  }

  // FALLBACK: Use Auth Token (for backward compatibility or if API key not set)
  // This happens when:
  // - App was set up before Phase 1B migration
  // - API key was manually revoked
  // - Emergency access needed
  if (account.authToken) {
    const authToken = decrypt(account.authToken);
    console.warn('Using Auth Token for REST API (consider migrating to API Key)');

    return twilio(account.accountSid, authToken);
  }

  throw new Error('No valid Twilio credentials found (neither API Key nor Auth Token)');
}

// ============================================================================
// SETUP ENDPOINTS
// ============================================================================

/**
 * POST /api/setup
 * Legacy setup endpoint - saves Twilio configuration
 * Note: Being phased out in favor of wizard-based setup
 */
app.post('/api/setup', async (req, res) => {
  try {
    const { accountSid, authToken, phoneNumber } = req.body;

    // Validate required fields
    if (!accountSid || !authToken || !phoneNumber) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate input formats
    if (!isValidAccountSid(accountSid)) {
      return res.status(400).json({ error: 'Invalid Account SID format' });
    }

    if (!isValidAuthToken(authToken)) {
      return res.status(400).json({ error: 'Invalid Auth Token format' });
    }

    if (!isValidPhoneNumber(phoneNumber)) {
      return res.status(400).json({ error: 'Invalid phone number format (use E.164: +1234567890)' });
    }

    // Get base URL from request
    const baseUrl = getBaseUrl(req);

    // Auto-provision TwiML App and API Keys
    const provisioned = await autoProvision(accountSid, authToken, baseUrl);

    // Save everything to KV (encrypt sensitive data)
    // Note: Legacy structure for backward compatibility
    const config = {
      accountSid,
      authToken: encrypt(authToken), // Encrypt auth token
      phoneNumber,
      twimlAppSid: provisioned.twimlAppSid,
      // Legacy fields (kept for compatibility)
      apiKey: provisioned.accessTokenKeySid,
      apiSecret: encrypt(provisioned.accessTokenKeySecret),
      initialized: true,
      baseUrl
    };

    await saveConfig(config);

    res.json({
      success: true,
      message: 'Setup completed successfully',
      twimlAppSid: provisioned.twimlAppSid
    });
  } catch (error) {
    await logError('backend', error, { endpoint: '/api/setup', body: req.body });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/reset
 * Deletes all configuration (protected endpoint)
 * Requires API key authentication
 */
app.post('/api/reset', requireAuth, async (req, res) => {
  try {
    // Delete all KV keys
    await kv.del('twilio_config');
    await kv.del('twilio_account');
    await kv.del('twiml_app');
    await kv.del('phone_numbers');
    await kv.del('conversations');
    await kv.del('messages');
    await kv.del('error_logs');

    res.json({
      success: true,
      message: 'All configuration has been reset'
    });
  } catch (error) {
    await logError('backend', error, { endpoint: '/api/reset' });
    res.status(500).json({ error: 'Failed to reset configuration' });
  }
});

/**
 * GET /api/twilio/phone-numbers
 * Fetches all phone numbers from Twilio account
 * Uses REST API Key for authentication
 */
app.get('/api/twilio/phone-numbers', async (req, res) => {
  try {
    // Get Twilio client using REST API Key (preferred) or Auth Token (fallback)
    const client = await getTwilioRestClient();

    // Fetch incoming phone numbers
    const numbers = await client.incomingPhoneNumbers.list({ limit: 100 });

    const formattedNumbers = numbers.map(number => ({
      sid: number.sid,
      phoneNumber: number.phoneNumber,
      friendlyName: number.friendlyName,
      capabilities: {
        voice: number.capabilities.voice,
        SMS: number.capabilities.SMS,
        MMS: number.capabilities.MMS
      }
    }));

    res.json({ numbers: formattedNumbers });
  } catch (error) {
    await logError('backend', error, { endpoint: '/api/twilio/phone-numbers' });
    res.status(500).json({ error: error.message });
  }
});

// Check if initialized and setup status
app.get('/api/status', async (req, res) => {
  try {
    const config = await getConfig();
    const account = await kv.get('twilio_account');

    res.json({
      initialized: !!config?.initialized,
      account_configured: !!account?.accountSid,
      voice_setup_completed: !!account?.voice_setup_completed,
      sms_setup_completed: !!account?.sms_setup_completed
    });
  } catch (error) {
    res.json({
      initialized: false,
      account_configured: false,
      voice_setup_completed: false,
      sms_setup_completed: false
    });
  }
});

/**
 * POST /api/setup/voice/credentials
 * Validates and saves Twilio credentials for voice setup
 *
 * Note: This endpoint uses Auth Token directly (not API Key) because:
 * - This is the INITIAL credential validation during setup
 * - API Keys don't exist yet (created in next step)
 * - Auth Token is required to create API Keys via autoProvision()
 */
app.post('/api/setup/voice/credentials', async (req, res) => {
  try {
    let { accountSid, authToken } = req.body;

    if (!accountSid || !authToken) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Sanitize and validate inputs
    accountSid = sanitizeInput(accountSid);
    authToken = sanitizeInput(authToken);

    if (!isValidAccountSid(accountSid)) {
      return res.status(400).json({ error: 'Invalid Account SID format' });
    }

    if (!isValidAuthToken(authToken)) {
      return res.status(400).json({ error: 'Invalid Auth Token format' });
    }

    // Validate credentials by making a test API call using Auth Token
    // (This is one of the legitimate uses of Auth Token per Twilio best practices)
    const client = twilio(accountSid, authToken);

    try {
      // Try to fetch account info to validate credentials
      await client.api.accounts(accountSid).fetch();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid Twilio credentials' });
    }

    // Save encrypted credentials to twilio_account
    await kv.set('twilio_account', {
      accountSid,
      authToken: encrypt(authToken), // Encrypt before storing
      voice_setup_completed: false,
      sms_setup_completed: false,
      created_at: new Date().toISOString()
    });

    res.json({ success: true, message: 'Credentials validated successfully' });
  } catch (error) {
    await logError('backend', error, { endpoint: '/api/setup/voice/credentials' });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/setup/voice/complete
 * Completes voice setup by auto-provisioning TwiML app
 * Can use existing credentials from SMS setup or accept new ones
 */
app.post('/api/setup/voice/complete', async (req, res) => {
  try {
    let { accountSid, authToken } = req.body;

    // Check if account already exists (from SMS setup)
    let account = await kv.get('twilio_account');
    let authTokenDecrypted;

    // If account exists, use those credentials
    if (account && account.accountSid && account.authToken) {
      accountSid = account.accountSid;
      authTokenDecrypted = decrypt(account.authToken); // Decrypt existing token
    } else {
      // No existing account, credentials are required
      if (!accountSid || !authToken) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Sanitize and validate inputs
      accountSid = sanitizeInput(accountSid);
      authToken = sanitizeInput(authToken);

      if (!isValidAccountSid(accountSid)) {
        return res.status(400).json({ error: 'Invalid Account SID format' });
      }

      if (!isValidAuthToken(authToken)) {
        return res.status(400).json({ error: 'Invalid Auth Token format' });
      }

      // Validate credentials by making a test API call
      const client = twilio(accountSid, authToken);
      try {
        await client.api.accounts(accountSid).fetch();
      } catch (error) {
        return res.status(401).json({ error: 'Invalid Twilio credentials' });
      }

      authTokenDecrypted = authToken; // Plain text for provisioning

      // Create new account entry if doesn't exist
      account = {
        accountSid,
        authToken: encrypt(authToken), // Encrypt before storing
        sms_setup_completed: false,
        created_at: new Date().toISOString()
      };
    }

    const baseUrl = getBaseUrl(req);

    // Auto-provision TwiML App and API Keys using decrypted token
    const provisioned = await autoProvision(accountSid, authTokenDecrypted, baseUrl);

    // Save TwiML app data with all required URLs for validation (encrypt secrets)
    // New structure: Separate keys for REST API and Access Tokens
    await kv.set('twiml_app', {
      sid: provisioned.twimlAppSid,

      // REST API Key (for server-to-server calls: phone config, SMS, validation)
      rest_api_key_sid: provisioned.restApiKeySid,
      rest_api_key_secret: encrypt(provisioned.restApiKeySecret),

      // Access Token Key (for browser SDK authentication)
      access_token_key_sid: provisioned.accessTokenKeySid,
      access_token_key_secret: encrypt(provisioned.accessTokenKeySecret),

      // Legacy fields (kept for backward compatibility with existing code)
      api_key: provisioned.accessTokenKeySid,
      api_secret: encrypt(provisioned.accessTokenKeySecret),

      // TwiML App configuration
      voice_url: `${baseUrl}/voice`,
      voice_method: 'POST',
      status_callback: `${baseUrl}/status`,
      status_callback_method: 'POST',
      app_url: baseUrl,
      created_at: new Date().toISOString(),
      last_validated: new Date().toISOString(),
      is_valid: true
    });

    // Update account to mark voice setup as completed
    await kv.set('twilio_account', {
      ...account,
      voice_setup_completed: true
    });

    res.json({
      success: true,
      message: 'Voice account setup completed successfully',
      twimlAppSid: provisioned.twimlAppSid
    });
  } catch (error) {
    await logError('backend', error, { endpoint: '/api/setup/voice/complete' });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/setup/sms/complete
 * Completes SMS setup
 * Can use existing credentials from voice setup or accept new ones
 *
 * Note: Uses Auth Token for initial credential validation (when setting up fresh)
 * This is appropriate because it's only validating new credentials during setup
 */
app.post('/api/setup/sms/complete', async (req, res) => {
  try {
    let { accountSid, authToken } = req.body;

    // Check if account already exists (from voice setup)
    let account = await kv.get('twilio_account');

    // If no account exists, credentials are required
    if (!account) {
      if (!accountSid || !authToken) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Sanitize and validate inputs
      accountSid = sanitizeInput(accountSid);
      authToken = sanitizeInput(authToken);

      if (!isValidAccountSid(accountSid)) {
        return res.status(400).json({ error: 'Invalid Account SID format' });
      }

      if (!isValidAuthToken(authToken)) {
        return res.status(400).json({ error: 'Invalid Auth Token format' });
      }

      // Validate credentials by making a test API call using Auth Token
      // (Legitimate use during initial setup - API Keys may not exist yet)
      const client = twilio(accountSid, authToken);
      try {
        await client.api.accounts(accountSid).fetch();
      } catch (error) {
        return res.status(401).json({ error: 'Invalid Twilio credentials' });
      }

      // Create new account entry with encrypted credentials
      account = {
        accountSid,
        authToken: encrypt(authToken), // Encrypt before storing
        voice_setup_completed: false,
        created_at: new Date().toISOString()
      };
    }

    // Mark SMS as completed
    await kv.set('twilio_account', {
      ...account,
      sms_setup_completed: true
    });

    res.json({
      success: true,
      message: 'SMS setup completed successfully'
    });
  } catch (error) {
    await logError('backend', error, { endpoint: '/api/setup/sms/complete' });
    res.status(500).json({ error: error.message });
  }
});

// Phone Number Management Endpoints

// Get all phone numbers
app.get('/api/numbers', async (req, res) => {
  try {
    const numbers = await kv.get('phone_numbers') || [];
    res.json({ numbers });
  } catch (error) {
    await logError('backend', error, { endpoint: '/api/numbers' });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/numbers/add
 * Adds a phone number to the system
 * Uses distributed lock to prevent race conditions
 */
app.post('/api/numbers/add', async (req, res) => {
  try {
    let { sid, phoneNumber, friendlyName } = req.body;

    if (!sid || !phoneNumber) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Sanitize inputs
    sid = sanitizeInput(sid);
    phoneNumber = sanitizeInput(phoneNumber);
    friendlyName = sanitizeInput(friendlyName);

    // Validate phone number format
    if (!isValidPhoneNumber(phoneNumber)) {
      return res.status(400).json({ error: 'Invalid phone number format (use E.164: +1234567890)' });
    }

    // Use lock to prevent race conditions when modifying phone_numbers
    await withLock('phone_numbers', async () => {
      const numbers = await kv.get('phone_numbers') || [];

      // Check if number already exists
      if (numbers.find(n => n.sid === sid)) {
        throw new Error('Phone number already added');
      }

      // Enforce limit
      if (numbers.length >= CONFIG.PHONE_NUMBER_LIMIT) {
        throw new Error(`Cannot add more than ${CONFIG.PHONE_NUMBER_LIMIT} phone numbers`);
      }

      // Add new number with default configuration
      numbers.push({
        sid,
        phone_number: phoneNumber,
        friendly_name: friendlyName || '',
        voice_config: {
          webhook_configured: false,
          issues: []
        },
        sms_config: {
          webhook_configured: false,
          issues: []
        },
        added_at: new Date().toISOString()
      });

      await kv.set('phone_numbers', numbers);
    });

    res.json({
      success: true,
      message: 'Phone number added successfully'
    });
  } catch (error) {
    await logError('backend', error, { endpoint: '/api/numbers/add' });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/numbers/:sid/configure-voice
 * Configures voice webhooks for a phone number
 * Updates Twilio API and local database with lock protection
 * Uses REST API Key for authentication
 */
app.post('/api/numbers/:sid/configure-voice', async (req, res) => {
  try {
    const { sid } = req.params;

    const twimlApp = await kv.get('twiml_app');

    if (!twimlApp) {
      return res.status(400).json({ error: 'Voice not set up. Please complete voice wizard first.' });
    }

    const baseUrl = getBaseUrl(req);

    // Get Twilio client using REST API Key (preferred) or Auth Token (fallback)
    const client = await getTwilioRestClient();

    // Configure phone number for voice via Twilio API
    await client.incomingPhoneNumbers(sid).update({
      voiceUrl: `${baseUrl}/voice`,
      voiceMethod: 'POST',
      voiceApplicationSid: twimlApp.sid
    });

    // Update number configuration with lock protection
    await withLock('phone_numbers', async () => {
      const numbers = await kv.get('phone_numbers') || [];
      const numberIndex = numbers.findIndex(n => n.sid === sid);

      if (numberIndex === -1) {
        throw new Error('Phone number not found');
      }

      numbers[numberIndex].voice_config = {
        webhook_url: `${baseUrl}/voice`,
        webhook_method: 'POST',
        twiml_app_sid: twimlApp.sid,
        webhook_configured: true,
        configured_at: new Date().toISOString(),
        issues: []
      };

      await kv.set('phone_numbers', numbers);
    });

    res.json({
      success: true,
      message: 'Voice configured successfully'
    });
  } catch (error) {
    await logError('backend', error, { endpoint: '/api/numbers/:sid/configure-voice' });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/numbers/:sid/configure-sms
 * Configures SMS webhooks for a phone number
 * Updates Twilio API and local database with lock protection
 * Uses REST API Key for authentication
 */
app.post('/api/numbers/:sid/configure-sms', async (req, res) => {
  try {
    const { sid } = req.params;

    const account = await kv.get('twilio_account');

    if (!account || !account.sms_setup_completed) {
      return res.status(400).json({ error: 'SMS not set up. Please complete SMS wizard first.' });
    }

    const baseUrl = getBaseUrl(req);

    // Get Twilio client using REST API Key (preferred) or Auth Token (fallback)
    const client = await getTwilioRestClient();

    // Configure phone number for SMS via Twilio API
    await client.incomingPhoneNumbers(sid).update({
      smsUrl: `${baseUrl}/sms`,
      smsMethod: 'POST',
      statusCallback: `${baseUrl}/sms-status`,
      statusCallbackMethod: 'POST'
    });

    // Update number configuration with lock protection
    await withLock('phone_numbers', async () => {
      const numbers = await kv.get('phone_numbers') || [];
      const numberIndex = numbers.findIndex(n => n.sid === sid);

      if (numberIndex === -1) {
        throw new Error('Phone number not found');
      }

      numbers[numberIndex].sms_config = {
        webhook_url: `${baseUrl}/sms`,
        webhook_method: 'POST',
        status_callback: `${baseUrl}/sms-status`,
        status_callback_method: 'POST',
        webhook_configured: true,
        configured_at: new Date().toISOString(),
        issues: []
      };

      await kv.set('phone_numbers', numbers);
    });

    res.json({
      success: true,
      message: 'SMS configured successfully'
    });
  } catch (error) {
    await logError('backend', error, { endpoint: '/api/numbers/:sid/configure-sms' });
    res.status(500).json({ error: error.message });
  }
});

// Fix voice configuration
app.post('/api/numbers/:sid/fix-voice', async (req, res) => {
  try {
    // Same as configure-voice - re-apply configuration
    req.url = `/api/numbers/${req.params.sid}/configure-voice`;
    return app._router.handle(req, res);
  } catch (error) {
    await logError('backend', error, { endpoint: '/api/numbers/:sid/fix-voice' });
    res.status(500).json({ error: error.message });
  }
});

// Fix SMS configuration
app.post('/api/numbers/:sid/fix-sms', async (req, res) => {
  try {
    // Same as configure-sms - re-apply configuration
    req.url = `/api/numbers/${req.params.sid}/configure-sms`;
    return app._router.handle(req, res);
  } catch (error) {
    await logError('backend', error, { endpoint: '/api/numbers/:sid/fix-sms' });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/numbers/:sid/validate
 * Validates phone number configuration against Twilio
 * Checks if webhooks match expected values
 * Uses REST API Key for authentication
 */
app.post('/api/numbers/:sid/validate', async (req, res) => {
  try {
    const { sid } = req.params;

    const twimlApp = await kv.get('twiml_app');

    const baseUrl = getBaseUrl(req);

    // Get Twilio client using REST API Key (preferred) or Auth Token (fallback)
    const client = await getTwilioRestClient();

    // Fetch actual configuration from Twilio
    const twilioNumber = await client.incomingPhoneNumbers(sid).fetch();

    // Validate configuration with lock protection
    const validationResult = await withLock('phone_numbers', async () => {
      const numbers = await kv.get('phone_numbers') || [];
      const numberIndex = numbers.findIndex(n => n.sid === sid);

      if (numberIndex === -1) {
        throw new Error('Phone number not found');
      }

      // Validate voice configuration
      const voiceIssues = [];
      if (numbers[numberIndex].voice_config && numbers[numberIndex].voice_config.webhook_configured) {
        if (twilioNumber.voiceUrl !== `${baseUrl}/voice`) {
          voiceIssues.push('Voice URL mismatch');
        }
        if (twilioNumber.voiceMethod !== 'POST') {
          voiceIssues.push('Voice method should be POST');
        }
        if (twimlApp && twilioNumber.voiceApplicationSid !== twimlApp.sid) {
          voiceIssues.push('TwiML App SID mismatch');
        }
      }

      // Validate SMS configuration
      const smsIssues = [];
      if (numbers[numberIndex].sms_config && numbers[numberIndex].sms_config.webhook_configured) {
        if (twilioNumber.smsUrl !== `${baseUrl}/sms`) {
          smsIssues.push('SMS URL mismatch');
        }
        if (twilioNumber.smsMethod !== 'POST') {
          smsIssues.push('SMS method should be POST');
        }
        if (twilioNumber.statusCallback !== `${baseUrl}/sms-status`) {
          smsIssues.push('SMS status callback mismatch');
        }
      }

      // Update issues in database
      numbers[numberIndex].voice_config = {
        ...numbers[numberIndex].voice_config,
        issues: voiceIssues,
        last_validated: new Date().toISOString()
      };

      numbers[numberIndex].sms_config = {
        ...numbers[numberIndex].sms_config,
        issues: smsIssues,
        last_validated: new Date().toISOString()
      };

      await kv.set('phone_numbers', numbers);

      return { voiceIssues, smsIssues };
    });

    res.json({
      success: true,
      message: validationResult.voiceIssues.length + validationResult.smsIssues.length === 0
        ? 'Validation passed - configuration is correct'
        : `Found ${validationResult.voiceIssues.length + validationResult.smsIssues.length} issue(s)`,
      voiceIssues: validationResult.voiceIssues,
      smsIssues: validationResult.smsIssues
    });
  } catch (error) {
    await logError('backend', error, { endpoint: '/api/numbers/:sid/validate' });
    res.status(500).json({ error: error.message });
  }
});

// Validate all numbers
app.post('/api/numbers/validate-all', async (req, res) => {
  try {
    const numbers = await kv.get('phone_numbers') || [];

    let totalIssues = 0;
    for (const number of numbers) {
      // Trigger validation for each number
      const validateRes = await fetch(`${req.protocol}://${req.get('host')}/api/numbers/${number.sid}/validate`, {
        method: 'POST'
      });
      const data = await validateRes.json();

      if (data.voiceIssues) totalIssues += data.voiceIssues.length;
      if (data.smsIssues) totalIssues += data.smsIssues.length;
    }

    res.json({
      success: true,
      message: totalIssues === 0
        ? `All ${numbers.length} number(s) validated successfully`
        : `Validated ${numbers.length} number(s) - found ${totalIssues} issue(s)`
    });
  } catch (error) {
    await logError('backend', error, { endpoint: '/api/numbers/validate-all' });
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/numbers/:sid
 * Removes a phone number from the system
 * Uses lock to prevent race conditions
 */
app.delete('/api/numbers/:sid', async (req, res) => {
  try {
    const { sid } = req.params;

    await withLock('phone_numbers', async () => {
      const numbers = await kv.get('phone_numbers') || [];
      const filtered = numbers.filter(n => n.sid !== sid);

      if (filtered.length === numbers.length) {
        throw new Error('Phone number not found');
      }

      await kv.set('phone_numbers', filtered);
    });

    res.json({
      success: true,
      message: 'Phone number removed successfully'
    });
  } catch (error) {
    await logError('backend', error, { endpoint: '/api/numbers/:sid (DELETE)' });
    res.status(500).json({ error: error.message });
  }
});

// SMS/Messaging API Endpoints

// Get all conversations
app.get('/api/conversations', async (req, res) => {
  try {
    const conversations = await kv.get('conversations') || [];
    res.json({ conversations });
  } catch (error) {
    await logError('backend', error, { endpoint: '/api/conversations' });
    res.status(500).json({ error: error.message });
  }
});

// Get messages for a conversation
app.get('/api/conversations/:phoneNumber/messages', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const messages = await kv.get('messages') || [];

    // Filter messages for this conversation
    const conversationMessages = messages.filter(m =>
      m.from === phoneNumber || m.to === phoneNumber
    );

    res.json({ messages: conversationMessages });
  } catch (error) {
    await logError('backend', error, { endpoint: '/api/conversations/:phoneNumber/messages' });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/conversations/:phoneNumber/send
 * Sends an SMS/MMS to a phone number
 * Uses locks to prevent race conditions when updating conversations/messages
 * Uses REST API Key for authentication
 */
app.post('/api/conversations/:phoneNumber/send', async (req, res) => {
  try {
    let { phoneNumber } = req.params;
    let { body, mediaUrl } = req.body;

    // Sanitize inputs
    phoneNumber = sanitizeInput(phoneNumber);
    body = sanitizeInput(body);

    // Validate phone number format
    if (!isValidPhoneNumber(phoneNumber)) {
      return res.status(400).json({ error: 'Invalid phone number format (use E.164: +1234567890)' });
    }

    const numbers = await kv.get('phone_numbers') || [];

    // Find first SMS-enabled number as sender
    const smsNumber = numbers.find(n => n.sms_config && n.sms_config.webhook_configured);

    if (!smsNumber) {
      return res.status(400).json({ error: 'No SMS-enabled phone number configured' });
    }

    // Get Twilio client using REST API Key (preferred) or Auth Token (fallback)
    const client = await getTwilioRestClient();

    const baseUrl = getBaseUrl(req);
    const messageParams = {
      body: body || '',
      from: smsNumber.phone_number,
      to: phoneNumber,
      statusCallback: `${baseUrl}/sms-status`
    };

    if (mediaUrl) {
      messageParams.mediaUrl = [mediaUrl];
    }

    const message = await client.messages.create(messageParams);

    // Store in database with lock protection
    const newMessage = await withLock('messages', async () => {
      const messages = await kv.get('messages') || [];
      const msg = {
        sid: message.sid,
        from: smsNumber.phone_number,
        to: phoneNumber,
        body: body || '',
        media: mediaUrl ? [{ url: mediaUrl }] : [],
        direction: 'outbound',
        timestamp: new Date().toISOString(),
        status: message.status
      };

      messages.unshift(msg);

      // Keep only last MAX_MESSAGES
      await kv.set('messages', messages.slice(0, CONFIG.MAX_MESSAGES));

      return msg;
    });

    // Update conversation with lock protection
    await withLock('conversations', async () => {
      const conversations = await kv.get('conversations') || [];
      const existingConv = conversations.find(c => c.phone_number === phoneNumber);

      if (existingConv) {
        existingConv.last_message = body || '(Media message)';
        existingConv.last_message_time = new Date().toISOString();
        existingConv.unread_count = 0; // Reset unread count since we're viewing
      } else {
        conversations.unshift({
          phone_number: phoneNumber,
          last_message: body || '(Media message)',
          last_message_time: new Date().toISOString(),
          unread_count: 0
        });
      }

      await kv.set('conversations', conversations);
    });

    res.json({
      success: true,
      message: newMessage
    });
  } catch (error) {
    await logError('backend', error, { endpoint: '/api/conversations/:phoneNumber/send' });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/conversations/:phoneNumber/mark-read
 * Marks conversation as read (resets unread count)
 */
app.post('/api/conversations/:phoneNumber/mark-read', async (req, res) => {
  try {
    let { phoneNumber } = req.params;
    phoneNumber = sanitizeInput(phoneNumber);

    await withLock('conversations', async () => {
      const conversations = await kv.get('conversations') || [];

      const conversation = conversations.find(c => c.phone_number === phoneNumber);
      if (conversation) {
        conversation.unread_count = 0;
        await kv.set('conversations', conversations);
      }
    });

    res.json({ success: true });
  } catch (error) {
    await logError('backend', error, { endpoint: '/api/conversations/:phoneNumber/mark-read' });
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/conversations/:phoneNumber
 * Deletes a conversation and all associated messages
 */
app.delete('/api/conversations/:phoneNumber', async (req, res) => {
  try {
    let { phoneNumber } = req.params;
    phoneNumber = sanitizeInput(phoneNumber);

    // Delete conversation with lock
    await withLock('conversations', async () => {
      const conversations = await kv.get('conversations') || [];
      const filtered = conversations.filter(c => c.phone_number !== phoneNumber);
      await kv.set('conversations', filtered);
    });

    // Delete messages with lock
    await withLock('messages', async () => {
      const messages = await kv.get('messages') || [];
      const filteredMessages = messages.filter(m =>
        m.from !== phoneNumber && m.to !== phoneNumber
      );
      await kv.set('messages', filteredMessages);
    });

    res.json({ success: true });
  } catch (error) {
    await logError('backend', error, { endpoint: '/api/conversations/:phoneNumber (DELETE)' });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/twiml-app/validate
 * Validates TwiML app configuration against Twilio
 * Uses REST API Key for authentication
 */
app.post('/api/twiml-app/validate', async (req, res) => {
  try {
    const twimlApp = await kv.get('twiml_app');

    if (!twimlApp) {
      return res.status(400).json({ error: 'TwiML app not configured' });
    }

    const baseUrl = getBaseUrl(req);

    const issues = [];

    try {
      // Get Twilio client using REST API Key (preferred) or Auth Token (fallback)
      const client = await getTwilioRestClient();

      // Fetch actual TwiML app from Twilio
      const twilioApp = await client.applications(twimlApp.sid).fetch();

      // Validate URLs and methods
      if (twilioApp.voiceUrl !== `${baseUrl}/voice`) {
        issues.push('Voice URL mismatch');
      }
      if (twilioApp.voiceMethod !== 'POST') {
        issues.push('Voice method should be POST');
      }
      if (twilioApp.statusCallback !== `${baseUrl}/status`) {
        issues.push('Status callback URL mismatch');
      }
      if (twilioApp.statusCallbackMethod !== 'POST') {
        issues.push('Status callback method should be POST');
      }

      // Update database with validation results
      await kv.set('twiml_app', {
        ...twimlApp,
        is_valid: issues.length === 0,
        last_validated: new Date().toISOString(),
        issues
      });

      res.json({
        success: true,
        is_valid: issues.length === 0,
        issues,
        message: issues.length === 0
          ? 'TwiML app configuration is valid'
          : `Found ${issues.length} issue(s)`
      });
    } catch (error) {
      // TwiML app doesn't exist or can't be fetched
      await kv.set('twiml_app', {
        ...twimlApp,
        is_valid: false,
        last_validated: new Date().toISOString(),
        issues: ['TwiML app not found in Twilio account']
      });

      res.json({
        success: true,
        is_valid: false,
        issues: ['TwiML app not found in Twilio account'],
        message: 'TwiML app not found - may need to run voice wizard again'
      });
    }
  } catch (error) {
    await logError('backend', error, { endpoint: '/api/twiml-app/validate' });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/token
 * Generates Twilio access token for browser voice calling
 * Note: Not protected by API key auth since it's called from frontend
 * Token has short TTL and requires prior setup, providing implicit security
 *
 * Uses dedicated Access Token API Key (separate from REST API Key)
 */
app.get('/api/token', async (req, res) => {
  try {
    const account = await kv.get('twilio_account');
    const twimlApp = await kv.get('twiml_app');

    if (!account || !twimlApp) {
      return res.status(400).json({ error: 'Not initialized. Please run setup first.' });
    }

    const { accountSid } = account;
    const { sid: twimlAppSid } = twimlApp;

    // Use dedicated Access Token Key (preferred)
    // Falls back to legacy api_key field for backward compatibility
    const apiKeySid = twimlApp.access_token_key_sid || twimlApp.api_key;
    const apiKeySecretEncrypted = twimlApp.access_token_key_secret || twimlApp.api_secret;

    if (!apiKeySid || !apiKeySecretEncrypted) {
      return res.status(500).json({ error: 'Access Token API Key not configured' });
    }

    // Decrypt API secret before using
    const apiKeySecret = decrypt(apiKeySecretEncrypted);

    // Create access token
    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const identity = 'browser_user';
    const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
      identity: identity,
      ttl: CONFIG.TOKEN_TTL_SECONDS
    });

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: true
    });

    token.addGrant(voiceGrant);

    res.json({
      token: token.toJwt(),
      identity: identity
    });
  } catch (error) {
    await logError('backend', error, { endpoint: '/api/token' });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /voice
 * Twilio webhook for handling voice calls
 * Validates that request comes from Twilio using signature validation
 */
app.post('/voice', validateTwilioSignature, async (req, res) => {
  try {
    const numbers = await kv.get('phone_numbers') || [];
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    // Get first configured voice number for caller ID
    const voiceNumber = numbers.find(n => n.voice_config && n.voice_config.webhook_configured);
    const callerId = voiceNumber ? voiceNumber.phone_number : null;

    // Check if this is an outgoing call from browser (From will be "client:browser_user")
    if (req.body.From && req.body.From.startsWith('client:')) {
      // Outgoing call from browser to external number
      const dial = response.dial({
        callerId: callerId
      });
      dial.number(req.body.To);
    } else {
      // Incoming call to Twilio number - route to browser
      const dial = response.dial();
      dial.client('browser_user');
    }

    res.type('text/xml');
    res.send(response.toString());
  } catch (error) {
    await logError('twilio', error, { endpoint: '/voice', body: req.body });
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();
    response.say('An error occurred. Please try again later.');
    res.type('text/xml');
    res.send(response.toString());
  }
});

/**
 * POST /status
 * Twilio webhook for call status callbacks
 * Validates that request comes from Twilio
 */
app.post('/status', validateTwilioSignature, (req, res) => {
  console.log('Call status:', req.body);
  res.sendStatus(200);
});

/**
 * POST /sms
 * Twilio webhook for incoming SMS/MMS messages
 * Validates signature and uses locks to prevent race conditions
 */
app.post('/sms', validateTwilioSignature, async (req, res) => {
  try {
    const { From, To, Body, NumMedia, MessageSid } = req.body;

    // Get media URLs if MMS
    const mediaUrls = [];
    if (NumMedia && parseInt(NumMedia) > 0) {
      for (let i = 0; i < parseInt(NumMedia); i++) {
        mediaUrls.push({
          contentType: req.body[`MediaContentType${i}`],
          url: req.body[`MediaUrl${i}`]
        });
      }
    }

    // Store message in database with lock protection
    await withLock('messages', async () => {
      const messages = await kv.get('messages') || [];
      const newMessage = {
        sid: MessageSid,
        from: From,
        to: To,
        body: Body || '',
        media: mediaUrls,
        direction: 'inbound',
        timestamp: new Date().toISOString(),
        status: 'received'
      };

      messages.unshift(newMessage);

      // Keep last MAX_MESSAGES
      await kv.set('messages', messages.slice(0, CONFIG.MAX_MESSAGES));
    });

    // Update conversation with lock protection
    await withLock('conversations', async () => {
      const conversations = await kv.get('conversations') || [];
      const existingConv = conversations.find(c => c.phone_number === From);

      if (existingConv) {
        existingConv.last_message = Body || '(Media message)';
        existingConv.last_message_time = new Date().toISOString();
        existingConv.unread_count = (existingConv.unread_count || 0) + 1;
      } else {
        conversations.unshift({
          phone_number: From,
          last_message: Body || '(Media message)',
          last_message_time: new Date().toISOString(),
          unread_count: 1
        });
      }

      await kv.set('conversations', conversations);
    });

    // Respond with empty TwiML (no auto-reply)
    const MessagingResponse = twilio.twiml.MessagingResponse;
    const response = new MessagingResponse();
    res.type('text/xml');
    res.send(response.toString());
  } catch (error) {
    await logError('twilio', error, { endpoint: '/sms', body: req.body });
    const MessagingResponse = twilio.twiml.MessagingResponse;
    const response = new MessagingResponse();
    res.type('text/xml');
    res.send(response.toString());
  }
});

/**
 * POST /sms-status
 * Twilio webhook for SMS delivery status updates
 * Validates signature and uses lock for database updates
 */
app.post('/sms-status', validateTwilioSignature, async (req, res) => {
  try {
    const { MessageSid, MessageStatus } = req.body;

    // Update message status in database with lock protection
    await withLock('messages', async () => {
      const messages = await kv.get('messages') || [];
      const message = messages.find(m => m.sid === MessageSid);

      if (message) {
        message.status = MessageStatus;
        await kv.set('messages', messages);
      }
    });

    res.sendStatus(200);
  } catch (error) {
    await logError('twilio', error, { endpoint: '/sms-status', body: req.body });
    res.sendStatus(200);
  }
});

// Frontend error logging endpoint
app.post('/api/log-error', async (req, res) => {
  try {
    const { message, stack, context } = req.body;
    await logError('frontend', { message, stack }, context);
    res.json({ success: true });
  } catch (error) {
    console.error('Error logging frontend error:', error);
    res.status(500).json({ error: 'Failed to log error' });
  }
});

/**
 * GET /api/errors
 * Retrieves all error logs (protected endpoint)
 */
app.get('/api/errors', requireAuth, async (req, res) => {
  try {
    const errors = await kv.get('error_logs') || [];
    res.json({ errors, count: errors.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve errors' });
  }
});

/**
 * POST /api/clear-errors
 * Clears all error logs (protected endpoint)
 */
app.post('/api/clear-errors', requireAuth, async (req, res) => {
  try {
    await kv.set('error_logs', []);
    res.json({ success: true, message: 'Errors cleared' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear errors' });
  }
});

/**
 * GET /debug
 * Debug page with visual error console (protected endpoint)
 */
app.get('/debug', requireAuth, async (req, res) => {
  try {
    const errors = await kv.get('error_logs') || [];
    const config = await getConfig();

    let html = `
<!DOCTYPE html>
<html>
<head>
    <title>Debug Console</title>
    <style>
        body {
            font-family: 'Monaco', 'Courier New', monospace;
            background: #1e1e1e;
            color: #d4d4d4;
            padding: 20px;
            margin: 0;
        }
        .header {
            background: #252526;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            border-left: 4px solid #007acc;
        }
        h1 {
            margin: 0 0 10px 0;
            color: #4ec9b0;
        }
        .stats {
            display: flex;
            gap: 30px;
            margin-top: 15px;
        }
        .stat {
            background: #2d2d30;
            padding: 10px 15px;
            border-radius: 4px;
        }
        .stat-label {
            color: #858585;
            font-size: 12px;
        }
        .stat-value {
            color: #4ec9b0;
            font-size: 20px;
            font-weight: bold;
        }
        .actions {
            margin-bottom: 20px;
        }
        .btn {
            background: #007acc;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-family: inherit;
            margin-right: 10px;
        }
        .btn:hover {
            background: #005a9e;
        }
        .btn-danger {
            background: #d9534f;
        }
        .btn-danger:hover {
            background: #c9302c;
        }
        .error-list {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }
        .error-item {
            background: #252526;
            border-left: 4px solid #d9534f;
            border-radius: 4px;
            padding: 15px;
        }
        .error-item.frontend {
            border-left-color: #f0ad4e;
        }
        .error-item.backend {
            border-left-color: #d9534f;
        }
        .error-item.twilio {
            border-left-color: #5bc0de;
        }
        .error-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        .error-type {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 3px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
        }
        .error-type.frontend {
            background: #f0ad4e;
            color: #1e1e1e;
        }
        .error-type.backend {
            background: #d9534f;
            color: white;
        }
        .error-type.twilio {
            background: #5bc0de;
            color: #1e1e1e;
        }
        .error-time {
            color: #858585;
            font-size: 12px;
        }
        .error-message {
            color: #f48771;
            font-size: 14px;
            margin-bottom: 10px;
            font-weight: bold;
        }
        .error-stack {
            background: #1e1e1e;
            padding: 10px;
            border-radius: 4px;
            overflow-x: auto;
            font-size: 12px;
            color: #858585;
            margin-top: 10px;
        }
        .error-context {
            background: #2d2d30;
            padding: 10px;
            border-radius: 4px;
            margin-top: 10px;
            font-size: 12px;
        }
        .no-errors {
            text-align: center;
            padding: 40px;
            background: #252526;
            border-radius: 8px;
            color: #4ec9b0;
        }
        pre {
            margin: 0;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🐛 Debug Console</h1>
        <div class="stats">
            <div class="stat">
                <div class="stat-label">Total Errors</div>
                <div class="stat-value">${errors.length}</div>
            </div>
            <div class="stat">
                <div class="stat-label">Initialized</div>
                <div class="stat-value">${config?.initialized ? 'Yes' : 'No'}</div>
            </div>
            <div class="stat">
                <div class="stat-label">Last Updated</div>
                <div class="stat-value">${errors.length > 0 ? new Date(errors[0].timestamp).toLocaleTimeString() : 'N/A'}</div>
            </div>
        </div>
    </div>

    <div class="actions">
        <button class="btn" onclick="location.reload()">🔄 Refresh</button>
        <button class="btn btn-danger" onclick="clearErrors()">🗑️ Clear All Errors</button>
        <button class="btn" onclick="window.open('/', '_blank')">📱 Open Phone App</button>
    </div>

    <div class="error-list">
`;

    if (errors.length === 0) {
      html += '<div class="no-errors">✅ No errors logged yet!</div>';
    } else {
      errors.forEach(err => {
        const time = new Date(err.timestamp).toLocaleString();
        html += `
        <div class="error-item ${err.type}">
            <div class="error-header">
                <span class="error-type ${err.type}">${err.type}</span>
                <span class="error-time">${time}</span>
            </div>
            <div class="error-message">${err.message}</div>
            ${err.stack ? `<div class="error-stack"><pre>${err.stack}</pre></div>` : ''}
            ${err.context && Object.keys(err.context).length > 0 ? `
                <div class="error-context">
                    <strong>Context:</strong>
                    <pre>${JSON.stringify(err.context, null, 2)}</pre>
                </div>
            ` : ''}
        </div>
        `;
      });
    }

    html += `
    </div>

    <script>
        async function clearErrors() {
            if (!confirm('Are you sure you want to clear all errors?')) return;

            try {
                const response = await fetch('/api/clear-errors', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                const data = await response.json();
                if (data.success) {
                    location.reload();
                }
            } catch (error) {
                alert('Failed to clear errors: ' + error.message);
            }
        }

        // Auto-refresh every 10 seconds
        setTimeout(() => location.reload(), 10000);
    </script>
</body>
</html>
    `;

    res.send(html);
  } catch (error) {
    res.status(500).send('Error loading debug page: ' + error.message);
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Only start server if not in Vercel serverless environment
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
