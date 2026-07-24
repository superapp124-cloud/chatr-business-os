import { ExecutionContext } from '../../types.js';
import { Logger } from '../observability/SystemLogger.js';
import { QuotaEngine } from './QuotaEngine.js';
import { WorkflowEngine } from '../../services/WorkflowService.js';
import { EventDispatcher } from '../events/EventDispatcher.js';

export interface IScheduler {
  submit(context: ExecutionContext): Promise<void>;
  pumpQueue(): void;
  reset?(): void;
}

export class RoundRobinScheduler implements IScheduler {
  // Simple FIFO queue per tenant
  private queues: Map<string, ExecutionContext[]> = new Map();
  private processing: boolean = false;

  /**
   * Submit a context for execution.
   */
  async submit(context: ExecutionContext): Promise<void> {
    const tenantId = context.tenant.tenantId;

    // Check intents API Quota first
    if (!QuotaEngine.checkIntentQuota(context.tenant)) {
      Logger.warn(`[TenantScheduler] Tenant ${tenantId} exceeded intent quota. Rejecting immediately.`);
      context.state = 'Failed';
      await EventDispatcher.dispatch({
        eventType: 'tenant.quota_exceeded',
        streamId: context.id,
        sequence: 1,
        actorId: context.tenant.userId,
        tenantId: tenantId,
        source: 'TenantScheduler',
        correlationId: context.trace.correlationId,
        payload: { reason: 'Intent quota exceeded' }
      });
      return;
    }

    if (!this.queues.has(tenantId)) {
      this.queues.set(tenantId, []);
    }

    if (QuotaEngine.checkWorkflowQuota(context.tenant)) {
      // We have capacity, execute immediately
      await WorkflowEngine.executePlan(context);
      this.pumpQueue();
    } else {
      // Capacity exceeded, check policy
      if (context.tenant.plan === 'Starter') {
        Logger.warn(`[TenantScheduler] Tenant ${tenantId} (Starter) exceeded workflow quota. Rejecting.`);
        context.state = 'Failed';
        await EventDispatcher.dispatch({
          eventType: 'tenant.quota_exceeded',
          streamId: context.id,
          sequence: 1,
          actorId: context.tenant.userId,
          tenantId: tenantId,
          source: 'TenantScheduler',
          correlationId: context.trace.correlationId,
          payload: { reason: 'Workflow quota exceeded (Starter Plan)' }
        });
        return;
      }

      // Queue for Business/Enterprise
      Logger.info(`[TenantScheduler] Tenant ${tenantId} exceeded workflow quota. Queueing workflow.`);
      this.queues.get(tenantId)!.push(context);
      context.state = 'Waiting';
    }
  }

  /**
   * Pumps the queues fairly (Round-Robin).
   */
  async pumpQueue() {
    if (this.processing) return;
    this.processing = true;

    try {
      let dispatched = false;
      do {
        dispatched = false;
        // Iterate through all tenants in a round-robin fashion
        for (const [tenantId, queue] of this.queues.entries()) {
          if (queue.length > 0) {
            // Peek at the first context
            const context = queue[0];
            
            // Try to acquire quota
            if (QuotaEngine.checkWorkflowQuota(context.tenant)) {
              queue.shift(); // Remove from queue
              dispatched = true;
              Logger.info(`[TenantScheduler] Dispatching queued workflow for Tenant ${tenantId}`);
              
              // We do NOT await here to allow concurrent execution up to the quota
              WorkflowEngine.executePlan(context).then(() => this.pumpQueue());
            }
          }
        }
      } while (dispatched);
    } finally {
      this.processing = false;
    }
  }

  reset() {
    this.queues.clear();
    this.processing = false;
  }
}

export const TenantScheduler: IScheduler = new RoundRobinScheduler();
