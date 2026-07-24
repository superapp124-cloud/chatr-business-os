'use strict';

/**
 * CHATR Kernel — SSE Transport
 *
 * Normalizes Server-Sent Events so UI only ever receives:
 *   conversation.started
 *   conversation.delta   { token }
 *   conversation.completed { totalTokens, latencyMs }
 *   conversation.error   { code, message }
 *   conversation.cancelled
 *
 * No raw Ollama events ever reach the renderer.
 *
 * Genesis v1.0
 */

const transportConfig = require('../config/transport.config.cjs');

/**
 * Initialize SSE headers on a response object.
 * @param {import('express').Response} res
 */
function initSSE(res) {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering
  res.flushHeaders();
}

/**
 * Write a normalized SSE event to the response.
 * @param {import('express').Response} res
 * @param {string} eventName
 * @param {object} data
 */
function sendEvent(res, eventName, data = {}) {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

/**
 * Start a managed SSE session with heartbeat.
 * Returns { send, close } helpers.
 */
function createSSESession(res) {
  initSSE(res);

  // Heartbeat keeps the connection alive through Electron's local proxy
  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch { /* closed */ }
  }, transportConfig.sse.heartbeatIntervalMs);

  const send = (eventName, data) => {
    try {
      sendEvent(res, eventName, data);
    } catch {
      // Connection closed by client — ignore
    }
  };

  const close = () => {
    clearInterval(heartbeat);
    try { res.end(); } catch { /* already closed */ }
  };

  // Clean up if client disconnects
  res.on('close', () => clearInterval(heartbeat));

  return { send, close };
}

module.exports = { initSSE, sendEvent, createSSESession };
