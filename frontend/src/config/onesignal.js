/**
 * OneSignal Configuration
 *
 * Purpose: Helper functions for OneSignal Web Push SDK
 *
 * Features:
 * - Permission prompting
 * - Player ID (subscription ID) retrieval
 * - Subscription status checking
 *
 * Note: OneSignal is initialized in index.html via OneSignalDeferred
 */

export const ONESIGNAL_APP_ID = '7d31c727-b3c6-4bbf-a0fa-55032d69454d';

/**
 * Wait for OneSignal SDK to be ready
 */
function waitForOneSignal() {
  return new Promise((resolve, reject) => {
    if (window.OneSignal) {
      resolve(window.OneSignal);
      return;
    }

    // Wait up to 10 seconds for SDK to load
    const timeout = setTimeout(() => {
      reject(new Error('OneSignal SDK failed to load'));
    }, 10000);

    const checkInterval = setInterval(() => {
      if (window.OneSignal) {
        clearInterval(checkInterval);
        clearTimeout(timeout);
        resolve(window.OneSignal);
      }
    }, 100);
  });
}

/**
 * Request notification permission and subscribe user
 *
 * @param {string} userId - The authenticated user's ID to link with OneSignal
 * @returns {Promise<string>} The OneSignal Player ID (subscription ID)
 */
export async function requestNotificationPermission(userId) {
  try {
    const OneSignal = await waitForOneSignal();

    console.log('[OneSignal] Starting permission request for user:', userId);

    // Set external_id to link OneSignal subscription to our user database
    // This is required for User Model (SDK v16+) to properly track users
    if (userId) {
      await OneSignal.login(userId);
      console.log('[OneSignal] User logged in with external_id:', userId);
    }

    // Use native browser prompt (more reliable than slidedown)
    // This directly requests browser notification permission
    const permissionGranted = await OneSignal.Notifications.requestPermission();

    console.log('[OneSignal] Permission result:', permissionGranted);

    if (!permissionGranted) {
      throw new Error('Notification permission was denied. Please allow notifications in your browser settings.');
    }

    // Wait for the subscription to be created
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check if we have a push subscription
    const isPushSupported = await OneSignal.Notifications.isPushSupported();
    console.log('[OneSignal] Push supported:', isPushSupported);

    if (!isPushSupported) {
      throw new Error('Push notifications are not supported in this browser.');
    }

    // Get the Player ID (subscription ID)
    const playerId = await OneSignal.User.PushSubscription.id;

    if (!playerId) {
      // Check the actual permission state
      const permission = await OneSignal.Notifications.permission;
      console.error('[OneSignal] No Player ID. Permission state:', permission);

      throw new Error(
        'Failed to create push subscription. ' +
        'Please ensure notifications are allowed in your browser settings and try again.'
      );
    }

    console.log('[OneSignal] Successfully subscribed! Player ID:', playerId);
    return playerId;
  } catch (error) {
    console.error('[OneSignal] Permission request failed:', error);
    throw error;
  }
}

/**
 * Check if user is subscribed to push notifications
 * Returns true only if permission is granted AND there's an active push subscription
 */
export async function isSubscribed() {
  try {
    const OneSignal = await waitForOneSignal();

    // Check if permission is granted
    const permission = await OneSignal.Notifications.permission;
    if (permission !== 'granted') {
      return false;
    }

    // Check if there's an active push subscription with a Player ID
    const playerId = await OneSignal.User.PushSubscription.id;
    return !!playerId;
  } catch (error) {
    console.error('[OneSignal] Failed to check subscription:', error);
    return false;
  }
}

/**
 * Get current OneSignal Player ID if subscribed
 */
export async function getPlayerId() {
  try {
    const OneSignal = await waitForOneSignal();
    const playerId = await OneSignal.User.PushSubscription.id;
    return playerId || null;
  } catch (error) {
    console.error('[OneSignal] Failed to get Player ID:', error);
    return null;
  }
}

/**
 * Get the OneSignal ID (User Model ID)
 */
export async function getOneSignalId() {
  try {
    const OneSignal = await waitForOneSignal();
    const onesignalId = await OneSignal.User.onesignalId;
    return onesignalId || null;
  } catch (error) {
    console.error('[OneSignal] Failed to get OneSignal ID:', error);
    return null;
  }
}

/**
 * Login user to OneSignal (set external_id)
 * Call this when user authenticates to link their account
 *
 * @param {string} userId - The authenticated user's ID
 */
export async function loginUser(userId) {
  try {
    const OneSignal = await waitForOneSignal();
    await OneSignal.login(userId);
    console.log('[OneSignal] User logged in with external_id:', userId);
  } catch (error) {
    console.error('[OneSignal] Login failed:', error);
    throw error;
  }
}

/**
 * Logout user from OneSignal (clear external_id)
 * Call this when user logs out
 */
export async function logoutUser() {
  try {
    const OneSignal = await waitForOneSignal();
    await OneSignal.logout();
    console.log('[OneSignal] User logged out');
  } catch (error) {
    console.error('[OneSignal] Logout failed:', error);
    throw error;
  }
}
