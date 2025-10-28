/**
 * CompanyRoom Durable Object (with WebSocket Hibernation API)
 *
 * Purpose: Manages WebSocket connections for a single company (tenant).
 * Each company gets its own Durable Object instance, providing:
 * - Real-time user presence tracking (who's online)
 * - Incoming call notifications
 * - New message notifications
 * - Call status updates
 *
 * Architecture:
 * - One Durable Object instance per company
 * - Uses WebSocket Hibernation API for cost efficiency
 * - Only wakes up when processing messages (10x-1000x cheaper!)
 * - Simple JSON message protocol (no Socket.IO overhead)
 *
 * Message Types (JSON):
 * - Client → Server:
 *   - { type: 'heartbeat' } - Keep connection alive
 *   - { type: 'accept_call', data: { callSid } }
 *   - { type: 'reject_call', data: { callSid } }
 *   - { type: 'join_room', data: { room } }
 *
 * - Server → Client:
 *   - { type: 'connected', data: { userId, companyId } }
 *   - { type: 'incoming_call', data: { callSid, from, to, ... } }
 *   - { type: 'call_answered', data: { callSid, answeredBy } }
 *   - { type: 'call_ended', data: { callSid, status } }
 *   - { type: 'user_joined', data: { userId } }
 *   - { type: 'user_left', data: { userId } }
 *   - { type: 'presence_snapshot', data: { users: [...] } }
 *
 * WebSocket Hibernation API Benefits:
 * - Duration charges ONLY when processing messages
 * - FREE when idle (even with connections open!)
 * - Cloudflare handles pings/pongs automatically
 * - 10x-1000x cost savings vs non-hibernation
 */

export class CompanyRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.ctx = state;
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
   * Handle WebSocket connection (Hibernation API)
   */
  async handleWebSocket(request) {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const companyId = url.searchParams.get('companyId');

    if (!userId || !companyId) {
      console.error('[CompanyRoom] WebSocket rejected: Missing userId or companyId');
      return new Response('Missing userId or companyId', { status: 400 });
    }

    console.log(`[CompanyRoom] New WebSocket connection - userId: ${userId}, companyId: ${companyId}`);

    // Create WebSocket pair
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // HIBERNATION API: Use ctx.acceptWebSocket instead of server.accept()
    // This enables hibernation - DO sleeps when idle!
    this.ctx.acceptWebSocket(server);
    console.log(`[CompanyRoom] ✅ WebSocket accepted with Hibernation API for userId: ${userId}`);

    // Store connection metadata using serializeAttachment (survives hibernation)
    server.serializeAttachment({
      userId: userId,
      companyId: companyId,
      connectedAt: Date.now(),
      rooms: [], // Rooms this user has joined
    });

    // Send connected message
    this.sendToWebSocket(server, {
      type: 'connected',
      data: {
        userId: userId,
        companyId: companyId,
        timestamp: new Date().toISOString(),
      },
    });

    // Broadcast user_joined to other connected users
    this.broadcastToOthers(server, {
      type: 'user_joined',
      data: {
        userId: userId,
        timestamp: new Date().toISOString(),
      },
    });

    // Send presence snapshot
    const connectedUsers = this.ctx.getWebSockets().map(ws => {
      const meta = ws.deserializeAttachment();
      return {
        userId: meta.userId,
        status: 'online',
        connectedAt: meta.connectedAt,
      };
    });

    this.sendToWebSocket(server, {
      type: 'presence_snapshot',
      data: {
        users: connectedUsers,
      },
    });

    console.log(`[CompanyRoom] Connection setup complete for userId: ${userId}, total connections: ${this.ctx.getWebSockets().length}`);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  /**
   * HIBERNATION API: Called when WebSocket receives a message
   * DO wakes up, processes this, then hibernates again
   */
  async webSocketMessage(ws, message) {
    const meta = ws.deserializeAttachment();
    const userId = meta.userId;

    try {
      console.log(`[CompanyRoom] 📨 Message from userId: ${userId}`);

      // Parse JSON message
      const msg = JSON.parse(message);
      console.log(`[CompanyRoom] Message type: ${msg.type}`, msg.data || {});

      switch (msg.type) {
        case 'heartbeat':
          console.log(`[CompanyRoom] ❤️ Heartbeat from userId: ${userId}`);
          // Just log it - Cloudflare handles pings/pongs automatically!
          break;

        case 'accept_call':
          console.log(`[CompanyRoom] ✅ User ${userId} accepting call: ${msg.data.callSid}`);
          this.broadcastToOthers(ws, {
            type: 'call_answered',
            data: {
              callSid: msg.data.callSid,
              answeredBy: userId,
              timestamp: new Date().toISOString(),
            },
          });
          break;

        case 'reject_call':
          console.log(`[CompanyRoom] ❌ User ${userId} rejecting call: ${msg.data.callSid}`);
          // Just log it, don't broadcast (call might still ring others)
          break;

        case 'join_room':
          console.log(`[CompanyRoom] 🚪 User ${userId} joining room: ${msg.data.room}`);
          meta.rooms.push(msg.data.room);
          ws.serializeAttachment(meta);
          break;

        case 'leave_room':
          console.log(`[CompanyRoom] 🚪 User ${userId} leaving room: ${msg.data.room}`);
          meta.rooms = meta.rooms.filter(r => r !== msg.data.room);
          ws.serializeAttachment(meta);
          break;

        default:
          console.warn(`[CompanyRoom] ⚠️ Unknown message type '${msg.type}' from userId: ${userId}`);
      }
    } catch (error) {
      console.error(`[CompanyRoom] ❌ Error handling message from userId: ${userId}`, error);
    }

    // DO automatically hibernates after this method returns!
  }

  /**
   * HIBERNATION API: Called when WebSocket closes
   */
  async webSocketClose(ws, code, reason, wasClean) {
    const meta = ws.deserializeAttachment();
    const userId = meta.userId;

    console.log(`[CompanyRoom] 🔌 WebSocket closed for userId: ${userId}, code: ${code}, reason: ${reason || 'none'}`);

    // Broadcast user_left to remaining connections
    this.broadcastToOthers(ws, {
      type: 'user_left',
      data: {
        userId: userId,
        timestamp: new Date().toISOString(),
      },
    });

    console.log(`[CompanyRoom] User ${userId} disconnected, remaining connections: ${this.ctx.getWebSockets().length}`);
  }

  /**
   * Send JSON message to a specific WebSocket
   */
  sendToWebSocket(ws, message) {
    try {
      ws.send(JSON.stringify(message));
      console.log(`[CompanyRoom] 📤 Sent message type '${message.type}' to connection`);
    } catch (error) {
      console.error(`[CompanyRoom] ❌ Error sending message:`, error);
    }
  }

  /**
   * Broadcast message to all connected WebSockets except one
   */
  broadcastToOthers(excludeWs, message) {
    const allWebSockets = this.ctx.getWebSockets();
    let count = 0;

    for (const ws of allWebSockets) {
      if (ws !== excludeWs) {
        this.sendToWebSocket(ws, message);
        count++;
      }
    }

    console.log(`[CompanyRoom] 📢 Broadcasted '${message.type}' to ${count} connections`);
  }

  /**
   * Broadcast message to all connected WebSockets
   */
  broadcastToAll(message) {
    const allWebSockets = this.ctx.getWebSockets();

    for (const ws of allWebSockets) {
      this.sendToWebSocket(ws, message);
    }

    console.log(`[CompanyRoom] 📢 Broadcasted '${message.type}' to all ${allWebSockets.length} connections`);
  }

  /**
   * Broadcast message to users in a specific room
   */
  broadcastToRoom(roomName, message) {
    const allWebSockets = this.ctx.getWebSockets();
    let count = 0;

    for (const ws of allWebSockets) {
      const meta = ws.deserializeAttachment();
      if (meta.rooms.includes(roomName)) {
        this.sendToWebSocket(ws, message);
        count++;
      }
    }

    console.log(`[CompanyRoom] 📢 Broadcasted '${message.type}' to ${count} users in room '${roomName}'`);
  }

  /**
   * Send message to specific users by userId
   */
  sendToUsers(userIds, message) {
    const allWebSockets = this.ctx.getWebSockets();
    let count = 0;

    for (const ws of allWebSockets) {
      const meta = ws.deserializeAttachment();
      if (userIds.includes(meta.userId)) {
        this.sendToWebSocket(ws, message);
        count++;
      }
    }

    console.log(`[CompanyRoom] 📤 Sent '${message.type}' to ${count}/${userIds.length} target users`);
  }

  /**
   * Handle HTTP broadcast request (from webhooks/backend)
   */
  async handleBroadcast(request) {
    try {
      const body = await request.json();
      const { event, data, targetUsers, room } = body;

      console.log(`[CompanyRoom] Broadcast request - event: ${event}, targetUsers: ${targetUsers?.length || 'all'}, room: ${room || 'none'}`);

      const message = {
        type: event,
        data: data,
      };

      // Priority order: targetUsers > room > all
      if (targetUsers && Array.isArray(targetUsers)) {
        // Send to specific users
        console.log(`[CompanyRoom] Broadcasting to ${targetUsers.length} specific users`);
        this.sendToUsers(targetUsers, message);
      } else if (room) {
        // Send to room
        console.log(`[CompanyRoom] Broadcasting to room: ${room}`);
        this.broadcastToRoom(room, message);
      } else {
        // Broadcast to all users
        console.log(`[CompanyRoom] Broadcasting to all users`);
        this.broadcastToAll(message);
      }

      return new Response(JSON.stringify({
        success: true,
        connections: this.ctx.getWebSockets().length,
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
    const allWebSockets = this.ctx.getWebSockets();
    const presence = allWebSockets.map(ws => {
      const meta = ws.deserializeAttachment();
      return {
        userId: meta.userId,
        status: 'online',
        connectedAt: meta.connectedAt,
      };
    });

    return new Response(JSON.stringify({ presence }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
