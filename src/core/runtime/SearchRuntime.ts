import { Commitment } from '../capabilities/types';

export interface SearchQuery {
  intent: string;
  filters: Record<string, any>;
}

export interface SearchResultItem {
  id: string;
  title: string;
  subtitle?: string;
  price?: string;
  image?: string;
  metadata?: Record<string, any>;
  score?: number;
}

export interface SearchResultResponse {
  results: SearchResultItem[];
  metadata?: {
    total?: number;
    provider?: string;
  };
}

export interface SearchProvider {
  search(query: SearchQuery): Promise<SearchResultResponse>;
}

/**
 * Search Result Runtime
 * 
 * A generic runtime pipeline for finding and selecting structured items:
 * Understand -> Retrieve -> Merge -> Rank -> Results -> Select -> Preview -> Execute
 */
export class SearchRuntimeImpl {
  private static instance: SearchRuntimeImpl;
  private providers: Map<string, SearchProvider[]> = new Map();

  private constructor() {}

  public static getInstance(): SearchRuntimeImpl {
    if (!SearchRuntimeImpl.instance) {
      SearchRuntimeImpl.instance = new SearchRuntimeImpl();
    }
    return SearchRuntimeImpl.instance;
  }

  public registerProvider(intent: string, provider: SearchProvider): void {
    if (!this.providers.has(intent)) {
      this.providers.set(intent, []);
    }
    this.providers.get(intent)!.push(provider);
  }

  public async runSearch(query: SearchQuery): Promise<SearchResultItem[]> {
    console.log(`[SearchRuntime] Executing search for intent: ${query.intent}`, query.filters);

    const intentProviders = this.providers.get(query.intent) || [];
    if (intentProviders.length === 0) {
      console.warn(`[SearchRuntime] No providers registered for ${query.intent}`);
      return [];
    }

    // Retrieve from all providers
    const promises = intentProviders.map(p => p.search(query).catch(e => {
      console.error(`[SearchRuntime] Provider error:`, e);
      return { results: [] };
    }));
    const responses = await Promise.all(promises);

    // Merge
    let allResults: SearchResultItem[] = [];
    responses.forEach(res => {
      allResults.push(...res.results);
    });

    // Rank (Mock ranking based on score or price if present)
    allResults.sort((a, b) => {
      if (a.score && b.score) return b.score - a.score;
      if (a.price && b.price) {
         const pA = parseFloat(a.price.replace(/[^0-9.]/g, ''));
         const pB = parseFloat(b.price.replace(/[^0-9.]/g, ''));
         if (!isNaN(pA) && !isNaN(pB)) return pA - pB; // lower price first
      }
      return 0;
    });

    return allResults;
  }
}

export const searchRuntime = SearchRuntimeImpl.getInstance();
