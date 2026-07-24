import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase with controllable return values
const mockSelect = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn(() => ({ data: mockSelect(), error: null })),
    })),
  },
}));

import { PolicyEngine } from '@/platform/Governance/PolicyEngine';
import { workflowSimulator } from '@/core/intelligence/WorkflowSimulator';

describe('PolicyEngine', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns allowed:true when no policies exist', async () => {
    mockSelect.mockReturnValue([]);
    const result = await PolicyEngine.evaluate({ capability: 'email' });
    expect(result.allowed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('blocks immediately when a blocking policy matches', async () => {
    mockSelect.mockReturnValue([{
      id: 'p1', name: 'Block email', scope: 'global', enabled: true, priority: 10,
      enforcement: 'block',
      rule: { type: 'capability_limit', blocked: ['email'] },
      tenant_id: null, workflow_id: null, capability: null, delay_seconds: null,
    }]);
    const result = await PolicyEngine.evaluate({ capability: 'email' });
    expect(result.allowed).toBe(false);
    expect(result.violations[0].policy_name).toBe('Block email');
  });

  it('continues evaluating after a warn policy', async () => {
    mockSelect.mockReturnValue([
      {
        id: 'p1', name: 'Warn email', scope: 'global', enabled: true, priority: 10,
        enforcement: 'warn',
        rule: { type: 'always' },
        tenant_id: null, workflow_id: null, capability: null, delay_seconds: null,
      },
      {
        id: 'p2', name: 'Allow sms', scope: 'global', enabled: true, priority: 20,
        enforcement: 'allow',
        rule: { type: 'always' },
        tenant_id: null, workflow_id: null, capability: null, delay_seconds: null,
      },
    ]);
    const result = await PolicyEngine.evaluate({ capability: 'email' });
    expect(result.allowed).toBe(true); // warn does not block
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].enforcement).toBe('warn');
  });

  it('sets require_approval:true for approval enforcement', async () => {
    mockSelect.mockReturnValue([{
      id: 'p1', name: 'Require approval for sms', scope: 'capability', enabled: true, priority: 5,
      enforcement: 'require_approval',
      rule: { type: 'always' },
      tenant_id: null, workflow_id: null, capability: null, delay_seconds: null,
    }]);
    const result = await PolicyEngine.evaluate({ capability: 'sms' });
    expect(result.allowed).toBe(true);
    expect(result.require_approval).toBe(true);
  });

  it('never throws on unexpected errors', async () => {
    mockSelect.mockImplementation(() => { throw new Error('DB crash'); });
    const result = await PolicyEngine.evaluate({ capability: 'email' });
    expect(result.allowed).toBe(true); // Safety-first default
  });
});

// ── WorkflowSimulator ─────────────────────────────────────────────────────
describe('WorkflowSimulator', () => {
  const ctx = { available_providers: ['supabase', 'ollama'], active_policies: [] };

  it('passes a valid linear graph', () => {
    const nodes = [
      { id: 't1', type: 'trigger', data: {}, position: { x: 0, y: 0 } },
      { id: 'a1', type: 'action', data: { provider: 'supabase' }, position: { x: 0, y: 0 } },
    ];
    const edges = [{ id: 'e1', source: 't1', target: 'a1' }];
    const result = workflowSimulator.simulate(nodes, edges, ctx);
    expect(result.passed).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails a cyclic graph', () => {
    const nodes = [
      { id: 't1', type: 'trigger', data: {}, position: { x: 0, y: 0 } },
      { id: 'a1', type: 'action', data: {}, position: { x: 0, y: 0 } },
    ];
    const edges = [
      { id: 'e1', source: 't1', target: 'a1' },
      { id: 'e2', source: 'a1', target: 't1' },
    ];
    const result = workflowSimulator.simulate(nodes, edges, ctx);
    expect(result.passed).toBe(false);
    expect(result.errors.some(e => e.includes('Cycle'))).toBe(true);
  });

  it('fails when a required provider is unavailable', () => {
    const nodes = [
      { id: 't1', type: 'trigger', data: {}, position: { x: 0, y: 0 } },
      { id: 'a1', type: 'action', data: { provider: 'stripe' }, position: { x: 0, y: 0 } },
    ];
    const edges = [{ id: 'e1', source: 't1', target: 'a1' }];
    const result = workflowSimulator.simulate(nodes, edges, ctx);
    expect(result.passed).toBe(false);
    expect(result.errors.some(e => e.includes('stripe'))).toBe(true);
  });

  it('flags missing trigger node', () => {
    const nodes = [{ id: 'a1', type: 'action', data: {}, position: { x: 0, y: 0 } }];
    const result = workflowSimulator.simulate(nodes, [], ctx);
    expect(result.passed).toBe(false);
    expect(result.errors.some(e => e.includes('trigger'))).toBe(true);
  });

  it('flags blocked capabilities from active policies', () => {
    const blockCtx = {
      ...ctx,
      active_policies: [{ scope: 'global', capability: 'sms', enforcement: 'block', rule: {} }],
    };
    const nodes = [
      { id: 't1', type: 'trigger', data: {}, position: { x: 0, y: 0 } },
      { id: 'a1', type: 'capability', data: { capability: 'sms', provider: 'supabase' }, position: { x: 0, y: 0 } },
    ];
    const edges = [{ id: 'e1', source: 't1', target: 'a1' }];
    const result = workflowSimulator.simulate(nodes, edges, blockCtx);
    expect(result.passed).toBe(false);
    expect(result.errors.some(e => e.includes('sms'))).toBe(true);
  });
});
