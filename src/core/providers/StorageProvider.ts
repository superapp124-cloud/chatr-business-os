import { IProvider, ProviderCapabilities, ProviderState, providerRegistry, ProviderRole } from './ProviderRegistry';

const STORAGE_KEY = 'chatr_storage_provider_v1';

/**
 * StorageProvider — persists all in-house capability data to localStorage.
 * 
 * This is the Reality Layer for: Task, Note, Checklist, Contact, Document, Expense,
 * Calendar Event, Call log, Email log, Meeting, Interview, Follow-up.
 * 
 * Data survives page refresh. In production, this would be replaced with a
 * Supabase or SQLite-backed provider without changing any capability code.
 */
export class StorageProviderImpl implements IProvider {
  id = 'sys.storage.local';
  name = 'System Storage Provider';
  type = 'storage';
  role: ProviderRole = 'ExecutionProvider';

  private storage: Map<string, any>;

  constructor() {
    // Hydrate from localStorage on boot
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : [];
      this.storage = new Map(parsed);
    } catch {
      this.storage = new Map();
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(this.storage.entries())));
    } catch (e) {
      console.warn('[StorageProvider] Could not persist to localStorage:', e);
    }
  }

  capabilities(): ProviderCapabilities {
    return { canSearch: true, canBook: true, canCancel: true, canVerify: true };
  }

  async health(): Promise<ProviderState> {
    return { isHealthy: true, lastChecked: Date.now() };
  }

  async authenticate() { return true; }

  async search(query: any): Promise<any[]> {
    const all = Array.from(this.storage.values());
    if (query?.type) return all.filter(r => r.type === query.type);
    return all;
  }

  async create(payload: any): Promise<any> {
    console.log(`[StorageProvider] Storing record:`, payload);
    const id = payload.id || `REC-${Date.now()}`;
    const record = { ...payload, id, storedAt: Date.now() };
    this.storage.set(id, record);
    this.persist();

    return {
      success: true,
      transactionId: id,
      storedAt: record.storedAt,
      _provider: this.name
    };
  }

  async verify(id: string): Promise<any> {
    const exists = this.storage.has(id);
    const record = this.storage.get(id);
    return {
      verified: exists,
      status: exists ? 'STORED' : 'NOT_FOUND',
      storedAt: record?.storedAt
    };
  }

  async delete(id: string): Promise<any> {
    const existed = this.storage.has(id);
    this.storage.delete(id);
    this.persist();
    return { success: existed };
  }

  async update(id: string, patch: any): Promise<any> {
    const existing = this.storage.get(id);
    if (!existing) return { success: false, error: 'Not found' };
    const updated = { ...existing, ...patch, updatedAt: Date.now() };
    this.storage.set(id, updated);
    this.persist();
    return { success: true, record: updated };
  }

  getAllRecords(): any[] {
    return Array.from(this.storage.values());
  }
}

const storageProvider = new StorageProviderImpl();
providerRegistry.register(storageProvider);
