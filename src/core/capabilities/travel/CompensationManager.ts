/**
 * Compensation Manager
 *
 * Handles distributed workflow failure recovery.
 * Travel cancellation ≠ database rollback.
 *
 * Each stage registers a compensation action.
 * On failure, the manager replays compensations in reverse order.
 */

import { eventBus } from '@/core/runtime/EventBus';
import { ProviderTransaction } from '../travel/types';

export interface CompensationRecord {
  stageId: string;
  stageName: string;
  transaction: ProviderTransaction;
  compensationFn: () => Promise<void>;
}

export class CompensationManager {
  private stack: CompensationRecord[] = [];
  private workflowId: string;

  constructor(workflowId: string) {
    this.workflowId = workflowId;
  }

  /**
   * Register a compensation action after a stage succeeds.
   * Compensations are replayed in LIFO order on failure.
   */
  register(record: CompensationRecord): void {
    this.stack.push(record);
    console.log(`[CompensationManager] Registered compensation for: ${record.stageName}`);
  }

  /**
   * Execute all registered compensations in reverse order.
   */
  async compensate(reason: string): Promise<void> {
    console.log(`[CompensationManager] Starting compensation. Reason: ${reason}`);

    eventBus.publish('COMPENSATION_STARTED', {
      workflowId: this.workflowId,
      reason,
      stages: this.stack.map(r => r.stageName).reverse()
    });

    // LIFO: most recent action compensated first
    const reversed = [...this.stack].reverse();

    for (const record of reversed) {
      try {
        console.log(`[CompensationManager] Compensating: ${record.stageName}`);
        await record.compensationFn();

        record.transaction.status = 'COMPENSATED';

        eventBus.publish('COMPENSATION_STEP_COMPLETED', {
          workflowId: this.workflowId,
          stage: record.stageName,
          externalRef: record.transaction.externalReference
        });
      } catch (err: any) {
        console.error(`[CompensationManager] Compensation failed for ${record.stageName}: ${err.message}`);
        eventBus.publish('COMPENSATION_STEP_FAILED', {
          workflowId: this.workflowId,
          stage: record.stageName,
          error: err.message
        });
      }
    }

    eventBus.publish('COMPENSATION_COMPLETED', {
      workflowId: this.workflowId,
      compensatedStages: reversed.map(r => r.stageName)
    });
  }

  get registeredStages(): string[] {
    return this.stack.map(r => r.stageName);
  }
}
