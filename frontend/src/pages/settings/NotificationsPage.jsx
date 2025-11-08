/**
 * Notifications Settings Page
 *
 * Purpose: Configure push notifications
 *
 * Features:
 * - Enable/disable push notifications
 * - Test notifications
 * - Show permission status
 */

import { useState, useEffect } from 'react';
import { Bell, BellOff, CheckCircle, XCircle, AlertCircle, Send } from 'lucide-react';
import notificationService from '../../services/notifications';

function NotificationsPage() {
  const [permissionStatus, setPermissionStatus] = useState('default');
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    // Check initial status
    const status = notificationService.getPermissionStatus();
    setPermissionStatus(status);
    setIsEnabled(notificationService.isEnabled());
  }, []);

  const handleEnableNotifications = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await notificationService.initialize();

      const status = notificationService.getPermissionStatus();
      setPermissionStatus(status);
      setIsEnabled(notificationService.isEnabled());

      if (status === 'granted') {
        setSuccess('Push notifications enabled successfully!');
      } else if (status === 'denied') {
        setError('Notification permission denied. Please enable in browser settings.');
      }
    } catch (err) {
      console.error('[NotificationsPage] Failed to enable notifications:', err);
      setError('Failed to enable notifications. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendTest = async () => {
    setTesting(true);
    setError(null);
    setSuccess(null);

    try {
      await notificationService.sendTestNotification();
      setSuccess('Test notification sent! You should receive it shortly.');
    } catch (err) {
      console.error('[NotificationsPage] Failed to send test:', err);
      setError('Failed to send test notification. Please try again.');
    } finally {
      setTesting(false);
    }
  };

  const getStatusIcon = () => {
    if (permissionStatus === 'granted') {
      return <CheckCircle className="w-6 h-6 text-green-500" />;
    } else if (permissionStatus === 'denied') {
      return <XCircle className="w-6 h-6 text-red-500" />;
    } else if (permissionStatus === 'unsupported') {
      return <XCircle className="w-6 h-6 text-gray-400" />;
    } else {
      return <AlertCircle className="w-6 h-6 text-yellow-500" />;
    }
  };

  const getStatusText = () => {
    if (permissionStatus === 'granted') {
      return 'Notifications enabled';
    } else if (permissionStatus === 'denied') {
      return 'Notifications blocked';
    } else if (permissionStatus === 'unsupported') {
      return 'Notifications not supported';
    } else {
      return 'Notifications disabled';
    }
  };

  const getStatusDescription = () => {
    if (permissionStatus === 'granted') {
      return 'You will receive push notifications for new messages and calls.';
    } else if (permissionStatus === 'denied') {
      return 'You have blocked notifications. Enable them in your browser settings to receive alerts.';
    } else if (permissionStatus === 'unsupported') {
      return 'Your browser does not support push notifications.';
    } else {
      return 'Enable notifications to receive real-time alerts for new messages and calls.';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Push Notifications</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Manage push notification settings and test notifications
        </p>
      </div>

      {/* Status Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-start gap-4">
          {getStatusIcon()}
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{getStatusText()}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{getStatusDescription()}</p>

            {/* Browser info */}
            {permissionStatus === 'unsupported' && (
              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <strong>Browser:</strong> {navigator.userAgent}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Alert messages */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
        </div>
      )}

      {/* Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Actions</h3>

        <div className="space-y-3">
          {/* Enable/Disable button */}
          {permissionStatus !== 'granted' && permissionStatus !== 'unsupported' && (
            <button
              onClick={handleEnableNotifications}
              disabled={loading}
              className="w-full px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Bell className="w-5 h-5" />
              <span>{loading ? 'Enabling...' : 'Enable Push Notifications'}</span>
            </button>
          )}

          {/* Test notification button */}
          {isEnabled && (
            <button
              onClick={handleSendTest}
              disabled={testing}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Send className="w-5 h-5" />
              <span>{testing ? 'Sending...' : 'Send Test Notification'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-semibold mb-1">About Push Notifications</p>
            <ul className="list-disc list-inside space-y-1 text-blue-700 dark:text-blue-300">
              <li>Receive notifications even when the app is closed</li>
              <li>Get alerted for new messages and incoming calls</li>
              <li>Notifications work on desktop and mobile browsers</li>
              <li>You can disable notifications anytime in browser settings</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NotificationsPage;
