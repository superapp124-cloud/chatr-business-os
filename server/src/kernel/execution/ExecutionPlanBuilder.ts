import { ExecutionPlan, ExecutionPlanStep, ExecutionContext } from '../../types.js';
import { randomUUID } from 'crypto';

export class ExecutionPlanBuilder {
  /**
   * Deep copies an ExecutionPlan template and hydrates its payloads with extracted entities.
   */
  static build(context: ExecutionContext, template: ExecutionPlan, entities: Record<string, any>): ExecutionPlan {
    const plan: ExecutionPlan = {
      id: `plan_${Date.now()}`,
      steps: template.steps.map(step => this.hydrateStep(context, step, entities))
    };
    return plan;
  }

  private static hydrateStep(context: ExecutionContext, step: ExecutionPlanStep, entities: Record<string, any>): ExecutionPlanStep {
    const newStep = { ...step, id: randomUUID(), status: 'Pending' as const };
    
    // Hydrate idempotency key
    newStep.idempotencyKey = newStep.idempotencyKey.replace('{contextId}', context.id);

    // Deep copy and hydrate payload
    if (newStep.payload) {
      newStep.payload = JSON.parse(JSON.stringify(newStep.payload));
      
      // Simple string replacement for entity variables in payload values
      // e.g. "name": "{name}" -> "name": "John"
      this.hydrateObject(newStep.payload, entities);
    }
    
    return newStep;
  }

  private static hydrateObject(obj: any, entities: Record<string, any>) {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        // Replace {variable} with entity value
        obj[key] = obj[key].replace(/{([^}]+)}/g, (match: string, p1: string) => {
          return entities[p1] !== undefined ? entities[p1] : match;
        });
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.hydrateObject(obj[key], entities);
      }
    }
  }
}
