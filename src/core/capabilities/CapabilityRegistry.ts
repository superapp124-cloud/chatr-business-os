import { Capability } from './types';

export class CapabilityRegistry {
  private static instance: CapabilityRegistry;
  private capabilities: Map<string, Capability> = new Map();

  private constructor() {}

  public static getInstance(): CapabilityRegistry {
    if (!CapabilityRegistry.instance) {
      CapabilityRegistry.instance = new CapabilityRegistry();
    }
    return CapabilityRegistry.instance;
  }

  public register(capability: Capability): void {
    const id = capability.manifest.id;
    if (this.capabilities.has(id)) {
      console.warn(`[CapabilityRegistry] Capability ${id} is already registered. Overwriting.`);
    }
    this.capabilities.set(id, capability);
    console.log(`[CapabilityRegistry] Registered capability: ${id} v${capability.manifest.version}`);
  }

  public unregister(id: string): void {
    this.capabilities.delete(id);
  }

  public getCapability(id: string): Capability | undefined {
    return this.capabilities.get(id);
  }

  public getAllCapabilities(): Capability[] {
    return Array.from(this.capabilities.values());
  }
}

export const capabilityRegistry = CapabilityRegistry.getInstance();
