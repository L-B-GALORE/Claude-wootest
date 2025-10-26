/**
 * Incoming Call Card
 *
 * Purpose: Display incoming call with answer/reject buttons
 *
 * Features:
 * - Show caller information
 * - Answer call
 * - Reject call
 * - Call duration timer
 */

import { useState, useEffect } from 'react';
import { Phone, PhoneOff, User } from 'lucide-react';

function IncomingCallCard({ call, onAnswer, onReject }) {
  const [ringDuration, setRingDuration] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setRingDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const callerNumber = call?.parameters?.From || 'Unknown';
  const calledNumber = call?.parameters?.To || '';

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-bounce-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-80">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 rounded-t-2xl">
          <div className="text-center">
            <div className="flex justify-center mb-3">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
                <User className="w-8 h-8 text-white" />
              </div>
            </div>
            <h3 className="text-white text-lg font-semibold mb-1">Incoming Call</h3>
            <p className="text-white/90 text-sm">
              {callerNumber}
            </p>
            {calledNumber && (
              <p className="text-white/70 text-xs mt-1">
                to {calledNumber}
              </p>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          <div className="text-center mb-6">
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Ringing: {formatTime(ringDuration)}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={onReject}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-all transform hover:scale-110">
                <PhoneOff className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Reject</span>
            </button>

            <button
              onClick={onAnswer}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="w-16 h-16 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center transition-all transform hover:scale-110 animate-pulse">
                <Phone className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Answer</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default IncomingCallCard;
