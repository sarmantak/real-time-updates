/**
 * Server-Sent Events (SSE) Server - Node.js/Express
 * Implements server-to-client push communication via persistent HTTP connection.
 * 
 * Architecture:
 * - GET /events: Establishes SSE connection and sends events to client
 * - POST /broadcast: Triggers message broadcast to all connected clients
 * - Automatic reconnection on client disconnect
 * - Simple and efficient push-based communication
 */

import express from 'express';
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Store all connected SSE clients
const clients = new Set();

// Message queue for recently sent messages (for new clients)
const messageHistory = [];
const MAX_HISTORY = 10;

/**
 * POST /broadcast
 * Broadcast a message to all connected SSE clients.
 * Body: { message: string }
 */
app.post('/broadcast', (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const timestamp = new Date().toISOString();
  const eventData = { message, timestamp, clientCount: clients.size };

  console.log(`[SERVER] Broadcasting message to ${clients.size} client(s): "${message}"`);

  // Add to history
  messageHistory.push(eventData);
  if (messageHistory.length > MAX_HISTORY) {
    messageHistory.shift();
  }

  // Send to all connected clients
  clients.forEach((client) => {
    client.write(`data: ${JSON.stringify(eventData)}\n\n`);
  });

  res.json({
    success: true,
    broadcastCount: clients.size,
    timestamp,
  });
});

/**
 * GET /events
 * SSE endpoint. Establishes persistent connection and sends events.
 * Features:
 * - Automatic reconnection on disconnect
 * - Sends recent message history to new clients
 * - Keeps connection alive with periodic heartbeat
 */
app.get('/events', (req, res) => {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Add client to active clients set
  clients.add(res);
  console.log(`[SERVER] Client connected. Total connections: ${clients.size}`);

  // Send initial connection message
  const welcomeEvent = {
    type: 'connected',
    message: 'SSE connection established',
    clientCount: clients.size,
    timestamp: new Date().toISOString(),
  };
  res.write(`data: ${JSON.stringify(welcomeEvent)}\n\n`);

  // Send recent message history to new client
  if (messageHistory.length > 0) {
    const historyEvent = {
      type: 'history',
      messages: messageHistory,
      count: messageHistory.length,
    };
    res.write(`data: ${JSON.stringify(historyEvent)}\n\n`);
  }

  // Send heartbeat/keep-alive ping every 30 seconds
  const heartbeatInterval = setInterval(() => {
    const heartbeat = {
      type: 'ping',
      clientCount: clients.size,
      timestamp: new Date().toISOString(),
    };
    res.write(`data: ${JSON.stringify(heartbeat)}\n\n`);
  }, 30000);

  // Handle client disconnect
  req.on('close', () => {
    console.log('[SERVER] Client disconnected.');
    clients.delete(res);
    clearInterval(heartbeatInterval);
    res.end();
    console.log(`[SERVER] Remaining connections: ${clients.size}`);
  });

  // Handle errors
  res.on('error', (err) => {
    console.log('[SERVER] Error on SSE stream:', err.message);
    clients.delete(res);
    clearInterval(heartbeatInterval);
  });
});

/**
 * GET /health
 * Health check endpoint.
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    connectedClients: clients.size,
    messageHistorySize: messageHistory.length,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 SSE Server started on http://localhost:${PORT}`);
  console.log(`📡 Open http://localhost:${PORT} in your browser to connect\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n[SERVER] SIGTERM received. Shutting down gracefully.');
  // Close all SSE connections
  clients.forEach((client) => {
    client.end();
  });
  clients.clear();
  process.exit(0);
});
