/**
 * Call Manager Component
 *
 * Purpose: Manage call state and Twilio Device lifecycle
 *
 * Features:
 * - Initialize Twilio Device on mount
 * - Handle incoming calls
 * - Manage call state (idle, ringing, active)
 * - Render appropriate UI (IncomingCallCard or ActiveCallCard)
 */

import { useState, useEffect } from 'react';
import twilioDevice from '../../services/twilio-device';
import IncomingCallCard from './IncomingCallCard';
import ActiveCallCard from './ActiveCallCard';

function CallManager() {
  const [callState, setCallState] = useState('idle'); // idle, ringing, active
  const [currentCall, setCurrentCall] = useState(null);
  const [deviceReady, setDeviceReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    initializeDevice();

    return () => {
      // Cleanup on unmount
      twilioDevice.destroy();
    };
  }, []);

  const initializeDevice = async () => {
    try {
      await twilioDevice.initialize();
      setDeviceReady(true);

      // Listen for incoming calls
      twilioDevice.on('incoming', handleIncomingCall);

      // Listen for errors
      twilioDevice.on('error', handleError);
    } catch (err) {
      console.error('Failed to initialize Twilio Device:', err);
      setError('Failed to initialize calling. Please refresh the page.');
    }
  };

  const handleIncomingCall = (call) => {
    console.log('[CallManager] Incoming call', call);
    setCurrentCall(call);
    setCallState('ringing');

    // Setup call event listeners
    call.on('accept', () => {
      console.log('[CallManager] Call accepted');
      setCallState('active');
    });

    call.on('disconnect', () => {
      console.log('[CallManager] Call disconnected');
      setCallState('idle');
      setCurrentCall(null);
    });

    call.on('reject', () => {
      console.log('[CallManager] Call rejected');
      setCallState('idle');
      setCurrentCall(null);
    });

    call.on('cancel', () => {
      console.log('[CallManager] Call cancelled');
      setCallState('idle');
      setCurrentCall(null);
    });
  };

  const handleError = (error) => {
    console.error('[CallManager] Error:', error);
    setError(error.message || 'An error occurred');
  };

  const handleAnswerCall = () => {
    console.log('[CallManager] Answering call');
    twilioDevice.acceptCall();
  };

  const handleRejectCall = () => {
    console.log('[CallManager] Rejecting call');
    twilioDevice.rejectCall();
    setCallState('idle');
    setCurrentCall(null);
  };

  const handleHangup = () => {
    console.log('[CallManager] Hanging up');
    twilioDevice.hangup();
    setCallState('idle');
    setCurrentCall(null);
  };

  const handleMute = (shouldMute) => {
    console.log('[CallManager] Mute:', shouldMute);
    twilioDevice.mute(shouldMute);
  };

  const handleSendDigit = (digit) => {
    console.log('[CallManager] Send digit:', digit);
    twilioDevice.sendDigit(digit);
  };

  // Don't render anything if idle
  if (callState === 'idle') {
    return null;
  }

  return (
    <>
      {/* Error notification */}
      {error && (
        <div className="fixed top-6 right-6 z-50 bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg">
          {error}
        </div>
      )}

      {/* Incoming call */}
      {callState === 'ringing' && currentCall && (
        <IncomingCallCard
          call={currentCall}
          onAnswer={handleAnswerCall}
          onReject={handleRejectCall}
        />
      )}

      {/* Active call */}
      {callState === 'active' && currentCall && (
        <ActiveCallCard
          call={currentCall}
          onHangup={handleHangup}
          onMute={handleMute}
          onSendDigit={handleSendDigit}
        />
      )}
    </>
  );
}

export default CallManager;
