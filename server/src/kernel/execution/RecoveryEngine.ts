import { WorkflowEngine } from '../../services/WorkflowService.js';
import { ExecutionContext } from '../../types.js';
import { ExecutionStore } from './ExecutionStore.js';
import { SystemRepository } from '../repositories/SystemRepository.js';

import { EventDispatcher } from '../events/EventDispatcher.js';

export class SystemRecoveryEngine {
  
  /**
   * Scans the database for orphaned executions, validates their checkpoints,
   * and safely resumes them if valid.
   */
  async bootAndRecover(): Promise<void> {
    console.log('[RecoveryEngine] Scanning for crashed executions...');

    if (process.env.VITE_SUPABASE_ANON_KEY === 'dummy') return;

    try {
      const crashedIntents = await SystemRepository.getOrphanedExecutions();

    if (!crashedIntents || crashedIntents.length === 0) {
      console.log('[RecoveryEngine] No crashed executions found. System healthy.');
      return;
    }

    console.warn(`[RecoveryEngine] Detected ${crashedIntents.length} orphaned executions. Initiating recovery sequence...`);

    for (const record of crashedIntents) {
      if (record.execution_log) {
        let context = record.execution_log as ExecutionContext;
        
        if (this.validateCheckpoint(context)) {
          console.log(`[RecoveryEngine] Resuming Context ${context.id}...`);
          
          await EventDispatcher.dispatch({
            eventType: 'workflow.recovered',
            streamId: context.id,
            sequence: 1, // Simple operational event
            actorId: 'system',
            tenantId: context.tenant.tenantId,
            source: 'RecoveryEngine',
            correlationId: context.trace.correlationId,
            payload: { reason: 'System reboot recovery' }
          });
          
          WorkflowEngine.executePlan(context).catch(err => {
            console.error(`[RecoveryEngine] Failed to resume context ${context.id}:`, err);
          });
        } else {
          console.error(`[RecoveryEngine] Invalid checkpoint detected for Context ${context.id}. Isolating as Failed.`);
          
          context.state = 'Failed';
          context.observations.push({
            timestamp: new Date().toISOString(),
            type: 'bottleneck',
            component: 'RecoveryEngine',
            details: 'Invalid or corrupted checkpoint detected on boot.'
          });
          
          await EventDispatcher.dispatch({
            eventType: 'workflow.recovery.failed',
            streamId: context.id,
            sequence: 1,
            actorId: 'system',
            tenantId: context.tenant.tenantId,
            source: 'RecoveryEngine',
            correlationId: context.trace.correlationId,
            payload: { reason: 'Invalid or corrupted checkpoint detected on boot' }
          });

          await ExecutionStore.saveCheckpoint(context);
        }
      }
    }
    } catch (err: any) {
      console.error(`[RecoveryEngine] Boot recovery failed:`, err);
    }
  }

  private validateCheckpoint(context: ExecutionContext): boolean {
    if (!context || !context.id || !context.executionPlan) {
      return false;
    }
    
    // Check if the plan is malformed
    if (!Array.isArray(context.executionPlan.steps)) {
      return false;
    }

    return true;
  }
}

export const RecoveryEngine = new SystemRecoveryEngine();
