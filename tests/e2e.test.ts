import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { randomUUID } from 'crypto';
import { CapabilityRuntime } from '../server/src/kernel/CapabilityRuntime.js';
import { CapabilityValidator } from '../server/src/kernel/CapabilityValidator.js';
import { TenantProvisioner } from '../server/src/kernel/tenant/TenantProvisioner.js';
import { SystemWorkflowEngine } from '../server/src/services/WorkflowService.js';
import { CapabilityLoader } from '../server/src/kernel/CapabilityLoader.js';
import { TenantContextManager } from '../server/src/kernel/tenant/TenantContextManager.js';
import { EventDispatcher } from '../server/src/kernel/events/EventDispatcher.js';

describe('V1.0 Intent OS End-to-End Capability Testing', () => {
  beforeEach(async () => {
    vi.spyOn(EventDispatcher, 'dispatch').mockResolvedValue(undefined);
    const { ExecutionStore } = await import('../server/src/kernel/execution/ExecutionStore.js');
    vi.spyOn(ExecutionStore, 'saveCheckpoint').mockResolvedValue();
    const { OutcomeTracker } = await import('../server/src/kernel/execution/OutcomeTracker.js');
    vi.spyOn(OutcomeTracker, 'track').mockImplementation(async (ctx: any) => ctx);
    const { EventBus } = await import('../server/src/services/EventBusService.js');
    vi.spyOn(EventBus, 'audit').mockResolvedValue(undefined);
    vi.spyOn(EventBus, 'publish').mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('E2E Test 1: Capability Validator rejects invalid manifest', () => {
    const invalidPkg: any = {
      manifest: {
        id: 'Invalid.Cap',
        // missing name, version, etc.
      }
    };
    
    expect(() => CapabilityValidator.validate(invalidPkg)).toThrowError('Capability Invalid.Cap missing name.');
  });

  it('E2E Test 2: Dynamic Capability Registration (Sales, Recruitment, Finance, Support, Notifications)', async () => {
    // Test that CapabilityLoader successfully loads from disk
    await CapabilityLoader.discoverAndLoad();
    
    const allManifests = CapabilityRuntime.getAll();
    expect(allManifests.length).toBeGreaterThanOrEqual(5); // At least our 5
    
    const ids = allManifests.map(m => m.id);
    expect(ids).toContain('Sales.LeadTracker');
    expect(ids).toContain('Recruitment.ATS');
    expect(ids).toContain('Finance.Expense');
    expect(ids).toContain('Support.Ticketing');
    expect(ids).toContain('System.Notifications');
  });

  it('E2E Test 3: Tenant Provisioning and Capability Rollout', async () => {
    const org = await TenantProvisioner.provision('Acme Corp', 'Enterprise');
    expect(org.organizationId).toBeDefined();
  });

  it('E2E Test 4: Finance Workflow Pause and Resume (Approval Engine)', async () => {
    // 1. Fetch the SubmitExpense workflow
    const wf = CapabilityRuntime.getWorkflow('Finance.Expense', 'Finance.SubmitExpense');
    expect(wf).toBeDefined();

    // Mock BusinessObjectRepository and ObjectRegistry to prevent real DB inserts
    const boSpy = vi.spyOn((await import('../server/src/kernel/repositories/BusinessObjectRepository.js')).BusinessObjectRepository, 'insertObject').mockResolvedValue({ id: 'exp_123' });
    const registrySpy = vi.spyOn((await import('../server/src/kernel/ObjectRegistry.js')).ObjectRegistry, 'createInstance').mockReturnValue({ id: 'exp_123' });
    const execStoreSpy = vi.spyOn((await import('../server/src/kernel/execution/ExecutionStore.js')).ExecutionStore, 'saveCheckpoint').mockResolvedValue();
    
    // 2. Create Execution Context for the workflow
    const tenant: any = { tenantId: 't1', userId: 'u1' };
    const context: any = {
      id: randomUUID(),
      trace: { correlationId: 'c1' },
      tenant,
      state: 'Executing',
      executionPlan: wf.plan,
      completedSteps: [],
      observations: [],
      metadata: {}
    };

    // 3. Execute Workflow (Should pause at Approval step)
    try {
      await SystemWorkflowEngine.prototype.executePlan(context);
    } catch (e) {
      // It catches internally and returns context with state 'Waiting'
    }

    expect(context.state).toBe('Waiting');
    expect(context.completedSteps).toContain('step_1');
    expect(context.completedSteps).not.toContain('step_2');
    expect(execStoreSpy).toHaveBeenCalled(); // It should have checkpointed

    // 4. Simulate Approval Resolution (Resuming)
    const approveWf = CapabilityRuntime.getWorkflow('Finance.Expense', 'Finance.ApproveExpense');
    const resumeContext: any = {
      ...context,
      state: 'Executing',
      executionPlan: approveWf.plan,
      completedSteps: []
    };

    await SystemWorkflowEngine.prototype.executePlan(resumeContext);
    expect(resumeContext.state).toBe('Completed');
    expect(resumeContext.completedSteps).toContain('step_1'); // resolve
    expect(resumeContext.completedSteps).toContain('step_2'); // publish
  });

  it('E2E Test 5: Hybrid Orchestration Engine (Fast-Path and Dependencies)', async () => {
    const { SystemIntentService } = await import('../server/src/services/IntentService.js');
    const intentService = new SystemIntentService();

    // Mock BusinessObjectRepository and ObjectRegistry again
    vi.spyOn((await import('../server/src/kernel/repositories/BusinessObjectRepository.js')).BusinessObjectRepository, 'insertObject').mockResolvedValue({ id: 'lead_123' });
    vi.spyOn((await import('../server/src/kernel/ObjectRegistry.js')).ObjectRegistry, 'createInstance').mockReturnValue({ id: 'lead_123' });

    // Ensure test mode is active for MockIntentResolver
    process.env.VITEST = 'true';

    // A fast-path / Mock test
    const response = await intentService.resolveIntent('Create a new lead for John at Acme', 'u1', 'system');
    
    expect(response.success).toBe(true);
    expect(response.action).toBe('CreateLead');
    // State will be Completed because it executes synchronously in the test environment (TenantScheduler uses runWithinContext immediately if not async)
    // Actually, TenantScheduler.submit in tests might not await execution. Let's see.
  });

});
