import { CapabilityContract, IWorkflowContext } from '@/core/capabilities/types';
import { IWorkflowStage, PipelineEngine } from '@/core/runtime/PipelineEngine';
import { IProvider, ProviderRole, providerRegistry } from '@/core/providers/ProviderRegistry';
import { policyEngine } from '@/core/services/PolicyEngine';

export class WorkflowSDK {
  
  /**
   * Scaffolds a new standard Capability instance.
   */
  static createCapability(
    name: string, 
    stages: IWorkflowStage[], 
    initialContextFn: (intent: any) => IWorkflowContext
  ): CapabilityContract {
    return {
      initialize: async () => { /* no-op */ },
      plan: async (intent: any) => {
        const ctx = initialContextFn(intent);
        return new PipelineEngine(ctx, stages);
      },
      execute: async (context: any) => {
        if (context instanceof PipelineEngine) context.start();
      },
      pause: async (context: any) => { /* handled by engine */ },
      resume: async (context: any) => {
        if (context instanceof PipelineEngine) context.start();
      },
      cancel: async (context: any) => {
        if (context instanceof PipelineEngine) {
          context.getStages().forEach(s => {
            if (s.status === 'PENDING' || s.status === 'RUNNING') s.status = 'PAUSED';
          });
        }
      },
      rollback: async (context: any) => {
        if (context instanceof PipelineEngine) {
          for (const s of context.getStages()) await s.rollback(context.getContext());
        }
      },
      exportArtifacts: (context?: any) => {
        if (context instanceof PipelineEngine) {
          return Object.values(context.getContext().artifacts);
        }
        return [];
      }
    };
  }

  /**
   * Helper to quickly create an IWorkflowStage without class boilerplate
   */
  static createStage(
    id: string,
    name: string,
    dependencies: string[],
    executeFn: (ctx: IWorkflowContext) => Promise<void>,
    validateFn?: (ctx: IWorkflowContext) => Promise<boolean>
  ): IWorkflowStage {
    return {
      id,
      name,
      dependencies,
      status: 'PENDING',
      execute: executeFn,
      validate: validateFn || (async () => true),
      resume: async function(ctx) { this.status = 'RUNNING'; return this.execute(ctx); },
      rollback: async function(ctx) { this.status = 'PENDING'; },
      retry: async function(ctx) { if (this.status === 'FAILED') { this.status = 'PENDING'; return this.resume(ctx); } },
      timeout: () => 15000
    };
  }

  /**
   * Automatically enforces base properties of versioned immutable artifacts
   */
  static createArtifact<T extends Record<string, any>>(type: string, data: T, createdBy: string, relatedIds: string[] = []): T & { id: string, type: string, version: number, createdAt: number, createdBy: string, relatedArtifacts: string[] } {
    return {
      ...data,
      id: crypto.randomUUID(),
      type,
      version: 1,
      createdAt: Date.now(),
      createdBy,
      relatedArtifacts: relatedIds
    };
  }

  /**
   * Registers a provider automatically 
   */
  static createProvider(id: string, name: string, type: string, role: ProviderRole, methods: Partial<IProvider>): IProvider {
    const provider: IProvider = {
      id, name, type, role,
      capabilities: () => ({ canSearch: true, canBook: false, canCancel: false, canVerify: true }),
      health: async () => ({ isHealthy: true, lastChecked: Date.now() }),
      authenticate: async () => true,
      ...methods
    };
    providerRegistry.register(provider);
    return provider;
  }

  /**
   * Thin wrapper around PolicyEngine to standardize how stages fetch decisions
   */
  static async evaluatePolicy(domain: string, action: string, evidence: any): Promise<{ decision: string, reason: string }> {
    return policyEngine.evaluateDecision(domain, action, evidence);
  }
}
