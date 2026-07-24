import { 
  IMemoryProvider, 
  EnterprisePerson, 
  EnterprisePolicy, 
  EnterpriseProject, 
  ResolvedEntity 
} from '../capabilities/types';
import { MockEnterpriseProvider } from '../providers/MockEnterpriseProvider';

/**
 * Enterprise Memory (OS Service)
 * 
 * Read-only retrieval service. Aggregates data from registered Memory Providers.
 * Employs caching to reduce expensive enterprise lookups.
 */
export class EnterpriseMemoryImpl {
  private static instance: EnterpriseMemoryImpl;
  
  // Hardcoded to MockProvider for Genesis. Later dynamic via ProviderRegistry.
  private providers: IMemoryProvider[] = [new MockEnterpriseProvider()];

  // Caching layer
  private cache: Map<string, { data: any, timestamp: number }> = new Map();
  private CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  public static getInstance(): EnterpriseMemoryImpl {
    if (!EnterpriseMemoryImpl.instance) {
      EnterpriseMemoryImpl.instance = new EnterpriseMemoryImpl();
    }
    return EnterpriseMemoryImpl.instance;
  }

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry && (Date.now() - entry.timestamp) < this.CACHE_TTL_MS) {
      console.log(`[EnterpriseMemory] Cache hit for key: ${key}`);
      return entry.data as T;
    }
    return null;
  }

  private setCache(key: string, data: any) {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Resolves a person query across all registered memory providers.
   */
  public async resolvePerson(query: string): Promise<ResolvedEntity<EnterprisePerson>[]> {
    const cacheKey = `person:${query}`;
    const cached = this.getCached<ResolvedEntity<EnterprisePerson>[]>(cacheKey);
    if (cached) return cached;

    const results: ResolvedEntity<EnterprisePerson>[] = [];
    
    for (const provider of this.providers) {
      if (provider.resolvePerson) {
        const matches = await provider.resolvePerson(query);
        for (const match of matches) {
          results.push({
            entity: match,
            confidence: 0.95, // AI ranking would happen here later
            provider: provider.name,
            source: 'Directory',
            timestamp: new Date(),
            resolvedBy: 'EnterpriseMemory'
          });
        }
      }
    }

    this.setCache(cacheKey, results);
    return results;
  }

  /**
   * Resolves an enterprise policy.
   */
  public async resolvePolicy(topic: string): Promise<ResolvedEntity<EnterprisePolicy>[]> {
    const cacheKey = `policy:${topic}`;
    const cached = this.getCached<ResolvedEntity<EnterprisePolicy>[]>(cacheKey);
    if (cached) return cached;

    const results: ResolvedEntity<EnterprisePolicy>[] = [];
    
    for (const provider of this.providers) {
      if (provider.resolvePolicy) {
        const matches = await provider.resolvePolicy(topic);
        for (const match of matches) {
          results.push({
            entity: match,
            confidence: 0.99,
            provider: provider.name,
            source: 'Knowledge Base',
            timestamp: new Date(),
            resolvedBy: 'EnterpriseMemory'
          });
        }
      }
    }

    this.setCache(cacheKey, results);
    return results;
  }

  /**
   * Resolves an enterprise project.
   */
  public async resolveProject(query: string): Promise<ResolvedEntity<EnterpriseProject>[]> {
    const cacheKey = `project:${query}`;
    const cached = this.getCached<ResolvedEntity<EnterpriseProject>[]>(cacheKey);
    if (cached) return cached;

    const results: ResolvedEntity<EnterpriseProject>[] = [];
    
    for (const provider of this.providers) {
      if (provider.resolveProject) {
        const matches = await provider.resolveProject(query);
        for (const match of matches) {
          results.push({
            entity: match,
            confidence: 0.90,
            provider: provider.name,
            source: 'Projects Database',
            timestamp: new Date(),
            resolvedBy: 'EnterpriseMemory'
          });
        }
      }
    }

    this.setCache(cacheKey, results);
    return results;
  }
}

export const enterpriseMemory = EnterpriseMemoryImpl.getInstance();
