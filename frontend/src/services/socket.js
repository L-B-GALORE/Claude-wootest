/**
 * Socket.IO Manager Service
 *
 * Purpose: Manage Socket.IO connection for real-time communication with backend
 *
 * Features:
 * - Auto-connect/reconnect with authentication
 * - Event-based communication
 * - Room support
 * - Presence tracking
 * - Comprehensive debugging
 *
 * Events emitted by this service:
 * - 'connected' - Connected to server
 * - 'disconnected' - Disconnected from server
 * - 'error' - Connection error
 *
 * Events from server:
 * - 'incoming_call' - New incoming call
 * - 'call_answered' - Call was answered
 * - 'call_ended' - Call ended
 * - 'new_message' - New SMS/email
 * - 'presence_update' - User status changed
 * - 'user_joined' - User connected
 * - 'user_left' - User disconnected
 * - 'presence_snapshot' - Current online users
 */

import { io } from 'socket.io-client';

class SocketManager {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.eventHandlers = {};
    this.userId = null;
    this.companyId = null;

    console.log('[SocketManager] Initialized');
  }

  /**
   * Connect to Socket.IO server
   * @param {string} userId - User ID
   * @param {string} companyId - Company ID
   * @param {string} token - JWT token (optional, for future auth)
   */
  connect(userId, companyId, token = null) {
    if (this.socket && this.connected) {
      console.log('[SocketManager] Already connected');
      return;
    }

    this.userId = userId;
    this.companyId = companyId;

    console.log(`[SocketManager] Connecting... userId: ${userId}, companyId: ${companyId}`);

    // Build backend URL (Socket.IO client needs HTTP/HTTPS, not WS/WSS)
    const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;

    // Build WebSocket endpoint URL
    const socketUrl = `${apiUrl}/ws/company/${companyId}`;

    console.log(`[SocketManager] Socket.IO URL: ${socketUrl}`);
    console.log(`[SocketManager] Query params: userId=${userId}, companyId=${companyId}`);

    // Create Socket.IO client
    this.socket = io(socketUrl, {
      transports: ['websocket'], // Force WebSocket transport only (no polling for Cloudflare Workers)
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      autoConnect: true,
      query: {
        userId: userId,
        companyId: companyId,
      },
      auth: {
        token: token,
      },
      withCredentials: true,
    });

    console.log('[SocketManager] Socket.IO client created with config:', {
      url: socketUrl,
      transports: ['websocket'],
      userId,
      companyId,
    });

    this.setupEventListeners();
  }

  /**
   * Setup Socket.IO event listeners
   */
  setupEventListeners() {
    if (!this.socket) return;

    console.log('[SocketManager] Setting up event listeners');

    // Connection events
    this.socket.on('connect', () => {
      console.log('[SocketManager] ✅ Connected to server, socket ID:', this.socket.id);
      this.connected = true;
      this.reconnectAttempts = 0;
      this.triggerEvent('connected', { userId: this.userId, companyId: this.companyId });
    });

    this.socket.on('disconnect', (reason) => {
      console.log(`[SocketManager] ❌ Disconnected from server, reason: ${reason}`);
      this.connected = false;
      this.triggerEvent('disconnected', { reason });
    });

    this.socket.on('connect_error', (error) => {
      this.reconnectAttempts++;
      console.error(`[SocketManager] ⚠️ Connection error (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}):`, error.message);
      this.triggerEvent('error', { error: error.message, attempts: this.reconnectAttempts });
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`[SocketManager] 🔄 Reconnected after ${attemptNumber} attempts`);
      this.connected = true;
      this.reconnectAttempts = 0;
    });

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`[SocketManager] 🔄 Reconnection attempt ${attemptNumber}`);
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('[SocketManager] ⚠️ Reconnection error:', error.message);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('[SocketManager] ❌ Reconnection failed after maximum attempts');
      this.triggerEvent('error', { error: 'Reconnection failed' });
    });

    // Server events - incoming calls
    this.socket.on('incoming_call', (data) => {
      console.log('[SocketManager] 📞 Incoming call event:', data);
      this.triggerEvent('incoming_call', data);
    });

    this.socket.on('call_answered', (data) => {
      console.log('[SocketManager] ✅ Call answered event:', data);
      this.triggerEvent('call_answered', data);
    });

    this.socket.on('call_ended', (data) => {
      console.log('[SocketManager] 📵 Call ended event:', data);
      this.triggerEvent('call_ended', data);
    });

    // Server events - messages
    this.socket.on('new_message', (data) => {
      console.log('[SocketManager] 💬 New message event:', data);
      this.triggerEvent('new_message', data);
    });

    // Server events - presence
    this.socket.on('presence_update', (data) => {
      console.log('[SocketManager] 👤 Presence update event:', data);
      this.triggerEvent('presence_update', data);
    });

    this.socket.on('user_joined', (data) => {
      console.log('[SocketManager] 👋 User joined event:', data);
      this.triggerEvent('user_joined', data);
    });

    this.socket.on('user_left', (data) => {
      console.log('[SocketManager] 👋 User left event:', data);
      this.triggerEvent('user_left', data);
    });

    this.socket.on('presence_snapshot', (data) => {
      console.log('[SocketManager] 📸 Presence snapshot:', data);
      this.triggerEvent('presence_snapshot', data);
    });

    // Catch-all for any other events
    this.socket.onAny((eventName, ...args) => {
      console.log(`[SocketManager] 📨 Received event '${eventName}':`, args);
    });
  }

  /**
   * Emit event to server
   * @param {string} eventName - Event name
   * @param {object} data - Event data
   */
  emit(eventName, data = {}) {
    if (!this.socket || !this.connected) {
      console.warn(`[SocketManager] Cannot emit '${eventName}', not connected`);
      return;
    }

    console.log(`[SocketManager] 📤 Emitting '${eventName}':`, data);
    this.socket.emit(eventName, data);
  }

  /**
   * Send heartbeat to server
   */
  sendHeartbeat() {
    this.emit('heartbeat', {
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
    this.emit('accept_call', { callSid });
  }

  /**
   * Reject incoming call
   * @param {string} callSid - Twilio Call SID
   */
  rejectCall(callSid) {
    console.log(`[SocketManager] Rejecting call: ${callSid}`);
    this.emit('reject_call', { callSid });
  }

  /**
   * Join a room
   * @param {string} roomName - Room name (e.g., 'inbox:123')
   */
  joinRoom(roomName) {
    console.log(`[SocketManager] Joining room: ${roomName}`);
    this.emit('join_room', { room: roomName });
  }

  /**
   * Leave a room
   * @param {string} roomName - Room name
   */
  leaveRoom(roomName) {
    console.log(`[SocketManager] Leaving room: ${roomName}`);
    this.emit('leave_room', { room: roomName });
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
      this.socket.disconnect();
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
    return this.connected && this.socket?.connected;
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
      socketId: this.socket?.id,
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}

// Create singleton instance
const socketManager = new SocketManager();

export default socketManager;
