/**
 * Notifications Settings Page
 *
 * Purpose: Manage push notification settings
 *
 * Features:
 * - Enable push notifications for this device
 * - View subscription status
 * - Welcome notification after enabling
 */

import { useState, useEffect } from 'react';
import { Bell, Check, X } from 'lucide-react';
import SettingsLayout from './SettingsLayout';
import { requestNotificationPermission, getPlayerId, getOneSignalId } from '../../config/onesignal';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

function NotificationsPage() {
  const { user } = useAuth();
  const [subscriptionStatus, setSubscriptionStatus] = useState('checking'); // checking, subscribed, not_subscribed
  const [isEnabling, setIsEnabling] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null); // { success: boolean, message: string }

  // Check subscription status on mount
  useEffect(() => {
    checkSubscriptionStatus();
  }, []);

  async function checkSubscriptionStatus() {
    try {
      // Wait for OneSignal SDK
      const OneSignal = await (async () => {
        if (window.OneSignal) return window.OneSignal;
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('OneSignal SDK failed to load')), 10000);
          const checkInterval = setInterval(() => {
            if (window.OneSignal) {
              clearInterval(checkInterval);
              clearTimeout(timeout);
              resolve(window.OneSignal);
            }
          }, 100);
        });
      })();

      // Check if permission is already granted
      const permission = await OneSignal.Notifications.permission;

      if (!permission) {
        setSubscriptionStatus('not_subscribed');
        return;
      }

      // Permission is granted - restore session
      if (user?.id) {
        await OneSignal.login(user.id);
      }

      // Wait for subscription to be ready
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check if we have a valid subscription
      const playerId = await OneSignal.User.PushSubscription.id;
      const osId = await OneSignal.User.onesignalId;

      if (playerId || osId) {
        setSubscriptionStatus('subscribed');
      } else {
        setSubscriptionStatus('not_subscribed');
      }
    } catch (error) {
      console.error('[NotificationsPage] Error checking subscription:', error);
      setSubscriptionStatus('not_subscribed');
    }
  }

  async function handleEnableNotifications() {
    setIsEnabling(true);
    setStatusMessage(null);

    try {
      // Request notification permission and subscribe user
      const playerId = await requestNotificationPermission(user?.id);
      setSubscriptionStatus('subscribed');

      // Send welcome notification
      try {
        await api.post('/api/v1/notifications/test', { playerId });
      } catch (notifError) {
        console.warn('[NotificationsPage] Failed to send welcome notification:', notifError);
        // Don't fail the whole operation if welcome notification fails
      }

      setStatusMessage({
        success: true,
        message: 'Notifications enabled! This device will now receive push notifications when you get new messages.'
      });
    } catch (error) {
      console.error('[NotificationsPage] Failed to enable notifications:', error);
      setStatusMessage({
        success: false,
        message: error.message || 'Failed to enable notifications. Please check browser permissions and try again.'
      });
    } finally {
      setIsEnabling(false);
    }
  }

  return (
    <SettingsLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Push Notifications
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Get instant alerts for incoming SMS messages
          </p>
        </div>

        {/* Subscription Status Card */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                subscriptionStatus === 'subscribed'
                  ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}>
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">
                  {subscriptionStatus === 'checking' && 'Checking status...'}
                  {subscriptionStatus === 'subscribed' && 'Notifications Enabled'}
                  {subscriptionStatus === 'not_subscribed' && 'Notifications Disabled'}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {subscriptionStatus === 'subscribed' && 'This device will receive push notifications'}
                  {subscriptionStatus === 'not_subscribed' && 'Turn on to receive alerts for new messages'}
                </p>
              </div>
            </div>

            {subscriptionStatus === 'subscribed' && (
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <Check className="w-5 h-5" />
                <span className="text-sm font-medium">Active</span>
              </div>
            )}
          </div>
        </div>

        {/* Enable Button */}
        {subscriptionStatus === 'not_subscribed' && (
          <div>
            <button
              onClick={handleEnableNotifications}
              disabled={isEnabling}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white rounded-lg font-medium transition-colors"
            >
              <Bell className="w-5 h-5" />
              {isEnabling ? 'Enabling...' : 'Enable Notifications'}
            </button>

            <div className="mt-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-800 dark:text-blue-400">
                Turn on notifications and this device will get push notifications when you receive a text message.
              </p>
            </div>
          </div>
        )}

        {/* Status Message */}
        {statusMessage && (
          <div className={`p-4 rounded-lg border ${
            statusMessage.success
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
          }`}>
            <div className="flex items-start gap-3">
              {statusMessage.success ? (
                <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
              ) : (
                <X className="w-5 h-5 flex-shrink-0 mt-0.5" />
              )}
              <p className="text-sm">{statusMessage.message}</p>
            </div>
          </div>
        )}

        {/* Info Notice for Subscribed Users */}
        {subscriptionStatus === 'subscribed' && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
              How It Works
            </h4>
            <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
              <li>• You'll get a notification when someone texts your number</li>
              <li>• Works even when the app is closed or in the background</li>
              <li>• Each device needs to enable notifications separately</li>
              <li>• You can disable notifications in your browser settings</li>
            </ul>
          </div>
        )}
      </div>
    </SettingsLayout>
  );
}

export default NotificationsPage;
