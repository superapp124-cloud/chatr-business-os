import { IProvider, ProviderManifest, ProviderResult, ProviderError, ProviderConnectionTest, ProviderAuditMetadata } from '../contracts/Provider.abi';
import type { ExecutionContext } from '../contracts/ExecutionContext.abi';

export class MockAIProvider implements IProvider {
  manifest: ProviderManifest = {
    providerId: 'mock-ai',
    name: 'Mock AI (Deterministic)',
    version: '1.0.0',
    vendor: 'CHATR Testing',
    capabilities: ['chatr.ai.generate'],
    authStrategy: 'none',
    configurationSchema: {
      type: 'object',
      properties: {}
    }
  };

  auditMetadata: ProviderAuditMetadata = {
    mustAudit: false,
    includePayload: true,
    includeResponse: true
  };

  supportsIdempotency = true;
  supportsWebhook = false;

  async initialize(config: Record<string, any>): Promise<void> {}

  async healthCheck(context: ExecutionContext): Promise<ProviderConnectionTest> {
    return { connected: true, latencyMs: 1 };
  }

  async execute(capabilityId: string, payload: Record<string, any>, context: ExecutionContext): Promise<ProviderResult> {
    const prompt = payload.prompt as string;
    
    // Deterministic response for automated testing
    return {
      success: true,
      data: { response: `[MockAI] Generated response for: ${prompt}`, model: 'mock-model-v1' },
      latencyMs: 10,
      providerName: this.manifest.name
    };
  }

  classifyError(rawError: any): ProviderError {
    return {
      code: 'UNKNOWN',
      category: 'internal',
      retryable: false,
      providerId: this.manifest.providerId,
      capabilityId: 'chatr.ai.generate',
      message: 'Mock error'
    } as any;
  }
}
