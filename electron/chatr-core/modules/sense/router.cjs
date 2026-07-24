'use strict';

/**
/**
 * CHATR Sense Engine — Router
 *
 * Routes for the Sense module.
 * The critical endpoint is POST /sense/observe — called by the UI
 * immediately after each message is sent.
 */

const express = require('express');
const { observe, getHistory } = require('./service.cjs');
const { randomUUID } = require('crypto');

const router = express.Router();

/**
 * POST /sense/observe
 */
router.post('/observe', async (req, res) => {
  const { messageText, conversationId, userId } = req.body || {};

  if (!messageText || !conversationId) {
    return res.status(400).json({ ok: false, error: 'Missing messageText or conversationId', classifications: [] });
  }

  const requestId = req.requestId || randomUUID();
  const classifications = await observe({ messageText, conversationId, requestId });

  res.json({ ok: true, classifications, requestId });
});

/**
 * GET /sense/history/:conversationId
 */
router.get('/history/:conversationId', (req, res) => {
  const history = getHistory(req.params.conversationId);
  res.json({ ok: true, conversationId: req.params.conversationId, history });
});

/**
 * GET /sense/version
 */
router.get('/version', (req, res) => {
  const manifest = require('./module.json');
  res.json({
    name:     manifest.name,
    version:  manifest.version,
    codename: manifest.codename,
    magic:    manifest.magic,
    status:   manifest.status,
  });
});

module.exports = { router };
