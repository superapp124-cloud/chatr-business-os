import { EDLLivingObject } from '../contracts/edl/types';

export interface InstalledPack {
  manifest: any;
  objects: EDLLivingObject[];
  status: 'active' | 'disabled';
}

/**
 * Capability Registry
 * The universal source of truth for all installed Capability Packs in the runtime.
 * Supports Install, Upgrade, Enable, Disable, Uninstall.
 */
export class CapabilityRegistry {
  private packs: Map<string, InstalledPack> = new Map();
  private objectLookup: Map<string, EDLLivingObject> = new Map(); // Fast lookup by aggregateType
  private listeners: (() => void)[] = [];

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      listener();
    }
  }

  /**
   * Installs a pre-validated and compiled capability pack.
   */
  install(manifest: any, objects: EDLLivingObject[]) {
    if (this.packs.has(manifest.id)) {
      throw new Error(`Pack ${manifest.id} is already installed. Use upgrade() instead.`);
    }

    this.packs.set(manifest.id, {
      manifest,
      objects,
      status: 'active'
    });

    this.rebuildIndex();
  }

  /**
   * Disables a pack without removing it.
   */
  disable(packId: string) {
    const pack = this.packs.get(packId);
    if (!pack) throw new Error(`Pack ${packId} not found`);
    pack.status = 'disabled';
    this.rebuildIndex();
  }

  /**
   * Enables a previously disabled pack.
   */
  enable(packId: string) {
    const pack = this.packs.get(packId);
    if (!pack) throw new Error(`Pack ${packId} not found`);
    pack.status = 'active';
    this.rebuildIndex();
  }

  /**
   * Uninstalls a pack completely from the runtime registry.
   */
  uninstall(packId: string) {
    this.packs.delete(packId);
    this.rebuildIndex();
  }

  /**
   * Retrieves an EDL object definition by its aggregateType.
   */
  getAggregate(aggregateType: string): EDLLivingObject {
    const obj = this.objectLookup.get(aggregateType);
    if (!obj) {
      throw new Error(`AggregateType '${aggregateType}' not found in any active Capability Pack.`);
    }
    return obj;
  }

  /**
   * Retrieves all active packs.
   */
  getPacks(): InstalledPack[] {
    return Array.from(this.packs.values());
  }

  /**
   * Retrieves all active object definitions.
   */
  getObjects(): EDLLivingObject[] {
    return Array.from(this.objectLookup.values());
  }

  /**
   * Rebuilds the internal fast-lookup indices for active packs.
   */
  private rebuildIndex() {
    this.objectLookup.clear();
    for (const pack of this.packs.values()) {
      if (pack.status !== 'active') continue;
      
      for (const obj of pack.objects) {
        if (this.objectLookup.has(obj.type)) {
          console.warn(`Object type ${obj.type} is redefined. Overwriting.`);
        }
        this.objectLookup.set(obj.type, obj);
      }
    }
    this.notify();
  }
}
