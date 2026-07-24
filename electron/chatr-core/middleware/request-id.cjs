'use strict';

/**
 * CHATR Kernel — Request ID Middleware
 *
 * Attaches a unique UUID to every incoming request.
 * Downstream logs, events, and the SSE stream all reference this ID.
 *
 * Genesis v1.0
 */

const { randomUUID } = require('crypto');

function requestId(req, res, next) {
  req.requestId = randomUUID();
  res.setHeader('X-Request-ID', req.requestId);
  next();
}

module.exports = { requestId };
