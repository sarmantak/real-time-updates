/**
 * Long-Polling Client - Vanilla JavaScript (ES6)
 * 
 * Architecture:
 * - subscribe(): Recursive async function that continuously polls /poll endpoint
 * - Cache-busting: Uses timestamp in query params to prevent caching
 * - Error Resilience: Implements exponential backoff on errors
 * - Timeout Safety: Handles 204 responses and network timeouts gracefully
 */

// ============================================================================
// State Management
// ============================================================================

const STATE = {
  isRunning: false,
  pollCount: 0,
  messageCount: 0,
  retryDelay: 1000, // Start with 1 second
  maxRetryDelay: 5000, // Max 5 seconds
};

// ============================================================================
// DOM Elements
// ============================================================================

const elements = {
  messageInput: document.getElementById('messageInput'),
  statusIndicator: document.getElementById('statusIndicator'),
  statusText: document.getElementById('statusText'),
  pollCount: document.getElementById('pollCount'),
  messageCount: document.getElementById('messageCount'),
  latestMessage: document.getElementById('latestMessage'),
  logContainer: document.getElementById('logContainer'),
  lastTrigger: document.getElementById('lastTrigger'),
};

// ============================================================================
// Logging Utilities
// ============================================================================

/**
 * Log an event to the UI and console.
 * @param {string} message - The message to log
 * @param {string} type - 'success', 'error', 'info', or 'default'
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

  // Also log to console for debugging
  console.log(`[${type.toUpperCase()}] ${message}`);
}

// ============================================================================
// UI Updates
// ============================================================================

/**
 * Update the polling status indicator.
 * @param {string} state - 'listening', 'idle', or 'error'
 */
function updateStatusIndicator(state) {
  const classes = ['listening', 'idle', 'error'];
  elements.statusIndicator.classList.remove(...classes);
  elements.statusIndicator.classList.add(state);

  const statuses = {
    listening: '🔄 Listening for messages...',
    idle: '⏸️ Waiting to reconnect...',
    error: '❌ Error - Retrying...',
  };

  elements.statusText.textContent = statuses[state] || statuses.listening;
}

/**
 * Update the UI with the latest message.
 * @param {string} message - The message to display
 */
function updateLatestMessage(message) {
  elements.latestMessage.textContent = message;
  STATE.messageCount++;
  elements.messageCount.textContent = STATE.messageCount;
}

/**
 * Update poll count.
 */
function incrementPollCount() {
  STATE.pollCount++;
  elements.pollCount.textContent = STATE.pollCount;
}

/**
 * Reset retry delay on successful connection.
 */
function resetRetryDelay() {
  STATE.retryDelay = 1000;
}

/**
 * Increase retry delay with exponential backoff (max 5 seconds).
 */
function increaseRetryDelay() {
  STATE.retryDelay = Math.min(STATE.retryDelay * 1.5, STATE.maxRetryDelay);
}

// ============================================================================
// Long-Polling Logic
// ============================================================================

/**
 * Wait for a specified time before retrying.
 * Used for error resilience to avoid hammering the server.
 * @param {number} ms - Milliseconds to wait
 */
async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Main polling function - recursive async loop.
 * 
 * Flow:
 * 1. Make a fetch request to /poll with cache-busting timestamp
 * 2. Wait for response
 * 3. If 200: Display message and restart polling immediately
 * 4. If 204: No data available, restart polling immediately
 * 5. On error: Log error, wait with exponential backoff, then restart
 */
async function subscribe() {
  if (!STATE.isRunning) return;

  try {
    updateStatusIndicator('listening');

    // Cache-busting timestamp to prevent browser/proxy caching
    const timestamp = Date.now();
    const url = `/poll?t=${timestamp}`;

    log(`📤 Sending poll request (${STATE.pollCount + 1})`, 'info');

    // Make the fetch request (no explicit timeout, rely on browser/server)
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });

    incrementPollCount();

    if (response.status === 200) {
      // Success: Data is available
      const data = await response.json();
      log(`✅ Message received: "${data.message}"`, 'success');
      updateLatestMessage(data.message);
      resetRetryDelay();
    } else if (response.status === 204) {
      // No Content: Timeout (no data available, restart polling)
      log(`⏱️ Poll timeout (30s) - no data available. Restarting...`, 'info');
      resetRetryDelay();
    } else {
      // Unexpected response
      log(`⚠️ Unexpected response status: ${response.status}`, 'error');
      increaseRetryDelay();
      await delay(STATE.retryDelay);
    }
  } catch (error) {
    // Network error, server down, or fetch interrupted
    updateStatusIndicator('error');
    log(
      `❌ Error: ${error.message || 'Connection failed'}. Retrying in ${(STATE.retryDelay / 1000).toFixed(1)}s...`,
      'error'
    );
    increaseRetryDelay();
    await delay(STATE.retryDelay);
  }

  // Recursively restart the polling loop
  if (STATE.isRunning) {
    subscribe();
  }
}

/**
 * Start the polling loop.
 */
function startPolling() {
  if (STATE.isRunning) return;

  STATE.isRunning = true;
  log('🚀 Polling started', 'success');
  subscribe();
}

/**
 * Stop the polling loop.
 */
function stopPolling() {
  STATE.isRunning = false;
  updateStatusIndicator('idle');
  log('🛑 Polling stopped', 'info');
}

// ============================================================================
// Message Sending
// ============================================================================

/**
 * Send a message to the server via POST /message.
 * The server will resolve all pending poll requests with this message.
 */
async function sendMessage() {
  const message = elements.messageInput.value.trim();

  if (!message) {
    log('⚠️ Message cannot be empty', 'error');
    return;
  }

  try {
    log(`📨 Sending message: "${message}"`, 'info');

    const response = await fetch('/message', {
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
      `✅ Message sent successfully (${data.resolvedCount} request(s) resolved)`,
      'success'
    );

    elements.lastTrigger.textContent = message;
    elements.messageInput.value = '';
  } catch (error) {
    log(`❌ Failed to send message: ${error.message}`, 'error');
  }
}

// ============================================================================
// Initialize
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  log('🎯 Long-Polling Client initialized', 'info');

  // Allow Enter key to send message
  elements.messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });

  // Wire up the Send button click handler
  const sendButton = document.querySelector('button');
  if (sendButton) {
    sendButton.addEventListener('click', sendMessage);
  }

  // Start polling when page loads
  startPolling();

  // Handle page unload
  window.addEventListener('beforeunload', () => {
    stopPolling();
  });

  // Handle visibility changes (pause polling when tab is hidden)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      log('📵 Tab is hidden - pausing polling', 'info');
      stopPolling();
    } else {
      log('📱 Tab is visible - resuming polling', 'info');
      startPolling();
    }
  });
});
