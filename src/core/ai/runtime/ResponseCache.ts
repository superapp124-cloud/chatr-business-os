import { IAIProviderResponse } from './RuntimeInterfaces';
import { eventBus } from '@/core/runtime/EventBus';

export class ResponseCache {
  private cache: Map<string, { response: IAIProviderResponse<any>, lastAccessed: number }> = new Map();
  private maxItems = 1000;

  constructor() {
    eventBus.subscribe('MEMORY_WARNING', () => {
      console.warn('[ResponseCache] Memory warning received. Flushing 50% of oldest AI cache entries.');
      this.evictLRU(Math.floor(this.cache.size / 2));
    });
  }

  /**
   * Generates a deterministic cache key.
   */
  private generateKey(artifactVersionId: string, model: string, promptTemplateType: string, parametersHash: string): string {
    return `${artifactVersionId}::${model}::${promptTemplateType}::${parametersHash}`;
  }

  public get(artifactVersionId: string, model: string, promptTemplateType: string, parametersHash: string): IAIProviderResponse<any> | null {
    const key = this.generateKey(artifactVersionId, model, promptTemplateType, parametersHash);
    const entry = this.cache.get(key);
    if (entry) {
      entry.lastAccessed = Date.now();
      return entry.response;
    }
    return null;
  }

  public set(artifactVersionId: string, model: string, promptTemplateType: string, parametersHash: string, response: IAIProviderResponse<any>): void {
    if (this.cache.size >= this.maxItems) {
      this.evictLRU(Math.floor(this.maxItems * 0.2)); // Evict 20% to make room
    }
    const key = this.generateKey(artifactVersionId, model, promptTemplateType, parametersHash);
    this.cache.set(key, { response, lastAccessed: Date.now() });
  }

  private evictLRU(countToEvict: number) {
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    
    for (let i = 0; i < countToEvict && i < entries.length; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  public clear(): void {
    this.cache.clear();
  }
}

export const responseCache = new ResponseCache();
