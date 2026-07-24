import { TenantContext, TenantCapability } from '../../types.js';

export interface TenantFeatureFlag {
  flag: string;
  enabled: boolean;
}

export interface OrganizationDescriptor {
  organizationId: string;
  branding: {
    logoUrl?: string;
    primaryColor?: string;
  };
  regionalSettings: {
    timezone: string;
    locale: string;
  };
  aiModels: {
    planner: string;
    extractor: string;
  };
  capabilities: TenantCapability[];
  featureFlags: TenantFeatureFlag[];
}

export class TenantRegistry {
  private static descriptors: Map<string, OrganizationDescriptor> = new Map();

  /**
   * Loads an organization descriptor. In production, this fetches from the DB.
   */
  static async getDescriptor(organizationId: string): Promise<OrganizationDescriptor> {
    if (this.descriptors.has(organizationId)) {
      return this.descriptors.get(organizationId)!;
    }
    
    // Default fallback for development
    return {
      organizationId,
      branding: {},
      regionalSettings: { timezone: 'UTC', locale: 'en-US' },
      aiModels: { planner: 'gpt-4', extractor: 'gpt-4o-mini' },
      capabilities: [
        { id: 'lead_tracker', version: '1.0', enabled: true },
        { id: 'recruitment', version: '2.4', enabled: true }
      ],
      featureFlags: []
    };
  }

  /**
   * Sets a descriptor (useful for testing)
   */
  static setDescriptor(organizationId: string, descriptor: OrganizationDescriptor) {
    this.descriptors.set(organizationId, descriptor);
  }

  /**
   * Clears the registry (useful for testing)
   */
  static clear() {
    this.descriptors.clear();
  }
}
