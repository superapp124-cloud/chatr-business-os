/**
 * Workflow Inspector Store
 *
 * Central registry of all active and completed workflow instances.
 * Populated by PipelineEngine events via EventBus subscriptions.
 * Consumed by the Workflow Inspector UI.
 */

import { eventBus } from '@/core/runtime/EventBus';

export interface WorkflowInspectorRecord {
  workflowId: string;
  type: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'COMPENSATED';
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  stages: StageRecord[];
  events: EventRecord[];
  aiCalls: AICallRecord[];
  providerCalls: ProviderCallRecord[];
  policyEvaluations: PolicyRecord[];
  artifacts: string[];
  retryCount: number;
  compensationCount: number;
  currentStage?: string;
}

export interface StageRecord {
  stageId: string;
  stageName: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PAUSED';
  startedAt?: number;
  completedAt?: number;
  latencyMs?: number;
  error?: string;
}

export interface EventRecord {
  eventType: string;
  timestamp: number;
  payload?: any;
}

export interface AICallRecord {
  primitive: string;       // 'extractStructuredData' | 'classify' | 'reason' | etc.
  model: string;
  provider: string;
  latencyMs: number;
  cacheHit: boolean;
  confidence?: number;
  timestamp: number;
}

export interface ProviderCallRecord {
  providerId: string;
  operation: string;
  latencyMs: number;
  status: 'SUCCESS' | 'FAILED';
  timestamp: number;
}

export interface PolicyRecord {
  domain: string;
  action: string;
  decision: string;
  reason: string;
  confidence: number;
  timestamp: number;
}

class WorkflowInspectorStoreImpl {
  private records: Map<string, WorkflowInspectorRecord> = new Map();
  private listeners: Array<() => void> = [];

  constructor() {
    this.subscribeToEvents();
  }

  private subscribeToEvents() {
    // Pipeline-level events
    eventBus.subscribe('PIPELINE_STARTED', (e: any) => {
      const p = e.payload || e;
      this.upsert(p.workflowId, {
        workflowId: p.workflowId,
        type: p.type || 'unknown',
        status: 'RUNNING',
        startedAt: Date.now(),
        stages: [], events: [], aiCalls: [], providerCalls: [],
        policyEvaluations: [], artifacts: [],
        retryCount: 0, compensationCount: 0
      });
      this.addEvent(p.workflowId, 'PIPELINE_STARTED', p);
    });

    eventBus.subscribe('PIPELINE_COMPLETED', (e: any) => {
      const p = e.payload || e;
      this.update(p.workflowId, r => {
        r.status = 'COMPLETED';
        r.completedAt = Date.now();
        r.durationMs = r.completedAt - r.startedAt;
        r.currentStage = undefined;
      });
      this.addEvent(p.workflowId, 'PIPELINE_COMPLETED', p);
    });

    eventBus.subscribe('STAGE_STARTED', (e: any) => {
      const p = e.payload || e;
      this.update(p.workflowId, r => {
        r.currentStage = p.stage;
        const existing = r.stages.find(s => s.stageName === p.stage);
        if (!existing) {
          r.stages.push({ stageId: p.stage, stageName: p.stage, status: 'RUNNING', startedAt: Date.now() });
        }
      });
    });

    eventBus.subscribe('STAGE_COMPLETED', (e: any) => {
      const p = e.payload || e;
      this.update(p.workflowId, r => {
        const stage = r.stages.find(s => s.stageName === p.stage);
        if (stage) {
          stage.status = 'COMPLETED';
          stage.completedAt = Date.now();
          stage.latencyMs = p.latencyMs;
        }
      });
      this.addEvent(p.workflowId, 'STAGE_COMPLETED', p);
    });

    eventBus.subscribe('STAGE_FAILED', (e: any) => {
      const p = e.payload || e;
      this.update(p.workflowId, r => {
        r.status = 'FAILED';
        const stage = r.stages.find(s => s.stageName === p.stage);
        if (stage) { stage.status = 'FAILED'; stage.error = p.error; }
      });
      this.addEvent(p.workflowId, 'STAGE_FAILED', p);
    });

    // Compensation events
    eventBus.subscribe('COMPENSATION_STARTED', (e: any) => {
      const p = e.payload || e;
      this.update(p.workflowId, r => {
        r.status = 'COMPENSATED';
        r.compensationCount += 1;
      });
      this.addEvent(p.workflowId, 'COMPENSATION_STARTED', p);
    });

    eventBus.subscribe('COMPENSATION_COMPLETED', (e: any) => {
      const p = e.payload || e;
      this.addEvent(p.workflowId, 'COMPENSATION_COMPLETED', p);
    });

    // Activity logged (all domains)
    eventBus.subscribe('ACTIVITY_LOGGED', (e: any) => {
      const p = e.payload || e;
      if (p.entityId) this.addEvent(p.entityId, p.event, p);
    });
  }

  private upsert(workflowId: string, record: WorkflowInspectorRecord) {
    this.records.set(workflowId, record);
    this.notify();
  }

  private update(workflowId: string, fn: (r: WorkflowInspectorRecord) => void) {
    const r = this.records.get(workflowId);
    if (r) { fn(r); this.notify(); }
  }

  private addEvent(workflowId: string, eventType: string, payload?: any) {
    const r = this.records.get(workflowId);
    if (r) {
      r.events.push({ eventType, timestamp: Date.now(), payload });
      this.notify();
    }
  }

  private notify() {
    this.listeners.forEach(fn => fn());
  }

  public subscribe(fn: () => void): () => void {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter(l => l !== fn); };
  }

  public getAllWorkflows(): WorkflowInspectorRecord[] {
    return Array.from(this.records.values()).sort((a, b) => b.startedAt - a.startedAt);
  }

  public getWorkflow(workflowId: string): WorkflowInspectorRecord | undefined {
    return this.records.get(workflowId);
  }

  public clear() {
    this.records.clear();
    this.notify();
  }
}

export const workflowInspectorStore = new WorkflowInspectorStoreImpl();
