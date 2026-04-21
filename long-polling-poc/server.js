/**
 * Long-Polling Server - Node.js/Express
 * Implements a "waiting room" pattern for long-polling communication.
 * 
 * Architecture:
 * - /poll GET: Holds client requests until data is available or timeout occurs
 * - /message POST: Triggers data and resolves all pending requests
 * - Timeout Safety: Responds with 204 (No Content) after 30 seconds
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Waiting Room: Array of response objects waiting for data
const waitingRoom = [];

// Request timeout in milliseconds (30 seconds)
const REQUEST_TIMEOUT = 30000;

/**
 * POST /message
 * Endpoint to trigger a message and resolve all pending requests.
 * Body: { message: string }
 */
app.post('/message', (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  console.log(`[SERVER] Received message: "${message}". Resolving ${waitingRoom.length} pending request(s).`);

  // Resolve all pending requests with the message data
  while (waitingRoom.length > 0) {
    const clientResponse = waitingRoom.shift();
    // Only send if the response hasn't been sent already (not aborted/timed out)
    if (!clientResponse.headersSent) {
      clientResponse.json({ message });
    }
  }

  // Acknowledge the trigger
  res.json({ success: true, resolvedCount: waitingRoom.length });
});

/**
 * GET /poll
 * Long-polling endpoint. Holds the request in the waiting room until:
 * 1. Data is available (via /message endpoint), or
 * 2. 30 seconds timeout is reached (responds with 204 No Content)
 */
app.get('/poll', (req, res) => {
  console.log(`[SERVER] Poll request received. Waiting room size: ${waitingRoom.length + 1}`);

  // Add this response object to the waiting room
  waitingRoom.push(res);

  // Set timeout for this specific request (30 seconds)
  const timeoutHandle = setTimeout(() => {
    // Check if response hasn't been sent yet
    if (!res.headersSent) {
      console.log(`[SERVER] Request timeout after ${REQUEST_TIMEOUT / 1000}s. Sending 204 No Content.`);
      // Remove from waiting room if still there
      const index = waitingRoom.indexOf(res);
      if (index > -1) {
        waitingRoom.splice(index, 1);
      }
      // Send 204 No Content - no data is available
      res.status(204).send();
    }
  }, REQUEST_TIMEOUT);

  // Ensure timeout is cleared if response is sent before timeout
  res.on('finish', () => {
    clearTimeout(timeoutHandle);
    console.log(`[SERVER] Response finished. Waiting room size: ${waitingRoom.length}`);
  });

  // Handle client disconnect
  req.on('close', () => {
    if (!res.headersSent) {
      clearTimeout(timeoutHandle);
      const index = waitingRoom.indexOf(res);
      if (index > -1) {
        waitingRoom.splice(index, 1);
      }
      console.log(`[SERVER] Client disconnected. Waiting room size: ${waitingRoom.length}`);
    }
  });
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', waitingRoomSize: waitingRoom.length });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Long-Polling Server started on http://localhost:${PORT}`);
  console.log(`📡 Open http://localhost:${PORT} in your browser to test\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n[SERVER] SIGTERM received. Shutting down gracefully.');
  process.exit(0);
});
