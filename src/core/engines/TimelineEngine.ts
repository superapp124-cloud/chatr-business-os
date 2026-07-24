/**
 * CHATR Kernel Runtime v2.0 — TimelineEngine
 *
 * Layer 3 — Core Engines
 *
 * Replaces OSSchedulerService. Everything becomes part of one chronological model:
 * Past, Present, Future, Predictions, Reminders, Follow-ups, Commitments.
 */

import { IEngine, EngineHealth, EngineStatus, TimelineEntry } from '../runtime/types';
import { KernelAPI } from '../runtime/KernelAPI';

export class TimelineEngineImpl implements IEngine {
  readonly id = 'TimelineEngine';
  readonly version = '2.0.0';
  readonly kernelCompatibility = '>=2.0.0';
  readonly dependsOn = [];

  private _status: EngineStatus = 'stopped';
  private kernel!: KernelAPI;
  private db!: IDBDatabase;

  status(): EngineStatus { return this._status; }
  ready(): boolean { return this._status === 'ready'; }
  metrics(): Record<string, number> { return {}; }

  async health(): Promise<EngineHealth> {
    return { status: this._status, lastChecked: Date.now() };
  }

  async init(api: KernelAPI): Promise<void> {
    this._status = 'booting';
    this.kernel = api;

    try {
      await this.initIndexedDB();
      
      // Register persistence handler with EventBus
      this.kernel.events.setPersistenceHandler((event) => this.writeEvent(event));

      this.kernel.events.on('TRANSCRIPT_CHUNK_RECEIVED', (e) => {
        // Fast-path timeline write for live stream
        this.kernel.events.publish('TIMELINE_UPDATED', { type: 'stream', payload: e.payload }, { priority: 'normal' });
      });

      this.kernel.commands.register('SCHEDULE_EVENT', async (cmd) => {
        return this.writeEvent({
          id: cmd.id,
          type: 'MEETING_SCHEDULED',
          payload: cmd.payload,
          priority: 'normal',
          timestamp: cmd.timestamp,
          source: cmd.requestedBy,
          persist: true,
          correlationId: cmd.id
        });
      });

      this._status = 'ready';
    } catch (err) {
      this._status = 'crashed';
      throw err;
    }
  }

  private initIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('CHATR_Timeline', 1);
      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('timeline')) {
          const store = db.createObjectStore('timeline', { keyPath: 'id' });
          store.createIndex('by_type', 'type', { unique: false });
          store.createIndex('by_date', 'scheduledFor', { unique: false });
        }
        if (!db.objectStoreNames.contains('events')) {
          db.createObjectStore('events', { keyPath: 'id' });
        }
      };
      request.onsuccess = (e) => {
        this.db = (e.target as IDBOpenDBRequest).result;
        resolve();
      };
      request.onerror = (e) => reject((e.target as IDBOpenDBRequest).error);
    });
  }

  // ── Event Persistence ───────────────────────────────────────────────────────

  private writeEvent(event: unknown): void {
    if (!this.db) return;
    const tx = this.db.transaction('events', 'readwrite');
    tx.objectStore('events').put(event);
  }

  // ── Timeline API ──────────────────────────────────────────────────────────

  getToday(): TimelineEntry[] {
    return this.kernel.state.get('scheduler').entries.filter(e => e.type === 'present');
  }

  getPast(days: number): TimelineEntry[] {
    return this.kernel.state.get('scheduler').entries.filter(e => e.type === 'past');
  }

  getFuture(): TimelineEntry[] {
    return this.kernel.state.get('scheduler').entries.filter(e => e.type === 'future');
  }

  getPredictions(): TimelineEntry[] {
    return this.kernel.state.get('scheduler').entries.filter(e => e.type === 'prediction');
  }

  getForContact(contactId: string): TimelineEntry[] {
    return this.kernel.state.get('scheduler').entries.filter(e => e.relatedContacts.includes(contactId));
  }

  async addEntry(entry: TimelineEntry): Promise<void> {
    if (!this.db) return;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('timeline', 'readwrite');
      tx.objectStore('timeline').put(entry);
      tx.oncomplete = () => {
        this.kernel.state.update('scheduler', s => ({
          entries: [...s.entries, entry],
          todayCount: entry.type === 'present' ? s.todayCount + 1 : s.todayCount
        }));
        this.kernel.events.publish('TIMELINE_UPDATED', entry, { priority: 'normal', source: this.id });
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async restart(): Promise<void> {
    await this.dispose();
    await this.init(this.kernel);
  }

  async dispose(): Promise<void> {
    if (this.db) this.db.close();
    this._status = 'stopped';
  }
}

export const timelineEngine = new TimelineEngineImpl();
