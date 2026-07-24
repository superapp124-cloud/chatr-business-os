import type { ExecutionContext } from '../contracts/ExecutionContext.abi';
import type { IProvider } from '../contracts/Provider.abi';
import { CapabilityRegistry } from './CapabilityRegistry';
import { ProviderRegistry } from './ProviderRegistry';

/**
 * Phase D.5: ProviderResolver Pipeline
 * Capability Request -> CapabilityRegistry -> Candidate Providers -> 
 * Policy Engine -> Health Filter -> Cost / SLA Selection -> Provider
 */
export class ProviderResolver {
  constructor(
    private capabilityRegistry: CapabilityRegistry,
    private providerRegistry: ProviderRegistry
  ) {}

  async resolve(capabilityId: string, context: ExecutionContext): Promise<IProvider> {
    // 1. Validate Capability Request
    const capability = this.capabilityRegistry.get(capabilityId);
    if (!capability) {
      throw new Error(`Capability ${capabilityId} is not registered in the system.`);
    }

    // 2. Candidate Providers (Lookup)
    let candidates = this.providerRegistry.findAvailableForCapability(capabilityId);
    if (candidates.length === 0) {
      throw new Error(`No available providers found for capability: ${capabilityId}`);
    }

    // 3. Health Filter 
    // In a real system, we'd trigger lazy healthCheck() here if state is merely 'configured'.
    // For now, assume findAvailableForCapability filtered out 'down'.
    
    // 4. Policy Engine (Tenant Rules)
    // E.g., tenant policy might dictate "no AI providers outside EU" or "prefer local".
    // For Phase D.5 stub, we prioritize the defaultProviderId if it's healthy.
    const defaultCandidate = candidates.find(p => p.manifest.providerId === capability.defaultProviderId);
    if (defaultCandidate) {
      return defaultCandidate;
    }

    // 5. Cost / SLA Selection
    // If the default is unavailable, fallback to the cheapest or lowest latency
    // (Stub: just return the first available)
    return candidates[0];
  }
}
