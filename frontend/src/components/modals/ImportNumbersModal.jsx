/**
 * Import Phone Numbers Modal
 *
 * Purpose: Modal for importing Twilio phone numbers as channels
 *
 * Features:
 * - Fetch available numbers from Twilio
 * - Show checkboxes for selection
 * - Display capabilities (voice, SMS, MMS)
 * - Mark already imported numbers
 * - Bulk import
 *
 * BEFORE MODIFYING:
 * - Will this handle large numbers of phone numbers?
 * - Are we showing capabilities clearly?
 * - Is error handling comprehensive?
 */

import { useState, useEffect } from 'react';
import { X, Phone, MessageSquare, Image } from 'lucide-react';
import api from '../../services/api';

function ImportNumbersModal({ isOpen, onClose, providerId, onSuccess }) {
  const [numbers, setNumbers] = useState([]);
  const [selectedNumbers, setSelectedNumbers] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

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

      setNumbers(response.data.data.numbers);
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

  const handleImport = async () => {
    if (selectedNumbers.size === 0) return;

    setImporting(true);
    setError('');

    try {
      const numbersToImport = numbers.filter((n) => selectedNumbers.has(n.sid));

      const response = await api.post(`/api/v1/providers/${providerId}/import-channels`, {
        numbers: numbersToImport,
      });

      if (!response.data.success) {
        throw new Error(response.data.error?.message || 'Failed to import numbers');
      }

      // Success!
      onSuccess(response.data.data);
      setSelectedNumbers(new Set());
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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
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
            <div className="space-y-2">
              {numbers.map((number) => (
                <div
                  key={number.sid}
                  onClick={() => toggleNumber(number)}
                  className={`
                    border rounded-lg p-4 cursor-pointer transition-colors
                    ${
                      number.imported
                        ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 opacity-60 cursor-not-allowed'
                        : selectedNumbers.has(number.sid)
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700'
                    }
                  `}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedNumbers.has(number.sid)}
                      disabled={number.imported}
                      onChange={() => {}}
                      className="mt-1"
                    />
                    <div className="flex-1">
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
                      <div className="flex gap-3 mt-2">
                        {number.capabilities.voice && (
                          <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                            <Phone className="w-3 h-3" />
                            Voice
                          </div>
                        )}
                        {number.capabilities.sms && (
                          <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                            <MessageSquare className="w-3 h-3" />
                            SMS
                          </div>
                        )}
                        {number.capabilities.mms && (
                          <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                            <Image className="w-3 h-3" />
                            MMS
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
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
    </div>
  );
}

export default ImportNumbersModal;
