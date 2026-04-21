/**
 * WebSocket Client - Vanilla JavaScript (ES6)
 * 
 * Architecture:
 * - WebSocket connection: Bi-directional communication
 * - Message routing: Handle different message types
 * - Automatic reconnection: Exponential backoff on disconnect
 * - UI updates: Real-time message and user updates
 */

// ============================================================================
// State Management
// ============================================================================

const STATE = {
  ws: null,
  isConnected: false,
  clientId: null,
  username: null,
  messageCount: 0,
  reconnectAttempts: 0,
  maxReconnectAttempts: 5,
  reconnectDelay: 1000,
};

// ============================================================================
// DOM Elements
// ============================================================================

const elements = {
  messageInput: document.getElementById('messageInput'),
  usernameInput: document.getElementById('usernameInput'),
  statusDot: document.getElementById('statusDot'),
  statusText: document.getElementById('statusText'),
  messagesContainer: document.getElementById('messagesContainer'),
  userList: document.getElementById('userList'),
  userCount: document.getElementById('userCount'),
  messageCount: document.getElementById('messageCount'),
};

// ============================================================================
// WebSocket Connection Management
// ============================================================================

/**
 * Establish WebSocket connection
 */
function connectWebSocket() {
  try {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}`;

    console.log(`[WS] Connecting to ${url}`);

    STATE.ws = new WebSocket(url);

    STATE.ws.onopen = () => {
      console.log('[WS] Connected');
      STATE.isConnected = true;
      STATE.reconnectAttempts = 0;
      STATE.reconnectDelay = 1000;
      updateConnectionStatus('connected');
    };

    STATE.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleMessage(message);
      } catch (err) {
        console.error('[WS] Error parsing message:', err);
      }
    };

    STATE.ws.onerror = (error) => {
      console.error('[WS] Error:', error);
      updateConnectionStatus('error');
    };

    STATE.ws.onclose = () => {
      console.log('[WS] Disconnected');
      STATE.isConnected = false;
      updateConnectionStatus('disconnected');
      attemptReconnection();
    };
  } catch (err) {
    console.error('[WS] Connection error:', err.message);
    updateConnectionStatus('error');
    attemptReconnection();
  }
}

/**
 * Attempt to reconnect with exponential backoff
 */
function attemptReconnection() {
  if (STATE.reconnectAttempts >= STATE.maxReconnectAttempts) {
    console.log('[WS] Max reconnection attempts reached');
    updateConnectionStatus('disconnected');
    return;
  }

  STATE.reconnectAttempts++;
  const delay = STATE.reconnectDelay * Math.pow(2, STATE.reconnectAttempts - 1);

  console.log(`[WS] Reconnecting in ${delay}ms (attempt ${STATE.reconnectAttempts})`);

  setTimeout(() => {
    connectWebSocket();
  }, delay);
}

/**
 * Send message to server
 */
function sendMessage(data) {
  if (!STATE.ws || STATE.ws.readyState !== 1) {
    console.log('[WS] Not connected');
    return;
  }

  STATE.ws.send(JSON.stringify(data));
}

// ============================================================================
// Message Handlers
// ============================================================================

/**
 * Route incoming message by type
 */
function handleMessage(message) {
  switch (message.type) {
    case 'connected':
      handleConnected(message);
      break;
    case 'message':
      handleChatMessage(message);
      break;
    case 'presence':
      handlePresence(message);
      break;
    case 'history':
      handleHistory(message);
      break;
    case 'system':
      handleSystem(message);
      break;
    case 'pong':
      handlePong(message);
      break;
    case 'error':
      console.error('[WS] Server error:', message.message);
      break;
    default:
      console.log('[WS] Unknown message type:', message.type);
  }
}

/**
 * Handle connection confirmation
 */
function handleConnected(message) {
  STATE.clientId = message.clientId;
  console.log(`[WS] Connected with ID: ${STATE.clientId}`);
  addSystemMessage(`✅ Connected! (${message.clientCount} users)`);
}

/**
 * Handle chat message
 */
function handleChatMessage(message) {
  STATE.messageCount++;
  elements.messageCount.textContent = STATE.messageCount;

  const msgEl = document.createElement('div');
  msgEl.className = 'message';
  msgEl.innerHTML = `
    <div class="message-header">
      <span class="message-username">${escapeHtml(message.username)}</span>
      <span class="message-timestamp">${formatTime(message.timestamp)}</span>
    </div>
    <div class="message-text">${escapeHtml(message.text)}</div>
  `;

  elements.messagesContainer.appendChild(msgEl);
  elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
}

/**
 * Handle presence updates (user list)
 */
function handlePresence(message) {
  elements.userCount.textContent = message.users.length;

  elements.userList.innerHTML = '';

  if (message.users.length === 0) {
    elements.userList.innerHTML =
      '<div style="color: #999; font-size: 13px;">No users online</div>';
    return;
  }

  message.users.forEach((user) => {
    const userEl = document.createElement('div');
    userEl.className = 'user-item';
    userEl.innerHTML = `
      <div class="user-status"></div>
      <span>${escapeHtml(user.username)}</span>
    `;
    elements.userList.appendChild(userEl);
  });
}

/**
 * Handle message history
 */
function handleHistory(message) {
  console.log(`[WS] Received ${message.count} messages from history`);
  message.messages.forEach((msg) => {
    handleChatMessage(msg);
  });
}

/**
 * Handle system messages
 */
function handleSystem(message) {
  addSystemMessage(message.message);
  elements.userCount.textContent = message.users.length;
}

/**
 * Handle pong response
 */
function handlePong(message) {
  console.log('[WS] Pong received');
}

// ============================================================================
// UI Updates
// ============================================================================

/**
 * Update connection status indicator
 */
function updateConnectionStatus(state) {
  const states = {
    connected: { class: 'connected', text: '✅ Connected' },
    disconnected: { class: 'disconnected', text: '⏸️ Disconnected' },
    error: { class: 'disconnected', text: '❌ Connection Error' },
  };

  const status = states[state] || states.disconnected;
  elements.statusDot.className = `status-dot ${status.class}`;
  elements.statusText.textContent = status.text;
}

/**
 * Add system message to chat
 */
function addSystemMessage(text) {
  const msgEl = document.createElement('div');
  msgEl.className = 'message system';
  msgEl.innerHTML = `<div class="message-text">${escapeHtml(text)}</div>`;

  elements.messagesContainer.appendChild(msgEl);
  elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Format timestamp
 */
function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

// ============================================================================
// User Interactions
// ============================================================================

/**
 * Send chat message
 */
window.sendMessage = function () {
  const text = elements.messageInput.value.trim();

  if (!text) {
    console.log('Message is empty');
    return;
  }

  if (!STATE.username) {
    alert('Please join with a username first!');
    return;
  }

  sendMessage({
    type: 'message',
    text,
    username: STATE.username,
  });

  elements.messageInput.value = '';
  elements.messageInput.focus();
};

/**
 * Set username and join chat
 */
window.setUsername = function () {
  const username = elements.usernameInput.value.trim();

  if (!username) {
    alert('Please enter a username');
    return;
  }

  if (username.length > 20) {
    alert('Username must be 20 characters or less');
    return;
  }

  STATE.username = username;

  sendMessage({
    type: 'presence',
    username,
    status: 'online',
  });

  addSystemMessage(`👋 ${escapeHtml(username)} joined the chat`);
  elements.usernameInput.disabled = true;
  document.querySelector('button').textContent = 'Joined';
  elements.messageInput.focus();
};

// ============================================================================
// Initialize
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('[WS] Client initialized');

  // Connect to WebSocket
  connectWebSocket();

  // Allow Enter key to send message
  elements.messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      window.sendMessage();
    }
  });

  // Allow Enter key to set username
  elements.usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      window.setUsername();
    }
  });

  // Send periodic ping to keep connection alive
  setInterval(() => {
    if (STATE.isConnected) {
      sendMessage({ type: 'ping', timestamp: Date.now() });
    }
  }, 30000);

  // Handle page unload
  window.addEventListener('beforeunload', () => {
    if (STATE.ws) {
      STATE.ws.close();
    }
  });
});
