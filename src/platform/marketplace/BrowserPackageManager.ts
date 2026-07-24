import { InstalledPackage } from './PackageRegistry';
import type { INodeRegistry } from '../execution/INodeRegistry';
import type { PackageManifest } from '../contracts/PackageManifest.abi';
import { EventBus } from '../AutomationOS/EventBus';

export class BrowserPackageRegistry {
  private packages = new Map<string, InstalledPackage>();

  constructor() {
    this.load();
  }

  private load() {
    const stored = localStorage.getItem('chatr_browser_registry');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        for (const [k, v] of Object.entries(data)) {
          this.packages.set(k, v as InstalledPackage);
        }
      } catch (e) {}
    }
  }

  private save() {
    const obj = Object.fromEntries(this.packages.entries());
    localStorage.setItem('chatr_browser_registry', JSON.stringify(obj));
  }

  register(pkg: InstalledPackage): void {
    this.packages.set(pkg.manifest.id, pkg);
    this.save();
  }

  update(pkg: InstalledPackage): void {
    this.packages.set(pkg.manifest.id, pkg);
    this.save();
  }

  unregister(packageId: string): void {
    this.packages.delete(packageId);
    this.save();
  }

  has(packageId: string): boolean {
    return this.packages.has(packageId);
  }

  get(packageId: string): InstalledPackage | undefined {
    return this.packages.get(packageId);
  }

  list(): InstalledPackage[] {
    return Array.from(this.packages.values());
  }
}

export class BrowserPackageManager {
  constructor(
    private registry: BrowserPackageRegistry,
    private nodeRegistry: INodeRegistry
  ) {}

  async install(packageFolder: string): Promise<InstalledPackage> {
    // Fake the download and certification for the browser UI demo
    const manifest: PackageManifest = {
      id: 'com.chatr.nodes.core',
      name: 'Core Nodes',
      version: '1.0.0',
      abiVersion: '1.0.0',
      publisher: 'CHATR',
      type: 'node-pack',
      description: 'Core nodes',
      license: 'MIT',
      permissions: ['execute:local', 'provider.ai'],
      dependencies: []
    };

    const pkg: InstalledPackage = {
      manifest,
      installDate: new Date().toISOString(),
      location: 'browser-memory',
      status: 'active'
    };

    this.registry.register(pkg);

    // Activator
    const { TriggerNode } = await import('../nodes/TriggerNode');
    const { AIAgentNode } = await import('../nodes/AIAgentNode');
    const { ConditionNode } = await import('../nodes/ConditionNode');
    
    this.nodeRegistry.register(TriggerNode);
    this.nodeRegistry.register(AIAgentNode);
    this.nodeRegistry.register(ConditionNode);

    EventBus.publish({ type: 'INSTALL_COMPLETED', payload: { packageId: manifest.id }, timestamp: Date.now() });
    return pkg;
  }

  async uninstall(packageId: string): Promise<void> {
    if (packageId === 'com.chatr.nodes.core') {
      (this.nodeRegistry as any).unregister('core.trigger');
      (this.nodeRegistry as any).unregister('core.ai_agent');
      (this.nodeRegistry as any).unregister('core.condition');
    }
    this.registry.unregister(packageId);
    EventBus.publish({ type: 'UNINSTALL_COMPLETED', payload: { packageId }, timestamp: Date.now() });
  }
}
