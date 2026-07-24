import { DomainEventType } from '../contracts/events/DomainEventRegistry';

/**
 * Represents a single immutable fact in the enterprise ledger.
 */
export interface KernelEvent<T = any> {
  globalSequence?: number;         // Assigned by database
  eventId: string;                 // UUID
  
  streamId: string;                // e.g., "urn:chatr:object:candidate:123"
  aggregateType: string;           // e.g., "Candidate"
  aggregateId: string;             // e.g., "123"
  expectedVersion: number;         // Optimistic concurrency
  commandId?: string;              // Idempotency key
  
  eventType: DomainEventType;
  timestamp: Date;
  
  actorId: string;                 // e.g., "urn:chatr:actor:employee:456"
  tenantId: string;
  
  correlationId?: string;
  causationId?: string;
  
  payload: T;                      // The actual state delta
  metadata: Record<string, any>;   // Source, IP, context
}

/**
 * EventStore
 * 
 * The foundational system of record for CHATR OS.
 * The Object Runtime depends only on this interface, never on a specific DB.
 */
export interface EventStore {
  /**
   * Appends an event to a specific stream using optimistic concurrency.
   * Throws ConcurrencyError if expectedVersion does not match current version.
   */
  append(streamId: string, expectedVersion: number, event: Omit<KernelEvent, 'globalSequence' | 'expectedVersion' | 'streamId'>): Promise<KernelEvent>;

  /**
   * Appends multiple events in a single transaction.
   */
  appendBatch(streamId: string, expectedVersion: number, events: Omit<KernelEvent, 'globalSequence' | 'expectedVersion' | 'streamId'>[]): Promise<KernelEvent[]>;

  /**
   * Loads all events for a specific stream.
   */
  loadStream(streamId: string): Promise<KernelEvent[]>;

  /**
   * Loads all events for a specific aggregate type and ID.
   */
  loadAggregate(aggregateType: string, aggregateId: string): Promise<KernelEvent[]>;

  /**
   * Loads all events across all streams since a specific global sequence.
   * Crucial for Projection Services to rebuild or catch up.
   */
  loadSince(position: number): Promise<KernelEvent[]>;

  /**
   * Subscribes to the global event stream for real-time projection updates.
   */
  subscribe(handler: (event: KernelEvent) => Promise<void>): void;

  /**
   * Replays events from a specific position to rebuild projections.
   */
  replay(handler: (event: KernelEvent) => Promise<void>, fromPosition?: number): Promise<void>;
}

export class ConcurrencyError extends Error {
  constructor(streamId: string, expectedVersion: number, actualVersion: number) {
    super(`Concurrency conflict on stream ${streamId}. Expected version ${expectedVersion} but found ${actualVersion}`);
    this.name = 'ConcurrencyError';
  }
}

export class EventStoreCorruptionError extends Error {
  constructor(reason: string, streamId?: string) {
    super(`EventStore Corruption Detected: ${reason} ${streamId ? `in stream ${streamId}` : ''}`);
    this.name = 'EventStoreCorruptionError';
  }
}
