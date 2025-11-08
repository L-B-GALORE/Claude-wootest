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
 * Returns the OneSignal Player ID (subscription ID)
 */
export async function requestNotificationPermission() {
  try {
    const OneSignal = await waitForOneSignal();

    // Request permission using slidedown prompt
    await OneSignal.Slidedown.promptPush();

    // Wait a bit for the permission to be processed
    await new Promise(resolve => setTimeout(resolve, 500));

    // Get the Player ID (subscription ID)
    const playerId = await OneSignal.User.PushSubscription.id;

    if (!playerId) {
      throw new Error('Failed to get OneSignal Player ID. User may have denied permission.');
    }

    console.log('[OneSignal] Permission granted, Player ID:', playerId);
    return playerId;
  } catch (error) {
    console.error('[OneSignal] Permission request failed:', error);
    throw error;
  }
}

/**
 * Check if user is subscribed to push notifications
 */
export async function isSubscribed() {
  try {
    const OneSignal = await waitForOneSignal();
    const permission = await OneSignal.Notifications.permission;
    return permission === 'granted';
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
