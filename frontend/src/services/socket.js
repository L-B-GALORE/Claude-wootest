/**
 * Socket.IO Manager Service
 *
 * Purpose: Manage Socket.IO connection for real-time communication with backend
 *
 * Features:
 * - Auto-connect/reconnect with authentication
 * - Event-based communication (Socket.IO protocol over native WebSocket)
 * - Room support
 * - Presence tracking
 * - Comprehensive debugging
 *
 * Implementation:
 * - Uses native WebSocket with Socket.IO protocol encoding/decoding
 * - Compatible with Cloudflare Workers Durable Objects
 * - Manual reconnection logic with exponential backoff
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

import { Decoder, Encoder } from 'socket.io-parser';

class SocketManager {
  constructor() {
    this.ws = null;
    this.encoder = new Encoder();
    this.decoder = new Decoder();
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectTimer = null;
    this.reconnectDelay = 1000; // Start with 1 second
    this.eventHandlers = {};
    this.userId = null;
    this.companyId = null;

    console.log('[SocketManager] Initialized');

    // Setup decoder to handle incoming packets
    this.decoder.on('decoded', (packet) => {
      console.log('[SocketManager] Decoded Socket.IO packet:', packet);
      this.handleSocketIOPacket(packet);
    });
  }

  /**
   * Connect to WebSocket server
   * @param {string} userId - User ID
   * @param {string} companyId - Company ID
   * @param {string} token - JWT token (optional, for future auth)
   */
  connect(userId, companyId, token = null) {
    if (this.ws && this.connected) {
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

    try {
      // Create native WebSocket connection
      this.ws = new WebSocket(socketUrl);

      this.ws.onopen = () => {
        console.log('[SocketManager] ✅ WebSocket connected');
        this.connected = true;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000; // Reset backoff
        this.triggerEvent('connected', { userId: this.userId, companyId: this.companyId });
      };

      this.ws.onmessage = (event) => {
        console.log('[SocketManager] Raw message received:', event.data);
        this.handleRawMessage(event.data);
      };

      this.ws.onerror = (error) => {
        console.error('[SocketManager] ⚠️ WebSocket error:', error);
        this.triggerEvent('error', { error: 'WebSocket error', attempts: this.reconnectAttempts });
      };

      this.ws.onclose = (event) => {
        console.log(`[SocketManager] ❌ WebSocket closed (code: ${event.code}, reason: ${event.reason})`);
        this.connected = false;
        this.triggerEvent('disconnected', { code: event.code, reason: event.reason });

        // Attempt reconnection
        this.attemptReconnect();
      };
    } catch (error) {
      console.error('[SocketManager] Failed to create WebSocket:', error);
      this.triggerEvent('error', { error: error.message });
      this.attemptReconnect();
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  attemptReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[SocketManager] ❌ Max reconnection attempts reached');
      this.triggerEvent('error', { error: 'Max reconnection attempts reached' });
      return;
    }

    this.reconnectAttempts++;
    console.log(`[SocketManager] 🔄 Attempting to reconnect in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      console.log(`[SocketManager] 🔄 Reconnecting now... (attempt ${this.reconnectAttempts})`);
      this.connect(this.userId, this.companyId);
    }, this.reconnectDelay);

    // Exponential backoff: double the delay for next attempt
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 10000); // Max 10 seconds
  }

  /**
   * Handle raw WebSocket message
   */
  handleRawMessage(data) {
    try {
      if (typeof data === 'string') {
        const firstChar = data.charAt(0);

        // Handle Engine.IO ping (type 2)
        if (firstChar === '2') {
          console.log('[SocketManager] 📡 Received ping, sending pong');
          this.ws.send('3'); // Send pong
          return;
        }

        // Handle Engine.IO pong (type 3)
        if (firstChar === '3') {
          console.log('[SocketManager] 📡 Received pong');
          return;
        }

        // Handle Engine.IO message (type 4) - contains Socket.IO packet
        if (firstChar === '4') {
          const socketIOData = data.substring(1);
          console.log('[SocketManager] 📦 Received Socket.IO packet:', socketIOData);
          this.decoder.add(socketIOData);
          return;
        }

        // Try parsing as plain JSON (legacy support)
        try {
          const message = JSON.parse(data);
          console.log('[SocketManager] Received legacy JSON message:', message);
          // Trigger as event if it has a type
          if (message.type) {
            this.triggerEvent(message.type, message);
          }
        } catch (parseError) {
          console.warn('[SocketManager] Unknown message format:', data);
        }
      }
    } catch (error) {
      console.error('[SocketManager] Error handling raw message:', error);
    }
  }

  /**
   * Handle decoded Socket.IO packet
   */
  handleSocketIOPacket(packet) {
    try {
      switch (packet.type) {
        case 0: // CONNECT
          console.log('[SocketManager] ✅ Socket.IO CONNECT packet received:', packet.data);
          break;

        case 1: // DISCONNECT
          console.log('[SocketManager] Socket.IO DISCONNECT packet received');
          break;

        case 2: // EVENT
          // packet.data is an array: [eventName, ...args]
          const [eventName, data] = packet.data;
          console.log(`[SocketManager] 📨 Event '${eventName}' received:`, data);

          // Trigger event handlers
          this.triggerEvent(eventName, data);
          break;

        case 3: // ACK
          console.log('[SocketManager] Socket.IO ACK packet received:', packet);
          break;

        case 4: // CONNECT_ERROR
          console.error('[SocketManager] Socket.IO CONNECT_ERROR:', packet.data);
          break;

        default:
          console.warn('[SocketManager] Unknown Socket.IO packet type:', packet.type);
      }
    } catch (error) {
      console.error('[SocketManager] Error handling Socket.IO packet:', error);
    }
  }

  /**
   * Emit event to server
   * @param {string} eventName - Event name
   * @param {object} data - Event data
   */
  emit(eventName, data = {}) {
    if (!this.ws || !this.connected) {
      console.warn(`[SocketManager] Cannot emit '${eventName}', not connected`);
      return;
    }

    console.log(`[SocketManager] 📤 Emitting '${eventName}':`, data);

    // Create Socket.IO EVENT packet (type 2)
    const packet = {
      type: 2, // EVENT
      nsp: '/',
      data: [eventName, data],
    };

    // Encode the packet
    this.encoder.encode(packet, (encodedPackets) => {
      encodedPackets.forEach((encodedPacket) => {
        // Prepend Engine.IO message type (4)
        const message = '4' + encodedPacket;
        console.log(`[SocketManager] 📤 Sending encoded packet:`, message);
        this.ws.send(message);
      });
    });
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
    console.log('[SocketManager] Disconnecting...');

    // Clear reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.connected = false;
    this.userId = null;
    this.companyId = null;
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;
  }

  /**
   * Check if connected
   * @returns {boolean}
   */
  isConnected() {
    return this.connected && this.ws && this.ws.readyState === WebSocket.OPEN;
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
      readyState: this.ws?.readyState,
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}

// Create singleton instance
const socketManager = new SocketManager();

export default socketManager;
