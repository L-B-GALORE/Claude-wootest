/**
 * Notification Service
 *
 * Purpose: Manage push notifications
 *
 * Features:
 * - Request notification permission
 * - Register FCM token with backend
 * - Handle foreground notifications
 */

import { requestNotificationPermission, onForegroundMessage } from '../config/firebase';
import api from './api';

class NotificationService {
  constructor() {
    this.token = null;
    this.initialized = false;
  }

  /**
   * Initialize notifications
   * - Request permission
   * - Get FCM token
   * - Register token with backend
   * - Set up foreground message handler
   */
  async initialize() {
    if (this.initialized) {
      console.log('[NotificationService] Already initialized');
      return;
    }

    try {
      console.log('[NotificationService] Initializing...');

      // Request permission and get token
      const token = await requestNotificationPermission();

      if (!token) {
        console.log('[NotificationService] No token - permission denied or not supported');
        return;
      }

      this.token = token;

      // Register token with backend
      await this.registerToken(token);

      // Set up foreground message handler
      this.setupForegroundHandler();

      this.initialized = true;
      console.log('[NotificationService] ✅ Initialized successfully');
    } catch (error) {
      console.error('[NotificationService] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Register FCM token with backend
   * @param {string} token - FCM token
   */
  async registerToken(token) {
    try {
      console.log('[NotificationService] Registering token with backend...');

      await api.post('/api/v1/notifications/register', {
        token,
        deviceInfo: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
        },
      });

      console.log('[NotificationService] ✅ Token registered with backend');
    } catch (error) {
      console.error('[NotificationService] Failed to register token:', error);
      throw error;
    }
  }

  /**
   * Set up handler for foreground messages (when app is open)
   */
  setupForegroundHandler() {
    onForegroundMessage((payload) => {
      console.log('[NotificationService] Foreground message:', payload);

      // Show browser notification even when app is open
      const notificationTitle = payload.notification?.title || 'New Notification';
      const notificationOptions = {
        body: payload.notification?.body || '',
        icon: payload.notification?.icon || '/logo.png',
      };

      new Notification(notificationTitle, notificationOptions);
    });
  }

  /**
   * Send a test notification (for testing)
   */
  async sendTestNotification() {
    try {
      console.log('[NotificationService] Sending test notification...');

      const response = await api.post('/api/v1/notifications/test');

      console.log('[NotificationService] ✅ Test notification sent:', response.data);
      return response.data;
    } catch (error) {
      console.error('[NotificationService] Failed to send test notification:', error);
      throw error;
    }
  }

  /**
   * Get current permission status
   */
  getPermissionStatus() {
    if (!('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission;
  }

  /**
   * Check if notifications are enabled
   */
  isEnabled() {
    return this.initialized && this.token !== null;
  }
}

// Create singleton instance
const notificationService = new NotificationService();

export default notificationService;
