/**
 * WebSocket Manager Service (using PartySocket)
 *
 * Purpose: Manage WebSocket connection for real-time communication with backend
 *
 * Features:
 * - Auto-reconnection built-in (no manual code needed!)
 * - Simple event-based communication
 * - Buffering when disconnected
 * - Comprehensive debugging
 *
 * Events from server:
 * - 'connected' - Connected to server
 * - 'incoming_call' - New incoming call
 * - 'call_answered' - Call was answered
 * - 'call_ended' - Call ended
 * - 'new_message' - New SMS/email
 * - 'user_joined' - User connected
 * - 'user_left' - User disconnected
 * - 'presence_snapshot' - Current online users
 */

import PartySocket from 'partysocket';

class SocketManager {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.eventHandlers = {};
    this.userId = null;
    this.companyId = null;

    console.log('[SocketManager] Initialized');
  }

  /**
   * Connect to WebSocket server
   * @param {string} userId - User ID
   * @param {string} companyId - Company ID
   */
  connect(userId, companyId) {
    if (this.socket && this.connected) {
      console.log('[SocketManager] Already connected');
      return;
    }

    this.userId = userId;
    this.companyId = companyId;

    console.log(`[SocketManager] Connecting... userId: ${userId}, companyId: ${companyId}`);

    // Build WebSocket URL
    const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
    const wsUrl = apiUrl.replace('https://', 'wss://').replace('http://', 'ws://');
    const socketUrl = `${wsUrl}/ws/company/${companyId}?userId=${userId}&companyId=${companyId}`;

    console.log(`[SocketManager] WebSocket URL: ${socketUrl}`);

    // Create PartySocket connection (auto-reconnection built-in!)
    this.socket = new PartySocket(socketUrl, {
      // Optional configuration
      maxReconnectionDelay: 10000, // Max 10 seconds between reconnects
      minReconnectionDelay: 1000,  // Min 1 second
      reconnectionDelayGrowFactor: 1.3,
      maxEnqueuedMessages: 100, // Buffer messages when disconnected
      debug: false, // Set to true for PartySocket internal logs
    });

    this.setupEventListeners();
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    if (!this.socket) return;

    console.log('[SocketManager] Setting up event listeners');

    // Connection events
    this.socket.addEventListener('open', () => {
      console.log('[SocketManager] ✅ WebSocket connected');
      this.connected = true;
      this.triggerEvent('socket_connected', { userId: this.userId, companyId: this.companyId });
    });

    this.socket.addEventListener('close', (event) => {
      console.log(`[SocketManager] ❌ WebSocket closed (code: ${event.code}, reason: ${event.reason || 'none'})`);
      this.connected = false;
      this.triggerEvent('socket_disconnected', { code: event.code, reason: event.reason });
    });

    this.socket.addEventListener('error', (error) => {
      console.error('[SocketManager] ⚠️ WebSocket error:', error);
      this.triggerEvent('socket_error', { error: error.message || 'WebSocket error' });
    });

    // Message events
    this.socket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log(`[SocketManager] 📨 Received message type '${message.type}':`, message.data || {});

        // Trigger event handlers
        this.triggerEvent(message.type, message.data || {});
      } catch (error) {
        console.error('[SocketManager] Error parsing message:', error);
      }
    });
  }

  /**
   * Send message to server
   * @param {string} type - Message type
   * @param {object} data - Message data
   */
  send(type, data = {}) {
    if (!this.socket) {
      console.warn(`[SocketManager] Cannot send message '${type}', not connected`);
      return;
    }

    const message = { type, data };
    console.log(`[SocketManager] 📤 Sending message type '${type}':`, data);

    // PartySocket handles buffering if disconnected!
    this.socket.send(JSON.stringify(message));
  }

  /**
   * Send heartbeat to server
   */
  sendHeartbeat() {
    this.send('heartbeat', {
      userId: this.userId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Accept incoming call
   * @param {string} callSid - Twilio Call SID
   */
  acceptCall(callSid) {
    console.log(`[SocketManager] Accepting call: ${callSid}`);
    this.send('accept_call', { callSid });
  }

  /**
   * Reject incoming call
   * @param {string} callSid - Twilio Call SID
   */
  rejectCall(callSid) {
    console.log(`[SocketManager] Rejecting call: ${callSid}`);
    this.send('reject_call', { callSid });
  }

  /**
   * Join a room
   * @param {string} roomName - Room name (e.g., 'inbox:123')
   */
  joinRoom(roomName) {
    console.log(`[SocketManager] Joining room: ${roomName}`);
    this.send('join_room', { room: roomName });
  }

  /**
   * Leave a room
   * @param {string} roomName - Room name
   */
  leaveRoom(roomName) {
    console.log(`[SocketManager] Leaving room: ${roomName}`);
    this.send('leave_room', { room: roomName });
  }

  /**
   * Subscribe to an event
   * @param {string} event - Event name
   * @param {function} handler - Event handler function
   */
  on(event, handler) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(handler);
    console.log(`[SocketManager] Subscribed to event '${event}', total handlers: ${this.eventHandlers[event].length}`);
  }

  /**
   * Unsubscribe from an event
   * @param {string} event - Event name
   * @param {function} handler - Event handler function
   */
  off(event, handler) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event] = this.eventHandlers[event].filter(h => h !== handler);
      console.log(`[SocketManager] Unsubscribed from event '${event}', remaining handlers: ${this.eventHandlers[event].length}`);
    }
  }

  /**
   * Trigger event handlers
   * @param {string} event - Event name
   * @param {any} data - Event data
   */
  triggerEvent(event, data) {
    if (this.eventHandlers[event]) {
      console.log(`[SocketManager] Triggering ${this.eventHandlers[event].length} handler(s) for event '${event}'`);
      this.eventHandlers[event].forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`[SocketManager] Error in event handler for '${event}':`, error);
        }
      });
    }
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    if (this.socket) {
      console.log('[SocketManager] Disconnecting...');
      this.socket.close();
      this.socket = null;
      this.connected = false;
      this.userId = null;
      this.companyId = null;
    }
  }

  /**
   * Check if connected
   * @returns {boolean}
   */
  isConnected() {
    return this.connected && this.socket && this.socket.readyState === WebSocket.OPEN;
  }

  /**
   * Get connection status
   * @returns {object}
   */
  getStatus() {
    return {
      connected: this.connected,
      userId: this.userId,
      companyId: this.companyId,
      readyState: this.socket?.readyState,
    };
  }
}

// Create singleton instance
const socketManager = new SocketManager();

export default socketManager;
