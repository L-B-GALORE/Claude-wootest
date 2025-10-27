/**
 * CompanyRoom Durable Object
 *
 * Purpose: Manages WebSocket connections for a single company (tenant).
 * Each company gets its own Durable Object instance, providing:
 * - Real-time user presence tracking (who's online)
 * - Incoming call notifications
 * - New message notifications
 * - Call status updates
 * - Typing indicators (future)
 *
 * Architecture:
 * - One Durable Object instance per company
 * - Holds all active WebSocket connections for that company's users
 * - Stores presence state in-memory (fast)
 * - Uses Socket.IO protocol for real-time communication
 *
 * Socket.IO Events:
 * - Client → Server:
 *   - 'heartbeat' - Keep connection alive
 *   - 'accept_call' - Accept incoming call
 *   - 'reject_call' - Reject incoming call
 *
 * - Server → Client:
 *   - 'incoming_call' - New call notification
 *   - 'call_answered' - Someone answered
 *   - 'call_ended' - Call disconnected
 *   - 'new_message' - New SMS/email
 *   - 'presence_update' - User online/offline
 *   - 'user_joined' - User connected
 *   - 'user_left' - User disconnected
 *
 * Protocol:
 * - Uses Socket.IO wire protocol over WebSockets
 * - Engine.IO packet types: 0=open, 1=close, 2=ping, 3=pong, 4=message
 * - Socket.IO packet types: 0=CONNECT, 1=DISCONNECT, 2=EVENT, 3=ACK, 4=CONNECT_ERROR
 */

import { Encoder, Decoder } from 'socket.io-parser';

export class CompanyRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.connections = new Map(); // userId → { ws: WebSocket, encoder: Encoder, decoder: Decoder, rooms: Set }
    this.userPresence = new Map(); // userId → { status, lastSeen }
    this.heartbeatTimeouts = new Map(); // userId → timeout
    console.log('[CompanyRoom] Initialized new CompanyRoom instance');
  }

  /**
   * Fetch handler - handles WebSocket upgrades and HTTP requests
   */
  async fetch(request) {
    const url = new URL(request.url);

    // Handle WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request);
    }

    // Handle HTTP requests to this Durable Object
    if (url.pathname === '/broadcast') {
      return this.handleBroadcast(request);
    }

    if (url.pathname === '/presence') {
      return this.handleGetPresence(request);
    }

    return new Response('CompanyRoom Durable Object', { status: 200 });
  }

  /**
   * Handle WebSocket connection
   */
  async handleWebSocket(request) {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const companyId = url.searchParams.get('companyId');

    if (!userId || !companyId) {
      console.error('[CompanyRoom] WebSocket rejected: Missing userId or companyId');
      return new Response('Missing userId or companyId', { status: 400 });
    }

    console.log(`[CompanyRoom] New WebSocket connection request from userId: ${userId}, companyId: ${companyId}`);

    // Create WebSocket pair
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept the WebSocket connection
    server.accept();
    console.log(`[CompanyRoom] WebSocket accepted for userId: ${userId}`);

    // Create Socket.IO encoder and decoder for this connection
    const encoder = new Encoder();
    const decoder = new Decoder();

    // Store the connection with Socket.IO components
    this.connections.set(userId, {
      ws: server,
      encoder: encoder,
      decoder: decoder,
      rooms: new Set(), // Socket.IO rooms this user has joined
    });

    console.log(`[CompanyRoom] Stored connection for userId: ${userId}, total connections: ${this.connections.size}`);

    // Update presence
    this.userPresence.set(userId, {
      status: 'online',
      lastSeen: Date.now(),
    });

    // Send Socket.IO CONNECT packet (type 0)
    const connectPacket = {
      type: 0, // CONNECT
      nsp: '/', // namespace
      data: {
        sid: userId, // session ID
        userId: userId,
        companyId: companyId,
      },
    };
    this.sendSocketIOPacket(userId, connectPacket);
    console.log(`[CompanyRoom] Sent CONNECT packet to userId: ${userId}`);

    // Broadcast user_joined event to other users
    this.emitToOthers(userId, 'user_joined', {
      userId,
      timestamp: new Date().toISOString(),
    });
    console.log(`[CompanyRoom] Broadcasted user_joined for userId: ${userId}`);

    // Send current presence snapshot to the new user
    const presenceData = Array.from(this.userPresence.entries()).map(([id, data]) => ({
      userId: id,
      status: data.status,
    }));
    this.emitToUser(userId, 'presence_snapshot', { users: presenceData });
    console.log(`[CompanyRoom] Sent presence_snapshot to userId: ${userId}, users: ${presenceData.length}`);

    // Setup decoder to handle incoming packets
    decoder.on('decoded', (packet) => {
      console.log(`[CompanyRoom] Decoded packet from userId: ${userId}`, JSON.stringify(packet));
      this.handleSocketIOPacket(userId, packet);
    });

    // Handle incoming messages
    server.addEventListener('message', (event) => {
      console.log(`[CompanyRoom] Raw message from userId: ${userId}, data type: ${typeof event.data}`);
      this.handleRawMessage(userId, event.data);
    });

    // Handle connection close
    server.addEventListener('close', () => {
      console.log(`[CompanyRoom] WebSocket closed for userId: ${userId}`);
      this.handleDisconnect(userId);
    });

    // Handle errors
    server.addEventListener('error', (event) => {
      console.error(`[CompanyRoom] WebSocket error for userId: ${userId}`, event);
      this.handleDisconnect(userId);
    });

    // Set up heartbeat timeout (60 seconds)
    this.setHeartbeatTimeout(userId);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  /**
   * Handle raw WebSocket message (can be Socket.IO or Engine.IO format)
   */
  handleRawMessage(userId, data) {
    const connection = this.connections.get(userId);
    if (!connection) {
      console.error(`[CompanyRoom] No connection found for userId: ${userId}`);
      return;
    }

    try {
      // Socket.IO client sends messages as strings starting with packet type
      // Engine.IO packet types: 2=ping, 3=pong, 4=message
      // Socket.IO uses Engine.IO type 4 (message) for all its packets

      if (typeof data === 'string') {
        const firstChar = data.charAt(0);

        // Handle Engine.IO ping (type 2)
        if (firstChar === '2') {
          console.log(`[CompanyRoom] Received ping from userId: ${userId}`);
          // Send pong (type 3)
          connection.ws.send('3');
          console.log(`[CompanyRoom] Sent pong to userId: ${userId}`);

          // Update heartbeat
          const presence = this.userPresence.get(userId);
          if (presence) {
            presence.lastSeen = Date.now();
          }
          this.setHeartbeatTimeout(userId);
          return;
        }

        // Handle Engine.IO message (type 4) - contains Socket.IO packet
        if (firstChar === '4') {
          // Remove the Engine.IO packet type prefix
          const socketIOData = data.substring(1);
          console.log(`[CompanyRoom] Received Socket.IO packet from userId: ${userId}, data: ${socketIOData}`);

          // Decode Socket.IO packet
          connection.decoder.add(socketIOData);
          return;
        }

        // Try to parse as legacy JSON format for backward compatibility
        try {
          const message = JSON.parse(data);
          console.log(`[CompanyRoom] Received legacy JSON message from userId: ${userId}`, message);
          this.handleLegacyMessage(userId, message);
        } catch (parseError) {
          console.warn(`[CompanyRoom] Unknown message format from userId: ${userId}, data: ${data}`);
        }
      }
    } catch (error) {
      console.error(`[CompanyRoom] Error handling raw message from userId: ${userId}`, error);
    }
  }

  /**
   * Handle Socket.IO packet
   */
  handleSocketIOPacket(userId, packet) {
    console.log(`[CompanyRoom] Handling Socket.IO packet from userId: ${userId}, type: ${packet.type}`);

    try {
      switch (packet.type) {
        case 0: // CONNECT
          console.log(`[CompanyRoom] Client CONNECT from userId: ${userId}`);
          break;

        case 1: // DISCONNECT
          console.log(`[CompanyRoom] Client DISCONNECT from userId: ${userId}`);
          this.handleDisconnect(userId);
          break;

        case 2: // EVENT
          // packet.data is an array: [eventName, ...args]
          const [eventName, ...args] = packet.data;
          console.log(`[CompanyRoom] Received event '${eventName}' from userId: ${userId}, args:`, args);
          this.handleSocketIOEvent(userId, eventName, args);
          break;

        case 3: // ACK
          console.log(`[CompanyRoom] Received ACK from userId: ${userId}, id: ${packet.id}`);
          break;

        case 4: // CONNECT_ERROR
          console.error(`[CompanyRoom] CONNECT_ERROR from userId: ${userId}`, packet.data);
          break;

        default:
          console.warn(`[CompanyRoom] Unknown Socket.IO packet type: ${packet.type}`);
      }
    } catch (error) {
      console.error(`[CompanyRoom] Error handling Socket.IO packet from userId: ${userId}`, error);
    }
  }

  /**
   * Handle Socket.IO event
   */
  handleSocketIOEvent(userId, eventName, args) {
    console.log(`[CompanyRoom] Processing event '${eventName}' from userId: ${userId}`);

    // Extract first argument as data (Socket.IO convention)
    const data = args[0] || {};

    switch (eventName) {
      case 'heartbeat':
        console.log(`[CompanyRoom] Heartbeat from userId: ${userId}`);
        const presence = this.userPresence.get(userId);
        if (presence) {
          presence.lastSeen = Date.now();
        }
        this.setHeartbeatTimeout(userId);
        break;

      case 'accept_call':
        console.log(`[CompanyRoom] User ${userId} accepting call:`, data.callSid);
        this.emitToOthers(userId, 'call_answered', {
          callSid: data.callSid,
          answeredBy: userId,
          timestamp: new Date().toISOString(),
        });
        break;

      case 'reject_call':
        console.log(`[CompanyRoom] User ${userId} rejecting call:`, data.callSid);
        // Just log it, don't broadcast (call might still ring others)
        break;

      case 'join_room':
        console.log(`[CompanyRoom] User ${userId} joining room:`, data.room);
        this.joinRoom(userId, data.room);
        break;

      case 'leave_room':
        console.log(`[CompanyRoom] User ${userId} leaving room:`, data.room);
        this.leaveRoom(userId, data.room);
        break;

      default:
        console.warn(`[CompanyRoom] Unknown event '${eventName}' from userId: ${userId}`);
    }
  }

  /**
   * Handle legacy JSON message (backward compatibility)
   */
  handleLegacyMessage(userId, message) {
    console.log(`[CompanyRoom] Handling legacy message from userId: ${userId}, type: ${message.type}`);

    switch (message.type) {
      case 'heartbeat':
        const presence = this.userPresence.get(userId);
        if (presence) {
          presence.lastSeen = Date.now();
        }
        this.setHeartbeatTimeout(userId);
        break;

      case 'accept_call':
        this.broadcast({
          type: 'call_answered',
          callSid: message.callSid,
          answeredBy: userId,
          timestamp: new Date().toISOString(),
        }, userId);
        break;

      case 'reject_call':
        console.log('[CompanyRoom] User', userId, 'rejected call', message.callSid);
        break;

      default:
        console.warn('[CompanyRoom] Unknown legacy message type:', message.type);
    }
  }

  /**
   * Handle user disconnect
   */
  handleDisconnect(userId) {
    console.log(`[CompanyRoom] Handling disconnect for userId: ${userId}`);

    // Remove connection
    this.connections.delete(userId);

    // Clear heartbeat timeout
    if (this.heartbeatTimeouts.has(userId)) {
      clearTimeout(this.heartbeatTimeouts.get(userId));
      this.heartbeatTimeouts.delete(userId);
    }

    // Update presence
    this.userPresence.set(userId, {
      status: 'offline',
      lastSeen: Date.now(),
    });

    // Broadcast user left
    this.emitToAll('user_left', {
      userId,
      timestamp: new Date().toISOString(),
    });

    console.log(`[CompanyRoom] User ${userId} disconnected, remaining connections: ${this.connections.size}`);

    // Clean up old presence data after 5 minutes
    setTimeout(() => {
      const presence = this.userPresence.get(userId);
      if (presence && presence.status === 'offline') {
        this.userPresence.delete(userId);
        console.log(`[CompanyRoom] Cleaned up presence data for userId: ${userId}`);
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Set heartbeat timeout for a user
   */
  setHeartbeatTimeout(userId) {
    // Clear existing timeout
    if (this.heartbeatTimeouts.has(userId)) {
      clearTimeout(this.heartbeatTimeouts.get(userId));
    }

    // Set new timeout
    const timeout = setTimeout(() => {
      console.log(`[CompanyRoom] Heartbeat timeout for userId: ${userId}`);
      this.handleDisconnect(userId);
    }, 60 * 1000); // 60 seconds

    this.heartbeatTimeouts.set(userId, timeout);
  }

  /**
   * Send Socket.IO packet to a user
   */
  sendSocketIOPacket(userId, packet) {
    const connection = this.connections.get(userId);
    if (!connection) {
      console.warn(`[CompanyRoom] Cannot send packet, no connection for userId: ${userId}`);
      return;
    }

    const { ws, encoder } = connection;
    if (ws.readyState !== WebSocket.READY_STATE_OPEN) {
      console.warn(`[CompanyRoom] Cannot send packet, WebSocket not open for userId: ${userId}`);
      return;
    }

    try {
      // Encode the Socket.IO packet
      encoder.encode(packet, (encodedPackets) => {
        encodedPackets.forEach((encodedPacket) => {
          // Prepend Engine.IO message type (4)
          const message = '4' + encodedPacket;
          ws.send(message);
          console.log(`[CompanyRoom] Sent packet to userId: ${userId}, message: ${message}`);
        });
      });
    } catch (error) {
      console.error(`[CompanyRoom] Error sending Socket.IO packet to userId: ${userId}`, error);
    }
  }

  /**
   * Emit event to a specific user
   */
  emitToUser(userId, eventName, data = {}) {
    console.log(`[CompanyRoom] Emitting '${eventName}' to userId: ${userId}`, data);
    const packet = {
      type: 2, // EVENT
      nsp: '/',
      data: [eventName, data],
    };
    this.sendSocketIOPacket(userId, packet);
  }

  /**
   * Emit event to all connected users
   */
  emitToAll(eventName, data = {}) {
    console.log(`[CompanyRoom] Emitting '${eventName}' to all users (${this.connections.size} connections)`, data);
    for (const userId of this.connections.keys()) {
      this.emitToUser(userId, eventName, data);
    }
  }

  /**
   * Emit event to all users except one
   */
  emitToOthers(excludeUserId, eventName, data = {}) {
    console.log(`[CompanyRoom] Emitting '${eventName}' to others (excluding ${excludeUserId})`, data);
    for (const userId of this.connections.keys()) {
      if (userId !== excludeUserId) {
        this.emitToUser(userId, eventName, data);
      }
    }
  }

  /**
   * Emit event to users in a specific room
   */
  emitToRoom(roomName, eventName, data = {}) {
    console.log(`[CompanyRoom] Emitting '${eventName}' to room '${roomName}'`, data);
    let count = 0;
    for (const [userId, connection] of this.connections.entries()) {
      if (connection.rooms.has(roomName)) {
        this.emitToUser(userId, eventName, data);
        count++;
      }
    }
    console.log(`[CompanyRoom] Emitted to ${count} users in room '${roomName}'`);
  }

  /**
   * Join a room
   */
  joinRoom(userId, roomName) {
    const connection = this.connections.get(userId);
    if (connection) {
      connection.rooms.add(roomName);
      console.log(`[CompanyRoom] User ${userId} joined room '${roomName}', total rooms: ${connection.rooms.size}`);
    }
  }

  /**
   * Leave a room
   */
  leaveRoom(userId, roomName) {
    const connection = this.connections.get(userId);
    if (connection) {
      connection.rooms.delete(roomName);
      console.log(`[CompanyRoom] User ${userId} left room '${roomName}', remaining rooms: ${connection.rooms.size}`);
    }
  }

  /**
   * Broadcast message to all connected users (legacy method for backward compatibility)
   */
  broadcast(message, excludeUserId = null) {
    console.log(`[CompanyRoom] Legacy broadcast (excluding ${excludeUserId})`, message);
    const payload = JSON.stringify(message);

    for (const [userId, connection] of this.connections.entries()) {
      if (userId !== excludeUserId && connection.ws.readyState === WebSocket.READY_STATE_OPEN) {
        connection.ws.send(payload);
      }
    }
  }

  /**
   * Send message to specific user (legacy method for backward compatibility)
   */
  sendToUser(userId, message) {
    console.log(`[CompanyRoom] Legacy sendToUser to ${userId}`, message);
    const connection = this.connections.get(userId);
    if (connection && connection.ws.readyState === WebSocket.READY_STATE_OPEN) {
      connection.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Handle HTTP broadcast request (from webhooks/backend)
   */
  async handleBroadcast(request) {
    try {
      const body = await request.json();
      const { event, data, targetUsers, room } = body;

      console.log(`[CompanyRoom] Broadcast request - event: ${event}, targetUsers: ${targetUsers?.length || 'all'}, room: ${room || 'none'}`);

      // Priority order: targetUsers > room > all
      if (targetUsers && Array.isArray(targetUsers)) {
        // Send to specific users
        console.log(`[CompanyRoom] Broadcasting to ${targetUsers.length} specific users`);
        targetUsers.forEach(userId => {
          this.emitToUser(userId, event, data);
        });
      } else if (room) {
        // Send to room
        console.log(`[CompanyRoom] Broadcasting to room: ${room}`);
        this.emitToRoom(room, event, data);
      } else {
        // Broadcast to all users
        console.log(`[CompanyRoom] Broadcasting to all users`);
        this.emitToAll(event, data);
      }

      return new Response(JSON.stringify({
        success: true,
        connections: this.connections.size,
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('[CompanyRoom] Broadcast error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  /**
   * Handle get presence request
   */
  async handleGetPresence(request) {
    const presence = Array.from(this.userPresence.entries()).map(([userId, data]) => ({
      userId,
      status: data.status,
      lastSeen: data.lastSeen,
    }));

    return new Response(JSON.stringify({ presence }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
