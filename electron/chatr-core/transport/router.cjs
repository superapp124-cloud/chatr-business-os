/**
 * CHATR Kernel 1.0 — Event Router
 *
 * Exposes scoped Server-Sent Events streams to UI clients.
 * Filters kernel events by scope so clients only receive relevant state.
 */
const { Router } = require('express');
const { createSSESession } = require('./sse.cjs');
const { bus } = require('../events/bus.cjs');

const router = Router();
const { randomUUID } = require('crypto');

router.get('/stream', (req, res) => {
  const scope = req.query.scope || 'global';
  const session = createSSESession(res);

  // Send an initial handshake event
  session.send('KERNEL.STREAM.CONNECTED', { scope, timestamp: Date.now() });

  // Subscribe to all kernel events via the wildcard
  const handler = ({ eventName, envelope }) => {
    // Event Filtering
    if (eventName === 'KERNEL.LEARNING.COMPLETE') return; // Learning stays invisible

    // Scope check: send if global, or if event scope matches requested scope
    if (scope === 'global' || envelope.scope === 'global' || envelope.scope === scope) {
      session.send(eventName, envelope);
    }
  };

  bus.subscribe('*', handler);

  req.on('close', () => {
    bus.unsubscribe('*', handler);
    session.close();
  });
});

// UI submits an action (e.g. from Outcome Engine)
router.post('/action', (req, res) => {
  const { action, payload, correlationId } = req.body;
  const cid = correlationId || randomUUID();
  
  if (!action) {
    return res.status(400).json({ error: 'Action type required' });
  }

  // Publish to the bus so executors can pick it up
  if (action.type === 'DISMISS_SUGGESTION') {
    bus.publish('KERNEL.SUGGESTION.DISMISSED', {
      action,
      payload,
      correlationId: cid
    });
  } else {
    bus.publish('KERNEL.ACTION.CONFIRMED', {
      action,
      payload,
      correlationId: cid
    });
  }

  res.json({ status: 'queued', correlationId: cid });
});

// Fetch telemetry traces for Beta Command Center
router.get('/telemetry', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const tracePath = path.join(process.env.APPDATA || process.env.HOME || '', '.chatr', 'trace.jsonl');
  
  if (!fs.existsSync(tracePath)) {
    return res.json({ traces: [] });
  }
  
  try {
    const data = fs.readFileSync(tracePath, 'utf8');
    const traces = data
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
    res.json({ traces });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read telemetry data' });
  }
});

module.exports = { router };
