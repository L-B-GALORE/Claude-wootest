/**
 * Outbound Dialer Component
 *
 * Reusable component for making outbound calls
 *
 * Features:
 * - Phone number input with dialpad
 * - Caller ID selection (which number to call FROM)
 * - Call button
 *
 * Props:
 * - onCall: (phoneNumber, callerIdNumber) => void
 * - onCancel: () => void
 */

import { useState, useEffect } from 'react';
import { Phone, X, Delete } from 'lucide-react';
import api from '../../services/api';

function OutboundDialer({ onCall, onCancel }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [callerIds, setCallerIds] = useState([]);
  const [selectedCallerId, setSelectedCallerId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch available caller IDs when component mounts
  useEffect(() => {
    async function fetchCallerIds() {
      try {
        setLoading(true);
        const response = await api.get('/api/v1/voice/caller-ids');
        const ids = response.data.data.callerIds;
        setCallerIds(ids);

        // Auto-select first caller ID if available
        if (ids.length > 0) {
          setSelectedCallerId(ids[0].phoneNumber);
        }

        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch caller IDs:', err);
        setError('Failed to load available phone numbers');
        setLoading(false);
      }
    }

    fetchCallerIds();
  }, []);

  const handleDialpadClick = (digit) => {
    setPhoneNumber(prev => prev + digit);
  };

  const handleBackspace = () => {
    setPhoneNumber(prev => prev.slice(0, -1));
  };

  const handleCall = () => {
    if (!phoneNumber.trim()) {
      return;
    }

    if (!selectedCallerId) {
      return;
    }

    onCall(phoneNumber.trim(), selectedCallerId);
  };

  const dialpadButtons = [
    { digit: '1', letters: '' },
    { digit: '2', letters: 'ABC' },
    { digit: '3', letters: 'DEF' },
    { digit: '4', letters: 'GHI' },
    { digit: '5', letters: 'JKL' },
    { digit: '6', letters: 'MNO' },
    { digit: '7', letters: 'PQRS' },
    { digit: '8', letters: 'TUV' },
    { digit: '9', letters: 'WXYZ' },
    { digit: '*', letters: '' },
    { digit: '0', letters: '+' },
    { digit: '#', letters: '' },
  ];

  if (loading) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-80">
          <div className="p-6 text-center text-gray-600 dark:text-gray-400">Loading...</div>
        </div>
      </div>
    );
  }

  if (error || callerIds.length === 0) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-80">
          {/* Header */}
          <div className="bg-gradient-to-r from-red-500 to-rose-600 p-4 rounded-t-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-white text-lg font-semibold">Make Call</h3>
              <button
                onClick={onCancel}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-6">
            <div className="text-center text-red-600 dark:text-red-400 text-sm mb-4">
              {error || 'No phone numbers available. You must be assigned to an inbox with a phone number to make calls.'}
            </div>
            <button
              onClick={onCancel}
              className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-80">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-indigo-600 p-4 rounded-t-2xl">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-white text-lg font-semibold">Make Call</h3>
            <button
              onClick={onCancel}
              className="text-white/80 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Caller ID Selection - in header */}
          <div>
            <label className="block text-xs text-white/70 mb-1">
              Calling from
            </label>
            <select
              value={selectedCallerId}
              onChange={(e) => setSelectedCallerId(e.target.value)}
              className="w-full px-2 py-1.5 text-sm bg-white/20 text-white border border-white/30 rounded-lg focus:ring-2 focus:ring-white/50 focus:outline-none"
            >
              {callerIds.map((callerId) => (
                <option key={callerId.phoneNumber} value={callerId.phoneNumber} className="text-gray-900">
                  {callerId.phoneNumber} {callerId.inboxName ? `(${callerId.inboxName})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Body */}
        <div className="p-4">
          {/* Phone Number Display */}
          <div className="mb-3">
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9+\-() ]/g, ''))}
              placeholder="Enter number"
              className="w-full px-3 py-2 text-xl text-center border-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-mono"
            />
          </div>

          {/* Compact Dialpad */}
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {dialpadButtons.map((button) => (
              <button
                key={button.digit}
                onClick={() => handleDialpadClick(button.digit)}
                className="h-12 flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-gray-300 dark:active:bg-gray-500 rounded-lg transition-colors select-none"
              >
                <span className="text-lg font-semibold text-gray-900 dark:text-white">{button.digit}</span>
                {button.letters && (
                  <span className="text-[9px] text-gray-500 dark:text-gray-400 leading-none">{button.letters}</span>
                )}
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleBackspace}
              className="flex-1 px-3 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium flex items-center justify-center gap-1.5"
            >
              <Delete className="w-4 h-4" />
              Delete
            </button>
            <button
              onClick={handleCall}
              disabled={!phoneNumber.trim() || !selectedCallerId}
              className="flex-1 px-3 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-1.5"
            >
              <Phone className="w-4 h-4" />
              Call
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OutboundDialer;
