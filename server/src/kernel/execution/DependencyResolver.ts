import { ExecutionContext, ICapabilityWorkflow } from '../../types.js';

export class DependencyResolver {
  private ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';

  async resolveDependencies(context: ExecutionContext, workflow: ICapabilityWorkflow, entities: Record<string, any>): Promise<boolean> {
    if (!workflow.requiredEntities || workflow.requiredEntities.length === 0) {
      return true; // No dependencies
    }

    const missing: string[] = [];
    for (const req of workflow.requiredEntities) {
      if (!entities[req]) {
        missing.push(req);
      }
    }

    if (missing.length === 0) {
      return true;
    }

    // Missing dependencies! Trigger clarification.
    console.log(`[DependencyResolver] Missing required entities: ${missing.join(', ')}`);
    context.state = 'WaitingForClarification';
    
    // Generate natural language question
    let clarificationQuestion = `Please provide the following missing information: ${missing.join(', ')}`;
    
    // Attempt to use Ollama for natural question generation
    if (context.tenant.tenantId !== 'system' && !process.env.VITEST) { // Skip in E2E tests
      try {
        const response = await fetch(`${this.ollamaUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama3',
            prompt: `You are a helpful assistant. The user wants to execute an action but is missing some information.
Missing fields: ${missing.join(', ')}
Original request: "${context.rawInput}"
Generate a single, natural question asking the user for this missing information. Do NOT include any other text.`,
            stream: false,
            options: { temperature: 0.3 }
          })
        });
        if (response.ok) {
          const data = await response.json();
          clarificationQuestion = data.response.trim();
        }
      } catch (err) {
        // Fallback to static text
      }
    }

    // Save observation
    context.observations.push({
      id: `obs_${Date.now()}`,
      timestamp: new Date().toISOString(),
      source: 'DependencyResolver',
      level: 'warn',
      message: clarificationQuestion,
      data: { missing }
    });

    return false; // Dependencies not met
  }
}
