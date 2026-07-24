import { IProvider, ProviderManifest, ProviderResult, ProviderError, ProviderConnectionTest, ProviderAuditMetadata } from '../contracts/Provider.abi';
import type { ExecutionContext } from '../contracts/ExecutionContext.abi';
import { generate } from '@/services/ai';

export class LocalAIProvider implements IProvider {
  manifest: ProviderManifest = {
    providerId: 'local-ai',
    name: 'Local AI Generator',
    version: '1.0.0',
    vendor: 'CHATR',
    capabilities: ['chatr.ai.generate'],
    authStrategy: 'none',
    configurationSchema: {
      type: 'object',
      properties: {}
    },
    rateLimit: {
      requestsPerWindow: 10,
      windowSeconds: 60,
      burstAllowed: false
    }
  };

  auditMetadata: ProviderAuditMetadata = {
    mustAudit: true,
    includePayload: true,
    includeResponse: true
  };

  supportsIdempotency = false;
  supportsWebhook = false;

  async initialize(config: Record<string, any>): Promise<void> {}

  async healthCheck(context: ExecutionContext): Promise<ProviderConnectionTest> {
    return { connected: true, latencyMs: 50 };
  }

  async execute(capabilityId: string, payload: Record<string, any>, context: ExecutionContext): Promise<ProviderResult> {
    const start = Date.now();
    try {
      // Actually calls the existing local `generate` service using Ollama/MLC
      const prompt = payload.prompt as string;
      const response = await generate({ prompt });
      return {
        success: true,
        data: { response, model: 'local' },
        latencyMs: Date.now() - start,
        providerName: this.manifest.name
      };
    } catch (e: any) {
      return {
        success: false,
        error: this.classifyError(e),
        latencyMs: Date.now() - start,
        providerName: this.manifest.name
      };
    }
  }

  classifyError(rawError: any): ProviderError {
    return {
      code: 'INTERNAL',
      category: 'internal',
      retryable: true,
      providerId: this.manifest.providerId,
      capabilityId: 'chatr.ai.generate',
      message: rawError.message || 'Unknown error'
    } as any;
  }
}
