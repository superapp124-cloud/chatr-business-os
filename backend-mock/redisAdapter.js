'use strict';
/**
 * redisAdapter.js — Optional Redis Adapter for Socket.IO
 *
 * When REDIS_URL is present: attaches @socket.io/redis-adapter so that
 * Socket.IO events are broadcast across ALL server instances.
 *
 * When REDIS_URL is absent: single-node mode, no-op. All functionality
 * works on a single server. Zero breaking changes.
 *
 * Supports Upstash Redis (TLS URLs: rediss://...) automatically.
 *
 * Usage:
 *   const { attachRedisAdapter } = require('./redisAdapter');
 *   await attachRedisAdapter(io);
 */

const REDIS_URL = process.env.REDIS_URL;

/**
 * Attaches the Redis adapter to the Socket.IO server instance.
 * @param {import('socket.io').Server} io
 * @returns {Promise<{ redis: any|null, mode: 'redis'|'single-node' }>}
 */
async function attachRedisAdapter(io) {
  if (!REDIS_URL) {
    console.log('ℹ️  [Redis] REDIS_URL not set — running in single-node mode');
    return { redis: null, mode: 'single-node' };
  }

  try {
    const { createAdapter } = require('@socket.io/redis-adapter');
    const { Redis } = require('ioredis');

    const redisOptions = {
      maxRetriesPerRequest: null,        // Required for ioredis + Socket.IO
      enableReadyCheck: false,           // Required for Upstash
      lazyConnect: false,
    };

    // Upstash and other TLS providers use rediss:// scheme
    const pubClient = new Redis(REDIS_URL, redisOptions);
    const subClient = pubClient.duplicate();

    await Promise.all([
      new Promise((resolve, reject) => {
        pubClient.once('ready', resolve);
        pubClient.once('error', reject);
      }),
      new Promise((resolve, reject) => {
        subClient.once('ready', resolve);
        subClient.once('error', reject);
      }),
    ]);

    io.adapter(createAdapter(pubClient, subClient));

    console.log('✅ [Redis] Adapter attached — multi-node scaling enabled');
    console.log(`   URL: ${REDIS_URL.replace(/:([^@/]+)@/, ':***@')}`); // mask password

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      await pubClient.quit();
      await subClient.quit();
    });
    process.on('SIGINT', async () => {
      await pubClient.quit();
      await subClient.quit();
    });

    return { redis: pubClient, mode: 'redis' };
  } catch (err) {
    console.error('⚠️  [Redis] Failed to attach adapter, falling back to single-node:', err.message);
    console.warn('   Messages will NOT be shared across multiple server instances');
    return { redis: null, mode: 'single-node' };
  }
}

module.exports = { attachRedisAdapter };
