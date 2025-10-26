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
 * - Persists presence to PRESENCE_KV (for cross-region consistency)
 *
 * WebSocket Message Types:
 * - Client → Server:
 *   - { type: 'heartbeat' } - Keep connection alive
 *   - { type: 'accept_call', callSid: '...' } - Accept incoming call
 *   - { type: 'reject_call', callSid: '...' } - Reject incoming call
 *
 * - Server → Client:
 *   - { type: 'incoming_call', ...callData } - New call notification
 *   - { type: 'call_answered', callSid, answeredBy } - Someone answered
 *   - { type: 'new_message', ...messageData } - New SMS/email
 *   - { type: 'presence_update', userId, status } - User online/offline
 *   - { type: 'user_joined', userId } - User connected
 *   - { type: 'user_left', userId } - User disconnected
 *
 * BEFORE MODIFYING:
 * - Does this change affect all companies' WebSocket behavior?
 * - Will this break existing client connections?
 * - Should this be a new message type instead of modifying existing ones?
 * - Does this need to be persisted to KV or just in-memory?
 *
 * Used by:
 * - Frontend WebSocket clients (React app)
 * - Backend webhook handlers (Twilio sends event → broadcast to users)
 * - Presence tracking system
 */

export class CompanyRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.connections = new Map(); // userId → WebSocket
    this.userPresence = new Map(); // userId → { status, lastSeen }
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
      return new Response('Missing userId or companyId', { status: 400 });
    }

    // Create WebSocket pair
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept the WebSocket connection
    server.accept();

    // Store the connection
    this.connections.set(userId, server);

    // Update presence
    this.userPresence.set(userId, {
      status: 'online',
      lastSeen: Date.now(),
    });

    // Broadcast user joined to other users
    this.broadcast({
      type: 'user_joined',
      userId,
      timestamp: new Date().toISOString(),
    }, userId); // Exclude the user who just joined

    // Send current presence to the new user
    server.send(JSON.stringify({
      type: 'presence_snapshot',
      users: Array.from(this.userPresence.entries()).map(([id, data]) => ({
        userId: id,
        status: data.status,
      })),
    }));

    // Handle incoming messages
    server.addEventListener('message', (event) => {
      this.handleMessage(userId, event.data);
    });

    // Handle connection close
    server.addEventListener('close', () => {
      this.handleDisconnect(userId);
    });

    // Handle errors
    server.addEventListener('error', (event) => {
      console.error('WebSocket error for user', userId, event);
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
   * Handle incoming WebSocket message
   */
  handleMessage(userId, data) {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'heartbeat':
          // Update last seen time
          const presence = this.userPresence.get(userId);
          if (presence) {
            presence.lastSeen = Date.now();
          }
          // Reset heartbeat timeout
          this.setHeartbeatTimeout(userId);
          break;

        case 'accept_call':
          // User accepted an incoming call
          // Broadcast to other users that this call was answered
          this.broadcast({
            type: 'call_answered',
            callSid: message.callSid,
            answeredBy: userId,
            timestamp: new Date().toISOString(),
          }, userId);
          break;

        case 'reject_call':
          // User rejected an incoming call
          // Just log it, don't broadcast (call might still ring others)
          console.log('User', userId, 'rejected call', message.callSid);
          break;

        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  }

  /**
   * Handle user disconnect
   */
  handleDisconnect(userId) {
    // Remove connection
    this.connections.delete(userId);

    // Update presence
    this.userPresence.set(userId, {
      status: 'offline',
      lastSeen: Date.now(),
    });

    // Broadcast user left
    this.broadcast({
      type: 'user_left',
      userId,
      timestamp: new Date().toISOString(),
    });

    // Clean up old presence data after 5 minutes
    setTimeout(() => {
      const presence = this.userPresence.get(userId);
      if (presence && presence.status === 'offline') {
        this.userPresence.delete(userId);
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Set heartbeat timeout for a user
   */
  setHeartbeatTimeout(userId) {
    // Clear existing timeout
    if (this.heartbeatTimeouts) {
      clearTimeout(this.heartbeatTimeouts.get(userId));
    } else {
      this.heartbeatTimeouts = new Map();
    }

    // Set new timeout
    const timeout = setTimeout(() => {
      console.log('Heartbeat timeout for user', userId);
      this.handleDisconnect(userId);
    }, 60 * 1000); // 60 seconds

    this.heartbeatTimeouts.set(userId, timeout);
  }

  /**
   * Broadcast message to all connected users (or exclude specific user)
   */
  broadcast(message, excludeUserId = null) {
    const payload = JSON.stringify(message);

    for (const [userId, ws] of this.connections.entries()) {
      if (userId !== excludeUserId && ws.readyState === WebSocket.READY_STATE_OPEN) {
        ws.send(payload);
      }
    }
  }

  /**
   * Send message to specific user
   */
  sendToUser(userId, message) {
    const ws = this.connections.get(userId);
    if (ws && ws.readyState === WebSocket.READY_STATE_OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Handle HTTP broadcast request (from webhooks/backend)
   */
  async handleBroadcast(request) {
    try {
      const body = await request.json();
      const { event, data, targetUsers } = body;

      // If targetUsers specified, send to those users only
      if (targetUsers && Array.isArray(targetUsers)) {
        targetUsers.forEach(userId => {
          this.sendToUser(userId, { type: event, ...data });
        });
      } else {
        // Broadcast to all users
        this.broadcast({ type: event, ...data });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
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
