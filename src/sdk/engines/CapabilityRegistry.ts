/**
 * CHATR OS — Capability Registry
 * 
 * Central registry for all installed Capability SDKs.
 * Departments act as installable plugins providing their knowledge,
 * objects, skills, and metrics to the Universal Executive.
 */
import { ICapabilitySDK } from '../types';

export class CapabilityRegistry {
  private static sdks = new Map<string, ICapabilitySDK>();

  static register(sdk: ICapabilitySDK) {
    this.sdks.set(sdk.id, sdk);
    console.log(`[CapabilityRegistry] Registered plugin: ${sdk.id} (${sdk.name})`);
  }

  static get(id: string): ICapabilitySDK | undefined {
    return this.sdks.get(id);
  }

  static getAll(): ICapabilitySDK[] {
    return Array.from(this.sdks.values());
  }
}
