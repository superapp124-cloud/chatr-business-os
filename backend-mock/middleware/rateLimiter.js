'use strict';
/**
 * rateLimiter.js — Socket.IO Event Rate Limiter
 *
 * Token-bucket algorithm: each user gets 20 tokens/second.
 * A token is consumed per event. Events arriving when bucket is empty
 * are dropped and the offending socket is warned.
 *
 * Usage (per-socket, in connection handler):
 *   const createRateLimiter = require('./middleware/rateLimiter');
 *   const limiter = createRateLimiter(socket.data.userId);
 *   socket.use(([event, ...args], next) => {
 *     if (!limiter.consume()) return; // drop silently
 *     next();
 *   });
 */

const RATE = 20;          // tokens per second
const BURST = 30;         // max burst tokens
const REFILL_INTERVAL_MS = 1000;

// Global bucket store — keyed by userId
const buckets = new Map();

// Periodic cleanup of stale buckets (every 5 minutes)
setInterval(() => {
  const staleAge = Date.now() - 5 * 60 * 1000;
  for (const [userId, bucket] of buckets) {
    if (bucket.lastRefill < staleAge) {
      buckets.delete(userId);
    }
  }
}, 5 * 60 * 1000);

/**
 * Returns a rate-limiter for the given userId.
 * @param {string} userId
 * @returns {{ consume: () => boolean }}
 */
function createRateLimiter(userId) {
  if (!buckets.has(userId)) {
    buckets.set(userId, { tokens: BURST, lastRefill: Date.now() });
  }

  return {
    /**
     * Attempt to consume one token.
     * @returns {boolean} true if allowed, false if rate-limited
     */
    consume() {
      const bucket = buckets.get(userId);
      const now = Date.now();
      const elapsed = (now - bucket.lastRefill) / REFILL_INTERVAL_MS;

      // Refill tokens based on elapsed time
      bucket.tokens = Math.min(BURST, bucket.tokens + elapsed * RATE);
      bucket.lastRefill = now;

      if (bucket.tokens < 1) {
        return false; // rate limited
      }

      bucket.tokens -= 1;
      return true;
    },
  };
}

/**
 * Socket.IO middleware factory — attaches per-socket rate limiter.
 * Drops events and emits rate_limited error to the client when exceeded.
 *
 * @param {import('socket.io').Socket} socket
 * @returns {Function} Socket.IO use() middleware
 */
function rateLimiterMiddleware(socket) {
  const limiter = createRateLimiter(socket.data.userId || socket.id);

  return ([event, ...args], next) => {
    // Never rate-limit system events
    const systemEvents = ['disconnect', 'disconnecting', 'error'];
    if (systemEvents.includes(event)) return next();

    if (!limiter.consume()) {
      socket.emit('rate_limited', {
        event,
        message: 'Rate limit exceeded (20 events/sec). Please slow down.',
        retryAfter: 1000,
      });
      return; // drop — do NOT call next()
    }

    next();
  };
}

module.exports = { createRateLimiter, rateLimiterMiddleware };
