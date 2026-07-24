'use strict';

/**
 * CHATR Kernel — Resource Manager
 * Platform Milestone C — ABI v0.9 RC
 *
 * Input:  goal_id, resource, quantity, priority, owner, ttl_ms
 *
 * Output: ResourceLease (abi: chatr.resource_lease.v0_9_rc)
 *         Immutable. Persisted. Published on event bus.
 *
 * Events: resource.leasing → resource.leased
 *         resource.released
 *         resource.expired
 *         resource.failed
 *
 * Rules:
 *   - Tracks in-flight leases by resource type and goal.
 *   - Enforces capacity limits.
 *   - Supports lease expiry (TTL) to prevent leaks.
 */

const crypto = require('crypto');
const { RESOURCE } = require('../events/events.cjs');

const ABI               = 'chatr.resource_lease.v0_9_rc';
const COLLECTION        = 'kernel_resource_leases_v0_9_rc';
const LEASE_VERSION     = 1;

/**
 * Global resource limits.
 * In a real implementation, this would be dynamic and configurable.
 */
const RESOURCE_CAPACITY = {
  browser_session: 5,
  network_slot: 20,
  llm_inference: 2,
  cpu_bound: 4,
};

class ResourceManager {
  constructor(options = {}) {
    this._persistence = options.persistence || getDefaultPersistence();
    this._bus         = options.bus         || getDefaultBus();
    this._now         = normalizeNow(options.now);
    this._setTimeout  = options.setTimeout  || setTimeout;
    this._clearTimeout= options.clearTimeout|| clearTimeout;
    
    this._leases      = new Map();
    this._timers      = new Map();
    this._loadFromDisk();
  }

  /**
   * Acquire a resource lease.
   *
   * @param {object} input
   * @param {string} input.goal_id
   * @param {string} input.resource  (e.g., 'browser_session')
   * @param {number} [input.quantity] default 1
   * @param {string} [input.priority] default 'normal'
   * @param {string} input.owner
   * @param {number} [input.ttl_ms] default 30000
   * @param {boolean} [input.renewable] default true
   * @returns {object} ResourceLease — immutable, persisted
   */
  lease(input = {}) {
    const goalId        = input.goal_id || input.goalId;
    const resource      = input.resource;
    const quantity      = input.quantity || 1;
    const priority      = input.priority || 'normal';
    const owner         = input.owner;
    const ttlMs         = input.ttl_ms || 30000;
    const renewable     = input.renewable !== false;
    const correlationId = input.correlation_id || goalId;
    const leasedAt      = this._now();

    if (!goalId) throw new Error('ResourceManager requires goal_id');
    if (!resource) throw new Error('ResourceManager requires resource');
    if (!owner) throw new Error('ResourceManager requires owner');

    this._publish(RESOURCE.LEASING, {
      goal_id:        goalId,
      resource,
      quantity,
      owner,
      correlation_id: correlationId,
      source:         'ResourceManager',
    });

    try {
      if (!RESOURCE_CAPACITY.hasOwnProperty(resource)) {
        throw new Error(`Unknown resource type: ${resource}`);
      }

      const available = this._getAvailableCapacity(resource);
      if (quantity > available) {
        throw new Error(`Insufficient capacity for ${resource}. Requested: ${quantity}, Available: ${available}`);
      }

      const expiresAt = new Date(new Date(leasedAt).getTime() + ttlMs).toISOString();

      const leaseObj = buildResourceLease({
        goalId,
        resource,
        quantity,
        priority,
        owner,
        ttlMs,
        renewable,
        expiresAt,
      });

      validateResourceLease(leaseObj);
      const immutable = deepFreeze(leaseObj);

      if (!input.dry_run) {
        this._leases.set(immutable.lease_id, immutable);
        this._scheduleExpiry(immutable);
        this._persist();
      }

      this._publish(RESOURCE.LEASED, {
        goal_id:        goalId,
        lease_id:       immutable.lease_id,
        resource:       immutable.resource,
        expires_at:     immutable.expires_at,
        correlation_id: correlationId,
        source:         'ResourceManager',
      });

      return immutable;
    } catch (error) {
      this._publish(RESOURCE.FAILED, {
        goal_id:        goalId,
        resource,
        error:          error.message,
        correlation_id: correlationId,
        source:         'ResourceManager',
      });
      throw error;
    }
  }

  /**
   * Release an active lease.
   */
  release(leaseId) {
    const lease = this._leases.get(leaseId);
    if (!lease) return false;

    this._leases.delete(leaseId);
    
    if (this._timers.has(leaseId)) {
      this._clearTimeout(this._timers.get(leaseId));
      this._timers.delete(leaseId);
    }

    this._persist();

    this._publish(RESOURCE.RELEASED, {
      goal_id:  lease.goal_id,
      lease_id: leaseId,
      resource: lease.resource,
      source:   'ResourceManager',
    });

    return true;
  }

  _getAvailableCapacity(resource) {
    const max = RESOURCE_CAPACITY[resource] || 0;
    let used = 0;
    const now = new Date(this._now()).getTime();

    for (const [id, lease] of this._leases.entries()) {
      if (lease.resource === resource) {
        // Optimistic cleanup of expired leases
        if (new Date(lease.expires_at).getTime() <= now) {
          this._expire(lease);
        } else {
          used += lease.quantity;
        }
      }
    }
    return Math.max(0, max - used);
  }

  _scheduleExpiry(lease) {
    if (this._timers.has(lease.lease_id)) return;
    
    const now = new Date(this._now()).getTime();
    const expiresAt = new Date(lease.expires_at).getTime();
    const delay = Math.max(0, expiresAt - now);

    const timerId = this._setTimeout(() => {
      this._expire(lease);
    }, delay);

    this._timers.set(lease.lease_id, timerId);
  }

  _expire(lease) {
    if (!this._leases.has(lease.lease_id)) return;

    this._leases.delete(lease.lease_id);
    this._timers.delete(lease.lease_id);
    this._persist();

    this._publish(RESOURCE.EXPIRED, {
      goal_id:  lease.goal_id,
      lease_id: lease.lease_id,
      resource: lease.resource,
      source:   'ResourceManager',
    });
  }

  getLease(id) {
    return this._leases.get(id) || null;
  }

  listLeases() {
    return Array.from(this._leases.values());
  }

  _loadFromDisk() {
    const stored = this._persistence.retrieve(COLLECTION);
    this._leases.clear();
    const now = new Date(this._now()).getTime();

    for (const l of stored?.leases || []) {
      try {
        validateResourceLease(l);
        if (new Date(l.expires_at).getTime() > now) {
          this._leases.set(l.lease_id, deepFreeze(l));
          this._scheduleExpiry(l);
        }
      } catch {
        // Skip corrupted records
      }
    }
  }

  _persist() {
    return this._persistence.store(COLLECTION, {
      abi:        ABI,
      leases:     this.listLeases(),
      updated_at: this._now(),
    });
  }

  _publish(eventName, payload) {
    if (this._bus && typeof this._bus.publish === 'function') {
      this._bus.publish(eventName, payload);
    }
  }
}

// ── ABI object construction ───────────────────────────────────────────────────

function buildResourceLease({ goalId, resource, quantity, priority, owner, ttlMs, renewable, expiresAt }) {
  const leaseId = `lease_${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`;
  
  return {
    abi:            ABI,
    lease_version:  LEASE_VERSION,
    lease_id:       leaseId,
    goal_id:        goalId,
    owner:          owner,
    resource:       resource,
    quantity:       quantity,
    priority:       priority,
    ttl_ms:         ttlMs,
    renewable:      renewable,
    expires_at:     expiresAt,
  };
}

// ── Validation ────────────────────────────────────────────────────────────────

function validateResourceLease(l) {
  if (!l || typeof l !== 'object') {
    throw new Error('ResourceLease must be an object');
  }
  if (l.abi !== ABI) {
    throw new Error(`Invalid ResourceLease ABI: ${l.abi}`);
  }
  if (!l.lease_id || typeof l.lease_id !== 'string') {
    throw new Error('ResourceLease requires lease_id');
  }
  if (!l.goal_id || typeof l.goal_id !== 'string') {
    throw new Error('ResourceLease requires goal_id');
  }
  if (!l.owner || typeof l.owner !== 'string') {
    throw new Error('ResourceLease requires owner');
  }
  if (!l.resource || typeof l.resource !== 'string') {
    throw new Error('ResourceLease requires resource');
  }
  if (typeof l.quantity !== 'number' || l.quantity <= 0) {
    throw new Error('ResourceLease requires positive quantity');
  }
  if (typeof l.ttl_ms !== 'number' || l.ttl_ms <= 0) {
    throw new Error('ResourceLease requires positive ttl_ms');
  }
  if (Number.isNaN(Date.parse(l.expires_at))) {
    throw new Error('ResourceLease requires expires_at ISO timestamp');
  }
  return true;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function deepFreeze(v) {
  if (!v || typeof v !== 'object' || Object.isFrozen(v)) return v;
  Object.freeze(v);
  for (const nested of Object.values(v)) deepFreeze(nested);
  return v;
}

function normalizeNow(now) {
  return typeof now === 'function' ? now : () => new Date().toISOString();
}

function getDefaultPersistence() {
  return require('../db/persistence.cjs');
}

function getDefaultBus() {
  return require('../events/bus.cjs').bus;
}

// ── Singleton ─────────────────────────────────────────────────────────────────

let _default = null;

function getResourceManager() {
  if (!_default) _default = new ResourceManager();
  return _default;
}

// ── Exports ───────────────────────────────────────────────────────────────────

const exported = {
  ABI,
  ResourceManager,
  COLLECTION,
  LEASE_VERSION,
  RESOURCE_CAPACITY,
  validateResourceLease,
  deepFreeze,
  getResourceManager,
};

Object.defineProperty(exported, 'resourceManager', {
  enumerable: true,
  get: getResourceManager,
});

module.exports = exported;
