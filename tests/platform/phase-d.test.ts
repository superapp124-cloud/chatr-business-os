import { describe, it, expect } from 'vitest';
import { BrowserNodeRegistry } from '../../src/platform/execution/BrowserNodeRegistry';
import { ProviderResolver } from '../../src/platform/execution/ProviderResolver';
import { AIAgentNode } from '../../src/platform/nodes/AIAgentNode';

describe('Phase D: Node Platform', () => {
  it('D-01: NodeRegistry restricts duplicate registrations', () => {
    const registry = new BrowserNodeRegistry();
    // BrowserNodeRegistry constructor already registered AIAgentNode.
    expect(() => registry.register(AIAgentNode)).toThrowError(/already registered/);
  });

  it('D-02: NodeRegistry dynamically lists manifests for the Studio palette', () => {
    const registry = new BrowserNodeRegistry();
    const manifests = registry.manifests();
    expect(manifests.length).toBeGreaterThanOrEqual(3); // Trigger, AI, Condition
    
    const aiManifest = manifests.find(m => m.type === 'core.ai_agent');
    expect(aiManifest).toBeDefined();
    expect(aiManifest?.label).toBe('AI Agent');
    expect(aiManifest?.category).toBe('ai');
  });

  it('D-03: ProviderResolver decouples nodes from direct provider implementation', async () => {
    // AIAgentNode requires 'chatr.ai.generate'
    const caps = AIAgentNode.capabilities;
    expect(caps).toContain('chatr.ai.generate');

    // Simulate the execution phase resolving the capability
    const provider = await ProviderResolver.resolve('chatr.ai.generate', {} as any);
    expect(provider).toBeDefined();
    expect(provider.id).toBe('local-ai'); // Fallback configured in our stub

    const result = await provider.execute({ prompt: 'Hello World' });
    expect(result.data).toContain('Mock AI Provider');
  });

  it('D-04: AIAgentNode executes via the capability rather than hardcoded logic', async () => {
    const result = await AIAgentNode.execute({ prompt: 'Test' }, {} as any);
    expect(result.providerUsed).toBe('local-ai');
    expect(result.capabilityId).toBe('chatr.ai.generate');
    expect(result.output.success).toBe(true);
  });

  it('D-05: Nodes enforce declarative uiContracts instead of embedded UI logic', () => {
    const contract = AIAgentNode.uiContract;
    expect(contract.fields.length).toBeGreaterThan(0);
    
    const promptField = contract.fields.find(f => f.key === 'prompt');
    expect(promptField).toBeDefined();
    expect(promptField?.type).toBe('textarea');
  });

  it('D-06: Nodes validate configuration prior to execution', () => {
    // AI Agent missing 'prompt' should fail
    const result = AIAgentNode.validate({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].field).toBe('prompt');

    // Valid prompt should pass
    const passResult = AIAgentNode.validate({ prompt: 'Help me write an email' });
    expect(passResult.valid).toBe(true);
  });
});
