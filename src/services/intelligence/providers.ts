/**
 * CHATR Intelligence Engine – Provider Plugin Interfaces
 *
 * Every communication provider (SMS, Mail, Calls, Notifications, …)
 * implements these interfaces so the Intelligence Engine can consume
 * them without any provider-specific logic leaking into the core.
 *
 * Decision 6: Plugin architecture – each plugin emits standardised events.
 * Decision 12: Every module exposes interfaces for enterprise extensibility.
 */

import type {
  CommunicationEvent,
  CommunicationSource,
  GraphEntity,
  RelationshipProfile,
} from './schema';

// ─────────────────────────────────────────────────────────────────────────────
// Plugin Lifecycle
// ─────────────────────────────────────────────────────────────────────────────

export interface PluginCapabilities {
  canSend: boolean;
  canReceive: boolean;
  canSearch: boolean;
  canSync: boolean;
  supportsAttachments: boolean;
  supportsThreads: boolean;
  requiresOAuth: boolean;
}

export interface PluginStatus {
  connected: boolean;
  lastSyncAt?: string;   // ISO 8601
  accountId?: string;
  displayName?: string;
  error?: string;
}

/**
 * Every communication plugin implements this interface.
 * The plugin is responsible for translating provider-specific data
 * into the canonical CommunicationEvent schema.
 */
export interface ICommunicationProvider {
  /** Unique identifier, matches CommunicationSource */
  readonly source: CommunicationSource;
  readonly displayName: string;
  readonly capabilities: PluginCapabilities;

  /** Initialise / connect the plugin */
  connect(options?: Record<string, unknown>): Promise<PluginStatus>;

  /** Gracefully disconnect and clean up listeners */
  disconnect(): Promise<void>;

  /** Pull the latest communications and emit them as events */
  sync(since?: string): Promise<CommunicationEvent[]>;

  /** Current connection status */
  getStatus(): PluginStatus;

  /**
   * Register a listener so the plugin can push real-time events
   * (e.g. SMS received via native broadcast) into the pipeline.
   */
  onEvent(handler: (event: CommunicationEvent) => void): void;

  /** Remove previously registered listener */
  offEvent(handler: (event: CommunicationEvent) => void): void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage Provider
// ─────────────────────────────────────────────────────────────────────────────

export interface StorageQueryOptions {
  source?: CommunicationSource;
  since?: string;        // ISO 8601
  until?: string;        // ISO 8601
  entityId?: string;
  threadId?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'timestamp' | 'attention';
  orderDir?: 'asc' | 'desc';
}

export interface StorageSearchOptions {
  query: string;
  sources?: CommunicationSource[];
  limit?: number;
}

/**
 * Abstraction over the local SQLite database.
 * Swap the underlying engine without touching the Intelligence pipeline.
 */
export interface IStorageProvider {
  /** Initialise the database and run migrations */
  init(): Promise<void>;

  // ── CommunicationEvents ───────────────────────────────────────────────────
  saveEvent(event: CommunicationEvent): Promise<void>;
  saveEvents(events: CommunicationEvent[]): Promise<void>;
  getEvent(id: string): Promise<CommunicationEvent | null>;
  queryEvents(options: StorageQueryOptions): Promise<CommunicationEvent[]>;
  updateAIResults(
    id: string,
    aiResults: CommunicationEvent['aiResults']
  ): Promise<void>;
  markRead(id: string): Promise<void>;
  deleteEvent(id: string): Promise<void>;

  // ── Full-Text Search (FTS5) ────────────────────────────────────────────────
  searchEvents(options: StorageSearchOptions): Promise<CommunicationEvent[]>;

  // ── Graph Entities ────────────────────────────────────────────────────────
  saveEntity(entity: GraphEntity): Promise<void>;
  getEntity(id: string): Promise<GraphEntity | null>;
  findEntityByAlias(alias: string): Promise<GraphEntity | null>;
  linkEventToEntity(eventId: string, entityId: string): Promise<void>;

  // ── Relationship Profiles ─────────────────────────────────────────────────
  saveRelationship(profile: RelationshipProfile): Promise<void>;
  getRelationship(entityId: string): Promise<RelationshipProfile | null>;
  getAllRelationships(): Promise<RelationshipProfile[]>;

  /** Aggregate daily brief data */
  getDailyBriefStats(): Promise<{
    repliesNeeded: number;
    billsDue: number;
    meetings: number;
    threatsDetected: number;
    unread: number;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Threat Provider
// ─────────────────────────────────────────────────────────────────────────────

import type { ThreatResult } from './schema';

export interface IThreatProvider {
  /**
   * Analyse a communication event for threats.
   * Must run fully locally unless explicitly opted in to cloud.
   */
  analyse(event: CommunicationEvent): Promise<ThreatResult>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Search Provider
// ─────────────────────────────────────────────────────────────────────────────

export interface SearchResult {
  event: CommunicationEvent;
  /** Relevance score 0–1 */
  score: number;
  /** Highlighted snippet for the UI */
  snippet: string;
}

export interface ISearchProvider {
  /** Index a new or updated event */
  index(event: CommunicationEvent): Promise<void>;
  /** Batch index */
  indexAll(events: CommunicationEvent[]): Promise<void>;
  /** Natural language / keyword search */
  search(query: string, limit?: number): Promise<SearchResult[]>;
  /** Remove event from index */
  removeFromIndex(id: string): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Provider (Decision 11 – local-first, cloud optional)
// ─────────────────────────────────────────────────────────────────────────────

import type { AIResults } from './schema';

export type AIProcessingMode = 'local' | 'cloud';

export interface IAIProvider {
  readonly mode: AIProcessingMode;
  readonly isAvailable: boolean;

  /**
   * Run the full AI pipeline for one event.
   * Throws if unavailable so the caller can fall back gracefully.
   */
  process(event: CommunicationEvent): Promise<AIResults>;
}
