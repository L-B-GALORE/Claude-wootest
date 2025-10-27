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
import { Phone, X } from 'lucide-react';
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
      alert('Please enter a phone number');
      return;
    }

    if (!selectedCallerId) {
      alert('Please select a caller ID');
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
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  if (error || callerIds.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Make Call</h2>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="text-center text-red-600 mb-4">
            {error || 'No phone numbers available. You must be assigned to an inbox with a phone number to make calls.'}
          </div>
          <button
            onClick={onCancel}
            className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Make Call</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Caller ID Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Call From
          </label>
          <select
            value={selectedCallerId}
            onChange={(e) => setSelectedCallerId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            {callerIds.map((callerId) => (
              <option key={callerId.phoneNumber} value={callerId.phoneNumber}>
                {callerId.phoneNumber} {callerId.inboxName ? `(${callerId.inboxName})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Phone Number Display */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Call To
          </label>
          <div className="w-full px-4 py-3 text-2xl text-center border border-gray-300 rounded-lg bg-gray-50 font-mono">
            {phoneNumber || 'Enter number'}
          </div>
        </div>

        {/* Dialpad */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {dialpadButtons.map((button) => (
            <button
              key={button.digit}
              onClick={() => handleDialpadClick(button.digit)}
              className="aspect-square flex flex-col items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg text-2xl font-semibold transition-colors"
            >
              <span>{button.digit}</span>
              {button.letters && (
                <span className="text-xs text-gray-500">{button.letters}</span>
              )}
            </button>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleBackspace}
            className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
          >
            ← Delete
          </button>
          <button
            onClick={handleCall}
            disabled={!phoneNumber.trim() || !selectedCallerId}
            className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
          >
            <Phone className="w-5 h-5" />
            Call
          </button>
        </div>
      </div>
    </div>
  );
}

export default OutboundDialer;
