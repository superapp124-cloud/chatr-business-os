import { ProviderManifestV1 } from '../../architecture/contracts';

// ─── 1. CORE STORAGE ADAPTER (ABI 1.0) ───────────────────────────────────────────
export interface IStorageAdapter {
  // Transaction Support
  transaction<T>(action: () => Promise<T>): Promise<T>;
  
  // Read
  get(collection: string, id: string): Promise<any>;
  query(collection: string, filter: any): Promise<any[]>;
  search(collection: string, fullTextQuery: string): Promise<any[]>;
  
  // Write (Append-only / Updates)
  insert(collection: string, record: any): Promise<void>;
  update(collection: string, id: string, delta: any): Promise<void>;
  softDelete(collection: string, id: string): Promise<void>;
  
  // Time Travel / History
  getSnapshot(collection: string, id: string, timestamp: number): Promise<any>;
  
  // Migrations
  executeRaw(sql: string, params?: any[]): Promise<void>;
}

// ─── 2. REPOSITORY CONTRACTS ──────────────────────────────────────────────────
export interface IProviderRepository {
  saveProvider(manifest: ProviderManifestV1): Promise<void>;
  getProvider(id: string): Promise<ProviderManifestV1 | null>;
  searchProviders(query: string): Promise<ProviderManifestV1[]>;
}

// ─── 3. EVENT STORE ───────────────────────────────────────────────────────────
export interface EventRecord {
  eventId: string;
  timestamp: number;
  entityId: string;
  eventType: string;
  payload: any;
}

export interface IEventStore {
  appendEvent(event: EventRecord): Promise<void>;
  getEventsForEntity(entityId: string): Promise<EventRecord[]>;
  replayEvents(since: number): Promise<EventRecord[]>;
}

// ─── 4. TELEMETRY STORE ───────────────────────────────────────────────────────
export interface TelemetryRecord {
  traceId: string;
  timestamp: number;
  providerId: string;
  capabilityId: string;
  latencyMs: number;
  status: 'SUCCESS' | 'FAILED';
  metadata: any;
}

export interface ITelemetryStore {
  recordTrace(trace: TelemetryRecord): Promise<void>;
  getProviderMetrics(providerId: string, since: number): Promise<{ avgLatency: number, successRate: number }>;
}
