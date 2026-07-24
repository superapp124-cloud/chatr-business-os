/**
 * CHATR OS — Automation Engine
 * 
 * Intercepts events from the EventBus and executes autonomous workflows 
 * using the Universal Intent Execution Framework.
 */
import { EventBus } from './EventBus';
import { GoalPlanner, IExecutionGraph } from './GoalPlanner';
import { ExecutionRuntime } from './ExecutionRuntime';
import { ContextRuntime, IBusinessContext } from './ContextRuntime';

export const SYSTEM_IDENTITY = {
  id: 'system',
  roles: ['system_admin']
};

export class AutomationEngine {
  private static isInitialized = false;

  static initialize() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    EventBus.subscribe('*', 'WorkObjectCreated', async (payload: any) => {
      if (payload?.objectName === 'Ticket' && !payload?.object?.Assignee && !payload?.object?.assignee) {
        // Build an autonomous business context
        const context: IBusinessContext = {
          intent: { action: 'assign', entity: 'ticket', subject: 'System Admin', confidence: 1.0, dropped_clauses: [] },
          capabilityId: 'Support.Helpdesk',
          businessObject: 'Ticket',
          user: SYSTEM_IDENTITY,
          currentRecord: payload.object,
          policies: [],
          memory: []
        };

        try {
          const plan: IExecutionGraph = GoalPlanner.createPlan(context);
          await ExecutionRuntime.execute(plan);
        } catch (err) {
           console.error('[AutomationEngine] Autonomous Execution Failed', err);
        }
      }
    });
  }
}
