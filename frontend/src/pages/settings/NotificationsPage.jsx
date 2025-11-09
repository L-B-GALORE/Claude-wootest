/**
 * Notifications Settings Page
 *
 * Purpose: Manage push notification settings and test notifications
 *
 * Features:
 * - Enable/disable push notifications
 * - View subscription status
 * - Send test notifications
 */

import { useState, useEffect } from 'react';
import { Bell, Check, X, Send } from 'lucide-react';
import SettingsLayout from './SettingsLayout';
import { requestNotificationPermission, isSubscribed, getPlayerId, getOneSignalId } from '../../config/onesignal';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

function NotificationsPage() {
  const { user } = useAuth();
  const [subscriptionStatus, setSubscriptionStatus] = useState('checking'); // checking, subscribed, not_subscribed
  const [playerId, setPlayerId] = useState(null);
  const [oneSignalId, setOneSignalId] = useState(null);
  const [isEnabling, setIsEnabling] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState(null); // { success: boolean, message: string }

  // Check subscription status on mount
  useEffect(() => {
    checkSubscriptionStatus();
  }, []);

  async function checkSubscriptionStatus() {
    try {
      const subscribed = await isSubscribed();
      setSubscriptionStatus(subscribed ? 'subscribed' : 'not_subscribed');

      if (subscribed) {
        const id = await getPlayerId();
        const osId = await getOneSignalId();
        setPlayerId(id);
        setOneSignalId(osId);
      }
    } catch (error) {
      console.error('Failed to check subscription status:', error);
      setSubscriptionStatus('not_subscribed');
    }
  }

  async function handleEnableNotifications() {
    setIsEnabling(true);
    setTestResult(null);

    try {
      // Pass user ID to link OneSignal subscription to our user database
      const playerId = await requestNotificationPermission(user?.id);
      const osId = await getOneSignalId();
      setPlayerId(playerId);
      setOneSignalId(osId);
      setSubscriptionStatus('subscribed');
      setTestResult({ success: true, message: 'Notifications enabled successfully! You will now appear in OneSignal dashboard.' });
    } catch (error) {
      console.error('Failed to enable notifications:', error);
      setTestResult({
        success: false,
        message: error.message || 'Failed to enable notifications. Please check browser permissions.'
      });
    } finally {
      setIsEnabling(false);
    }
  }

  async function handleSendTestNotification() {
    if (!playerId) {
      setTestResult({ success: false, message: 'No Player ID available. Please enable notifications first.' });
      return;
    }

    setIsSendingTest(true);
    setTestResult(null);

    try {
      const response = await api.post('/api/v1/notifications/test', { playerId });
      setTestResult({
        success: true,
        message: response.data.message || 'Test notification sent! Check your browser for the notification.'
      });
    } catch (error) {
      console.error('Failed to send test notification:', error);
      const errorMessage = error.response?.data?.error?.message || error.message || 'Failed to send test notification';
      setTestResult({
        success: false,
        message: errorMessage
      });
    } finally {
      setIsSendingTest(false);
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
            Receive notifications for incoming calls, messages, and important updates
          </p>
        </div>

        {/* Subscription Status Card */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
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
                  Notification Status
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {subscriptionStatus === 'checking' && 'Checking subscription status...'}
                  {subscriptionStatus === 'subscribed' && 'Notifications enabled'}
                  {subscriptionStatus === 'not_subscribed' && 'Notifications disabled'}
                </p>
              </div>
            </div>

            {subscriptionStatus === 'subscribed' ? (
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <Check className="w-5 h-5" />
                <span className="text-sm font-medium">Active</span>
              </div>
            ) : subscriptionStatus === 'not_subscribed' ? (
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-500">
                <X className="w-5 h-5" />
                <span className="text-sm font-medium">Inactive</span>
              </div>
            ) : null}
          </div>

          {/* Subscription IDs (for debugging) */}
          {(oneSignalId || playerId) && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
              {oneSignalId && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mb-1">
                    OneSignal User ID (external_id: {user?.id})
                  </p>
                  <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded font-mono text-gray-700 dark:text-gray-300 block break-all">
                    {oneSignalId}
                  </code>
                </div>
              )}
              {playerId && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mb-1">Player ID (Push Subscription)</p>
                  <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded font-mono text-gray-700 dark:text-gray-300 block break-all">
                    {playerId}
                  </code>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {subscriptionStatus === 'not_subscribed' && (
            <button
              onClick={handleEnableNotifications}
              disabled={isEnabling}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white rounded-lg font-medium transition-colors"
            >
              <Bell className="w-5 h-5" />
              {isEnabling ? 'Enabling...' : 'Enable Notifications'}
            </button>
          )}

          {subscriptionStatus === 'subscribed' && (
            <button
              onClick={handleSendTestNotification}
              disabled={isSendingTest}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
            >
              <Send className="w-5 h-5" />
              {isSendingTest ? 'Sending...' : 'Send Test Notification'}
            </button>
          )}
        </div>

        {/* Result Message */}
        {testResult && (
          <div className={`p-4 rounded-lg border ${
            testResult.success
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
          }`}>
            <div className="flex items-start gap-3">
              {testResult.success ? (
                <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
              ) : (
                <X className="w-5 h-5 flex-shrink-0 mt-0.5" />
              )}
              <p className="text-sm">{testResult.message}</p>
            </div>
          </div>
        )}

        {/* Info Notice */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
            About Push Notifications
          </h4>
          <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
            <li>• Receive instant alerts for incoming calls and messages</li>
            <li>• Works even when the app is closed or in the background</li>
            <li>• You can disable notifications at any time in browser settings</li>
            <li>• Notifications are sent via OneSignal</li>
          </ul>
        </div>
      </div>
    </SettingsLayout>
  );
}

export default NotificationsPage;
