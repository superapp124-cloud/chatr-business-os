import { ExecutionContext } from '../../types.js';
import { CapabilityRuntime } from '../CapabilityRuntime.js';

export class SystemCapabilityResolver {
  async resolve(context: ExecutionContext): Promise<ExecutionContext> {
    if (!context.resolvedIntent) throw new Error('Cannot resolve capability: No intent parsed.');
    
    context.state = 'Resolved';
    
    const capabilityId = context.resolvedIntent.capability;
    const action = context.resolvedIntent.action;

    // Verify it exists in the graph
    const manifest = CapabilityRuntime.getManifest(capabilityId);
    if (!manifest) {
      throw new Error(`[CapabilityResolver] Resolved to ${capabilityId}, but it is not loaded in the CapabilityRuntime!`);
    }

    console.log(`[CapabilityResolver] Matched intent to Capability: ${manifest.name}`);

    // The Parser already populated capability/action dynamically. 
    // This step is now just a graph verification check.
    context.resolvedIntent.capability = capabilityId;
    context.resolvedIntent.action = action;

    return context;
  }
}

export const CapabilityResolver = new SystemCapabilityResolver();
