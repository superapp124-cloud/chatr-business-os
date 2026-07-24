import { IProvider } from '../contracts/Provider.abi';

export type ProviderState = 
  | 'registered'
  | 'configured'
  | 'healthy'
  | 'degraded'
  | 'down';

export interface ProviderRegistration {
  provider: IProvider;
  state: ProviderState;
  lastHealthCheck?: number;
  latencyMs?: number;
}

export class ProviderRegistry {
  private providers = new Map<string, ProviderRegistration>();

  register(provider: IProvider): void {
    if (this.providers.has(provider.manifest.providerId)) {
      throw new Error(`Provider ${provider.manifest.providerId} is already registered.`);
    }
    this.providers.set(provider.manifest.providerId, {
      provider,
      state: 'registered'
    });
  }

  get(providerId: string): IProvider | undefined {
    return this.providers.get(providerId)?.provider;
  }

  getState(providerId: string): ProviderState | undefined {
    return this.providers.get(providerId)?.state;
  }

  updateState(providerId: string, state: ProviderState, latencyMs?: number): void {
    const reg = this.providers.get(providerId);
    if (reg) {
      reg.state = state;
      reg.lastHealthCheck = Date.now();
      if (latencyMs !== undefined) {
        reg.latencyMs = latencyMs;
      }
    }
  }

  list(): IProvider[] {
    return Array.from(this.providers.values()).map(r => r.provider);
  }

  /**
   * Finds all providers capable of fulfilling a specific capability
   * that are currently in a healthy or degraded state (i.e. available).
   */
  findAvailableForCapability(capabilityId: string): IProvider[] {
    return Array.from(this.providers.values())
      .filter(r => 
        r.provider.manifest.capabilities.includes(capabilityId) &&
        (r.state === 'healthy' || r.state === 'degraded' || r.state === 'configured') // Include configured as we may lazy-check health
      )
      .map(r => r.provider);
  }
}
