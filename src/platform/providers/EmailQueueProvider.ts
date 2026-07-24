import { IProvider, ProviderManifest, ProviderResult, ProviderError, ProviderConnectionTest, ProviderAuditMetadata } from '../contracts/Provider.abi';
import type { ExecutionContext } from '../contracts/ExecutionContext.abi';
import { supabase } from '@/integrations/supabase/client';

export class EmailQueueProvider implements IProvider {
  manifest: ProviderManifest = {
    providerId: 'email-queue',
    name: 'Internal Email Queue',
    version: '1.0.0',
    vendor: 'CHATR',
    capabilities: ['chatr.communication.email'],
    authStrategy: 'session_cookie',
    configurationSchema: {
      type: 'object',
      properties: {}
    }
  };

  auditMetadata: ProviderAuditMetadata = {
    mustAudit: true,
    includePayload: true,
    includeResponse: true
  };

  supportsIdempotency = true;
  supportsWebhook = false;

  async initialize(config: Record<string, any>): Promise<void> {}

  async healthCheck(context: ExecutionContext): Promise<ProviderConnectionTest> {
    // Ping Supabase
    const { error } = await supabase.from('email_queue').select('id').limit(1);
    if (error) {
      return { connected: false, latencyMs: 0, errorMessage: error.message };
    }
    return { connected: true, latencyMs: 20 };
  }

  async execute(capabilityId: string, payload: Record<string, any>, context: ExecutionContext): Promise<ProviderResult> {
    const start = Date.now();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase.from as any)('email_queue').insert({
        to_address: payload.to || user?.email,
        subject: payload.subject,
        body: payload.body,
        status: 'pending',
        created_at: new Date().toISOString(),
        metadata: { source: 'provider_platform', ...payload },
      });
      
      if (error) throw error;
      
      return {
        success: true,
        data: { queued: true, to: payload.to },
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
      code: 'NETWORK_ERROR', // Would parse Supabase error code properly here
      category: 'network',
      retryable: true,
      providerId: this.manifest.providerId,
      capabilityId: 'chatr.communication.email',
      message: rawError.message || 'Email queue insert failed'
    } as any;
  }
}
