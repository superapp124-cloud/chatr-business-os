import { randomUUID } from 'crypto';
import { ExecutionContext, ExecutionPlan, IPlanner } from '../../types.js';

export class SequentialPlanner implements IPlanner {
  async generatePlan(context: ExecutionContext): Promise<ExecutionPlan> {
    if (!context.resolvedIntent) throw new Error('Planner requires a resolved intent.');
    
    console.log(`[SequentialPlanner] Generating execution plan for: ${context.resolvedIntent.action}`);
    context.state = 'Planned';

    const plan: ExecutionPlan = {
      id: `plan_${Date.now()}`,
      steps: []
    };

    const [noun] = context.resolvedIntent.intent.split('.');
    
    // Step 1: Database Mutation
    const step1Id = randomUUID();
    plan.steps.push({
      id: step1Id,
      idempotencyKey: `${context.id}:insert:${noun}`,
      action: 'Database.Insert',
      component: 'WorkflowRuntime',
      payload: { table: 'os_work_objects', type: noun },
      status: 'Pending',
      retryCount: 0,
      maxAttempts: 3,
      timeoutMs: 30000 // 30 seconds
    });
    
    // Step 2: Event Publication
    const step2Id = randomUUID();
    plan.steps.push({
      id: step2Id,
      idempotencyKey: `${context.id}:publish:WorkObjectCreated`,
      action: 'Publish',
      component: 'EventBus',
      payload: { eventType: 'WorkObjectCreated' },
      status: 'Pending',
      retryCount: 0,
      maxAttempts: 3,
      timeoutMs: 10000 // 10 seconds
    });

    context.executionPlan = plan;
    return plan;
  }
}

export const Planner = new SequentialPlanner();
