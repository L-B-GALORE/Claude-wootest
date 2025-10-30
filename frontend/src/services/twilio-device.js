/**
 * Twilio Device Service
 *
 * Purpose: Manage Twilio Voice SDK Device for browser-based calling
 *
 * Features:
 * - Initialize Twilio Device
 * - Handle incoming calls
 * - Make outbound calls
 * - Manage call state
 */

import { Device } from '@twilio/voice-sdk';
import api from './api';

class TwilioDeviceService {
  constructor() {
    this.device = null;
    this.currentCall = null;
    this.eventHandlers = {
      registered: [],
      unregistered: [],
      incoming: [],
      tokenWillExpire: [],
      error: [],
    };
  }

  /**
   * Initialize Twilio Device with access token
   *
   * Note: Microphone permission is NOT requested here.
   * The browser will automatically request microphone access when:
   * - Making an outbound call (device.connect())
   * - Accepting an incoming call (call.accept())
   *
   * This prevents the "microphone in use" indicator from showing
   * immediately on login, which is poor UX.
   */
  async initialize() {
    try {
      // Get access token from backend
      const response = await api.post('/api/v1/voice/token');

      if (!response.data.success) {
        throw new Error('Failed to get access token');
      }

      const { token } = response.data.data;

      console.log('[Twilio Device] Creating Device instance...');

      // Create Device instance (no mic access needed yet)
      this.device = new Device(token, {
        logLevel: 'debug',
        edge: 'ashburn',
      });

      this.setupEventListeners();

      console.log('[Twilio Device] Registering device...');

      // Register the device (no mic access needed for registration)
      await this.device.register();

      console.log('[Twilio Device] Registered successfully (microphone will be requested when making/accepting calls)');

      return this.device;
    } catch (error) {
      console.error('[Twilio Device] Initialization error:', error);

      // Check if this is a "no provider configured" error
      if (error.response?.data?.error?.code === 'PROVIDER_NOT_FOUND') {
        console.log('[Twilio Device] No Twilio provider configured - calling features disabled');
        // Return a special error code so the UI can handle it gracefully
        const providerError = new Error('NO_PROVIDER_CONFIGURED');
        providerError.code = 'NO_PROVIDER_CONFIGURED';
        throw providerError;
      }

      throw error;
    }
  }

  /**
   * Setup Device event listeners
   */
  setupEventListeners() {
    if (!this.device) return;

    // Device registered
    this.device.on('registered', () => {
      console.log('[Twilio Device] Registered');
      this.triggerEvent('registered');
    });

    // Device unregistered
    this.device.on('unregistered', () => {
      console.log('[Twilio Device] Unregistered');
      this.triggerEvent('unregistered');
    });

    // Incoming call
    this.device.on('incoming', (call) => {
      console.log('[Twilio Device] Incoming call:', call.parameters);
      this.currentCall = call;
      this.setupCallListeners(call);
      this.triggerEvent('incoming', call);
    });

    // Token will expire
    this.device.on('tokenWillExpire', async () => {
      console.log('[Twilio Device] Token will expire, refreshing...');
      try {
        const response = await api.post('/api/v1/voice/token');
        if (response.data.success) {
          this.device.updateToken(response.data.data.token);
          console.log('[Twilio Device] Token refreshed');
        }
      } catch (error) {
        console.error('[Twilio Device] Token refresh error:', error);
      }
      this.triggerEvent('tokenWillExpire');
    });

    // Error
    this.device.on('error', (error) => {
      console.error('[Twilio Device] Error:', error);
      this.triggerEvent('error', error);
    });
  }

  /**
   * Setup call-specific event listeners
   */
  setupCallListeners(call) {
    call.on('accept', () => {
      console.log('[Twilio Call] Accepted');
    });

    call.on('disconnect', () => {
      console.log('[Twilio Call] Disconnected');
      this.currentCall = null;
    });

    call.on('reject', () => {
      console.log('[Twilio Call] Rejected');
      this.currentCall = null;
    });

    call.on('cancel', () => {
      console.log('[Twilio Call] Cancelled');
      this.currentCall = null;
    });

    call.on('error', (error) => {
      console.error('[Twilio Call] Error:', error);
    });
  }

  /**
   * Make outbound call
   * @param {string} phoneNumber - Destination phone number
   * @param {string} callerIdNumber - Caller ID to use (must be user's authorized number)
   * @returns {Promise<Call>} - The call object
   */
  async makeCall(phoneNumber, callerIdNumber) {
    if (!this.device) {
      throw new Error('Device not initialized');
    }

    console.log('[Twilio Device] Making outbound call:', { phoneNumber, callerIdNumber });

    try {
      // Connect to destination number with caller ID
      const call = await this.device.connect({
        params: {
          To: phoneNumber,
          From: callerIdNumber,
        },
      });

      this.currentCall = call;
      this.setupCallListeners(call);

      console.log('[Twilio Device] Outbound call initiated');

      return call;
    } catch (error) {
      console.error('[Twilio Device] Failed to make call:', error);
      throw error;
    }
  }

  /**
   * Answer incoming call
   */
  acceptCall() {
    if (this.currentCall) {
      this.currentCall.accept();
    }
  }

  /**
   * Reject incoming call
   */
  rejectCall() {
    if (this.currentCall) {
      this.currentCall.reject();
      this.currentCall = null;
    }
  }

  /**
   * Hang up active call
   */
  hangup() {
    if (this.currentCall) {
      this.currentCall.disconnect();
      this.currentCall = null;
    }
  }

  /**
   * Mute/unmute microphone
   */
  mute(shouldMute) {
    if (this.currentCall) {
      this.currentCall.mute(shouldMute);
    }
  }

  /**
   * Send DTMF tone
   */
  sendDigit(digit) {
    if (this.currentCall) {
      this.currentCall.sendDigits(digit);
    }
  }

  /**
   * Get current call status
   */
  getCallStatus() {
    if (!this.currentCall) return 'idle';
    return this.currentCall.status();
  }

  /**
   * Subscribe to events
   */
  on(event, handler) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].push(handler);
    }
  }

  /**
   * Unsubscribe from events
   */
  off(event, handler) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event] = this.eventHandlers[event].filter(h => h !== handler);
    }
  }

  /**
   * Trigger event handlers
   */
  triggerEvent(event, data) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(handler => handler(data));
    }
  }

  /**
   * Destroy device
   */
  destroy() {
    if (this.device) {
      this.device.unregister();
      this.device.destroy();
      this.device = null;
      this.currentCall = null;
      console.log('[Twilio Device] Destroyed');
    }
  }
}

// Create singleton instance
const twilioDevice = new TwilioDeviceService();

export default twilioDevice;
