export type CapabilityType = 
  | 'TextGeneration' 
  | 'ImageGeneration' 
  | 'Search' 
  | 'CRM_Action' 
  | 'Calendar_Action' 
  | 'Email_Action';

export interface ProviderCapability {
  providerId: string;
  capabilityType: CapabilityType;
  execute: (payload: any, context: any) => Promise<any>;
}

class CapabilityRegistryService {
  private providers: Map<CapabilityType, ProviderCapability[]> = new Map();

  register(capability: ProviderCapability) {
    if (!this.providers.has(capability.capabilityType)) {
      this.providers.set(capability.capabilityType, []);
    }
    this.providers.get(capability.capabilityType)?.push(capability);
    console.log(`Registered provider ${capability.providerId} for ${capability.capabilityType}`);
  }

  getProviders(type: CapabilityType): ProviderCapability[] {
    return this.providers.get(type) || [];
  }

  getProvider(type: CapabilityType, providerId: string): ProviderCapability | undefined {
    const caps = this.providers.get(type) || [];
    return caps.find(c => c.providerId === providerId);
  }
}

export const CapabilityRegistry = new CapabilityRegistryService();
