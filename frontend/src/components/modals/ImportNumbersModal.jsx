/**
 * Import Phone Numbers Modal
 *
 * Purpose: Modal for importing Twilio phone numbers as channels
 *
 * Features:
 * - Fetch available numbers from Twilio with current config
 * - Show current webhook configuration
 * - Allow capability selection (voice/SMS)
 * - Display what will be changed
 * - Bulk import
 */

import { useState, useEffect } from 'react';
import { X, Phone, MessageSquare, Image, AlertTriangle, ExternalLink } from 'lucide-react';
import api from '../../services/api';

function ImportNumbersModal({ isOpen, onClose, providerId, onSuccess }) {
  const [numbers, setNumbers] = useState([]);
  const [selectedNumbers, setSelectedNumbers] = useState(new Set());
  const [capabilities, setCapabilities] = useState({}); // {sid: {voice: bool, sms: bool}}
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [showHelpModal, setShowHelpModal] = useState(false);

  useEffect(() => {
    if (isOpen && providerId) {
      fetchAvailableNumbers();
    }
  }, [isOpen, providerId]);

  const fetchAvailableNumbers = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.get(`/api/v1/providers/${providerId}/available-numbers`);

      if (!response.data.success) {
        throw new Error(response.data.error?.message || 'Failed to fetch numbers');
      }

      const nums = response.data.data.numbers;
      setNumbers(nums);

      // Initialize capabilities for non-imported numbers (default: enable all available)
      const initialCapabilities = {};
      nums.forEach((num) => {
        if (!num.imported) {
          initialCapabilities[num.sid] = {
            voice: num.capabilities.voice,
            sms: num.capabilities.sms,
          };
        }
      });
      setCapabilities(initialCapabilities);
    } catch (err) {
      const errorMessage = err.response?.data?.error?.message || err.message || 'Failed to fetch numbers';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const toggleNumber = (number) => {
    if (number.imported) return; // Can't select already imported

    const newSelected = new Set(selectedNumbers);
    if (newSelected.has(number.sid)) {
      newSelected.delete(number.sid);
    } else {
      newSelected.add(number.sid);
    }
    setSelectedNumbers(newSelected);
  };

  const toggleCapability = (sid, capability) => {
    setCapabilities((prev) => ({
      ...prev,
      [sid]: {
        ...prev[sid],
        [capability]: !prev[sid]?.[capability],
      },
    }));
  };


  const handleImport = async () => {
    if (selectedNumbers.size === 0) return;

    setImporting(true);
    setError('');

    try {
      const numbersToImport = numbers
        .filter((n) => selectedNumbers.has(n.sid))
        .map((n) => ({
          sid: n.sid,
          phoneNumber: n.phoneNumber,
          capabilities: capabilities[n.sid] || { voice: false, sms: false },
        }));

      const response = await api.post(`/api/v1/providers/${providerId}/import-channels`, {
        numbers: numbersToImport,
      });

      if (!response.data.success) {
        throw new Error(response.data.error?.message || 'Failed to import numbers');
      }

      // Success!
      onSuccess(response.data.data);
      setSelectedNumbers(new Set());
      setCapabilities({});
      onClose();
    } catch (err) {
      const errorMessage = err.response?.data?.error?.message || err.message || 'Failed to import numbers';
      setError(errorMessage);
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  const availableCount = numbers.filter((n) => !n.imported).length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Import Phone Numbers
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {availableCount} available • {numbers.filter((n) => n.imported).length} already imported
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
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Fetching phone numbers from Twilio...
              </p>
            </div>
          ) : numbers.length === 0 ? (
            <div className="text-center py-8">
              <Phone className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600 dark:text-gray-400">
                No phone numbers found in your Twilio account
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {numbers.map((number) => {
                const isSelected = selectedNumbers.has(number.sid);
                const caps = capabilities[number.sid] || {};

                return (
                  <div
                    key={number.sid}
                    className={`
                      border rounded-lg p-4 transition-colors
                      ${
                        number.imported
                          ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 opacity-60'
                          : isSelected
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-gray-200 dark:border-gray-700'
                      }
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={number.imported}
                        onChange={() => toggleNumber(number)}
                        className="mt-1"
                      />
                      <div className="flex-1 space-y-3">
                        {/* Number Info */}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 dark:text-white">
                              {number.phoneNumber}
                            </span>
                            {number.imported && (
                              <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
                                Already imported
                              </span>
                            )}
                          </div>
                          {number.friendlyName && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                              {number.friendlyName}
                            </p>
                          )}
                        </div>

                        {/* Warning Message */}
                        {!number.imported && (
                          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                              <p className="text-xs text-amber-800 dark:text-amber-300">
                                If you're using this phone number for something else outside of this app it may stop working.{' '}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowHelpModal(true);
                                  }}
                                  className="text-amber-900 dark:text-amber-200 underline font-medium hover:text-amber-700 dark:hover:text-amber-100"
                                >
                                  Click here
                                </button>
                                {' '}for more details.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Capability Selection */}
                        {!number.imported && isSelected && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                              <AlertTriangle className="w-4 h-4 text-amber-500" />
                              Select capabilities to configure:
                            </div>
                            <div className="flex gap-4">
                              {number.capabilities.voice && (
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={caps.voice || false}
                                    onChange={() => toggleCapability(number.sid, 'voice')}
                                    className="rounded"
                                  />
                                  <div className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
                                    <Phone className="w-4 h-4" />
                                    Voice
                                  </div>
                                </label>
                              )}
                              {number.capabilities.sms && (
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={caps.sms || false}
                                    onChange={() => toggleCapability(number.sid, 'sms')}
                                    className="rounded"
                                  />
                                  <div className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
                                    <MessageSquare className="w-4 h-4" />
                                    SMS
                                    {number.capabilities.mms && (
                                      <span className="text-xs text-gray-500">& MMS</span>
                                    )}
                                  </div>
                                </label>
                              )}
                            </div>
                            {(caps.voice || caps.sms) && (
                              <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded p-2">
                                This will update:
                                {caps.voice && <div>• Voice → Webhook to our platform</div>}
                                {caps.sms && <div>• SMS → Webhook to our platform</div>}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {selectedNumbers.size} selected
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={selectedNumbers.size === 0 || importing}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {importing ? 'Importing...' : `Import ${selectedNumbers.size} Number${selectedNumbers.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Phone Number Configuration Help
              </h3>
              <button
                onClick={() => setShowHelpModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-gray-600 dark:text-gray-400">
                Help Modal Content Coming Soon
              </p>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ImportNumbersModal;
