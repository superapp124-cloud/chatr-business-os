/**
 * CHATR Kernel Runtime v2.0 — SearchIndexer
 *
 * Layer 3 — Core Engines
 *
 * Background-indexed universal search (not query-time search).
 * Offloads indexing to BackgroundWorkerPool.
 */

import { IEngine, EngineHealth, EngineStatus } from '../runtime/types';
import { KernelAPI } from '../runtime/KernelAPI';

export class SearchIndexerImpl implements IEngine {
  readonly id = 'SearchIndexer';
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
      
      // Listen for events that require indexing
      this.kernel.events.on('DOCUMENT_UPLOADED', (e) => this.queueIndex('document', e.payload));
      this.kernel.events.on('MESSAGE_RECEIVED', (e) => this.queueIndex('message', e.payload));
      this.kernel.events.on('CALL_ENDED', (e) => this.queueIndex('call', e.payload));
      
      this._status = 'ready';
    } catch (err) {
      this._status = 'crashed';
      throw err;
    }
  }

  private initIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('CHATR_SearchIndex', 1);
      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('search_index')) {
          const store = db.createObjectStore('search_index', { keyPath: 'id' });
          store.createIndex('by_type', 'type', { unique: false });
        }
      };
      request.onsuccess = (e) => {
        this.db = (e.target as IDBOpenDBRequest).result;
        resolve();
      };
      request.onerror = (e) => reject((e.target as IDBOpenDBRequest).error);
    });
  }

  private queueIndex(type: string, payload: unknown): void {
    this.kernel.workers.submit({
      type: 'index:document',
      payload: { type, data: payload },
      priority: 'background',
      onComplete: (indexedDoc) => this.writeToIndex(indexedDoc)
    });
  }

  private async writeToIndex(indexedDoc: unknown): Promise<void> {
    if (!this.db) return;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('search_index', 'readwrite');
      const store = tx.objectStore('search_index');
      store.put(indexedDoc);
      tx.oncomplete = () => {
        this.kernel.events.publish('INDEX_UPDATED', indexedDoc, { priority: 'background', source: this.id });
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  // Raw DB query used by SearchRankingEngine
  async queryIndex(query: string): Promise<unknown[]> {
    // Stub implementation - would use IndexedDB range queries or full-text search
    if (!this.db) return [];
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('search_index', 'readonly');
      const store = tx.objectStore('search_index');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
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

export const searchIndexer = new SearchIndexerImpl();
