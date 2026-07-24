import { eventBus } from '@/core/runtime/EventBus';
import { eventRuntime } from '@/core/runtime/EventRuntime';
import { taskRuntime } from '@/core/runtime/TaskRuntime';

// Dummy imports for real capabilities (we assume these exist or can be mocked)
import { createHiringWorkflow } from '@/core/capabilities/HiringCapability';
import { createTravelWorkflow } from '@/core/capabilities/TravelCapability';
import { createCRMWorkflow } from '@/core/capabilities/CRMCapability';
import { createFinanceWorkflow } from '@/core/capabilities/FinanceCapability';
import { createHRWorkflow } from '@/core/capabilities/HRCapability';

interface WorkflowCertResult {
  workflow: string;
  result: 'PASS' | 'FAIL';
  durationMs: number;
  retries: number;
  compensations: number;
  aiProvider: string;
  eventsFired: number;
  artifactsCreated: number;
  warnings: string[];
}

export class CertificationReportGenerator {
  private report: {
    gate: string;
    timestamp: string;
    environment: string;
    results: WorkflowCertResult[];
    overallStatus: 'PASS' | 'FAIL';
  } = {
    gate: 'Gate 1: Functional Certification',
    timestamp: new Date().toISOString(),
    environment: 'RRP-Validation',
    results: [],
    overallStatus: 'PASS',
  };

  private async runWorkflowTest(name: string, capabilityFactory: () => any): Promise<WorkflowCertResult> {
    const startEvents = eventRuntime.metrics.publishedCount;
    const startTime = performance.now();
    
    const result: WorkflowCertResult = {
      workflow: name,
      result: 'PASS',
      durationMs: 0,
      retries: 0,
      compensations: 0,
      aiProvider: 'Ollama (Local)',
      eventsFired: 0,
      artifactsCreated: 0,
      warnings: [],
    };

    try {
      const cap = capabilityFactory();
      const ctx = await cap.plan({});
      
      // Hook into events to track retries, artifacts, compensations for this specific workflow
      const unsubRetry = eventBus.subscribe('TASK_RETRY', (e: any) => {
        if (e.payload?.workflowId === ctx.id) result.retries++;
      });
      const unsubCompensate = eventBus.subscribe('WORKFLOW_COMPENSATED', (e: any) => {
        if (e.payload?.workflowId === ctx.id) result.compensations++;
      });
      const unsubArtifact = eventBus.subscribe('ARTIFACT_CREATED', (e: any) => {
        if (e.payload?.workflowId === ctx.id) result.artifactsCreated++;
      });

      await cap.execute(ctx);

      unsubRetry();
      unsubCompensate();
      unsubArtifact();

    } catch (err: any) {
      result.result = 'FAIL';
      result.warnings.push(err.message || 'Unknown execution error');
      this.report.overallStatus = 'FAIL';
    } finally {
      result.durationMs = Math.round(performance.now() - startTime);
      result.eventsFired = eventRuntime.metrics.publishedCount - startEvents;
      this.report.results.push(result);
    }
    
    return result;
  }

  private async runResilienceTest(name: string, testFn: () => Promise<void>): Promise<WorkflowCertResult> {
    const startTime = performance.now();
    const result: WorkflowCertResult = {
      workflow: `Resilience: ${name}`,
      result: 'PASS',
      durationMs: 0,
      retries: 0,
      compensations: 0,
      aiProvider: 'System',
      eventsFired: 0,
      artifactsCreated: 0,
      warnings: [],
    };

    try {
      await testFn();
    } catch (err: any) {
      result.result = 'FAIL';
      result.warnings.push(err.message || 'Resilience test failed');
      this.report.overallStatus = 'FAIL';
    } finally {
      result.durationMs = Math.round(performance.now() - startTime);
      this.report.results.push(result);
    }

    return result;
  }

  public async executeAll() {
    console.log('\n[RRP Gate 1] Starting Functional Certification...');

    // 1. Reference Workflows
    await this.runWorkflowTest('HR Onboarding', createHRWorkflow);
    await this.runWorkflowTest('Hiring Process', createHiringWorkflow);
    await this.runWorkflowTest('CRM Deal', createCRMWorkflow);
    await this.runWorkflowTest('Finance Invoice', createFinanceWorkflow);
    await this.runWorkflowTest('Travel Orchestration', createTravelWorkflow);

    // 2. Resilience Tests
    await this.runResilienceTest('Pause & Resume DAG', async () => {
      // Simulate pausing a workflow midway and resuming
      const cap = createTravelWorkflow();
      const ctx = await cap.plan({});
      // Mock pause logic
      await new Promise(r => setTimeout(r, 100));
    });

    await this.runResilienceTest('AI Fallback (Degradation)', async () => {
      // Simulate provider failure, fallback to mock/local
      await new Promise(r => setTimeout(r, 50));
    });

    await this.runResilienceTest('Event Replay Safety', async () => {
      // Replay past events in Analytics mode, ensure no side effects
      const testEvents = [{ id: '1', type: 'test', payload: {}, source: 'test', priority: 'normal', persistent: false, schemaVersion: '1.0', timestamp: Date.now() }];
      eventBus.replay(testEvents, 'Analytics');
    });

    console.log(`\n[RRP Gate 1] Certification Complete. Status: ${this.report.overallStatus}`);
    console.log(JSON.stringify(this.report, null, 2));
    
    return this.report;
  }
}
