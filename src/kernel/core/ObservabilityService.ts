import { kernelBus } from './EventBus';
import { ProcessId } from '../abi/v1';
import { emitWorkflowUIEvent, buildWidgetId } from '@/core/workflow-ui';

/**
 * Observability Service
 * Tracks process execution latency across the entire pipeline.
 */
export class ObservabilityService {
  private timings: Map<ProcessId, { start: number; lastEvent: number; log: string[] }> = new Map();
  
  // Global telemetry
  private eventCount: number = 0;
  private startTime: number = Date.now();
  private capabilityLatencies: number[] = [];
  private policyLatencies: number[] = [];

  constructor() {
    kernelBus.subscribe('*', this.trackEventFirehose.bind(this));
    kernelBus.subscribe('process.spawned', this.handleSpawned.bind(this));
    kernelBus.subscribe('process.discovery_completed', this.handleStep.bind(this, 'Discovery'));
    kernelBus.subscribe('process.ranking_completed', this.handleStep.bind(this, 'Ranking'));
    kernelBus.subscribe('process.selection_completed', this.handleStep.bind(this, 'Selection'));
    kernelBus.subscribe('process.policy_checked', this.handleStep.bind(this, 'Policy'));
    kernelBus.subscribe('process.resources_allocated', this.handleStep.bind(this, 'Allocation'));
    kernelBus.subscribe('execution.started', this.handleStep.bind(this, 'ExecutionStarted'));
    kernelBus.subscribe('execution.succeeded', this.handleStep.bind(this, 'ExecutionSucceeded'));
    kernelBus.subscribe('process.completed', this.handleCompleted.bind(this));
    kernelBus.subscribe('process.failed', this.handleFailed.bind(this));
  }

  private async handleSpawned(event: any): Promise<void> {
    const processId = event.content?.processId || event.payload?.processId || event.processId;
    if (!processId) return;
    this.timings.set(processId, { start: Date.now(), lastEvent: Date.now(), log: ['Process Spawned'] });
  }

  private async handleStep(stepName: string, event: any): Promise<void> {
    const processId = event.content?.processId || event.payload?.processId || event.processId;
    if (!processId || !this.timings.has(processId)) return;
    
    const record = this.timings.get(processId)!;
    const now = Date.now();
    const stepLatency = now - record.lastEvent;
    
    record.log.push(`${stepName} (${stepLatency}ms)`);
    record.lastEvent = now;
  }

  private async handleCompleted(event: any): Promise<void> {
    const processId = event.content?.processId || event.payload?.processId || event.processId;
    const intentId = event.intentId || event.payload?.intentId;
    
    if (!processId || !this.timings.has(processId)) return;

    const record = this.timings.get(processId)!;
    const totalLatency = Date.now() - record.start;
    
    console.log(`[ObservabilityService] Pipeline trace for ${processId} (${totalLatency}ms total):\n  ${record.log.join(' -> ')} -> Completed`);
    
    if (intentId) {
      const consoleId = buildWidgetId(intentId, 'execution_console', 0);
      emitWorkflowUIEvent({
        event: 'WIDGET_UPDATED',
        workflowId: intentId,
        widgetId: consoleId,
        widgetType: 'execution_console',
        widgetVersion: '1.0',
        lifecycle: 'ACTIVE',
        payload: { phaseUpdate: { id: 'verification', status: 'completed', message: `Pipeline verified (${totalLatency}ms)` } },
      });
    }

    this.timings.delete(processId);
  }

  private async handleFailed(event: any): Promise<void> {
    const processId = event.content?.processId || event.payload?.processId || event.processId;
    if (!processId || !this.timings.has(processId)) return;
    
    const record = this.timings.get(processId)!;
    const totalLatency = Date.now() - record.start;
    
    console.error(`[ObservabilityService] Pipeline trace for ${processId} FAILED (${totalLatency}ms total):\n  ${record.log.join(' -> ')} -> FAILED`);
    this.timings.delete(processId);
  }

  private async trackEventFirehose(event: any): Promise<void> {
    this.eventCount++;
  }

  public getMetrics() {
    const uptime = (Date.now() - this.startTime) / 1000;
    const eventsPerSec = this.eventCount / (uptime || 1);
    const avgCapLatency = this.capabilityLatencies.length ? 
      this.capabilityLatencies.reduce((a,b)=>a+b,0) / this.capabilityLatencies.length : 0;
    const avgPolicyLatency = this.policyLatencies.length ? 
      this.policyLatencies.reduce((a,b)=>a+b,0) / this.policyLatencies.length : 0;

    return {
      uptimeSec: uptime,
      eventsPerSec,
      activeProcesses: this.timings.size,
      avgCapLatency,
      avgPolicyLatency
    };
  }
}

export const observabilityService = new ObservabilityService();
