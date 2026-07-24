import { openDB, IDBPDatabase } from 'idb';
import { EventStore, KernelEvent, ConcurrencyError, EventStoreCorruptionError } from './EventStore';

export class IndexedDBEventStore implements EventStore {
  private dbName = 'chatr-event-store';
  private storeName = 'events';
  private metaStoreName = 'meta';
  private dbPromise: Promise<IDBPDatabase>;
  private subscriptions: ((event: KernelEvent) => Promise<void>)[] = [];

  constructor(dbPrefix: string = '') {
    this.dbName = dbPrefix ? `${dbPrefix}-chatr-event-store` : 'chatr-event-store';
    this.dbPromise = openDB(this.dbName, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('events')) {
          const store = db.createObjectStore('events', { keyPath: 'eventId' });
          store.createIndex('by-stream', 'streamId');
          store.createIndex('by-aggregate', ['aggregateType', 'aggregateId']);
          store.createIndex('by-global-sequence', 'globalSequence');
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta');
        }
      },
    });
  }

  async append(
    streamId: string,
    expectedVersion: number,
    eventData: Omit<KernelEvent, 'globalSequence' | 'expectedVersion' | 'streamId'>
  ): Promise<KernelEvent> {
    const events = await this.appendBatch(streamId, expectedVersion, [eventData]);
    return events[0];
  }

  async appendBatch(
    streamId: string,
    expectedVersion: number,
    events: Omit<KernelEvent, 'globalSequence' | 'expectedVersion' | 'streamId'>[]
  ): Promise<KernelEvent[]> {
    const db = await this.dbPromise;
    const tx = db.transaction([this.storeName, this.metaStoreName], 'readwrite');
    const store = tx.objectStore(this.storeName);
    const metaStore = tx.objectStore(this.metaStoreName);

    // Check concurrency
    const streamIndex = store.index('by-stream');
    const streamEvents = await streamIndex.getAll(streamId);
    const currentVersion = streamEvents.length > 0 
      ? Math.max(...streamEvents.map(e => e.expectedVersion))
      : 0;

    if (expectedVersion !== currentVersion) {
      throw new ConcurrencyError(streamId, expectedVersion, currentVersion);
    }

    let globalSequenceCounter = (await metaStore.get('globalSequenceCounter')) || 0;

    const insertedEvents: KernelEvent[] = [];
    let version = expectedVersion;

    for (const event of events) {
      version++;
      globalSequenceCounter++;
      const newEvent: KernelEvent = {
        ...event,
        streamId,
        expectedVersion: version,
        globalSequence: globalSequenceCounter
      };
      await store.put(newEvent);
      insertedEvents.push(newEvent);
    }

    await metaStore.put(globalSequenceCounter, 'globalSequenceCounter');
    await tx.done;

    // Notify subscribers asynchronously
    setTimeout(() => {
      for (const event of insertedEvents) {
        for (const handler of this.subscriptions) {
          handler(event).catch(err => console.error('Subscription handler failed:', err));
        }
      }
    }, 0);

    return insertedEvents;
  }

  /**
   * Directly sets events (used when syncing from server to override/catch-up local store).
   * Bypasses optimistic concurrency checks, using the server's global sequences and versions.
   */
  async appendFromServer(events: KernelEvent[]): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction([this.storeName, this.metaStoreName], 'readwrite');
    const store = tx.objectStore(this.storeName);
    const metaStore = tx.objectStore(this.metaStoreName);

    let globalSequenceCounter = (await metaStore.get('globalSequenceCounter')) || 0;

    for (const event of events) {
      await store.put(event);
      if (event.globalSequence && event.globalSequence > globalSequenceCounter) {
        globalSequenceCounter = event.globalSequence;
      }
    }

    await metaStore.put(globalSequenceCounter, 'globalSequenceCounter');
    await tx.done;

    setTimeout(() => {
      for (const event of events) {
        for (const handler of this.subscriptions) {
          handler(event).catch(err => console.error('Subscription handler failed:', err));
        }
      }
    }, 0);
  }

  async loadStream(streamId: string): Promise<KernelEvent[]> {
    const db = await this.dbPromise;
    const streamIndex = db.transaction(this.storeName, 'readonly').store.index('by-stream');
    const stream = await streamIndex.getAll(streamId);
    
    stream.sort((a, b) => a.expectedVersion - b.expectedVersion);
      
    // Integrity check
    let expected = 1;
    for (const e of stream) {
      if (e.expectedVersion !== expected) {
        throw new EventStoreCorruptionError(`Missing or duplicate sequence. Expected ${expected}, got ${e.expectedVersion}`, streamId);
      }
      expected++;
    }
    return stream;
  }

  async loadAggregate(aggregateType: string, aggregateId: string): Promise<KernelEvent[]> {
    const db = await this.dbPromise;
    const index = db.transaction(this.storeName, 'readonly').store.index('by-aggregate');
    const stream = await index.getAll([aggregateType, aggregateId]);
    return stream.sort((a, b) => a.expectedVersion - b.expectedVersion);
  }

  async loadSince(position: number): Promise<KernelEvent[]> {
    const db = await this.dbPromise;
    const index = db.transaction(this.storeName, 'readonly').store.index('by-global-sequence');
    // Using IDBKeyRange to get > position
    const range = IDBKeyRange.lowerBound(position, true);
    const stream = await index.getAll(range);
    
    stream.sort((a, b) => a.globalSequence! - b.globalSequence!);
      
    // Integrity check for global stream
    let expected = position + 1;
    for (const e of stream) {
      if (e.globalSequence !== expected) {
        throw new EventStoreCorruptionError(`Missing or duplicate global sequence. Expected ${expected}, got ${e.globalSequence}`);
      }
      expected++;
    }
    return stream;
  }

  subscribe(handler: (event: KernelEvent) => Promise<void>): void {
    this.subscriptions.push(handler);
  }

  async replay(handler: (event: KernelEvent) => Promise<void>, fromPosition: number = 0): Promise<void> {
    const events = await this.loadSince(fromPosition);
    for (const e of events) {
      await handler(e);
    }
  }

  async clear(): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction([this.storeName, this.metaStoreName], 'readwrite');
    await tx.objectStore(this.storeName).clear();
    await tx.objectStore(this.metaStoreName).clear();
    await tx.done;
  }
}
