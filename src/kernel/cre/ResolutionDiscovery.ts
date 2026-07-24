import { worldModel } from '../world/WorldModel';
import { CapabilityId } from '../abi/v1';

export interface ResolutionCandidate {
  entityId: string;
  capabilityId: CapabilityId;
  trust: any;
  health: string;
  costEstimate: any;
}

export class ResolutionDiscovery {
  /**
   * Finds all entities that offer the target capability and are currently ONLINE.
   */
  public discoverCandidates(targetCapability: CapabilityId): ResolutionCandidate[] {
    const candidates: ResolutionCandidate[] = [];

    // Find all active entities that have the capability
    const entities = worldModel.getAllNodes().filter(n => 
      n.type === 'Entity' && 
      (n.properties as any).state === 'active' &&
      (n.properties as any).capabilities?.includes(targetCapability)
    );

    for (const node of entities) {
      const entity = node.properties as any;
      
      // Filter out OFFLINE or QUARANTINED
      if (entity.health === 'OFFLINE' || entity.health === 'QUARANTINED') {
        continue;
      }

      candidates.push({
        entityId: entity.id,
        capabilityId: targetCapability,
        trust: entity.trust,
        health: entity.health || 'UNKNOWN',
        costEstimate: entity.economy?.costEstimate || { totalUSD: 0 }
      });
    }

    return candidates;
  }
}

export const resolutionDiscovery = new ResolutionDiscovery();
