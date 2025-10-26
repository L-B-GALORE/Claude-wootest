/**
 * Configure Routing Modal
 *
 * Purpose: Configure routing strategy for an inbox
 *
 * Features:
 * - Select routing strategy (Ring All Users, Voicemail)
 * - Save configuration
 */

import { useState, useEffect } from 'react';
import { X, Phone, Voicemail, Users } from 'lucide-react';
import api from '../../services/api';

function ConfigureRoutingModal({ isOpen, onClose, inbox, onSuccess }) {
  const [selectedStrategy, setSelectedStrategy] = useState('RING_ALL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && inbox) {
      fetchCurrentStrategy();
    }
  }, [isOpen, inbox]);

  const fetchCurrentStrategy = async () => {
    try {
      const response = await api.get(`/api/v1/inboxes/${inbox.id}/routing`);
      if (response.data.success && response.data.data.strategies.length > 0) {
        // Find PHONE channel type strategy
        const phoneStrategy = response.data.data.strategies.find(
          (s) => s.channelType === 'PHONE'
        );
        if (phoneStrategy) {
          setSelectedStrategy(phoneStrategy.strategyType);
        }
      }
    } catch (error) {
      console.error('Failed to fetch routing strategy:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.post(`/api/v1/inboxes/${inbox.id}/routing`, {
        channelType: 'PHONE',
        strategyType: selectedStrategy,
        config: {},
      });

      if (response.data.success) {
        onSuccess();
        onClose();
      }
    } catch (err) {
      const errorMessage = err.response?.data?.error?.message || 'Failed to save routing strategy';
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
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Configure Call Routing
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {inbox?.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              When a call comes in:
            </label>

            <div className="space-y-3">
              {/* Ring All Users */}
              <div
                onClick={() => setSelectedStrategy('RING_ALL')}
                className={`
                  border-2 rounded-lg p-4 cursor-pointer transition-all
                  ${
                    selectedStrategy === 'RING_ALL'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }
                `}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="strategy"
                    checked={selectedStrategy === 'RING_ALL'}
                    onChange={() => setSelectedStrategy('RING_ALL')}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                      <span className="font-medium text-gray-900 dark:text-white">
                        Ring All Users
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Ring all assigned users simultaneously in their browsers. First to answer gets the call.
                    </p>
                  </div>
                </div>
              </div>

              {/* Voicemail - Coming Soon */}
              <div
                className="border-2 rounded-lg p-4 opacity-50 cursor-not-allowed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="strategy"
                    checked={false}
                    disabled
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Voicemail className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-gray-600 dark:text-gray-500">
                        Send to Voicemail
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
                        Coming Soon
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-500">
                      Automatically send calls to voicemail for later review.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {loading ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConfigureRoutingModal;
