import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { randomUUID } from 'crypto';
import { TenantRegistry, OrganizationDescriptor } from '../server/src/kernel/tenant/TenantRegistry.js';
import { QuotaEngine } from '../server/src/kernel/tenant/QuotaEngine.js';
import { TenantContextManager } from '../server/src/kernel/tenant/TenantContextManager.js';
import { TenantScheduler } from '../server/src/kernel/tenant/TenantScheduler.js';
import { SystemWorkflowEngine } from '../server/src/services/WorkflowService.js';
import { ExecutionContext, TenantContext } from '../server/src/types.js';

describe('V1.0 Intent OS Tenant & Security Hardening', () => {
  beforeEach(() => {
    TenantRegistry.clear();
    // QuotaEngine and TenantScheduler don't have reset methods, we'll recreate or manipulate as needed
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Test 1: Tenant-specific Capability Filtering', async () => {
    const orgId = 'org-123';
    TenantRegistry.setDescriptor(orgId, {
      organizationId: orgId,
      branding: {},
      regionalSettings: { timezone: 'UTC', locale: 'en-US' },
      aiModels: { planner: 'gpt-4', extractor: 'gpt-4o-mini' },
      capabilities: [
        { id: 'hr', version: '1.0', enabled: true },
        { id: 'sales', version: '1.0', enabled: false }
      ],
      featureFlags: []
    });

    const descriptor = await TenantRegistry.getDescriptor(orgId);
    expect(descriptor).toBeDefined();
    
    const enabledCaps = descriptor.capabilities.filter(c => c.enabled).map(c => c.id);
    expect(enabledCaps).toContain('hr');
    expect(enabledCaps).not.toContain('sales');
  });

  it('Test 2: Quota Enforcement (Starter Plan Rejection)', async () => {
    const tenantCtx: TenantContext = {
      tenantId: 'tenant-1',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      userId: 'user-1',
      roles: [],
      permissions: [],
      plan: 'Starter',
      enabledCapabilities: [],
      quotas: {
        concurrentWorkflows: 5,
        intentsPerMinute: 100,
        eventsPerSecond: 10,
        storageGb: 5,
        aiTokensPerDay: 10000,
        mcpRequestsPerDay: 1000
      }
    };

    // Simulate 5 running workflows for the starter tenant
    for (let i = 0; i < 5; i++) {
      QuotaEngine.checkWorkflowQuota(tenantCtx);
    }

    // The 6th should fail because Starter plan limit is 5
    const hasCapacity = QuotaEngine.checkWorkflowQuota(tenantCtx);
    expect(hasCapacity).toBe(false);
  });

  it('Test 3: Fair Dispatch via TenantScheduler', async () => {
    // Mock the WorkflowEngine so it doesn't actually execute
    const executeSpy = vi.spyOn(SystemWorkflowEngine.prototype, 'executePlan').mockResolvedValue(undefined as any);

    const tenantA: TenantContext = {
      tenantId: 'tenant-A', organizationId: 'org-A', workspaceId: 'ws-A', userId: 'user-A',
      roles: [], permissions: [], plan: 'Pro' as any, enabledCapabilities: [], quotas: {} as any
    };
    
    const tenantB: TenantContext = {
      tenantId: 'tenant-B', organizationId: 'org-B', workspaceId: 'ws-B', userId: 'user-B',
      roles: [], permissions: [], plan: 'Pro' as any, enabledCapabilities: [], quotas: {} as any
    };

    const createCtx = (tenant: TenantContext): ExecutionContext => ({
      id: randomUUID(),
      state: 'Planning',
      intent: 'Dummy Intent',
      observations: [],
      trace: { traceId: randomUUID(), spanId: randomUUID(), correlationId: randomUUID() },
      tenant
    });

    const ctxA1 = createCtx(tenantA);
    const ctxA2 = createCtx(tenantA);
    const ctxA3 = createCtx(tenantA);
    const ctxB1 = createCtx(tenantB);

    // Mock QuotaEngine to simulate no capacity initially so they queue
    let simulateNoCapacity = true;
    vi.spyOn(QuotaEngine, 'checkWorkflowQuota').mockImplementation(() => !simulateNoCapacity);

    // We can't use await here because submit will queue them and resolve synchronously!
    await TenantScheduler.submit(ctxA1);
    await TenantScheduler.submit(ctxA2);
    await TenantScheduler.submit(ctxA3);
    await TenantScheduler.submit(ctxB1);

    // Now let's simulate capacity becoming available and manually pump the queue
    simulateNoCapacity = false;
    
    // We expect fair dispatch, meaning:
    // A gets a turn, B gets a turn, then A gets its second turn, etc.
    TenantScheduler.pumpQueue();
    
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(executeSpy).toHaveBeenCalledTimes(4);

    expect(executeSpy.mock.calls[0][0].id).toBe(ctxA1.id);
    expect(executeSpy.mock.calls[1][0].id).toBe(ctxB1.id);
    expect(executeSpy.mock.calls[2][0].id).toBe(ctxA2.id);
    expect(executeSpy.mock.calls[3][0].id).toBe(ctxA3.id);
  });
});
