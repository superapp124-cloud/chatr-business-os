import { describe, it, expect, beforeEach } from 'vitest';
import { CapabilityRegistry } from '../../src/platform/execution/CapabilityRegistry';
import { ProviderRegistry } from '../../src/platform/execution/ProviderRegistry';
import { ProviderResolver } from '../../src/platform/execution/ProviderResolver';
import { MockAIProvider } from '../../src/platform/providers/MockAIProvider';
import { LocalAIProvider } from '../../src/platform/providers/LocalAIProvider';
import { CapabilityDefinition } from '../../src/platform/contracts/Capability.abi';

describe('Phase D.5: Provider Platform', () => {
  let capabilityRegistry: CapabilityRegistry;
  let providerRegistry: ProviderRegistry;
  let resolver: ProviderResolver;

  beforeEach(() => {
    capabilityRegistry = new CapabilityRegistry();
    providerRegistry = new ProviderRegistry();
    resolver = new ProviderResolver(capabilityRegistry, providerRegistry);

    // Register capability
    const aiCap: CapabilityDefinition = {
      capabilityId: 'chatr.ai.generate',
      name: 'AI Generation',
      description: 'Generates text',
      category: 'ai',
      inputSchema: { type: 'object' },
      outputSchema: { type: 'object' },
      supportedProviders: ['mock-ai', 'local-ai'],
      defaultProviderId: 'mock-ai',
      permissions: [],
      securityLevel: 'medium',
      costCategory: 'low',
      alwaysAudit: true,
      supportsIdempotency: false
    };
    capabilityRegistry.register(aiCap);

    // Register providers
    providerRegistry.register(new MockAIProvider());
    providerRegistry.register(new LocalAIProvider());
  });

  it('D5.1: Extensibility demonstration - New Capability registered', () => {
    expect(capabilityRegistry.has('chatr.ai.generate')).toBe(true);
    expect(() => capabilityRegistry.register(capabilityRegistry.get('chatr.ai.generate')!))
      .toThrowError(/already registered/);
  });

  it('D5.4: ProviderRegistry tracks health states', () => {
    expect(providerRegistry.getState('mock-ai')).toBe('registered');
    
    providerRegistry.updateState('mock-ai', 'healthy', 15);
    expect(providerRegistry.getState('mock-ai')).toBe('healthy');
  });

  it('D5.5: Policy-aware ProviderResolver selects healthy default provider', async () => {
    providerRegistry.updateState('mock-ai', 'healthy');
    providerRegistry.updateState('local-ai', 'healthy');

    const provider = await resolver.resolve('chatr.ai.generate', {} as any);
    
    // Should select defaultProviderId ('mock-ai')
    expect(provider.manifest.providerId).toBe('mock-ai');
  });

  it('D5.5: Policy-aware ProviderResolver falls back when default is down', async () => {
    providerRegistry.updateState('mock-ai', 'down');
    providerRegistry.updateState('local-ai', 'healthy');

    const provider = await resolver.resolve('chatr.ai.generate', {} as any);
    
    // Should fallback to local-ai since mock-ai is down
    expect(provider.manifest.providerId).toBe('local-ai');
  });

  it('D5.6: MockAIProvider provides deterministic output', async () => {
    const mock = new MockAIProvider();
    const result = await mock.execute('chatr.ai.generate', { prompt: 'Unit Test' }, {} as any);
    
    expect(result.success).toBe(true);
    expect(result.data?.response).toContain('[MockAI] Generated response for: Unit Test');
    expect(result.data?.model).toBe('mock-model-v1');
  });

  it('D5.6: Normalized errors from Provider SDK', () => {
    const mock = new MockAIProvider();
    const error = mock.classifyError(new Error('Test failure'));
    
    expect(error.code).toBe('UNKNOWN');
    expect(error.retryable).toBe(false);
    expect(error.providerId).toBe('mock-ai');
  });
});
