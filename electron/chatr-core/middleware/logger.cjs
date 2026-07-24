'use strict';

/**
 * CHATR Kernel — Logger Middleware
 *
 * Logs every request with:
 *   requestId, method, path, conversationId, duration, status
 *
 * Also collects metrics for /metrics endpoint.
 *
 * Genesis v1.0
 */

const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

// In-memory metrics store (reset on restart — persistence comes later)
const _metrics = {
  totalRequests:  0,
  totalStreams:   0,
  totalErrors:    0,
  totalLatencyMs: 0,
  requestsByPath: {},
};

function getMetrics() {
  return {
    ..._metrics,
    avgLatencyMs: _metrics.totalRequests > 0
      ? Math.round(_metrics.totalLatencyMs / _metrics.totalRequests)
      : 0,
  };
}

function logger(req, res, next) {
  const startMs = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startMs;
    const path = req.path;

    _metrics.totalRequests++;
    _metrics.totalLatencyMs += durationMs;
    _metrics.requestsByPath[path] = (_metrics.requestsByPath[path] || 0) + 1;

    if (res.statusCode >= 400) _metrics.totalErrors++;
    if (path.includes('stream')) _metrics.totalStreams++;

    log.info('[CHATR Core]', {
      requestId:      req.requestId,
      method:         req.method,
      path,
      conversationId: req.body?.conversationId || '-',
      status:         res.statusCode,
      durationMs,
    });
  });

  next();
}

module.exports = { logger, getMetrics };
