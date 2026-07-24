import { kernel } from '../abi';
import { ExecutionPlan } from '../core/types/ABI';
import { CapabilityId, Context } from '../abi/v1';

export class ProviderResolver {
  async resolve(capabilityId: string): Promise<ExecutionPlan> {
    const dummyContext: Context = {
      entityId: 'system' as any,
      timestamp: Date.now(),
      metadata: {}
    };

    const entities = await kernel.resolveCapability(capabilityId as CapabilityId, dummyContext, {
      optimize: 'fastest'
    });

    if (entities.length === 0) {
      throw new Error(`No entities found for capability: ${capabilityId}`);
    }

    const bestEntity = entities[0];
    const metadata = bestEntity.metadata as any;

    return {
      providerId: metadata.providerId || bestEntity.id,
      transport: metadata.transport as any,
      timeoutMs: metadata.executionPlan?.timeoutMs || 5000,
      retryCount: 1,
      normalizer: metadata.executionPlan?.normalizer || 'OpenMeteoNormalizer',
      verifier: metadata.executionPlan?.verifier || 'WeatherVerifier',
      authority: 'Public',
      transportConfig: metadata.executionPlan?.transportConfig || {}
    };
  }
}

export const providerResolver = new ProviderResolver();
