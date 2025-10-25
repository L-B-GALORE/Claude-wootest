/**
 * Connect Twilio Modal
 *
 * Purpose: Modal for connecting Twilio provider
 *
 * Features:
 * - Account SID input
 * - Auth Token input (password field)
 * - Validation
 * - Error handling
 * - Success callback
 *
 * BEFORE MODIFYING:
 * - Will this break the connection flow?
 * - Are we validating inputs properly?
 * - Is error handling comprehensive?
 */

import { useState } from 'react';
import { X } from 'lucide-react';
import api from '../../services/api';

function ConnectTwilioModal({ isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    accountSid: '',
    authToken: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/api/v1/providers/twilio', formData);

      if (!response.data.success) {
        throw new Error(response.data.error?.message || 'Failed to connect Twilio');
      }

      // Success!
      setFormData({ accountSid: '', authToken: '' });
      onSuccess(response.data.data.provider);
      onClose();
    } catch (err) {
      console.error('Twilio connection error:', err);
      const errorMessage = err.response?.data?.error?.message || err.message || 'Failed to connect Twilio';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Connect Twilio Account
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Account SID
              </label>
              <input
                type="text"
                name="accountSid"
                value={formData.accountSid}
                onChange={handleChange}
                required
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Found in your Twilio Console
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Auth Token
              </label>
              <input
                type="password"
                name="authToken"
                value={formData.authToken}
                onChange={handleChange}
                required
                placeholder="••••••••••••••••••••••••••••••••"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Found in your Twilio Console (keep this secret!)
              </p>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>What happens next:</strong>
              <br />
              We'll create a TwiML App, generate API keys, and securely store your credentials.
              You'll then be able to import your phone numbers.
            </p>
          </div>

          {/* Footer */}
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white rounded-lg transition-colors"
            >
              {loading ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ConnectTwilioModal;
