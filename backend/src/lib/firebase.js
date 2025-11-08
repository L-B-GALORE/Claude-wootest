/**
 * Firebase Admin SDK Helper
 *
 * Purpose: Send push notifications using Firebase Cloud Messaging (FCM)
 *
 * Features:
 * - Send notifications to specific tokens
 * - Send to multiple devices
 * - Handle errors and invalid tokens
 */

/**
 * Send push notification using Firebase Cloud Messaging
 *
 * @param {string} serviceAccountJson - Firebase service account JSON (from Cloudflare secret)
 * @param {object} message - FCM message object
 * @param {string} message.token - FCM token for target device
 * @param {object} message.notification - Notification payload
 * @param {string} message.notification.title - Notification title
 * @param {string} message.notification.body - Notification body
 * @param {object} message.data - Optional data payload
 * @returns {Promise<object>} - Result from FCM
 */
export async function sendPushNotification(serviceAccountJson, message) {
  try {
    console.log('[Firebase] Sending push notification...');

    // Parse service account credentials
    const serviceAccount = JSON.parse(serviceAccountJson);

    // Prepare FCM API request
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`;

    // Get OAuth2 access token
    const accessToken = await getAccessToken(serviceAccount);

    // Build FCM message
    const fcmMessage = {
      message: {
        token: message.token,
        notification: message.notification,
        data: message.data || {},
        webpush: {
          notification: {
            icon: '/logo.png',
            badge: '/logo.png',
          },
        },
      },
    };

    // Send to FCM
    const response = await fetch(fcmUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(fcmMessage),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[Firebase] FCM API error:', error);
      throw new Error(error.error?.message || 'Failed to send notification');
    }

    const result = await response.json();
    console.log('[Firebase] ✅ Notification sent successfully');

    return result;
  } catch (error) {
    console.error('[Firebase] Error sending notification:', error);
    throw error;
  }
}

/**
 * Get OAuth2 access token for Firebase Admin SDK
 * Uses service account credentials to get JWT token
 *
 * @param {object} serviceAccount - Firebase service account object
 * @returns {Promise<string>} - Access token
 */
async function getAccessToken(serviceAccount) {
  try {
    // Create JWT assertion
    const now = Math.floor(Date.now() / 1000);
    const expiry = now + 3600; // 1 hour

    const header = {
      alg: 'RS256',
      typ: 'JWT',
    };

    const payload = {
      iss: serviceAccount.client_email,
      sub: serviceAccount.client_email,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: expiry,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
    };

    // Encode JWT
    const jwt = await createJWT(header, payload, serviceAccount.private_key);

    // Exchange JWT for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json();
      console.error('[Firebase] Token exchange failed:', error);
      throw new Error('Failed to get access token');
    }

    const tokenData = await tokenResponse.json();
    return tokenData.access_token;
  } catch (error) {
    console.error('[Firebase] Error getting access token:', error);
    throw error;
  }
}

/**
 * Create JWT token using RS256 algorithm
 * Uses Web Crypto API available in Cloudflare Workers
 *
 * @param {object} header - JWT header
 * @param {object} payload - JWT payload
 * @param {string} privateKeyPem - Private key in PEM format
 * @returns {Promise<string>} - JWT token
 */
async function createJWT(header, payload, privateKeyPem) {
  // Encode header and payload
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const message = `${encodedHeader}.${encodedPayload}`;

  // Import private key
  const privateKey = await importPrivateKey(privateKeyPem);

  // Sign message
  const signature = await crypto.subtle.sign(
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    privateKey,
    new TextEncoder().encode(message)
  );

  // Encode signature
  const encodedSignature = base64UrlEncode(signature);

  return `${message}.${encodedSignature}`;
}

/**
 * Import RSA private key from PEM format
 *
 * @param {string} pem - Private key in PEM format
 * @returns {Promise<CryptoKey>}
 */
async function importPrivateKey(pem) {
  // Remove PEM header/footer and newlines
  const pemContents = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\n/g, '');

  // Decode base64
  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  // Import key
  return await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );
}

/**
 * Base64 URL encode (without padding)
 *
 * @param {string|ArrayBuffer} data - Data to encode
 * @returns {string}
 */
function base64UrlEncode(data) {
  let base64;

  if (data instanceof ArrayBuffer) {
    // Convert ArrayBuffer to base64
    const bytes = new Uint8Array(data);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    base64 = btoa(binary);
  } else {
    // String data
    base64 = btoa(data);
  }

  // Convert to URL-safe base64
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
