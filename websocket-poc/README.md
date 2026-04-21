# WebSocket Proof-of-Concept

A minimal, production-ready example of real-time, bi-directional communication using WebSocket, Node.js/Express, and Vanilla JavaScript. Features a functional chat application demonstrating true push and pull communication.

## 📋 Architecture Overview

### WebSocket (Bi-directional Communication)

WebSocket provides a persistent, full-duplex connection for real-time communication:

1. **Client connects** → HTTP upgrade to WebSocket protocol
2. **Persistent connection** → Bi-directional pipe established
3. **Client sends data** → Instantly pushed to server
4. **Server sends data** → Instantly pushed to all clients
5. **Both directions active** → True real-time communication

```
┌─────────────┐                      ┌──────────────┐
│   Client    │                      │    Server    │
│  ws.send()  │──────────────────────│  Receive &   │
│             │     WebSocket        │  Broadcast  │
│ ws.onmsg()  │◄─────────────────────│              │
│  Display    │    Bi-directional    │              │
└─────────────┘                      └──────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose installed

### Docker Setup

**One-command startup:**
```bash
cd websocket-poc
docker-compose up
```

The server will start on `http://localhost:3002` inside a container.

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
docker build -t websocket-poc .

# Run container
docker run -p 3002:3000 websocket-poc
```

**Docker Features:**
- ✅ Automatic dependency installation (no manual setup)
- ✅ Health checks for monitoring
- ✅ Live code reloading via volume mounting
- ✅ Isolated container environment
- ✅ One-command deployment and shutdown

## 🎯 Features

### Backend (server.js)

- **WebSocket Server**: Built with `ws` library for high performance
  - HTTP upgrade handling for WebSocket handshake
  - Connection tracking with metadata (username, joinedAt, etc.)
  - Message routing by type (message, presence, ping/pong)
  - Broadcasting to all clients or specific clients

- **Message Types**:
  - `message`: Chat messages (with history)
  - `presence`: User online/offline/typing status
  - `ping/pong`: Keep-alive heartbeat
  - `system`: Server notifications
  - `error`: Error messages

- **Features**:
  - Message history for new clients (last 20 messages)
  - Active user tracking and presence broadcast
  - Graceful client cleanup on disconnect
  - Automatic error handling

- **Endpoints**:
  - `GET /`: Serve frontend
  - `GET /health`: Health check
  - `GET /stats`: Server statistics (users, message count)
  - `WS /`: WebSocket upgrade endpoint

### Frontend (public/client.js)

- **WebSocket Client**: Vanilla JavaScript with modern patterns
  - Automatic reconnection with exponential backoff
  - Message type routing
  - Clean event handling
  - Proper error management

- **Features**:
  - Real-time message sending and receiving
  - User presence updates
  - Automatic user list refresh
  - Message history display
  - Connection status indicator
  - Statistics (connected users, message count)

- **UI Features**:
  - Chat-like interface with sidebar
  - Username input to join chat
  - Active user list with online status
  - System notifications for joins/leaves
  - Real-time message counter
  - Responsive design (mobile-friendly)

## 📊 Testing the PoC

### Scenario 1: Simple Chat

1. Open `http://localhost:3002` in browser
2. Enter your username and click "Join"
3. Type a message and press Enter
4. See message appear instantly
5. Open another tab and repeat
6. Both tabs receive messages in real-time

### Scenario 2: Multiple Concurrent Users

1. Open 3+ browser tabs to the same URL
2. Each tab joins with different username
3. See "Active Users" list update instantly
4. Send message from one tab
5. All tabs receive message immediately
6. See user count update in real-time

### Scenario 3: Presence Notifications

1. Open two tabs, join as different users
2. First user sends message
3. Second tab receives system notification: "user1 joined the chat"
4. Close first tab
5. Second tab receives: "user1 left the chat"

### Scenario 4: Connection Resilience

1. Open browser and join chat
2. Send some messages
3. Open DevTools Network tab, throttle connection
4. Send messages - see them get through
5. Restore connection
6. Messages continue working
7. Close DevTools

### Scenario 5: Message History

1. Open first tab, send some messages
2. Close first tab
3. Open second tab - see recent message history
4. Old messages appear without needing to rebroadcast

## 🔍 Code Quality

### Best Practices Implemented

✅ **Bi-directional Communication**: Full-duplex WebSocket connection
```javascript
// Client sends anytime
ws.send(JSON.stringify({ type: 'message', text: '...' }));

// Server sends anytime
client.send(JSON.stringify({ type: 'message', ... }));
```

✅ **Message Type Routing**: Scalable message handling
```javascript
ws.on('message', (data) => {
  const { type } = JSON.parse(data);
  if (type === 'message') { ... }
  else if (type === 'presence') { ... }
});
```

✅ **Connection Tracking**: Map with metadata
```javascript
const clients = new Map(); // Map<ws, { id, username, joinedAt }>
```

✅ **Broadcasting**: Efficient multi-client delivery
```javascript
function broadcast(message, excludeClient) {
  wss.clients.forEach(client => {
    if (client !== excludeClient) client.send(...);
  });
}
```

✅ **Automatic Reconnection**: Exponential backoff
```javascript
const delay = reconnectDelay * Math.pow(2, attempts - 1);
```

✅ **Graceful Shutdown**: Close all connections
```javascript
process.on('SIGTERM', () => {
  wss.clients.forEach(client => client.close());
});
```

✅ **XSS Prevention**: HTML escaping
```javascript
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
```

## 📈 Performance Considerations

- **Connection Overhead**: Single persistent bi-directional connection
- **Memory Usage**: ~2-3 KB per connected client
- **CPU**: Minimal - event-driven architecture
- **Network**: Only sends when data available (no keep-alive overhead)
- **Latency**: Sub-second round-trip (only network delay)

## 📝 Project Structure

```
websocket-poc/
├── server.js              # Express + WS server (Node.js ES6 modules)
│                           #   - WebSocket upgrade handling
│                           #   - Connection management
│                           #   - Message routing
│                           #   - Broadcast system
│
├── public/
│   ├── index.html          # Chat UI
│   │                        #   - Chat message display
│   │                        #   - Username input
│   │                        #   - Message input
│   │                        #   - Active user sidebar
│   │
│   └── client.js           # Vanilla ES6 WebSocket client
│                           #   - Connection lifecycle
│                           #   - Message routing
│                           #   - Auto-reconnect logic
│                           #   - UI updates
│
├── Dockerfile              # Multi-stage Node.js 18 Alpine image
│                           #   - Optimized for production
│                           #   - Built-in health checks
│
├── docker-compose.yml      # Docker Compose orchestration
│                           #   - Single service configuration
│                           #   - Volume mounting for live reload
│                           #   - Runs on port 3002
│
├── .dockerignore            # Excludes unnecessary files from Docker build
├── package.json             # Dependencies and scripts
├── README.md                # This file
└── .gitignore               # Git ignore rules
```

### File Descriptions

| File | Purpose | Key Features |
|------|---------|---------------|
| `server.js` | Backend server | WebSocket management, message routing, broadcasting |
| `public/index.html` | UI template | Chat interface, user sidebar, responsive layout |
| `public/client.js` | Frontend logic | WebSocket client, reconnection, event handling |
| `Dockerfile` | Container image | Alpine Node.js 18, minimal attack surface |
| `docker-compose.yml` | Container orchestration | One-command startup, port 3002 |
| `package.json` | Dependencies & scripts | Express, ws, nodemon for dev |

## 🛠️ Customization

### Change Server Port

Edit `docker-compose.yml`:
```yaml
ports:
  - "3002:3000"  # Change first number for external port
```

### Change Message History Size

Edit `MAX_HISTORY` in `server.js`:
```javascript
const MAX_HISTORY = 20; // Change to desired number
```

### Add Custom Message Types

Add handler in `server.js`:
```javascript
} else if (message.type === 'custom') {
  // Handle custom type
  broadcast({ type: 'custom', data: ... });
}
```

And in `client.js`:
```javascript
case 'custom':
  handleCustom(message);
  break;
```

## 🐛 Troubleshooting

**Q: Browser shows "Disconnected"**
- Ensure server is running: `docker-compose up`
- Check if port 3002 is in use: `lsof -i :3002`
- Open browser console for WebSocket errors

**Q: Messages not appearing**
- Verify username is set (click "Join" button)
- Check server logs for message events
- Confirm both browser tabs connected (both show ✅)

**Q: Connection keeps reconnecting**
- Check browser console for network errors
- Verify server is responsive: `curl http://localhost:3002/health`
- Check if firewall is blocking WebSocket upgrade

**Q: High memory usage**
- Check `/stats` endpoint for active clients
- Verify clients are properly closing connections
- Monitor message history size (limited to 20 by default)

## 🔗 References

- [MDN - WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [ws - Node.js WebSocket Library](https://github.com/websockets/ws)
- [Express.js Documentation](https://expressjs.com/)
- [WebSocket vs SSE vs Long-Polling](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)

##  License

MIT - Feel free to use and modify for your projects!
