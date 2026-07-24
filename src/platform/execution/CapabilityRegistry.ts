import { CapabilityDefinition, ICapabilityRegistry } from '../contracts/Capability.abi';

export class CapabilityRegistry implements ICapabilityRegistry {
  private capabilities = new Map<string, CapabilityDefinition>();

  register(capability: CapabilityDefinition): void {
    if (this.capabilities.has(capability.capabilityId)) {
      throw new Error(`Capability ${capability.capabilityId} is already registered.`);
    }
    this.capabilities.set(capability.capabilityId, capability);
  }

  get(capabilityId: string): CapabilityDefinition | undefined {
    return this.capabilities.get(capabilityId);
  }

  list(): CapabilityDefinition[] {
    return Array.from(this.capabilities.values());
  }

  has(capabilityId: string): boolean {
    return this.capabilities.has(capabilityId);
  }
}
