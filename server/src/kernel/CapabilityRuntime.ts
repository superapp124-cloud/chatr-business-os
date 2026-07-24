import { ICapabilityManifest, ICapabilityPackage, TenantContext } from '../types.js';
import { CapabilityValidator } from './CapabilityValidator.js';

class SystemCapabilityRuntime {
  private activePackages = new Map<string, ICapabilityPackage>();

  loadPackage(pkg: ICapabilityPackage) {
    CapabilityValidator.validate(pkg);
    
    const manifest = pkg.manifest;
    if (this.activePackages.has(manifest.id)) {
      console.warn(`[CapabilityRuntime] Reloading package for: ${manifest.id}`);
    }
    
    this.activePackages.set(manifest.id, pkg);
    console.log(`[CapabilityRuntime] Loaded Capability Package: ${manifest.name} (${manifest.department})`);
  }

  getAllPackages(): ICapabilityPackage[] {
    return Array.from(this.activePackages.values());
  }

  getManifest(id: string, tenant?: TenantContext): ICapabilityManifest | undefined {
    const pkg = this.activePackages.get(id);
    if (!pkg) return undefined;
    const manifest = pkg.manifest;
    
    if (tenant && tenant.tenantId !== 'system') {
      const capabilityConfig = tenant.enabledCapabilities.find(c => c.id === id);
      
      if (!capabilityConfig) {
        console.warn(`[CapabilityRuntime] Tenant ${tenant.tenantId} attempted to access uninstalled capability: ${id}`);
        return undefined;
      }
      
      if (!capabilityConfig.enabled) {
        console.warn(`[CapabilityRuntime] Tenant ${tenant.tenantId} attempted to access disabled capability: ${id}`);
        return undefined;
      }
      
      if (capabilityConfig.rollout !== undefined) {
        // Deterministic rollout check using tenantId hash (simplified)
        const hash = tenant.tenantId.split('').reduce((a, b) => a + b.charCodeAt(0), 0) % 100;
        if (hash >= capabilityConfig.rollout) {
          console.warn(`[CapabilityRuntime] Tenant ${tenant.tenantId} not included in rollout for capability: ${id}`);
          return undefined;
        }
      }
    }
    
    return manifest;
  }

  getAll(tenant?: TenantContext): ICapabilityManifest[] {
    const all = Array.from(this.activePackages.values()).map(p => p.manifest);
    if (!tenant || tenant.tenantId === 'system') return all;
    
    return all.filter(manifest => {
      const config = tenant.enabledCapabilities.find(c => c.id === manifest.id);
      if (!config || !config.enabled) return false;
      if (config.rollout !== undefined) {
        const hash = tenant.tenantId.split('').reduce((a, b) => a + b.charCodeAt(0), 0) % 100;
        if (hash >= config.rollout) return false;
      }
      return true;
    });
  }
  
  getWorkflow(capabilityId: string, workflowId: string): ICapabilityWorkflow | undefined {
    const pkg = this.activePackages.get(capabilityId);
    if (!pkg) return undefined;
    return pkg.workflows.find(w => w.id === workflowId);
  }

}

export const CapabilityRuntime = new SystemCapabilityRuntime();
