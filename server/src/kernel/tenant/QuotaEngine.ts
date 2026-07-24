import { TenantContext } from '../../types.js';

export interface ResourceUsage {
  workflows: number;
  intents: number;
  events: number;
  aiTokens: number;
}

export class QuotaEngine {
  // In-memory counter for Phase 2E (Would be Redis in production)
  private static usageCounters: Map<string, ResourceUsage> = new Map();

  private static getUsage(tenantId: string): ResourceUsage {
    if (!this.usageCounters.has(tenantId)) {
      this.usageCounters.set(tenantId, {
        workflows: 0,
        intents: 0,
        events: 0,
        aiTokens: 0
      });
    }
    return this.usageCounters.get(tenantId)!;
  }

  /**
   * Called before intent resolution.
   * Throws an error or returns false if quota is exceeded.
   */
  static checkIntentQuota(tenant: TenantContext): boolean {
    if (tenant.tenantId === 'system' || tenant.tenantId === 'admin') return true;
    
    const usage = this.getUsage(tenant.tenantId);
    if (usage.intents >= tenant.quotas.intentsPerMinute) {
      return false; // Quota exceeded
    }
    
    // Optimistic increment
    usage.intents++;
    return true;
  }

  /**
   * Called when a workflow is scheduled.
   */
  static checkWorkflowQuota(tenant: TenantContext): boolean {
    if (tenant.tenantId === 'system' || tenant.tenantId === 'admin') return true;
    
    const usage = this.getUsage(tenant.tenantId);
    if (usage.workflows >= tenant.quotas.concurrentWorkflows) {
      return false;
    }
    
    usage.workflows++;
    return true;
  }

  /**
   * Called when a workflow completes or fails, freeing up concurrency.
   */
  static releaseWorkflow(tenantId: string) {
    if (tenantId === 'system' || tenantId === 'admin') return;
    
    const usage = this.getUsage(tenantId);
    if (usage.workflows > 0) {
      usage.workflows--;
    }
  }

  /**
   * Called by Telemetry/Accounting to track AI token usage.
   */
  static consumeAITokens(tenantId: string, tokens: number) {
    const usage = this.getUsage(tenantId);
    usage.aiTokens += tokens;
  }

  static getTenantUsage(tenantId: string): ResourceUsage {
    return this.getUsage(tenantId);
  }

  static reset() {
    this.usageCounters.clear();
  }
}
