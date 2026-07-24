import { registryService } from './RegistryService';
import { seedProviders } from './seed-providers';
import { RankingEngine } from './RankingEngine';
import { ProviderRecord } from './RegistrySchema';

export class ProviderResolver {
  /**
   * Resolves the optimal provider for a given capability string (e.g., 'travel.flight.search').
   */
  public async resolve(capabilityId: string): Promise<ProviderRecord | null> {
    let candidates = registryService.findByCapability(capabilityId);
    
    // Auto-seed for mock/testing purposes if registry is empty
    if (candidates.length === 0) {
      seedProviders();
      candidates = registryService.findByCapability(capabilityId);
    }

    if (candidates.length === 0) {
      return null;
    }

    const ranked = RankingEngine.rank(candidates, capabilityId);
    
    return ranked[0] || null;
  }
}

export const providerResolver = new ProviderResolver();
