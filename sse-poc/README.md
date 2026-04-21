# Server-Sent Events (SSE) Proof-of-Concept

A minimal, production-ready example of real-time, server-to-client push communication using Server-Sent Events (SSE), Node.js/Express, and Vanilla JavaScript.

## 📋 Architecture Overview

### SSE (Server-Sent Events)

SSE provides a persistent HTTP connection for server-to-client push communication:

1. **Client connects** → Establishes persistent HTTP connection via EventSource
2. **Server accepts** → Adds client to connected clients set
3. **Server sends events** → Broadcasts messages via persistent connection
4. **Automatic reconnection** → Browser automatically reconnects on disconnect

```
┌─────────────┐                      ┌──────────────┐
│   Client    │                      │    Server    │
│ EventSource │◄─────persistent──────│ Connected    │
│             │     HTTP (SSE)       │ Clients Set  │
│             │◄────data stream──────│              │
│ Receive &   │                      │ /broadcast   │
│ Display     │                      │   triggers   │
└─────────────┘                      └──────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose installed

### Docker Setup

**One-command startup:**
```bash
cd sse-poc
docker-compose up
```

The server will start on `http://localhost:3001` inside a container.

**Run in background (detached mode):**
```bash
docker-compose up -d
```

**View running logs:**
```bash
docker-compose logs -f
```

**Stop the container:**
```bash
docker-compose down
```

**Rebuild image (after code changes):**
```bash
docker-compose up --build
```

**Or build and run manually:**
```bash
# Build Docker image
docker build -t sse-poc .

# Run container
docker run -p 3001:3000 sse-poc
```

**Docker Features:**
- ✅ Automatic dependency installation (no manual setup)
- ✅ Health checks for monitoring
- ✅ Live code reloading via volume mounting
- ✅ Isolated container environment
- ✅ One-command deployment and shutdown

## 🎯 Features

### Backend (server.js)

- **GET `/events`**: SSE endpoint
  - Establishes persistent HTTP connection
  - Sends welcome message with client count
  - Sends recent message history to new clients
  - Sends periodic heartbeat (every 30 seconds)
  - Automatic browser reconnection on disconnect
  - Graceful client cleanup on error

- **POST /broadcast**: Broadcast endpoint
  - Accepts `{ message: string }` in request body
  - Sends to all connected clients instantly
  - Returns `{ success: true, broadcastCount: number }`
  - Maintains message history (last 10 messages)

- **GET `/health`**: Health check
  - Returns `{ status: 'ok', connectedClients: number, messageHistorySize: number }`

### Frontend (public/client.js)

- **EventSource API**: Persistent connection management
  - Automatic browser reconnection (no manual logic needed)
  - Built-in error handling
  - Simple event listener pattern

- **Event Types**:
  - `connected`: Initial connection confirmation
  - `history`: Recent message history
  - `ping`: Heartbeat for keep-alive
  - `message`: Regular broadcast messages

- **UI Features**:
  - Real-time connection status indicator
  - Connection duration timer
  - Event log with timestamps
  - Message counter
  - Broadcast message input
  - Responsive design with gradient background

## 📊 Testing the PoC

### Scenario 1: Simple Message Broadcast

1. Open `http://localhost:3001` in your browser
2. Browser automatically connects via SSE
3. Type a message in the text input
4. Click "Send" or press Enter
5. See the message instantly in the UI
6. Observe the event log showing messages and heartbeats

### Scenario 2: Multiple Concurrent Connections

1. Open multiple browser tabs to the same URL
2. Each tab connects and receives history
3. Send a message from any tab
4. All tabs receive the message instantly
5. Server logs show total connected clients

### Scenario 3: Connection Resilience

1. Open the browser and verify connection
2. Watch the "Connection Duration" timer
3. Observe periodic "ping" heartbeats in the log
4. The connection automatically keeps itself alive
5. No polling overhead or repeated requests

### Scenario 4: Server Restart Recovery

1. Open the browser and connect
2. Send some messages
3. Stop the server (Ctrl+C)
4. Watch browser automatically attempt reconnection
5. Restart the server
6. Browser automatically reconnects
7. Receives message history from new connection

## 💬 Sending Messages via CLI

### Using curl

**Basic command:**
```bash
curl -X POST http://localhost:3001/broadcast \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello from CLI"}'
```

**One-liner:**
```bash
curl -X POST http://localhost:3001/broadcast -H "Content-Type: application/json" -d '{"message":"Your message here"}'
```

**With dynamic timestamp:**
```bash
curl -X POST http://localhost:3001/broadcast -H "Content-Type: application/json" -d "{\"message\":\"Sent at $(date)\"}"
```

### Health Check

**Check server status:**
```bash
curl http://localhost:3001/health
```

**Example response:**
```json
{"status":"ok","connectedClients":2,"messageHistorySize":5}
```

### Using wget

```bash
wget --post-data='{"message":"Hello"}' \
  --header='Content-Type: application/json' \
  http://localhost:3001/broadcast -O -
```

### Bash Script Example

```bash
#!/bin/bash
# broadcast-message.sh

if [ -z "$1" ]; then
  echo "Usage: $0 'message text'"
  exit 1
fi

curl -X POST http://localhost:3001/broadcast \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"$1\"}"

echo "\n✅ Broadcast sent!"
```

**Usage:**
```bash
chmod +x broadcast-message.sh
./broadcast-message.sh "My awesome message"
```

## 🔍 Code Quality

### Best Practices Implemented

✅ **Persistent Connection**: Single HTTP connection reduces overhead
```javascript
const eventSource = new EventSource('/events');
```

✅ **Automatic Reconnection**: Browser handles reconnection transparently
```javascript
eventSource.onerror = (event) => {
  // Browser automatically reconnects
};
```

✅ **Message History**: New clients receive recent messages
```javascript
if (messageHistory.length > 0) {
  const historyEvent = { type: 'history', messages: messageHistory };
  res.write(`data: ${JSON.stringify(historyEvent)}\n\n`);
}
```

✅ **Heartbeat/Keep-Alive**: Prevents connection timeout
```javascript
const heartbeatInterval = setInterval(() => {
  res.write(`data: ${JSON.stringify({ type: 'ping' })}\n\n`);
}, 30000);
```

✅ **Memory Safety**: Proper client cleanup on disconnect
```javascript
req.on('close', () => {
  clients.delete(res);
  clearInterval(heartbeatInterval);
});
```

✅ **Graceful Shutdown**: Closes all SSE connections
```javascript
process.on('SIGTERM', () => {
  clients.forEach((client) => client.end());
  clients.clear();
  process.exit(0);
});
```

## 📈 Performance Considerations

- **Connection Overhead**: Single persistent HTTP connection (vs multiple polling requests)
- **Memory Usage**: ~1-2 KB per connected client
- **CPU**: Minimal - server sleeps until message trigger
- **Network**: Event-driven push (only sends when data available)
- **Latency**: Near-zero (no polling interval delay)

## 📝 Project Structure

```
sse-poc/
├── server.js              # Express server (Node.js ES6 modules)
│                           #   - GET /events: SSE endpoint
│                           #   - POST /broadcast: Trigger messages
│                           #   - GET /health: Health check
│                           #   - Client set management
│
├── public/
│   ├── index.html          # Modern responsive UI
│   │                        #   - Connection status indicator
│   │                        #   - Connection duration timer
│   │                        #   - Event log with timestamps
│   │                        #   - Broadcast message input
│   │
│   └── client.js           # Vanilla ES6 EventSource client
│                           #   - EventSource connection management
│                           #   - Event listener setup
│                           #   - Message broadcast handler
│
├── Dockerfile              # Multi-stage Node.js 18 Alpine image
│                           #   - Optimized for production
│                           #   - Built-in health checks
│
├── docker-compose.yml      # Docker Compose orchestration
│                           #   - Single service configuration
│                           #   - Volume mounting for live reload
│                           #   - Runs on port 3001
│
├── .dockerignore            # Excludes unnecessary files from Docker build
├── package.json             # Dependencies and scripts
├── README.md                # This file
└── .gitignore               # Git ignore rules
```

### File Descriptions

| File | Purpose | Key Features |
|------|---------|---------------|
| `server.js` | Backend server | SSE management, client set, message history |
| `public/index.html` | UI template | Responsive design, connection timer |
| `public/client.js` | Frontend logic | EventSource API, event handling |
| `Dockerfile` | Container image | Alpine Node.js 18, minimal attack surface |
| `docker-compose.yml` | Container orchestration | One-command startup, port 3001 |
| `package.json` | Dependencies & scripts | Express, nodemon for dev |

## 🛠️ Customization

### Change Heartbeat Interval

Edit heartbeat interval in `server.js`:
```javascript
const heartbeatInterval = setInterval(() => {
  res.write(`data: ${JSON.stringify({ type: 'ping' })}\n\n`);
}, 30000); // Change to desired milliseconds
```

### Change Message History Size

Edit `MAX_HISTORY` in `server.js`:
```javascript
const MAX_HISTORY = 10; // Change to desired number
```

### Change Server Port

Edit `PORT` in `server.js` or `docker-compose.yml`:
```yaml
ports:
  - "3001:3000"  # Change first number for external port
```

## 🐛 Troubleshooting

**Q: Browser shows "Connection Error"**
- Ensure server is running: `docker-compose up`
- Check if port 3001 is in use: `lsof -i :3001`
- Verify EventSource in browser console for CORS issues

**Q: Messages not appearing**
- Check server logs for "Broadcasting message"
- Verify POST request body is valid JSON
- Ensure Content-Type header is `application/json`
- Confirm clients are actually connected: `/health` endpoint

**Q: High memory usage**
- Check connected clients count with `/health` endpoint
- Verify clients are properly disconnecting
- Monitor message history size (limited to 10 by default)

**Q: Connection keeps reconnecting**
- Check browser console for network errors
- Verify server is responding to requests
- Check if firewall/proxy is interfering with persistent connections

## 🔗 References

- [MDN - Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [MDN - EventSource API](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)
- [Express.js Documentation](https://expressjs.com/)
- [Server-Sent Events vs WebSockets](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)

## 📊 SSE vs Long-Polling Comparison

| Feature | SSE | Long-Polling |
|---------|-----|--------------|
| Connection | Persistent | Repeated requests |
| Overhead | Low | Higher (repeated headers) |
| Latency | Minimal | 0-30 seconds |
| Implementation | Simple | More complex |
| Browser Support | Modern browsers (IE not supported) | Universal |
| Bi-directional | No (server→client only) | Can implement both ways |
| Memory per client | ~1-2 KB | ~0.1-0.2 KB |

## 📄 License

MIT - Feel free to use and modify for your projects!
