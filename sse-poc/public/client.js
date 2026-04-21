/**
 * Server-Sent Events (SSE) Client - Vanilla JavaScript (ES6)
 * 
 * Architecture:
 * - EventSource: Maintains persistent connection to /events endpoint
 * - Automatic reconnection: Browser handles reconnection automatically
 * - Event listeners: Handle different event types (message, ping, etc.)
 * - Simple and efficient: No polling overhead
 */

// ============================================================================
// State Management
// ============================================================================

const STATE = {
  isConnected: false,
  messageCount: 0,
  connectionStartTime: null,
  eventSource: null,
};

// ============================================================================
// DOM Elements
// ============================================================================

const elements = {
  messageInput: document.getElementById('messageInput'),
  statusIndicator: document.getElementById('statusIndicator'),
  statusText: document.getElementById('statusText'),
  messageCount: document.getElementById('messageCount'),
  connectionDuration: document.getElementById('connectionDuration'),
  latestMessage: document.getElementById('latestMessage'),
  logContainer: document.getElementById('logContainer'),
  lastBroadcast: document.getElementById('lastBroadcast'),
};

// ============================================================================
// Logging Utilities
// ============================================================================

/**
 * Log an event to the UI and console.
 * @param {string} message - The message to log
 * @param {string} type - 'success', 'error', 'info', 'ping', or 'default'
 */
function log(message, type = 'default') {
  const timestamp = new Date().toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const logEntry = document.createElement('div');
  logEntry.className = `log-entry ${type}`;
  logEntry.innerHTML = `
    <span class="timestamp">[${timestamp}]</span>
    <span>${message}</span>
  `;

  elements.logContainer.appendChild(logEntry);
  elements.logContainer.scrollTop = elements.logContainer.scrollHeight;

  console.log(`[${type.toUpperCase()}] ${message}`);
}

// ============================================================================
// UI Updates
// ============================================================================

/**
 * Update connection status indicator.
 * @param {string} state - 'connected', 'disconnected', or 'error'
 */
function updateStatusIndicator(state) {
  const classes = ['connected', 'disconnected', 'error'];
  elements.statusIndicator.classList.remove(...classes);
  elements.statusIndicator.classList.add(state);

  const statuses = {
    connected: '✅ Connected via SSE',
    disconnected: '⏸️ Disconnected',
    error: '❌ Connection Error',
  };

  elements.statusText.textContent = statuses[state] || statuses.connected;
}

/**
 * Update latest message display.
 * @param {string} message - The message to display
 */
function updateLatestMessage(message) {
  elements.latestMessage.textContent = message;
  STATE.messageCount++;
  elements.messageCount.textContent = STATE.messageCount;
}

/**
 * Update connection duration timer.
 */
function updateConnectionDuration() {
  if (!STATE.connectionStartTime || !STATE.isConnected) return;

  const elapsed = Math.floor((Date.now() - STATE.connectionStartTime) / 1000);
  if (elapsed < 60) {
    elements.connectionDuration.textContent = `${elapsed}s`;
  } else if (elapsed < 3600) {
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    elements.connectionDuration.textContent = `${minutes}m ${seconds}s`;
  } else {
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    elements.connectionDuration.textContent = `${hours}h ${minutes}m`;
  }
}

// ============================================================================
// SSE Connection Management
// ============================================================================

/**
 * Connect to SSE endpoint and set up event listeners.
 */
function connectSSE() {
  if (STATE.isConnected) {
    log('⚠️ Already connected', 'info');
    return;
  }

  log('🔌 Connecting to SSE endpoint...', 'info');

  try {
    STATE.eventSource = new EventSource('/events');
    STATE.connectionStartTime = Date.now();

    // Handle general message events
    STATE.eventSource.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle different event types
        if (data.type === 'connected') {
          STATE.isConnected = true;
          updateStatusIndicator('connected');
          log(
            `✅ Connected! Total clients: ${data.clientCount}`,
            'success'
          );
        } else if (data.type === 'history') {
          log(
            `📜 Received ${data.count} message(s) from history`,
            'info'
          );
        } else if (data.type === 'ping') {
          // Heartbeat/keep-alive message - don't spam the log
          updateConnectionDuration();
          // log(`♥ Heartbeat (${data.clientCount} clients)`, 'ping');
        } else if (data.message) {
          // Regular message
          log(`📨 Message: "${data.message}"`, 'success');
          updateLatestMessage(data.message);
        }
      } catch (err) {
        log(`❌ Error parsing message: ${err.message}`, 'error');
      }
    });

    // Handle connection open
    STATE.eventSource.onopen = () => {
      STATE.isConnected = true;
      updateStatusIndicator('connected');
    };

    // Handle connection errors
    STATE.eventSource.onerror = (event) => {
      if (STATE.eventSource.readyState === EventSource.CLOSED) {
        STATE.isConnected = false;
        updateStatusIndicator('disconnected');
        log('⚠️ Connection closed', 'error');
      } else {
        updateStatusIndicator('error');
        log('❌ Connection error. Attempting to reconnect...', 'error');
      }
    };
  } catch (error) {
    STATE.isConnected = false;
    updateStatusIndicator('error');
    log(`❌ Failed to connect: ${error.message}`, 'error');
  }
}

/**
 * Disconnect from SSE endpoint.
 */
function disconnectSSE() {
  if (STATE.eventSource) {
    STATE.eventSource.close();
    STATE.eventSource = null;
    STATE.isConnected = false;
    STATE.connectionStartTime = null;
    updateStatusIndicator('disconnected');
    log('🛑 Disconnected from SSE', 'info');
  }
}

// ============================================================================
// Message Broadcasting
// ============================================================================

/**
 * Broadcast a message to all connected clients.
 */
async function broadcastMessage() {
  const message = elements.messageInput.value.trim();

  if (!message) {
    log('⚠️ Message cannot be empty', 'error');
    return;
  }

  try {
    log(`📤 Broadcasting: "${message}"`, 'info');

    const response = await fetch('/broadcast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    log(
      `✅ Broadcast sent to ${data.broadcastCount} client(s)`,
      'success'
    );

    elements.lastBroadcast.textContent = message;
    elements.messageInput.value = '';
  } catch (error) {
    log(`❌ Failed to broadcast: ${error.message}`, 'error');
  }
}

// ============================================================================
// Initialize
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  log('🎯 SSE Client initialized', 'info');

  // Allow Enter key to send message
  elements.messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      broadcastMessage();
    }
  });

  // Wire up the Send button
  const sendButton = document.querySelector('button');
  if (sendButton) {
    sendButton.addEventListener('click', broadcastMessage);
  }

  // Connect to SSE endpoint
  connectSSE();

  // Update connection duration every second
  const durationInterval = setInterval(() => {
    updateConnectionDuration();
  }, 1000);

  // Handle page unload
  window.addEventListener('beforeunload', () => {
    disconnectSSE();
    clearInterval(durationInterval);
  });

  // Handle visibility changes
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      log('📵 Tab is hidden', 'info');
      // Connection stays alive (browser handles it)
    } else {
      log('📱 Tab is visible', 'info');
      // Reconnect if needed
      if (!STATE.isConnected) {
        connectSSE();
      }
    }
  });
});
