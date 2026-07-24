/**
 * CHATR Business OS v1.0 — Durable Offline Database Store (IndexedDB Engine)
 *
 * Replaces ephemeral localStorage and in-memory Map caches with a high-capacity,
 * indexed, asynchronous, persistent IndexedDB database engine.
 *
 * Persists:
 *   - bos_records (Business Objects: CRM, Finance, HR)
 *   - kg_nodes    (Knowledge Graph Entities)
 *   - kg_edges    (Knowledge Graph Relationships)
 *   - os_events   (Offline Event Queue)
 *
 * Operates across application restarts and offline periods without internet or Supabase.
 */

const DB_NAME = 'CHATR_Offline_Database_v1';
const DB_VERSION = 1;

export interface StoredRecord {
  id: string;
  table: 'bos_records' | 'kg_nodes' | 'kg_edges' | 'os_events';
  tenantId: string;
  data: Record<string, any>;
  updatedAt: string;
}

class OfflineDatabaseEngine {
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      this.dbPromise = this.initDB();
    }
  }

  private initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: any) => {
        const db: IDBDatabase = event.target.result;
        
        // Create stores if missing
        if (!db.objectStoreNames.contains('bos_records')) {
          const store = db.createObjectStore('bos_records', { keyPath: 'id' });
          store.createIndex('capability_id', 'capability_id', { unique: false });
          store.createIndex('object_name', 'object_name', { unique: false });
        }

        if (!db.objectStoreNames.contains('kg_nodes')) {
          const store = db.createObjectStore('kg_nodes', { keyPath: 'id' });
          store.createIndex('node_type', 'node_type', { unique: false });
          store.createIndex('name', 'name', { unique: false });
        }

        if (!db.objectStoreNames.contains('kg_edges')) {
          const store = db.createObjectStore('kg_edges', { keyPath: 'id' });
          store.createIndex('source', 'source', { unique: false });
          store.createIndex('target', 'target', { unique: false });
        }

        if (!db.objectStoreNames.contains('os_events')) {
          db.createObjectStore('os_events', { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ── Generic Async Operations ───────────────────────────────────────────────

  public async upsert(storeName: 'bos_records' | 'kg_nodes' | 'kg_edges' | 'os_events', record: any): Promise<void> {
    if (!this.dbPromise) return;
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async get(storeName: 'bos_records' | 'kg_nodes' | 'kg_edges' | 'os_events', id: string): Promise<any | undefined> {
    if (!this.dbPromise) return undefined;
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  public async getAll(storeName: 'bos_records' | 'kg_nodes' | 'kg_edges' | 'os_events'): Promise<any[]> {
    if (!this.dbPromise) return [];
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result ?? []);
      req.onerror = () => reject(req.error);
    });
  }

  public async delete(storeName: 'bos_records' | 'kg_nodes' | 'kg_edges' | 'os_events', id: string): Promise<void> {
    if (!this.dbPromise) return;
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}

export const offlineDatabaseStore = new OfflineDatabaseEngine();
