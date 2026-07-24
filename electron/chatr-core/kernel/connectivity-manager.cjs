'use strict';

/**
 * CHATR Kernel — Connectivity Manager
 *
 * Detects network state and routes capabilities to local providers when offline.
 * Local capabilities work without any network connection:
 *   memory.search, local-identity, os-calendar, os-reminder, ollama
 */

const { EventEmitter } = require('events');
const { bus } = require('../events/bus.cjs');

const LOCAL_CAPABILITIES = new Set([
  'memory.search',
  'identity.resolve',
  'calendar.query',
  'calendar.create',
  'reminder.create',
  'reminder.list',
  'ai.complete',      // Ollama local
  'ai.chat',          // Ollama local
  'ai.embed',         // Ollama local
  'storage.read',
  'storage.write',
]);

class ConnectivityManager extends EventEmitter {
  constructor() {
    super();
    this._online = true; // Assume online at start
    this._checkedAt = null;
    this._checkInterval = null;
  }

  /**
   * Start periodic connectivity checks.
   * @param {number} intervalMs - How often to check (default: 30 seconds)
   */
  start(intervalMs = 30000) {
    this._check();
    this._checkInterval = setInterval(() => this._check(), intervalMs);
    return this;
  }

  stop() {
    if (this._checkInterval) {
      clearInterval(this._checkInterval);
      this._checkInterval = null;
    }
  }

  /**
   * Check connectivity by attempting a lightweight DNS lookup.
   */
  async _check() {
    const was = this._online;
    try {
      const dns = require('dns').promises;
      await dns.lookup('8.8.8.8');
      this._online = true;
    } catch {
      this._online = false;
    }
    this._checkedAt = Date.now();

    if (was !== this._online) {
      const eventType = this._online ? 'CONNECTIVITY_RESTORED' : 'CONNECTIVITY_LOST';
      bus.publish(eventType, { online: this._online, checkedAt: this._checkedAt });
      this.emit('change', { online: this._online });
    }
  }

  /**
   * Returns true if the given capability can run locally (offline-safe).
   */
  isLocalCapability(capabilityId) {
    return LOCAL_CAPABILITIES.has(capabilityId);
  }

  /**
   * Returns true if the system is currently online.
   */
  isOnline() {
    return this._online;
  }

  /**
   * Set connectivity state manually (for testing).
   */
  setOnline(value) {
    const was = this._online;
    this._online = value;
    if (was !== value) {
      const eventType = value ? 'CONNECTIVITY_RESTORED' : 'CONNECTIVITY_LOST';
      bus.publish(eventType, { online: value, checkedAt: Date.now(), source: 'manual' });
    }
  }

  /**
   * Returns current connectivity status.
   */
  getStatus() {
    return {
      online: this._online,
      checkedAt: this._checkedAt,
      localCapabilities: [...LOCAL_CAPABILITIES]
    };
  }
}

const connectivityManager = new ConnectivityManager();
module.exports = { ConnectivityManager, connectivityManager, LOCAL_CAPABILITIES };
