import { ProviderRecord, ProviderCapability } from './RegistrySchema';

export class RegistryService {
  private static instance: RegistryService;
  private db: Map<string, ProviderRecord> = new Map();

  private constructor() {}

  public static getInstance(): RegistryService {
    if (!RegistryService.instance) {
      RegistryService.instance = new RegistryService();
    }
    return RegistryService.instance;
  }

  public insert(provider: ProviderRecord): void {
    this.db.set(provider.id, provider);
  }

  public update(id: string, partial: Partial<ProviderRecord>): void {
    const existing = this.db.get(id);
    if (!existing) throw new Error(`Provider ${id} not found in registry`);
    this.db.set(id, { ...existing, ...partial });
  }

  public getById(id: string): ProviderRecord | undefined {
    return this.db.get(id);
  }

  public getAll(): ProviderRecord[] {
    return Array.from(this.db.values());
  }

  public findByCapability(capabilityId: string): ProviderRecord[] {
    return this.getAll().filter(p => 
      p.status === 'ACTIVE' && 
      p.capabilities.some(c => c.capabilityId === capabilityId)
    );
  }

  public delete(id: string): void {
    this.db.delete(id);
  }

  public getProvidersForIndustry(industry: string): ProviderRecord[] {
    return this.getAll().filter(p => p.industry === industry);
  }
}

export const registryService = RegistryService.getInstance();
