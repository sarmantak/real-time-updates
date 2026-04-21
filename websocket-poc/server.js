/**
 * WebSocket Server - Node.js/Express
 * Implements bi-directional real-time communication via WebSocket.
 * 
 * Architecture:
 * - WebSocket upgrade: Converts HTTP connection to WebSocket
 * - Message router: Routes messages by type (message, presence, ping/pong)
 * - Connection manager: Tracks active clients with metadata
 * - Broadcast system: Send to all or specific clients
 */

import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT || 3000;

// Create HTTP server (required for WebSocket upgrade)
const server = createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Store connected clients with metadata
const clients = new Map(); // Map<ws, { id, username, joinedAt, lastSeen }>

// Message history for new clients
const messageHistory = [];
const MAX_HISTORY = 20;

/**
 * Generate unique client ID
 */
function generateClientId() {
  return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Broadcast message to all connected clients
 * @param {Object} message - Message to broadcast
 * @param {WebSocket} excludeClient - Optional client to exclude
 */
function broadcast(message, excludeClient = null) {
  const jsonMessage = JSON.stringify(message);
  
  wss.clients.forEach((client) => {
    if (client.readyState === 1 && client !== excludeClient) { // 1 = OPEN
      client.send(jsonMessage);
    }
  });
}

/**
 * Send message to specific client
 * @param {WebSocket} client - Target client
 * @param {Object} message - Message to send
 */
function sendToClient(client, message) {
  if (client.readyState === 1) { // 1 = OPEN
    client.send(JSON.stringify(message));
  }
}

/**
 * Get all active users
 */
function getActiveUsers() {
  return Array.from(clients.values())
    .filter(c => c.username)
    .map(c => ({ username: c.username, joinedAt: c.joinedAt }));
}

/**
 * Handle WebSocket connection
 */
wss.on('connection', (ws) => {
  const clientId = generateClientId();
  const clientData = {
    id: clientId,
    username: null,
    joinedAt: new Date().toISOString(),
    lastSeen: Date.now(),
  };

  clients.set(ws, clientData);
  console.log(`[WS] Client connected: ${clientId}. Total clients: ${wss.clients.size}`);

  // Send connection confirmation with client ID
  sendToClient(ws, {
    type: 'connected',
    clientId,
    message: 'Connected to WebSocket server',
    clientCount: wss.clients.size,
  });

  // Send message history to new client
  if (messageHistory.length > 0) {
    sendToClient(ws, {
      type: 'history',
      messages: messageHistory,
      count: messageHistory.length,
    });
  }

  /**
   * Handle incoming messages
   */
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      const sender = clients.get(ws);

      // Update last seen
      sender.lastSeen = Date.now();

      console.log(`[WS] Message from ${sender.username || clientId}:`, message.type);

      // Route message by type
      if (message.type === 'message') {
        // Chat message
        const chatMessage = {
          type: 'message',
          text: message.text,
          username: sender.username || 'Anonymous',
          timestamp: new Date().toISOString(),
          clientId: sender.id,
          clientCount: wss.clients.size,
        };

        // Add to history
        messageHistory.push(chatMessage);
        if (messageHistory.length > MAX_HISTORY) {
          messageHistory.shift();
        }

        // Broadcast to all clients
        broadcast(chatMessage);

      } else if (message.type === 'presence') {
        // Presence update (online, typing, offline)
        sender.username = message.username;

        const presenceMessage = {
          type: 'presence',
          username: message.username,
          status: message.status, // 'online', 'typing', 'offline'
          users: getActiveUsers(),
          clientCount: wss.clients.size,
        };

        broadcast(presenceMessage);

      } else if (message.type === 'ping') {
        // Keep-alive ping
        sendToClient(ws, {
          type: 'pong',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.log('[WS] Error parsing message:', err.message);
      sendToClient(ws, {
        type: 'error',
        message: 'Invalid message format',
      });
    }
  });

  /**
   * Handle client disconnect
   */
  ws.on('close', () => {
    const clientData = clients.get(ws);
    console.log(`[WS] Client disconnected: ${clientData.username || clientId}. Remaining: ${wss.clients.size}`);

    // Notify other clients
    if (clientData.username) {
      broadcast({
        type: 'system',
        message: `${clientData.username} left the chat`,
        users: getActiveUsers(),
        clientCount: wss.clients.size,
      });
    }

    clients.delete(ws);
  });

  /**
   * Handle errors
   */
  ws.on('error', (err) => {
    console.log('[WS] Error:', err.message);
    clients.delete(ws);
  });
});

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    connectedClients: wss.clients.size,
    messageHistorySize: messageHistory.length,
  });
});

/**
 * GET /stats
 * Server statistics endpoint
 */
app.get('/stats', (req, res) => {
  const users = getActiveUsers();
  res.json({
    status: 'ok',
    connectedClients: wss.clients.size,
    activeUsers: users,
    messageHistorySize: messageHistory.length,
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`\n🚀 WebSocket Server started on http://localhost:${PORT}`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}`);
  console.log(`📊 Open http://localhost:${PORT} in your browser to test\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n[WS] SIGTERM received. Shutting down gracefully.');
  
  // Close all WebSocket connections
  wss.clients.forEach((client) => {
    client.close();
  });
  
  server.close(() => {
    console.log('[WS] Server closed.');
    process.exit(0);
  });
});
