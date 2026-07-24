import { ProviderCapability } from '@/kernel/CapabilityRegistry';

export abstract class BaseAIProvider implements ProviderCapability {
  abstract providerId: string;
  capabilityType: 'TextGeneration' | 'ImageGeneration' | 'Embeddings' = 'TextGeneration';

  abstract execute(payload: any, context: any): Promise<any>;
}

export class AIFactory {
  // In a full implementation, this factory registers providers with the CapabilityRegistry
  // on system boot.
}
