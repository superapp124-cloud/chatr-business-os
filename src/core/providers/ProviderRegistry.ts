import { IProvider, ProviderRole } from './types';
export * from './types'; // Re-export for compatibility with other files

export class ProviderRegistryImpl {
  private static instance: ProviderRegistryImpl;
  private providers: Map<string, IProvider> = new Map();

  private constructor() {}

  public static getInstance(): ProviderRegistryImpl {
    if (!ProviderRegistryImpl.instance) {
      ProviderRegistryImpl.instance = new ProviderRegistryImpl();
    }
    return ProviderRegistryImpl.instance;
  }

  public register(provider: IProvider) {
    this.providers.set(provider.id, provider);
  }

  public getProvidersByTypeAndRole(type: string, role: ProviderRole): IProvider[] {
    return Array.from(this.providers.values()).filter(p => p.type === type && p.role === role);
  }

  public getProvidersByType(type: string): IProvider[] {
    return Array.from(this.providers.values()).filter(p => p.type === type);
  }

  public async getHealthyProviders(type: string, role: ProviderRole): Promise<IProvider[]> {
    const matching = this.getProvidersByTypeAndRole(type, role);
    const healthy: IProvider[] = [];
    
    for (const p of matching) {
      try {
        const state = await p.health();
        if (state.isHealthy) healthy.push(p);
      } catch (e) {
        console.warn(`[ProviderRegistry] Provider ${p.id} health check failed.`);
      }
    }
    return healthy;
  }
}

export const providerRegistry = ProviderRegistryImpl.getInstance();
