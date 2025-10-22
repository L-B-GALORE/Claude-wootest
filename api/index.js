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
    // Create TwiML App
    const twimlApp = await client.applications.create({
      friendlyName: 'Browser Phone App',
      voiceUrl: `${baseUrl}/voice`,
      voiceMethod: 'POST',
      statusCallback: `${baseUrl}/status`,
      statusCallbackMethod: 'POST'
    });

    // Create API Key
    const apiKey = await client.newKeys.create({
      friendlyName: 'Browser Phone API Key'
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

// Generate access token for browser
app.get('/api/token', async (req, res) => {
  try {
    const config = await getConfig();

    if (!config || !config.initialized) {
      return res.status(400).json({ error: 'Not initialized. Please run setup first.' });
    }

    const { accountSid, apiKey, apiSecret, twimlAppSid } = config;

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
    const config = await getConfig();
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    // Check if this is an outgoing call from browser
    if (req.body.To && req.body.To !== config.phoneNumber) {
      // Outgoing call from browser to external number
      const dial = response.dial({
        callerId: config.phoneNumber
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
