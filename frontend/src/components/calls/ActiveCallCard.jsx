/**
 * Active Call Card
 *
 * Purpose: Display active call with controls
 *
 * Features:
 * - Show call duration
 * - Hang up button
 * - Mute/unmute button
 * - Hold button (placeholder)
 * - Dial pad toggle
 */

import { useState, useEffect } from 'react';
import { Phone, Mic, MicOff, Pause, Grid3x3 } from 'lucide-react';
import DialPad from './DialPad';

function ActiveCallCard({ call, onHangup, onMute, onSendDigit }) {
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [showDialPad, setShowDialPad] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleMuteToggle = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    onMute(newMutedState);
  };

  const handleDigitPress = (digit) => {
    onSendDigit(digit);
  };

  const callerNumber = call?.parameters?.From || call?.parameters?.To || 'In Call';

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-80">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6 rounded-t-2xl">
          <div className="text-center">
            <h3 className="text-white text-lg font-semibold mb-1">Active Call</h3>
            <p className="text-white/90 text-sm">
              {callerNumber}
            </p>
            <p className="text-white/70 text-xs mt-2">
              {formatTime(callDuration)}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Dial Pad */}
          {showDialPad && (
            <div className="mb-4">
              <DialPad onDigitPress={handleDigitPress} />
            </div>
          )}

          {/* Control Buttons */}
          <div className="grid grid-cols-4 gap-4">
            {/* Mute */}
            <button
              onClick={handleMuteToggle}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all ${
                isMuted
                  ? 'bg-red-100 dark:bg-red-900/30'
                  : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {isMuted ? (
                <MicOff className="w-5 h-5 text-red-600 dark:text-red-400" />
              ) : (
                <Mic className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              )}
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {isMuted ? 'Unmute' : 'Mute'}
              </span>
            </button>

            {/* Hold (Coming Soon) */}
            <button
              disabled
              className="flex flex-col items-center gap-1 p-3 rounded-xl bg-gray-100 dark:bg-gray-700 opacity-50 cursor-not-allowed"
            >
              <Pause className="w-5 h-5 text-gray-400" />
              <span className="text-xs text-gray-400">Hold</span>
            </button>

            {/* Dial Pad */}
            <button
              onClick={() => setShowDialPad(!showDialPad)}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all ${
                showDialPad
                  ? 'bg-blue-100 dark:bg-blue-900/30'
                  : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <Grid3x3 className={`w-5 h-5 ${showDialPad ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`} />
              <span className="text-xs text-gray-600 dark:text-gray-400">Keypad</span>
            </button>

            {/* Hang Up */}
            <button
              onClick={onHangup}
              className="flex flex-col items-center gap-1 p-3 rounded-xl bg-red-500 hover:bg-red-600 transition-all"
            >
              <Phone className="w-5 h-5 text-white transform rotate-135" />
              <span className="text-xs text-white">End</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ActiveCallCard;
