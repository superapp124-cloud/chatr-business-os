import { providerRegistry, IProvider } from './ProviderRegistry';

export class UniversalRetrievalEngine {
  private static instance: UniversalRetrievalEngine;

  private constructor() {}

  public static getInstance(): UniversalRetrievalEngine {
    if (!UniversalRetrievalEngine.instance) {
      UniversalRetrievalEngine.instance = new UniversalRetrievalEngine();
    }
    return UniversalRetrievalEngine.instance;
  }

  public async retrieve(capabilityType: string, query: any): Promise<any[]> {
    // 1. Provider Discovery
    const providers = await providerRegistry.getHealthyProviders(capabilityType, 'SearchProvider');
    
    if (providers.length === 0) {
      console.warn(`[UniversalRetrievalEngine] No healthy providers found for ${capabilityType}`);
      return [];
    }

    // 2. Dispatch searches to all healthy providers in parallel
    const searchPromises = providers.map(p => this.safeSearch(p, query));
    const resultsArrays = await Promise.all(searchPromises);

    // 3. Merge
    let mergedResults = resultsArrays.flat();

    // 4. Deduplicate (simple ID based for now)
    const seen = new Set();
    mergedResults = mergedResults.filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    // 5. Rank (simple price sort for now)
    // Assume flights have price as string '₹4,980'. Need to parse to number.
    mergedResults.sort((a, b) => {
      const priceA = parseInt((a.price || '0').replace(/[^0-9]/g, ''));
      const priceB = parseInt((b.price || '0').replace(/[^0-9]/g, ''));
      return priceA - priceB;
    });

    return mergedResults;
  }

  private async safeSearch(provider: IProvider, query: any): Promise<any[]> {
    try {
      return await provider.search(query);
    } catch (e) {
      console.error(`[UniversalRetrievalEngine] Provider ${provider.id} retrieve failed:`, e);
      return [];
    }
  }
}

export const universalRetrievalEngine = UniversalRetrievalEngine.getInstance();
