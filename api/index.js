const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const twilio = require('twilio');
const path = require('path');
const { kv } = require('@vercel/kv');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Helper function to get config from KV
async function getConfig() {
  const config = await kv.get('twilio_config');
  return config;
}

// Helper function to save config to KV
async function saveConfig(config) {
  await kv.set('twilio_config', config);
}

// Error logging helper
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

    // Keep only last 100 errors
    const trimmedErrors = errors.slice(0, 100);

    // Save back to KV
    await kv.set('error_logs', trimmedErrors);

    console.error(`[${type}]`, error);
  } catch (logError) {
    console.error('Failed to log error:', logError);
  }
}

// Auto-provision TwiML App and API Key
async function autoProvision(accountSid, authToken, baseUrl) {
  const client = twilio(accountSid, authToken);

  try {
    // Create timestamp for friendly names
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

    // Create TwiML App
    const twimlApp = await client.applications.create({
      friendlyName: `Browser Phone App ${timestamp}`,
      voiceUrl: `${baseUrl}/voice`,
      voiceMethod: 'POST',
      statusCallback: `${baseUrl}/status`,
      statusCallbackMethod: 'POST'
    });

    // Create API Key
    const apiKey = await client.newKeys.create({
      friendlyName: `Browser Phone API Key ${timestamp}`
    });

    return {
      twimlAppSid: twimlApp.sid,
      apiKey: apiKey.sid,
      apiSecret: apiKey.secret
    };
  } catch (error) {
    console.error('Auto-provisioning error:', error);
    throw error;
  }
}

// Setup endpoint - Initialize Twilio credentials
app.post('/api/setup', async (req, res) => {
  try {
    const { accountSid, authToken, phoneNumber } = req.body;

    if (!accountSid || !authToken || !phoneNumber) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get base URL from request
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const baseUrl = `${protocol}://${host}`;

    // Auto-provision TwiML App and API Key
    const provisioned = await autoProvision(accountSid, authToken, baseUrl);

    // Save everything to KV
    const config = {
      accountSid,
      authToken,
      phoneNumber,
      twimlAppSid: provisioned.twimlAppSid,
      apiKey: provisioned.apiKey,
      apiSecret: provisioned.apiSecret,
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

// Reset all configuration
app.post('/api/reset', async (req, res) => {
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

// Query available Twilio phone numbers
app.get('/api/twilio/phone-numbers', async (req, res) => {
  try {
    const account = await kv.get('twilio_account');

    if (!account || !account.accountSid || !account.authToken) {
      return res.status(400).json({ error: 'Twilio credentials not configured' });
    }

    const client = twilio(account.accountSid, account.authToken);

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

// Voice Setup: Save and validate credentials
app.post('/api/setup/voice/credentials', async (req, res) => {
  try {
    const { accountSid, authToken } = req.body;

    if (!accountSid || !authToken) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate credentials by making a test API call
    const client = twilio(accountSid, authToken);

    try {
      // Try to fetch account info to validate credentials
      await client.api.accounts(accountSid).fetch();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid Twilio credentials' });
    }

    // Save credentials to twilio_account
    await kv.set('twilio_account', {
      accountSid,
      authToken,
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

// Voice Setup: Complete configuration
app.post('/api/setup/voice/complete', async (req, res) => {
  try {
    let { accountSid, authToken } = req.body;

    // Check if account already exists (from SMS setup)
    let account = await kv.get('twilio_account');

    // If account exists, use those credentials
    if (account && account.accountSid && account.authToken) {
      accountSid = account.accountSid;
      authToken = account.authToken;
    } else {
      // No existing account, credentials are required
      if (!accountSid || !authToken) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Validate credentials by making a test API call
      const client = twilio(accountSid, authToken);
      try {
        await client.api.accounts(accountSid).fetch();
      } catch (error) {
        return res.status(401).json({ error: 'Invalid Twilio credentials' });
      }

      // Create new account entry if doesn't exist
      account = {
        accountSid,
        authToken,
        sms_setup_completed: false,
        created_at: new Date().toISOString()
      };
    }

    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const baseUrl = `${protocol}://${host}`;

    // Auto-provision TwiML App and API Keys
    const provisioned = await autoProvision(accountSid, authToken, baseUrl);

    // Save TwiML app data with all required URLs for validation
    await kv.set('twiml_app', {
      sid: provisioned.twimlAppSid,
      api_key: provisioned.apiKey,
      api_secret: provisioned.apiSecret,
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

// SMS Setup: Complete configuration
app.post('/api/setup/sms/complete', async (req, res) => {
  try {
    const { accountSid, authToken } = req.body;

    // Check if account already exists (from voice setup)
    let account = await kv.get('twilio_account');

    // If no account exists, credentials are required
    if (!account) {
      if (!accountSid || !authToken) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Validate credentials by making a test API call
      const client = twilio(accountSid, authToken);
      try {
        await client.api.accounts(accountSid).fetch();
      } catch (error) {
        return res.status(401).json({ error: 'Invalid Twilio credentials' });
      }

      // Create new account entry
      account = {
        accountSid,
        authToken,
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

// Add phone number
app.post('/api/numbers/add', async (req, res) => {
  try {
    const { sid, phoneNumber, friendlyName } = req.body;

    if (!sid || !phoneNumber) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const numbers = await kv.get('phone_numbers') || [];

    // Check if number already exists
    if (numbers.find(n => n.sid === sid)) {
      return res.status(400).json({ error: 'Phone number already added' });
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

    res.json({
      success: true,
      message: 'Phone number added successfully'
    });
  } catch (error) {
    await logError('backend', error, { endpoint: '/api/numbers/add' });
    res.status(500).json({ error: error.message });
  }
});

// Configure voice for a number
app.post('/api/numbers/:sid/configure-voice', async (req, res) => {
  try {
    const { sid } = req.params;
    const numbers = await kv.get('phone_numbers') || [];
    const numberIndex = numbers.findIndex(n => n.sid === sid);

    if (numberIndex === -1) {
      return res.status(404).json({ error: 'Phone number not found' });
    }

    const account = await kv.get('twilio_account');
    const twimlApp = await kv.get('twiml_app');

    if (!account || !twimlApp) {
      return res.status(400).json({ error: 'Voice not set up. Please complete voice wizard first.' });
    }

    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const baseUrl = `${protocol}://${host}`;

    // Configure phone number for voice
    const client = twilio(account.accountSid, account.authToken);
    await client.incomingPhoneNumbers(sid).update({
      voiceUrl: `${baseUrl}/voice`,
      voiceMethod: 'POST',
      voiceApplicationSid: twimlApp.sid
    });

    // Update number configuration
    numbers[numberIndex].voice_config = {
      webhook_url: `${baseUrl}/voice`,
      webhook_method: 'POST',
      twiml_app_sid: twimlApp.sid,
      webhook_configured: true,
      configured_at: new Date().toISOString(),
      issues: []
    };

    await kv.set('phone_numbers', numbers);

    res.json({
      success: true,
      message: 'Voice configured successfully'
    });
  } catch (error) {
    await logError('backend', error, { endpoint: '/api/numbers/:sid/configure-voice' });
    res.status(500).json({ error: error.message });
  }
});

// Configure SMS for a number
app.post('/api/numbers/:sid/configure-sms', async (req, res) => {
  try {
    const { sid } = req.params;
    const numbers = await kv.get('phone_numbers') || [];
    const numberIndex = numbers.findIndex(n => n.sid === sid);

    if (numberIndex === -1) {
      return res.status(404).json({ error: 'Phone number not found' });
    }

    const account = await kv.get('twilio_account');

    if (!account || !account.sms_setup_completed) {
      return res.status(400).json({ error: 'SMS not set up. Please complete SMS wizard first.' });
    }

    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const baseUrl = `${protocol}://${host}`;

    // Configure phone number for SMS
    const client = twilio(account.accountSid, account.authToken);
    await client.incomingPhoneNumbers(sid).update({
      smsUrl: `${baseUrl}/sms`,
      smsMethod: 'POST',
      statusCallback: `${baseUrl}/sms-status`,
      statusCallbackMethod: 'POST'
    });

    // Update number configuration
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

// Validate a single number
app.post('/api/numbers/:sid/validate', async (req, res) => {
  try {
    const { sid } = req.params;
    const numbers = await kv.get('phone_numbers') || [];
    const numberIndex = numbers.findIndex(n => n.sid === sid);

    if (numberIndex === -1) {
      return res.status(404).json({ error: 'Phone number not found' });
    }

    const account = await kv.get('twilio_account');
    const twimlApp = await kv.get('twiml_app');

    if (!account) {
      return res.status(400).json({ error: 'Account not configured' });
    }

    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const baseUrl = `${protocol}://${host}`;

    // Fetch actual configuration from Twilio
    const client = twilio(account.accountSid, account.authToken);
    const twilioNumber = await client.incomingPhoneNumbers(sid).fetch();

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

    res.json({
      success: true,
      message: voiceIssues.length + smsIssues.length === 0
        ? 'Validation passed - configuration is correct'
        : `Found ${voiceIssues.length + smsIssues.length} issue(s)`,
      voiceIssues,
      smsIssues
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

// Delete a number
app.delete('/api/numbers/:sid', async (req, res) => {
  try {
    const { sid } = req.params;
    const numbers = await kv.get('phone_numbers') || [];
    const filtered = numbers.filter(n => n.sid !== sid);

    if (filtered.length === numbers.length) {
      return res.status(404).json({ error: 'Phone number not found' });
    }

    await kv.set('phone_numbers', filtered);

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

// Send SMS/MMS
app.post('/api/conversations/:phoneNumber/send', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const { body, mediaUrl } = req.body;

    const account = await kv.get('twilio_account');
    const numbers = await kv.get('phone_numbers') || [];

    if (!account) {
      return res.status(400).json({ error: 'Account not configured' });
    }

    // Find first SMS-enabled number as sender
    const smsNumber = numbers.find(n => n.sms_config && n.sms_config.webhook_configured);

    if (!smsNumber) {
      return res.status(400).json({ error: 'No SMS-enabled phone number configured' });
    }

    // Send message via Twilio
    const client = twilio(account.accountSid, account.authToken);
    const messageParams = {
      body: body || '',
      from: smsNumber.phone_number,
      to: phoneNumber,
      statusCallback: `${req.protocol}://${req.get('host')}/sms-status`
    };

    if (mediaUrl) {
      messageParams.mediaUrl = [mediaUrl];
    }

    const message = await client.messages.create(messageParams);

    // Store in database
    const messages = await kv.get('messages') || [];
    const newMessage = {
      sid: message.sid,
      from: smsNumber.phone_number,
      to: phoneNumber,
      body: body || '',
      media: mediaUrl ? [{ url: mediaUrl }] : [],
      direction: 'outbound',
      timestamp: new Date().toISOString(),
      status: message.status
    };

    messages.unshift(newMessage);
    await kv.set('messages', messages.slice(0, 1000));

    // Update conversation
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

    res.json({
      success: true,
      message: newMessage
    });
  } catch (error) {
    await logError('backend', error, { endpoint: '/api/conversations/:phoneNumber/send' });
    res.status(500).json({ error: error.message });
  }
});

// Mark conversation as read
app.post('/api/conversations/:phoneNumber/mark-read', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const conversations = await kv.get('conversations') || [];

    const conversation = conversations.find(c => c.phone_number === phoneNumber);
    if (conversation) {
      conversation.unread_count = 0;
      await kv.set('conversations', conversations);
    }

    res.json({ success: true });
  } catch (error) {
    await logError('backend', error, { endpoint: '/api/conversations/:phoneNumber/mark-read' });
    res.status(500).json({ error: error.message });
  }
});

// Delete conversation
app.delete('/api/conversations/:phoneNumber', async (req, res) => {
  try {
    const { phoneNumber } = req.params;

    // Delete conversation
    const conversations = await kv.get('conversations') || [];
    const filtered = conversations.filter(c => c.phone_number !== phoneNumber);
    await kv.set('conversations', filtered);

    // Delete messages
    const messages = await kv.get('messages') || [];
    const filteredMessages = messages.filter(m =>
      m.from !== phoneNumber && m.to !== phoneNumber
    );
    await kv.set('messages', filteredMessages);

    res.json({ success: true });
  } catch (error) {
    await logError('backend', error, { endpoint: '/api/conversations/:phoneNumber (DELETE)' });
    res.status(500).json({ error: error.message });
  }
});

// Validate TwiML app configuration
app.post('/api/twiml-app/validate', async (req, res) => {
  try {
    const account = await kv.get('twilio_account');
    const twimlApp = await kv.get('twiml_app');

    if (!account || !twimlApp) {
      return res.status(400).json({ error: 'TwiML app not configured' });
    }

    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const baseUrl = `${protocol}://${host}`;

    const issues = [];

    try {
      // Fetch actual TwiML app from Twilio
      const client = twilio(account.accountSid, account.authToken);
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

// Generate access token for browser
app.get('/api/token', async (req, res) => {
  try {
    const account = await kv.get('twilio_account');
    const twimlApp = await kv.get('twiml_app');

    if (!account || !twimlApp) {
      return res.status(400).json({ error: 'Not initialized. Please run setup first.' });
    }

    const { accountSid } = account;
    const { sid: twimlAppSid, api_key: apiKey, api_secret: apiSecret } = twimlApp;

    // Create access token
    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const identity = 'browser_user';
    const token = new AccessToken(accountSid, apiKey, apiSecret, {
      identity: identity,
      ttl: 3600 // 1 hour
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

// Voice webhook - handles incoming calls
app.post('/voice', async (req, res) => {
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

// Status callback (optional)
app.post('/status', (req, res) => {
  console.log('Call status:', req.body);
  res.sendStatus(200);
});

// SMS webhook - handles incoming SMS/MMS
app.post('/sms', async (req, res) => {
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

    // Store message in database
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
    await kv.set('messages', messages.slice(0, 1000)); // Keep last 1000 messages

    // Update conversation
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

// SMS status callback
app.post('/sms-status', async (req, res) => {
  try {
    const { MessageSid, MessageStatus } = req.body;

    // Update message status in database
    const messages = await kv.get('messages') || [];
    const message = messages.find(m => m.sid === MessageSid);

    if (message) {
      message.status = MessageStatus;
      await kv.set('messages', messages);
    }

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

// Get all errors (API endpoint)
app.get('/api/errors', async (req, res) => {
  try {
    const errors = await kv.get('error_logs') || [];
    res.json({ errors, count: errors.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve errors' });
  }
});

// Clear errors
app.post('/api/clear-errors', async (req, res) => {
  try {
    await kv.set('error_logs', []);
    res.json({ success: true, message: 'Errors cleared' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear errors' });
  }
});

// Debug page - view all errors in browser
app.get('/debug', async (req, res) => {
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
