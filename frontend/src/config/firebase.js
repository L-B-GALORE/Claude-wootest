/**
 * Firebase Configuration
 *
 * Purpose: Initialize Firebase for push notifications
 */

import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// Firebase configuration
const firebaseConfig = {
  apiKey: 'AIzaSyAcQavjg01TZ6e5_sL2c5L_weuv7fSYsUQ',
  authDomain: 'u9xpd4kaa4dkkkuwpvmsva8mklazfv.firebaseapp.com',
  projectId: 'u9xpd4kaa4dkkkuwpvmsva8mklazfv',
  storageBucket: 'u9xpd4kaa4dkkkuwpvmsva8mklazfv.firebasestorage.app',
  messagingSenderId: '281076227207',
  appId: '1:281076227207:web:87f43f72ce62845520ac22',
};

// Web Push VAPID key (public key)
const VAPID_KEY = 'BBF0stdakLT4eCud_YyWccOZCmzlGGrUCAOB8G6bwJ7tdPXBa99FHG8DU5IQ7qVfo_CTDKvG_bpS_ajTZmxGmoE';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Cloud Messaging
let messaging = null;
try {
  messaging = getMessaging(app);
  console.log('[Firebase] Messaging initialized');
} catch (error) {
  console.error('[Firebase] Failed to initialize messaging:', error);
}

/**
 * Request notification permission and get FCM token
 * @returns {Promise<string|null>} FCM token or null if permission denied
 */
export async function requestNotificationPermission() {
  try {
    console.log('[Firebase] Requesting notification permission...');

    // Check if notifications are supported
    if (!('Notification' in window)) {
      console.error('[Firebase] This browser does not support notifications');
      throw new Error('Notifications not supported');
    }

    // Request permission
    const permission = await Notification.requestPermission();
    console.log('[Firebase] Permission result:', permission);

    if (permission !== 'granted') {
      console.log('[Firebase] Notification permission denied');
      return null;
    }

    // Register service worker
    if ('serviceWorker' in navigator) {
      console.log('[Firebase] Registering service worker...');
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      console.log('[Firebase] Service worker registered:', registration);

      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;
      console.log('[Firebase] Service worker ready');
    }

    // Get FCM token
    console.log('[Firebase] Getting FCM token...');
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
    });

    if (token) {
      console.log('[Firebase] ✅ Got FCM token:', token.substring(0, 20) + '...');
      return token;
    } else {
      console.log('[Firebase] No registration token available');
      return null;
    }
  } catch (error) {
    console.error('[Firebase] Error getting FCM token:', error);
    throw error;
  }
}

/**
 * Listen for foreground messages (when app is open)
 * @param {function} handler - Message handler function
 */
export function onForegroundMessage(handler) {
  if (!messaging) {
    console.error('[Firebase] Messaging not initialized');
    return;
  }

  onMessage(messaging, (payload) => {
    console.log('[Firebase] 📨 Foreground message received:', payload);
    handler(payload);
  });
}

export { messaging };
