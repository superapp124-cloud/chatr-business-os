import { ExecutionContext } from '../../types.js';
import { EventBus } from '../../services/EventBusService.js';

export class SystemPolicyEngine {
  async evaluate(context: ExecutionContext): Promise<ExecutionContext> {
    if (!context.executionPlan) throw new Error('Policy Engine requires an Execution Plan.');

    console.log(`[PolicyEngine] Evaluating policies for intent: ${context.resolvedIntent?.action}`);
    
    // In an enterprise system, this looks up organizational policies.
    // E.g. "If invoice amount > 10,000 AND user != 'Director', require approval"
    
    // Mock Policy: Decisions marked as 'Urgent' require CEO approval.
    const isUrgent = context.resolvedIntent?.payload?.priority === 'high';
    
    if (isUrgent) {
      console.log(`[PolicyEngine] Policy Violation Detected: Urgent decisions require approval.`);
      
      context.state = 'Waiting';
      
      // Pause the pipeline and request approval via Event Bus
      await EventBus.publish({
        eventType: 'ApprovalRequested',
        payload: { contextId: context.id, reason: 'High priority decision policy' },
        source: 'PolicyEngine',
        actorId: context.tenant.userId,
        tenantId: context.tenant.tenantId
      });

      // Log the observation
      context.observations.push({
        timestamp: new Date().toISOString(),
        type: 'policy_violation',
        component: 'PolicyEngine',
        details: 'Paused for mandatory approval due to high priority.'
      });

      return context;
    }

    // Authorized
    console.log(`[PolicyEngine] Plan authorized. Proceeding to execution.`);
    context.state = 'Authorized';
    return context;
  }
}

export const PolicyEngine = new SystemPolicyEngine();
