import { ProviderManifest, ProviderTier } from './types';
import { capabilityRegistry } from '../capabilities/CapabilityRegistry';
import { Capability } from '../capabilities/types';
import { identityManager } from '../auth/IdentityManager';
import { eventBus } from '../runtime/EventBus';

export class ExternalProviderRegistryImpl {
  private providers = new Map<string, ProviderManifest>();

  public registerProvider(manifest: ProviderManifest): void {
    console.log(`[ExternalProviderRegistry] Registering provider: ${manifest.name} (${manifest.tier})`);
    this.providers.set(manifest.id, manifest);

    // Adapt provider manifest into granular capabilities for the Capability Registry
    manifest.capabilities.forEach(capName => {
      const capId = `${manifest.id}.${capName.toLowerCase().replace(/\s+/g, '_')}`;
      
      const capability: Capability = {
        manifest: {
          id: capId,
          version: '1.0.0',
          name: `${manifest.name} - ${capName}`,
          description: `Automatically adapted capability from provider ${manifest.id}`,
          executionPolicy: 'immediate'
        },
        validate: async (commitment) => ({ isValid: true }),
        verifyReality: async (commitment) => ({
          verified: true,
          provider: manifest.name,
          timestamp: new Date().toISOString(),
          transactionId: `mock-txn-${Date.now()}`
        })
      };

      capabilityRegistry.register(capability);
    });
  }

  public getProvider(id: string): ProviderManifest | undefined {
    return this.providers.get(id);
  }

  public getAllProviders(): ProviderManifest[] {
    return Array.from(this.providers.values());
  }

  // Universal Search adapter
  public async searchUnified(query: string): Promise<any[]> {
    console.log(`[ExternalProviderRegistry] Executing unified search for: "${query}"`);
    const accounts = await identityManager.getConnectedAccounts();
    
    // In production, this would fan out to all connected accounts' Search capabilities
    // For now, we mock the results
    return [
      {
        id: `search-result-${Date.now()}-1`,
        provider: 'google',
        type: 'email',
        title: `Re: ${query}`,
        timestamp: Date.now() - 3600000,
        preview: `I looked into ${query} and here is what I found...`
      },
      {
        id: `search-result-${Date.now()}-2`,
        provider: 'slack',
        type: 'message',
        title: `Engineering Channel`,
        timestamp: Date.now() - 7200000,
        preview: `Has anyone updated the docs for ${query}?`
      }
    ];
  }
}

export const externalProviderRegistry = new ExternalProviderRegistryImpl();
