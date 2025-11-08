/**
 * Firebase Cloud Messaging Service Worker
 *
 * Purpose: Handle push notifications in the background (when app is closed)
 *
 * This service worker:
 * - Receives push notifications from Firebase
 * - Shows notifications even when browser/tab is closed
 * - Handles notification clicks (opens app)
 */

// Import Firebase scripts for service worker
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Firebase configuration (same as main app)
const firebaseConfig = {
  apiKey: 'AIzaSyAcQavjg01TZ6e5_sL2c5L_weuv7fSYsUQ',
  authDomain: 'u9xpd4kaa4dkkkuwpvmsva8mklazfv.firebaseapp.com',
  projectId: 'u9xpd4kaa4dkkkuwpvmsva8mklazfv',
  storageBucket: 'u9xpd4kaa4dkkkuwpvmsva8mklazfv.firebasestorage.app',
  messagingSenderId: '281076227207',
  appId: '1:281076227207:web:87f43f72ce62845520ac22',
};

// Initialize Firebase in service worker
firebase.initializeApp(firebaseConfig);

// Get messaging instance
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message received:', payload);

  const notificationTitle = payload.notification?.title || 'New Notification';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: payload.notification?.icon || '/logo.png',
    badge: '/logo.png',
    data: payload.data || {},
    tag: payload.data?.tag || 'default',
    requireInteraction: false,
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification);

  event.notification.close();

  // Open app when notification is clicked
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }

      // Otherwise open new window
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

console.log('[SW] Firebase messaging service worker loaded');
