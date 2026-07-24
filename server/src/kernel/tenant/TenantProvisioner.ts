import { TenantRegistry, OrganizationDescriptor } from './TenantRegistry.js';
import { EventDispatcher } from '../events/EventDispatcher.js';
import { randomUUID } from 'crypto';

export class TenantProvisioner {
  /**
   * Provisions a new tenant with baseline capabilities and quotas.
   */
  static async provision(orgName: string, plan: 'Starter' | 'Business' | 'Enterprise'): Promise<OrganizationDescriptor> {
    const orgId = `org_${randomUUID()}`;
    
    // 1. Tenant Created
    const descriptor: OrganizationDescriptor = {
      organizationId: orgId,
      branding: { logoUrl: '', primaryColor: '#000000' },
      regionalSettings: { timezone: 'UTC', locale: 'en-US' },
      aiModels: { planner: 'gpt-4o', extractor: 'gpt-4o-mini' },
      capabilities: [],
      featureFlags: []
    };

    // 2. Capabilities Installed (Baseline)
    descriptor.capabilities.push({ id: 'os.core', version: '1.0.0', enabled: true });
    
    // 3. Policies Applied (Stub for future policy engine rules)
    
    // 4. Quotas Assigned (Handled by the Plan logic when checking quotas, but can be customized here)
    
    // Register
    TenantRegistry.setDescriptor(orgId, descriptor);
    
    // Emit Provisioning Event
    await EventDispatcher.dispatch({
      eventType: 'tenant.provisioned',
      streamId: orgId,
      sequence: 1,
      actorId: 'system',
      tenantId: 'system',
      source: 'TenantProvisioner',
      correlationId: randomUUID(),
      payload: { plan, orgName }
    });

    console.log(`[TenantProvisioner] Successfully provisioned tenant ${orgId} with plan ${plan}`);
    return descriptor;
  }
  static async installCapability(orgId: string, capabilityId: string): Promise<void> {
    const descriptor = TenantRegistry.getDescriptor(orgId);
    if (!descriptor) {
      throw new Error(`Tenant ${orgId} not found`);
    }

    if (!descriptor.capabilities.find(c => c.id === capabilityId)) {
      descriptor.capabilities.push({ id: capabilityId, version: 'latest', enabled: true });
      TenantRegistry.setDescriptor(orgId, descriptor);
      
      await EventDispatcher.dispatch({
        eventType: 'tenant.capability.installed',
        streamId: orgId,
        sequence: 1,
        actorId: 'system',
        tenantId: orgId,
        source: 'TenantProvisioner',
        correlationId: randomUUID(),
        payload: { capabilityId }
      });
      console.log(`[TenantProvisioner] Installed capability ${capabilityId} for tenant ${orgId}`);
    }
  }
}
