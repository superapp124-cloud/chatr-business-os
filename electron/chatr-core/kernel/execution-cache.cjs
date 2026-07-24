'use strict';

/**
 * Execution Cache
 * A memory store with capability-driven TTLs mapped by intent signature.
 */
class ExecutionCache {
  constructor() {
    this.cache = new Map();
    
    // Capability-specific TTLs
    this.ttls = {
      'DISCOVER': 30 * 1000,
      'FETCH_MENU': 60 * 1000,
      'SESSION': 5 * 60 * 1000,
      'OFFERS': 15 * 1000,
      'DEFAULT': 60 * 1000
    };
  }

  _generateSignature(capability, context) {
    return `${capability}|${context}`;
  }

  set(capability, context, data) {
    const signature = this._generateSignature(capability, context);
    const ttlMs = this.ttls[capability] || this.ttls['DEFAULT'];
    
    this.cache.set(signature, {
      data: data,
      expiresAt: Date.now() + ttlMs
    });
  }

  get(capability, context) {
    const signature = this._generateSignature(capability, context);
    const entry = this.cache.get(signature);

    if (entry) {
      if (Date.now() < entry.expiresAt) {
        return entry.data;
      }
      // Expired
      this.cache.delete(signature);
    }
    return null;
  }

  invalidate(capability, context) {
    const signature = this._generateSignature(capability, context);
    this.cache.delete(signature);
  }

  clear() {
    this.cache.clear();
  }
}

module.exports = { ExecutionCache };
