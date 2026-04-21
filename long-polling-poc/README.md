# Long-Polling Proof-of-Concept

A minimal, production-ready example of E2E (End-to-End) long-polling communication using Node.js/Express and Vanilla JavaScript.

## 📋 Architecture Overview

### Waiting Room Pattern

The server uses a "waiting room" array to hold client requests until data becomes available:

1. **Client connects** → Request added to waiting room
2. **Server receives message trigger** → All waiting requests resolved with data
3. **Timeout (30s)** → Request automatically responds with 204 No Content
4. **Client receives response** → Immediately restarts polling loop

```
┌─────────────┐                      ┌──────────────┐
│   Client    │                      │    Server    │
│  subscribe()│──────GET /poll──────>│ Waiting Room │
│             │                      │  [res1, ...]│
│             │<──────200 + data─────│  [resolved] │
│  Display    │                      │              │
│ Restart     │                      │              │
└─────────────┘                      └──────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose installed

### Docker Setup

**One-command startup:**
```bash
cd long-polling-poc
docker-compose up
```

The server will start on `http://localhost:3000` inside a container.

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
docker build -t long-polling-poc .

# Run container
docker run -p 3000:3000 long-polling-poc
```

**Docker Features:**
- ✅ Automatic dependency installation (no manual `npm install`)
- ✅ Health checks for monitoring
- ✅ Live code reloading via volume mounting
- ✅ Isolated container environment
- ✅ One-command deployment and shutdown

## 🎯 Features

### Backend (server.js)

- **GET `/poll`**: Long-polling endpoint
  - Holds requests in waiting room until data available
  - Auto-responds with 204 after 30 seconds (timeout safety)
  - Handles client disconnections gracefully
  - Prevents memory leaks with proper timeout cleanup

- **POST `/message`**: Trigger endpoint
  - Accepts `{ message: string }` in request body
  - Resolves all pending poll requests
  - Returns `{ success: true, resolvedCount: number }`

- **GET `/health`**: Health check
  - Returns `{ status: 'ok', waitingRoomSize: number }`

### Frontend (public/client.js)

- **subscribe()**: Recursive async polling function
  - Cache-busting with timestamp query parameter
  - Error resilience with exponential backoff (1-5 seconds)
  - Handles 200 (data), 204 (timeout), and error responses
  - Immediate restart after each poll cycle

- **Error Handling**:
  - Try-catch wraps all fetch operations
  - Network errors trigger retry with exponential backoff
  - Avoids "hammering" server on failures
  - Clear error logging to UI

- **UI Features**:
  - Real-time status indicator (listening/idle/error)
  - Event log with timestamps
  - Message counter and poll counter
  - Send message input with Enter key support
  - Automatic pause when browser tab is hidden
  - Responsive design with gradient background

## 📊 Testing the PoC

### Scenario 1: Simple Message Exchange

1. Open `http://localhost:3000` in your browser
2. Browser automatically connects and starts polling
3. Type a message in the text input (e.g., "Hello Server!")
4. Click "Send" or press Enter
5. Watch the message appear in the UI
6. Observe the event log showing poll requests and responses

### Scenario 2: Multiple Concurrent Polls

1. Open multiple browser tabs to the same URL
2. Send a message from any tab
3. All tabs receive the message simultaneously
4. Server resolves all waiting requests in one batch

### Scenario 3: Timeout Behavior

1. Open the browser and let it poll
2. Don't send any messages
3. After ~30 seconds, you'll see "Poll timeout (30s)" in the log
4. Polling automatically restarts
5. Network tab shows 204 responses on timeout

### Scenario 4: Server Down Resilience

1. Open the browser and let it start polling
2. Stop the server (Ctrl+C)
3. Watch the error messages in the log
4. Retry delays increase exponentially (1s → 1.5s → 2.25s → ... → 5s)
5. Restart the server
6. Polling automatically reconnects within seconds

## 💬 Sending Messages via CLI

You can send messages to the server without using the browser UI.

### Using curl

**Basic command:**
```bash
curl -X POST http://localhost:3000/message \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello from CLI"}'
```

**One-liner:**
```bash
curl -X POST http://localhost:3000/message -H "Content-Type: application/json" -d '{"message":"Your message here"}'
```

**With dynamic timestamp:**
```bash
curl -X POST http://localhost:3000/message -H "Content-Type: application/json" -d "{\"message\":\"Sent at $(date)\"}"
```

**From environment variable:**
```bash
MSG="Hello"
curl -X POST http://localhost:3000/message -H "Content-Type: application/json" -d "{\"message\":\"$MSG\"}"
```

### Health Check

**Check server status:**
```bash
curl http://localhost:3000/health
```

**Example response:**
```json
{"status":"ok","waitingRoomSize":2}
```

### Using wget

```bash
wget --post-data='{"message":"Hello"}' \
  --header='Content-Type: application/json' \
  http://localhost:3000/message -O -
```

### Bash Script Example

```bash
#!/bin/bash
# send-message.sh

if [ -z "$1" ]; then
  echo "Usage: $0 'message text'"
  exit 1
fi

curl -X POST http://localhost:3000/message \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"$1\"}"

echo "\n✅ Message sent!"
```

**Usage:**
```bash
chmod +x send-message.sh
./send-message.sh "My awesome message"
```

## 🔍 Code Quality

### Best Practices Implemented

✅ **No Caching**: Query parameters with timestamps prevent browser caching
```javascript
const url = `/poll?t=${timestamp}`;
```

✅ **Error Resilience**: Exponential backoff prevents server hammering
```javascript
STATE.retryDelay = Math.min(STATE.retryDelay * 1.5, STATE.maxRetryDelay);
```

✅ **Timeout Safety**: 30-second timeout with 204 response
```javascript
const timeoutHandle = setTimeout(() => {
  if (!res.headersSent) {
    res.status(204).send();
  }
}, REQUEST_TIMEOUT);
```

✅ **Memory Safety**: Proper cleanup of timeouts and request tracking
```javascript
res.on('finish', () => clearTimeout(timeoutHandle);
req.on('close', () => removeFromWaitingRoom(res);
```

✅ **Graceful Shutdown**: Server handles SIGTERM
```javascript
process.on('SIGTERM', () => process.exit(0));
```

✅ **Tab Visibility**: Pauses polling when tab is hidden
```javascript
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopPolling();
  else startPolling();
});
```

## 📈 Performance Considerations

- **Waiting Room Size**: Grows with connected clients, cleared on each message
- **Memory Usage**: ~100-200 bytes per pending request
- **Network**: Single HTTP request per 30-second cycle (or less if messages arrive)
- **CPU**: Minimal - mostly idle between polls

## 🔗 References

- [The Modern JavaScript Tutorial - Long Polling](https://javascript.info/long-polling)
- [HTTP Status Codes - 204 No Content](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/204)
- [Express.js Documentation](https://expressjs.com/)
- [Fetch API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)

## 📝 Project Structure

```
long-polling-poc/
├── server.js              # Express server (Node.js ES6 modules)
│                           #   - GET /poll: Long-polling endpoint with waiting room
│                           #   - POST /message: Trigger endpoint to resolve requests
│                           #   - GET /health: Health check endpoint
│                           #   - 30s timeout with 204 No Content response
│
├── public/
│   ├── index.html          # Modern responsive UI
│   │                        #   - Real-time status indicator
│   │                        #   - Event log with timestamps
│   │                        #   - Message sender input
│   │                        #   - Poll/message counters
│   │                        #   - Gradient background design
│   │
│   └── client.js           # Vanilla ES6 polling client
│                           #   - subscribe() recursive async polling loop
│                           #   - Cache-busting with timestamps
│                           #   - Exponential backoff error handling (1-5s)
│                           #   - Tab visibility detection
│
├── Dockerfile              # Multi-stage Node.js 18 Alpine image
│                           #   - Optimized for production
│                           #   - Built-in health checks
│
├── docker-compose.yml      # Docker Compose orchestration
│                           #   - Single service configuration
│                           #   - Volume mounting for live reload
│                           #   - Network isolation
│                           #   - Health monitoring
│
├── .dockerignore            # Excludes unnecessary files from Docker build
├── package.json             # Dependencies and scripts
├── README.md                # This file
└── .gitignore               # Git ignore rules
```

### File Descriptions

| File | Purpose | Key Features |
|------|---------|---------------|
| `server.js` | Backend server | Waiting room pattern, 30s timeout, graceful shutdown |
| `public/index.html` | UI template | Responsive design, real-time status display |
| `public/client.js` | Frontend logic | Recursive polling, error resilience, tab detection |
| `Dockerfile` | Container image | Alpine Node.js 18, minimal attack surface |
| `docker-compose.yml` | Container orchestration | One-command startup, volume mounting |
| `package.json` | Dependencies & scripts | Express, nodemon for development |


## 🛠️ Customization

### Change Timeout Duration

Edit `REQUEST_TIMEOUT` in `server.js`:
```javascript
const REQUEST_TIMEOUT = 30000; // Change to desired milliseconds
```

### Adjust Max Retry Delay

Edit `maxRetryDelay` in `public/client.js`:
```javascript
maxRetryDelay: 5000, // Change to desired milliseconds
```

### Disable Tab Visibility Pausing

Remove or comment out this section in `public/client.js`:
```javascript
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopPolling();
  else startPolling();
});
```

## 🐛 Troubleshooting

**Q: Browser shows "Connection failed" immediately**
- Ensure server is running: `npm start`
- Check if port 3000 is in use: `lsof -i :3000`
- Change PORT in server.js if needed

**Q: Messages not appearing**
- Check server logs for "Received message"
- Verify POST request body is valid JSON
- Ensure Content-Type header is `application/json`

**Q: Polls timing out constantly**
- Normal behavior - servers send 204 after 30 seconds if no data
- Open another tab and send a message to test
- Check browser console for network errors

**Q: High memory usage**
- Check waiting room size with `/health` endpoint
- Ensure clients are properly disconnecting
- Monitor for connection leaks

## 📄 License

MIT - Feel free to use and modify for your projects!
