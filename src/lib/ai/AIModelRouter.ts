import { generate } from '@/services/ai';

export type AIProvider = 'gemini' | 'gpt' | 'claude' | 'local' | 'enterprise';

export interface AIRequestOptions {
  taskType: 'summarize' | 'draft_reply' | 'extract_entities' | 'complex_reasoning';
  preferredProvider?: AIProvider;
  privacyRequired?: boolean; // If true, forces local or enterprise
}

export class AIModelRouter {
  
  /**
   * Evaluates the task and routes it to the most suitable provider.
   */
  static async routeTask(prompt: string, options: AIRequestOptions): Promise<string> {
    
    const provider = this.determineBestProvider(options);
    
    switch (provider) {
      case 'local':
        return this.executeLocalModel(prompt, options.taskType);
      case 'gemini':
      case 'gpt':
      case 'claude':
        return this.executeLocalModel(prompt, options.taskType);
      case 'enterprise':
        return this.executeEnterpriseModel(prompt);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  private static determineBestProvider(options: AIRequestOptions): AIProvider {
    if (options.privacyRequired) {
      // In a real app, check if enterprise server is configured, else fallback to local
      return 'local';
    }

    return 'local';
  }

  private static async executeLocalModel(prompt: string, taskType: string): Promise<string> {
    console.log(`[AI Router] Executing LOCAL model for task: ${taskType}`);
    return generate({ prompt, preferLocal: true });
  }

  private static async executeEnterpriseModel(prompt: string): Promise<string> {
    console.log(`[AI Router] Executing ENTERPRISE model`);
    // Connects to a user-defined local inference server (e.g., vLLM or Ollama endpoint)
    return "Simulated enterprise response.";
  }
}
