'use strict';

/**
 * CHATR Kernel — Transport Configuration
 */
module.exports = {
  cors: {
    origins: [
      'http://localhost:8086',
      'http://localhost:8087',
      'http://127.0.0.1:8086',
    ],
  },
  sse: {
    heartbeatIntervalMs: 15_000,    // Keep SSE connections alive
  },
};
