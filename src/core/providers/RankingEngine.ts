import { ProviderRecord } from './RegistrySchema';

export class RankingEngine {
  /**
   * Sorts the providers by their Trust Score and capability priority.
   */
  public static rank(providers: ProviderRecord[], capabilityId: string): ProviderRecord[] {
    return [...providers].sort((a, b) => {
      // 1. Health checks
      const aHealthy = a.health.uptime > 95 && a.health.successRate > 90 ? 1 : 0;
      const bHealthy = b.health.uptime > 95 && b.health.successRate > 90 ? 1 : 0;
      
      if (aHealthy !== bHealthy) {
        return bHealthy - aHealthy;
      }

      // 2. Capability Priority
      const aCap = a.capabilities.find(c => c.capabilityId === capabilityId);
      const bCap = b.capabilities.find(c => c.capabilityId === capabilityId);
      const aPriority = aCap ? aCap.priority : 0;
      const bPriority = bCap ? bCap.priority : 0;

      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }

      // 3. Trust Score
      return b.trustScore - a.trustScore;
    });
  }
}
