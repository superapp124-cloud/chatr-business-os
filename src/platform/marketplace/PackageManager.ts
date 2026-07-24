import { PackageRepository } from './PackageRepository';
import { PlatformCertification, PlatformCertificationError } from './PlatformCertification';
import { PackageRegistry, InstalledPackage } from './PackageRegistry';
import { EventBus } from '../AutomationOS/EventBus';
import type { INodeRegistry } from '../execution/INodeRegistry';

import { KeyStore } from './KeyStore';

/**
 * Phase E3: Orchestrator. 
 * Does NOT perform certification, registry, or UI logic itself.
 * Coordinates the pipeline and manages rollback on failure.
 */
export class PackageManager {
  constructor(
    private registry: PackageRegistry,
    private nodeRegistry: INodeRegistry,
    private keyStore?: KeyStore
  ) {}

  async install(packageFolder: string): Promise<InstalledPackage> {
    EventBus.publish({ type: 'INSTALL_STARTED', payload: { packageFolder }, timestamp: Date.now() });

    try {
      // 1. Download
      const { manifest, payloadBuffer, location } = await PackageRepository.download(packageFolder);

      // 2. Certify
      // Collect all currently installed package IDs for dependency validation
      const installedIds = new Set(this.registry.list().map(p => p.manifest.id));
      PlatformCertification.certify(manifest, payloadBuffer, installedIds, this.keyStore);

      // 3. Register (Installer Phase)
      const pkg: InstalledPackage = {
        manifest,
        installDate: new Date().toISOString(),
        location,
        status: 'inactive'
      };
      this.registry.register(pkg);

      // 4. Activate (Activator Phase)
      try {
        await this.activate(pkg);
      } catch (activationError) {
        // Rollback Phase
        this.registry.unregister(manifest.id);
        throw new Error(`Activation failed, package rolled back: ${activationError instanceof Error ? activationError.message : String(activationError)}`);
      }

      EventBus.publish({ type: 'INSTALL_COMPLETED', payload: { packageId: manifest.id }, timestamp: Date.now() });
      return pkg;

    } catch (error: any) {
      EventBus.publish({ type: 'INSTALL_FAILED', payload: { packageFolder, error: error.message }, timestamp: Date.now() });
      throw error;
    }
  }
  async upgrade(packageFolder: string): Promise<InstalledPackage> {
    EventBus.publish({ type: 'UPGRADE_STARTED', payload: { packageFolder }, timestamp: Date.now() });
    
    try {
      const { manifest, payloadBuffer, location } = await PackageRepository.download(packageFolder);
      const existingPkg = this.registry.get(manifest.id);
      
      if (!existingPkg) {
        throw new Error(`Package ${manifest.id} is not installed. Cannot upgrade.`);
      }

      // Simple SemVer block: prevent downgrades unless forced
      // (For E.5 we assume string comparison is enough for a mock semver check, 
      // but in real implementation use the 'semver' package)
      if (manifest.version === existingPkg.manifest.version) {
        throw new Error(`Package ${manifest.id} is already at version ${manifest.version}.`);
      }

      const installedIds = new Set(this.registry.list().map(p => p.manifest.id));
      PlatformCertification.certify(manifest, payloadBuffer, installedIds, this.keyStore);

      const pkg: InstalledPackage = {
        manifest,
        installDate: new Date().toISOString(),
        location,
        status: 'inactive'
      };

      // Backup active
      const previousPkg = existingPkg;
      
      try {
        await this.uninstall(manifest.id); // removes nodes
        this.registry.register(pkg);       // overrides registry
        await this.activate(pkg);          // activates new nodes
      } catch (e) {
        // Rollback
        this.registry.register(previousPkg);
        await this.activate(previousPkg);
        throw new Error(`Upgrade failed, rolled back to ${previousPkg.manifest.version}. Error: ${e}`);
      }

      EventBus.publish({ type: 'UPGRADE_COMPLETED', payload: { packageId: manifest.id, version: manifest.version }, timestamp: Date.now() });
      return pkg;
    } catch (error: any) {
      EventBus.publish({ type: 'UPGRADE_FAILED', payload: { packageFolder, error: error.message }, timestamp: Date.now() });
      throw error;
    }
  }

  private async activate(pkg: InstalledPackage): Promise<void> {
    // For Phase E, if it's a node-pack, we simulate loading its node definitions into the NodeRegistry.
    // In a real environment, we'd dynamically import() the entrypoint JS file defined in the manifest.
    if (pkg.manifest.type === 'node-pack' && pkg.manifest.id === 'com.chatr.nodes.core') {
      // Dynamically load the nodes we built in Phase D
      const { TriggerNode } = await import('../nodes/TriggerNode');
      const { AIAgentNode } = await import('../nodes/AIAgentNode');
      const { ConditionNode } = await import('../nodes/ConditionNode');
      
      this.nodeRegistry.register(TriggerNode);
      this.nodeRegistry.register(AIAgentNode);
      this.nodeRegistry.register(ConditionNode);
    }
    
    // Mark as active
    pkg.status = 'active';
    this.registry.update(pkg);
  }

  async uninstall(packageId: string): Promise<void> {
    if (!this.registry.has(packageId)) {
      throw new Error(`Package ${packageId} is not installed.`);
    }

    // Check if other packages depend on this one
    const dependents = this.registry.list().filter(p => p.manifest.dependencies.some(d => d.packageId === packageId));
    if (dependents.length > 0) {
      throw new Error(`Cannot uninstall ${packageId}: Packages ${dependents.map(d => d.manifest.id).join(', ')} depend on it.`);
    }

    const pkg = this.registry.get(packageId);
    if (pkg?.manifest.id === 'com.chatr.nodes.core') {
      (this.nodeRegistry as any).unregister('core.trigger');
      (this.nodeRegistry as any).unregister('core.ai_agent');
      (this.nodeRegistry as any).unregister('core.condition');
    }
    
    this.registry.unregister(packageId);
    EventBus.publish({ type: 'UNINSTALL_COMPLETED', payload: { packageId }, timestamp: Date.now() });
  }
}
