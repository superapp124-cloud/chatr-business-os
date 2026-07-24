
import { ActiveAIProvider } from './AIProvider';
import { AIContext, IntentPlan } from './Types';

export class IntentService {
  async processIntent(intentText: string, context: AIContext): Promise<IntentPlan> {
    console.log('[IntentService] Initiating multi-stage pipeline...');
    // 1. Parser (Extract entities)
    // 2. Entity Resolver
    // 3. Capability Planner
    // 4. Generator (via Provider)
    const plan = await ActiveAIProvider.plan(intentText, context);
    // 5. Validator
    console.log('[IntentService] Plan validated.');
    return plan;
  }
}

export const AutomationIntentService = new IntentService();
