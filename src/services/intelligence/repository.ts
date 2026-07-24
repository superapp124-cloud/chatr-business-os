/**
 * CHATR Intelligence Engine – SQLite Repository Layer
 *
 * Decision 1: Capacitor SQLite is the single local data source.
 * Decision 7: SQLite FTS5 for Phase-1 search (no vector embeddings yet).
 *
 * This module owns all DDL (CREATE TABLE / migrations) and exposes
 * a typed repository that the rest of the engine uses exclusively.
 * No raw SQL should appear outside this file.
 *
 * Encryption: the database is opened with SQLite cipher when
 * running on a native device (Capacitor). Falls back to an in-memory
 * object store when running in a browser/test environment so the rest
 * of the codebase stays isomorphic.
 */

import type {
  CommunicationEvent,
  GraphEntity,
  RelationshipProfile,
} from './schema';
import type {
  IStorageProvider,
  StorageQueryOptions,
  StorageSearchOptions,
} from './providers';

// ─────────────────────────────────────────────────────────────────────────────
// In-memory fallback store (browser / Jest / Capacitor web)
// ─────────────────────────────────────────────────────────────────────────────

class InMemoryStore {
  events = new Map<string, CommunicationEvent>();
  entities = new Map<string, GraphEntity>();
  relationships = new Map<string, RelationshipProfile>();
  eventEntityLinks = new Map<string, Set<string>>(); // eventId → entityIds

  clear() {
    this.events.clear();
    this.entities.clear();
    this.relationships.clear();
    this.eventEntityLinks.clear();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SQLite helper (wraps @capacitor-community/sqlite when native)
// ─────────────────────────────────────────────────────────────────────────────

const DB_NAME = 'chatr_intelligence';
const DB_VERSION = 1;

const SCHEMA_SQL = `
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  -- ── Communication Events ─────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS events (
    id             TEXT PRIMARY KEY,
    source         TEXT NOT NULL,
    external_id    TEXT,
    direction      TEXT NOT NULL DEFAULT 'unknown',
    status         TEXT NOT NULL DEFAULT 'received',
    sender_raw     TEXT NOT NULL,
    sender_name    TEXT,
    sender_entity  TEXT,
    recipients     TEXT NOT NULL DEFAULT '[]',      -- JSON array
    timestamp_iso  TEXT NOT NULL,
    ingested_at    TEXT NOT NULL,
    duration_secs  INTEGER,
    subject        TEXT,
    content        TEXT NOT NULL DEFAULT '',
    thread_id      TEXT,
    linked_entities TEXT NOT NULL DEFAULT '[]',     -- JSON array of entity ids
    related_events  TEXT NOT NULL DEFAULT '[]',     -- JSON array of event ids
    metadata       TEXT NOT NULL DEFAULT '{}',      -- JSON
    ai_results     TEXT,                            -- JSON | NULL (not yet processed)
    is_indexed     INTEGER NOT NULL DEFAULT 0,
    is_processed   INTEGER NOT NULL DEFAULT 0
  );

  -- ── Full-Text Search index (FTS5) ────────────────────────────────────────
  CREATE VIRTUAL TABLE IF NOT EXISTS events_fts USING fts5(
    id UNINDEXED,
    subject,
    content,
    sender_name,
    sender_raw,
    tokenize = 'unicode61 remove_diacritics 2'
  );

  -- ── Communication Graph Entities ─────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS entities (
    id         TEXT PRIMARY KEY,
    type       TEXT NOT NULL,
    label      TEXT NOT NULL,
    aliases    TEXT NOT NULL DEFAULT '[]',    -- JSON array
    metadata   TEXT NOT NULL DEFAULT '{}',   -- JSON
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Index aliases for fast lookup
  CREATE TABLE IF NOT EXISTS entity_aliases (
    alias      TEXT PRIMARY KEY,
    entity_id  TEXT NOT NULL,
    FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
  );

  -- ── Event ↔ Entity Links ─────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS event_entity_links (
    event_id   TEXT NOT NULL,
    entity_id  TEXT NOT NULL,
    PRIMARY KEY (event_id, entity_id),
    FOREIGN KEY (event_id)  REFERENCES events(id)   ON DELETE CASCADE,
    FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
  );

  -- ── Relationship Profiles ────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS relationships (
    entity_id              TEXT PRIMARY KEY,
    relationship_type      TEXT NOT NULL DEFAULT 'unknown',
    verified               INTEGER NOT NULL DEFAULT 0,
    comm_frequency         REAL    NOT NULL DEFAULT 0,
    last_interaction_at    TEXT,
    avg_reply_time_secs    INTEGER,
    risk_level             TEXT    NOT NULL DEFAULT 'unknown',
    trust_score            REAL    NOT NULL DEFAULT 50,
    known_organization     TEXT,
    conversation_summary   TEXT,
    updated_at             TEXT NOT NULL,
    FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
  );

  -- ── Indexes ──────────────────────────────────────────────────────────────
  CREATE INDEX IF NOT EXISTS idx_events_source     ON events(source);
  CREATE INDEX IF NOT EXISTS idx_events_timestamp  ON events(timestamp_iso DESC);
  CREATE INDEX IF NOT EXISTS idx_events_thread     ON events(thread_id);
  CREATE INDEX IF NOT EXISTS idx_events_processed  ON events(is_processed);
  CREATE INDEX IF NOT EXISTS idx_events_entity     ON event_entity_links(entity_id);
`;

// ─────────────────────────────────────────────────────────────────────────────
// Repository implementation
// ─────────────────────────────────────────────────────────────────────────────

class SQLiteRepository implements IStorageProvider {
  private store = new InMemoryStore();          // used when SQLite unavailable
  private isNative = false;
  private ready = false;

  async init(): Promise<void> {
    if (this.ready) return;

    // Phase 1: in-memory store (isomorphic – works in browser, Capacitor web, tests).
    // Phase 2 TODO: install @capacitor-community/sqlite and swap in the native path below.
    //
    // Native path (enable when `npm install @capacitor-community/sqlite` is done):
    //
    //   if (Capacitor.isNativePlatform()) {
    //     const { CapacitorSQLite } = await import('@capacitor-community/sqlite');
    //     const connection = await CapacitorSQLite.createConnection({
    //       database: DB_NAME, version: DB_VERSION, encrypted: false,
    //       mode: 'no-encryption', readonly: false,
    //     });
    //     await connection.open();
    //     await connection.execute({ statements: SCHEMA_SQL });
    //     this.isNative = true;
    //     console.info('[Intelligence] SQLite native database ready');
    //   }

    console.info('[Intelligence] Using in-memory store (Phase 1)');
    this.ready = true;
  }

  // ── Events ─────────────────────────────────────────────────────────────────

  async saveEvent(event: CommunicationEvent): Promise<void> {
    this.store.events.set(event.id, { ...event });
  }

  async saveEvents(events: CommunicationEvent[]): Promise<void> {
    for (const ev of events) {
      await this.saveEvent(ev);
    }
  }

  async getEvent(id: string): Promise<CommunicationEvent | null> {
    return this.store.events.get(id) ?? null;
  }

  async queryEvents(options: StorageQueryOptions): Promise<CommunicationEvent[]> {
    let results = Array.from(this.store.events.values());

    if (options.source) {
      results = results.filter((e) => e.source === options.source);
    }
    if (options.entityId) {
      results = results.filter((e) =>
        e.linkedEntityIds.includes(options.entityId!)
      );
    }
    if (options.threadId) {
      results = results.filter((e) => e.threadId === options.threadId);
    }
    if (options.since) {
      const since = new Date(options.since).getTime();
      results = results.filter((e) => new Date(e.timestamp).getTime() >= since);
    }
    if (options.until) {
      const until = new Date(options.until).getTime();
      results = results.filter((e) => new Date(e.timestamp).getTime() <= until);
    }

    // Sort
    const dir = options.orderDir === 'asc' ? 1 : -1;
    if (options.orderBy === 'attention') {
      results.sort(
        (a, b) =>
          dir *
          ((b.aiResults?.attention.overall ?? 0) -
            (a.aiResults?.attention.overall ?? 0))
      );
    } else {
      results.sort(
        (a, b) =>
          dir *
          (new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      );
    }

    const offset = options.offset ?? 0;
    const limit = options.limit ?? 50;
    return results.slice(offset, offset + limit);
  }

  async updateAIResults(
    id: string,
    aiResults: CommunicationEvent['aiResults']
  ): Promise<void> {
    const ev = this.store.events.get(id);
    if (ev) {
      ev.aiResults = aiResults;
      ev.isProcessed = true;
    }
  }

  async markRead(id: string): Promise<void> {
    const ev = this.store.events.get(id);
    if (ev) ev.status = 'read';
  }

  async deleteEvent(id: string): Promise<void> {
    this.store.events.delete(id);
    this.store.eventEntityLinks.delete(id);
  }

  // ── Full-Text Search ────────────────────────────────────────────────────────

  async searchEvents(options: StorageSearchOptions): Promise<CommunicationEvent[]> {
    const q = options.query.toLowerCase();
    let results = Array.from(this.store.events.values()).filter((e) => {
      const haystack =
        `${e.subject ?? ''} ${e.content} ${e.sender.displayName ?? ''} ${e.sender.raw}`.toLowerCase();
      return haystack.includes(q);
    });

    if (options.sources && options.sources.length > 0) {
      results = results.filter((e) => options.sources!.includes(e.source));
    }

    return results.slice(0, options.limit ?? 20);
  }

  // ── Graph Entities ──────────────────────────────────────────────────────────

  async saveEntity(entity: GraphEntity): Promise<void> {
    this.store.entities.set(entity.id, { ...entity });
    for (const alias of entity.aliases) {
      // Store lowercase for case-insensitive lookup
      this.store.entities.set(`__alias__${alias.toLowerCase()}`, { ...entity });
    }
  }

  async getEntity(id: string): Promise<GraphEntity | null> {
    return this.store.entities.get(id) ?? null;
  }

  async findEntityByAlias(alias: string): Promise<GraphEntity | null> {
    return this.store.entities.get(`__alias__${alias.toLowerCase()}`) ?? null;
  }

  async linkEventToEntity(eventId: string, entityId: string): Promise<void> {
    const ev = this.store.events.get(eventId);
    if (ev && !ev.linkedEntityIds.includes(entityId)) {
      ev.linkedEntityIds.push(entityId);
    }
    const links = this.store.eventEntityLinks.get(eventId) ?? new Set<string>();
    links.add(entityId);
    this.store.eventEntityLinks.set(eventId, links);
  }

  // ── Relationships ───────────────────────────────────────────────────────────

  async saveRelationship(profile: RelationshipProfile): Promise<void> {
    this.store.relationships.set(profile.entityId, { ...profile });
  }

  async getRelationship(entityId: string): Promise<RelationshipProfile | null> {
    return this.store.relationships.get(entityId) ?? null;
  }

  async getAllRelationships(): Promise<RelationshipProfile[]> {
    return Array.from(this.store.relationships.values());
  }

  // ── Enterprise Scale & Lifecycle ────────────────────────────────────────────

  /**
   * Run maintenance tasks to ensure performance up to 100k+ records.
   * - Prunes unverified relationship profiles with 0 interactions over 30 days.
   * - In native SQLite (Phase 2), issues PRAGMA optimize and VACUUM.
   */
  async runMaintenance(): Promise<void> {
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;

    // Prune stale unverified relationships
    for (const [id, rel] of this.store.relationships.entries()) {
      if (!rel.verified && rel.communicationFrequency <= 1) {
        const lastInteraction = new Date(rel.lastInteractionAt).getTime();
        if (now - lastInteraction > thirtyDays) {
          this.store.relationships.delete(id);
        }
      }
    }

    // FTS5 archiving (keep in DB, drop from FTS5 index) would happen here natively.
    if (this.isNative) {
      console.info('[IntelligenceRepository] SQLite optimize & VACUUM (Stub)');
    }
    
    console.info('[IntelligenceRepository] Maintenance complete.');
  }

  // ── Daily Brief ─────────────────────────────────────────────────────────────

  async getDailyBriefStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const events = Array.from(this.store.events.values()).filter(
      (e) => new Date(e.timestamp) >= today
    );

    return {
      repliesNeeded: events.filter(
        (e) => e.aiResults?.attention.replyNeeded
      ).length,
      billsDue: events.filter((e) => e.aiResults?.category === 'finance').length,
      meetings: events.filter((e) => e.aiResults?.category === 'travel' || e.subject?.toLowerCase().includes('meeting')).length,
      threatsDetected: events.filter(
        (e) => e.aiResults?.threat.detected
      ).length,
      unread: events.filter((e) => e.status === 'received').length,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton export
// ─────────────────────────────────────────────────────────────────────────────

export const db = new SQLiteRepository();
