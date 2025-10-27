/**
 * Call Manager Component
 *
 * Purpose: Manage call state and Twilio Device lifecycle
 *
 * Features:
 * - Initialize Twilio Device on mount
 * - Handle incoming calls (inbound)
 * - Handle outgoing calls (outbound)
 * - Manage call state (idle, dialing, ringing, active)
 * - Render appropriate UI (OutboundDialer, IncomingCallCard, or ActiveCallCard)
 * - Reusable components for both inbound and outbound scenarios
 */

import { useState, useEffect } from 'react';
import { Phone } from 'lucide-react';
import twilioDevice from '../../services/twilio-device';
import IncomingCallCard from './IncomingCallCard';
import ActiveCallCard from './ActiveCallCard';
import OutboundDialer from './OutboundDialer';

function CallManager() {
  const [callState, setCallState] = useState('idle'); // idle, dialing, ringing, active
  const [currentCall, setCurrentCall] = useState(null);
  const [deviceReady, setDeviceReady] = useState(false);
  const [error, setError] = useState(null);
  const [showDialer, setShowDialer] = useState(false);

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

  const handleMakeCall = async (phoneNumber, callerIdNumber) => {
    console.log('[CallManager] Making outbound call:', { phoneNumber, callerIdNumber });

    try {
      setShowDialer(false);
      setCallState('dialing');

      // Make outbound call
      const call = await twilioDevice.makeCall(phoneNumber, callerIdNumber);
      setCurrentCall(call);

      // Setup call event listeners (same as inbound)
      call.on('accept', () => {
        console.log('[CallManager] Outbound call accepted');
        setCallState('active');
      });

      call.on('disconnect', () => {
        console.log('[CallManager] Outbound call disconnected');
        setCallState('idle');
        setCurrentCall(null);
      });

      call.on('reject', () => {
        console.log('[CallManager] Outbound call rejected');
        setCallState('idle');
        setCurrentCall(null);
      });

      call.on('cancel', () => {
        console.log('[CallManager] Outbound call cancelled');
        setCallState('idle');
        setCurrentCall(null);
      });
    } catch (err) {
      console.error('[CallManager] Failed to make call:', err);
      setError('Failed to make call. Please try again.');
      setCallState('idle');
    }
  };

  return (
    <>
      {/* Error notification */}
      {error && (
        <div className="fixed top-6 right-6 z-50 bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg">
          {error}
        </div>
      )}

      {/* Floating action button to make calls - only show when idle */}
      {callState === 'idle' && deviceReady && (
        <button
          onClick={() => setShowDialer(true)}
          className="fixed bottom-6 right-6 z-40 bg-green-600 text-white p-4 rounded-full shadow-lg hover:bg-green-700 transition-colors"
          title="Make a call"
        >
          <Phone className="w-6 h-6" />
        </button>
      )}

      {/* Outbound dialer */}
      {showDialer && (
        <OutboundDialer
          onCall={handleMakeCall}
          onCancel={() => setShowDialer(false)}
        />
      )}

      {/* Incoming call - only for inbound calls */}
      {callState === 'ringing' && currentCall && (
        <IncomingCallCard
          call={currentCall}
          onAnswer={handleAnswerCall}
          onReject={handleRejectCall}
        />
      )}

      {/* Active call - shared component for BOTH inbound and outbound */}
      {(callState === 'active' || callState === 'dialing') && currentCall && (
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
