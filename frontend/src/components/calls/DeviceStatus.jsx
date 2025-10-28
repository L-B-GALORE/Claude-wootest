/**
 * Device Status Indicator
 *
 * Purpose: Show Twilio Device registration status
 *
 * Features:
 * - Show when device is ready
 * - Show errors if any
 * - Auto-hide when ready
 */

import { useState, useEffect } from 'react';
import { Phone, PhoneOff, AlertCircle } from 'lucide-react';
import twilioDevice from '../../services/twilio-device';

function DeviceStatus() {
  const [status, setStatus] = useState('initializing'); // initializing, ready, error
  const [error, setError] = useState(null);
  const [showIndicator, setShowIndicator] = useState(true);

  useEffect(() => {
    // Listen for registration
    const handleRegistered = () => {
      console.log('[DeviceStatus] Device registered');
      setStatus('ready');
      // Auto-hide after 3 seconds when ready
      setTimeout(() => setShowIndicator(false), 3000);
    };

    // Listen for errors
    const handleError = (err) => {
      console.error('[DeviceStatus] Device error:', err);
      setStatus('error');
      setError(err.message || 'Failed to initialize calling');
    };

    // Listen for unregistered
    const handleUnregistered = () => {
      console.log('[DeviceStatus] Device unregistered');
      setStatus('error');
      setError('Device disconnected');
      setShowIndicator(true);
    };

    twilioDevice.on('registered', handleRegistered);
    twilioDevice.on('error', handleError);
    twilioDevice.on('unregistered', handleUnregistered);

    return () => {
      twilioDevice.off('registered', handleRegistered);
      twilioDevice.off('error', handleError);
      twilioDevice.off('unregistered', handleUnregistered);
    };
  }, []);

  if (!showIndicator) return null;

  return (
    <div className="fixed top-4 right-4 z-40">
      {status === 'initializing' && (
        <div className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-lg px-4 py-3 shadow-lg flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin"></div>
          <div>
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              Initializing calling...
            </p>
            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              Setting up Twilio Device
            </p>
          </div>
        </div>
      )}

      {status === 'ready' && (
        <div className="bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg px-4 py-3 shadow-lg flex items-center gap-3 animate-slide-in">
          <Phone className="w-4 h-4 text-green-600 dark:text-green-400" />
          <div>
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              Ready to receive calls
            </p>
            <p className="text-xs text-green-700 dark:text-green-300">
              You can now answer incoming calls
            </p>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg px-4 py-3 shadow-lg flex items-start gap-3 max-w-sm">
          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              Calling unavailable
            </p>
            <p className="text-xs text-red-700 dark:text-red-300 mt-1">
              {error}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="text-xs text-red-700 dark:text-red-300 underline mt-2"
            >
              Refresh to try again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DeviceStatus;
