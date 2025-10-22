const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const twilio = require('twilio');
const { kv } = require('@vercel/kv');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Helper function to get config from KV
async function getConfig() {
  const config = await kv.get('twilio_config');
  return config;
}

// Helper function to save config to KV
async function saveConfig(config) {
  await kv.set('twilio_config', config);
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
    console.error('Setup error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check if initialized
app.get('/api/status', async (req, res) => {
  try {
    const config = await getConfig();
    res.json({ initialized: !!config?.initialized });
  } catch (error) {
    res.json({ initialized: false });
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
    console.error('Token generation error:', error);
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
    console.error('Voice webhook error:', error);
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
