/**
 * CHATR Kernel Runtime v2.0 — WorkflowEngine
 *
 * Layer 3 — Core Engines
 *
 * Orchestrates multi-step business processes. 
 * E.g., New Lead → Create Contact → Schedule Follow-up → Assign Workspace → Notify Team
 */

import { IEngine, EngineHealth, EngineStatus, WorkflowDef } from '../runtime/types';
import { KernelAPI } from '../runtime/KernelAPI';

export class WorkflowEngineImpl implements IEngine {
  readonly id = 'WorkflowEngine';
  readonly version = '2.0.0';
  readonly kernelCompatibility = '>=2.0.0';
  readonly dependsOn = [];

  private _status: EngineStatus = 'stopped';
  private kernel!: KernelAPI;
  private workflows = new Map<string, WorkflowDef>();

  status(): EngineStatus { return this._status; }
  ready(): boolean { return this._status === 'ready'; }
  metrics(): Record<string, number> { return {}; }

  async health(): Promise<EngineHealth> {
    return { status: this._status, lastChecked: Date.now() };
  }

  async init(api: KernelAPI): Promise<void> {
    this._status = 'booting';
    this.kernel = api;

    // Listen to all events to check for workflow triggers
    this.kernel.events.onAny((e) => this.checkTriggers(e.type, e.payload));

    this._status = 'ready';
  }

  registerWorkflow(def: WorkflowDef): void {
    this.workflows.set(def.id, def);
  }

  private async checkTriggers(eventType: string, payload: unknown): Promise<void> {
    for (const wf of this.workflows.values()) {
      if (wf.trigger === eventType) {
        // Execute workflow asynchronously
        this.executeWorkflow(wf, payload).catch(err => {
          console.error(`[WorkflowEngine] Workflow ${wf.id} failed:`, err);
        });
      }
    }
  }

  private async executeWorkflow(wf: WorkflowDef, payload: unknown): Promise<void> {
    console.log(`[WorkflowEngine] Executing workflow: ${wf.name}`);
    
    // Check permissions before starting
    for (const perm of wf.requiredPermissions) {
      if (!this.kernel.permissions.check(this.id, perm as any)) {
        throw new Error(`Missing permission ${perm} for workflow ${wf.id}`);
      }
    }

    // Step-by-step execution logic would go here
    for (const step of wf.steps) {
      try {
        await this.kernel.execute(step.command, { ...step.payload, _triggerPayload: payload }, { requestedBy: this.id });
      } catch (err) {
        if (step.onError === 'abort') throw err;
        // if continue, just swallow
      }
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async restart(): Promise<void> {
    await this.dispose();
    await this.init(this.kernel);
  }

  async dispose(): Promise<void> {
    this._status = 'stopped';
    this.workflows.clear();
  }
}

export const workflowEngine = new WorkflowEngineImpl();
