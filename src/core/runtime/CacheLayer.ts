/**
 * CHATR Kernel Runtime v2.0 — CacheLayer
 *
 * Layer 2 — Runtime Infrastructure
 *
 * Keyed TTL cache with:
 * - Domain namespacing (search:*, knowledge:*, relationship:*)
 * - Pattern-based invalidation
 * - LRU eviction when maxSize exceeded
 * - Hit/miss metrics for Telemetry
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;    // 0 = never expires
  createdAt: number;
  lastAccessedAt: number;
  hits: number;
}

interface CacheSetOptions {
  ttl?: number;         // milliseconds, 0 = no expiry
  domain?: string;      // for bulk invalidation e.g. 'search'
}

class CacheLayerImpl {
  private store = new Map<string, CacheEntry<unknown>>();
  private readonly MAX_SIZE = 500;
  private _hits = 0;
  private _misses = 0;

  // ── Get ───────────────────────────────────────────────────────────────────

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) { this._misses++; return null; }

    if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this._misses++;
      return null;
    }

    entry.lastAccessedAt = Date.now();
    entry.hits++;
    this._hits++;
    return entry.value as T;
  }

  // ── Set ───────────────────────────────────────────────────────────────────

  set<T>(key: string, value: T, opts?: CacheSetOptions): void {
    // Evict oldest entry if at capacity (LRU)
    if (this.store.size >= this.MAX_SIZE) {
      let oldestKey = '';
      let oldestAccess = Infinity;
      for (const [k, e] of this.store.entries()) {
        if (e.lastAccessedAt < oldestAccess) {
          oldestAccess = e.lastAccessedAt;
          oldestKey = k;
        }
      }
      if (oldestKey) this.store.delete(oldestKey);
    }

    const ttl = opts?.ttl ?? 0;
    this.store.set(key, {
      value,
      expiresAt: ttl > 0 ? Date.now() + ttl : 0,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      hits: 0,
    });
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  delete(key: string): void {
    this.store.delete(key);
  }

  /**
   * Pattern-based invalidation.
   * e.g. invalidate('relationship:*') removes all relationship: entries
   * e.g. invalidate('search:results:rahul*') removes matching entries
   */
  invalidate(pattern: string): number {
    const isWildcard = pattern.endsWith('*');
    const prefix = isWildcard ? pattern.slice(0, -1) : pattern;
    let count = 0;

    for (const key of this.store.keys()) {
      const matches = isWildcard ? key.startsWith(prefix) : key === pattern;
      if (matches) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  /** Convenience: clear all entries in a domain namespace */
  invalidateDomain(domain: string): number {
    return this.invalidate(`${domain}:*`);
  }

  // ── Has ───────────────────────────────────────────────────────────────────

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  // ── Metrics ───────────────────────────────────────────────────────────────

  get hitRate(): number {
    const total = this._hits + this._misses;
    return total === 0 ? 0 : this._hits / total;
  }

  get size(): number { return this.store.size; }
  get totalHits(): number { return this._hits; }
  get totalMisses(): number { return this._misses; }

  // ── Maintenance ───────────────────────────────────────────────────────────

  /** Purge all expired entries. Can be called periodically. */
  purgeExpired(): number {
    const now = Date.now();
    let count = 0;
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt > 0 && now > entry.expiresAt) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  clear(): void {
    this.store.clear();
    this._hits = 0;
    this._misses = 0;
  }
}

// Singleton
export const cache = new CacheLayerImpl();

// Start periodic purge (every 5 minutes)
setInterval(() => cache.purgeExpired(), 5 * 60 * 1000);

// Pre-defined TTL constants for consistency
export const TTL = {
  SEARCH_RESULTS:    60_000,     // 1 minute
  KNOWLEDGE_ENTITY:  300_000,    // 5 minutes
  RELATIONSHIP:      120_000,    // 2 minutes
  AI_CONTEXT:        30_000,     // 30 seconds
  CALENDAR_SLOTS:    30_000,     // 30 seconds
  WORKSPACE:         600_000,    // 10 minutes
  USER_PROFILE:      3_600_000,  // 1 hour
} as const;

export type { CacheLayerImpl };
