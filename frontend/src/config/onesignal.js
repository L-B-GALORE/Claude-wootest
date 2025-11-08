/**
 * OneSignal Configuration
 *
 * Purpose: Initialize OneSignal Web Push SDK
 *
 * Features:
 * - OneSignal SDK initialization
 * - Permission prompting
 * - Player ID (subscription ID) retrieval
 */

export const ONESIGNAL_APP_ID = '7d31c727-b3c6-4bbf-a0fa-55032d69454d';

/**
 * Initialize OneSignal SDK
 * Call this once when the app loads
 */
export async function initOneSignal() {
  if (typeof window === 'undefined' || !window.OneSignal) {
    console.warn('[OneSignal] SDK not loaded yet');
    return;
  }

  try {
    await window.OneSignal.init({
      appId: ONESIGNAL_APP_ID,
      allowLocalhostAsSecureOrigin: true, // For local development
      notifyButton: {
        enable: false, // We'll use custom UI
      },
    });

    console.log('[OneSignal] Initialized successfully');
  } catch (error) {
    console.error('[OneSignal] Initialization failed:', error);
    throw error;
  }
}

/**
 * Request notification permission and subscribe user
 * Returns the OneSignal Player ID (subscription ID)
 */
export async function requestNotificationPermission() {
  if (!window.OneSignal) {
    throw new Error('OneSignal SDK not loaded');
  }

  try {
    // Request permission
    const permission = await window.OneSignal.Notifications.requestPermission();

    if (!permission) {
      throw new Error('Notification permission denied');
    }

    console.log('[OneSignal] Permission granted');

    // Get the Player ID (subscription ID)
    const playerId = await window.OneSignal.User.PushSubscription.id;

    if (!playerId) {
      throw new Error('Failed to get OneSignal Player ID');
    }

    console.log('[OneSignal] Player ID:', playerId);
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
  if (!window.OneSignal) {
    return false;
  }

  try {
    const permission = await window.OneSignal.Notifications.permission;
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
  if (!window.OneSignal) {
    return null;
  }

  try {
    const playerId = await window.OneSignal.User.PushSubscription.id;
    return playerId || null;
  } catch (error) {
    console.error('[OneSignal] Failed to get Player ID:', error);
    return null;
  }
}
