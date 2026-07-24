'use strict';

/**
 * CHATR Kernel — Conversation Module Router
 *
 * Route definitions only. Zero business logic here.
 * All work is delegated to the Conversation Service.
 *
 * Genesis v1.0
 */

const express  = require('express');
const { chat, stream } = require('./service.cjs');
const { randomUUID }   = require('crypto');

const router = express.Router();

// POST /conversation/chat  — One-shot response
router.post('/chat', async (req, res) => {
  try {
    const { conversationId, message, userId } = req.body || {};
    const result = await chat({
      conversationId,
      message,
      userId,
      requestId: req.requestId || randomUUID(),
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.code || 'ERROR', message: err.message });
  }
});

// POST /conversation/stream  — SSE streaming response
router.post('/stream', async (req, res) => {
  const { conversationId, message, userId } = req.body || {};
  // stream() manages the response lifecycle (SSE headers, events, close)
  await stream({
    conversationId,
    message,
    userId,
    requestId: req.requestId || randomUUID(),
  }, res);
});

module.exports = { router };
