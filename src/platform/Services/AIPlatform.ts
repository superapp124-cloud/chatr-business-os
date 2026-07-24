import { IService } from '../Shared/Types';
import { Logger } from '../Infrastructure/Logger';

// Provider Interface
export interface AIProvider {
  name: string;
  chat(prompt: string): Promise<string>;
}

class AIPlatformService implements IService {
  name = 'AIPlatform';
  dependencies = ['Configuration', 'Metrics'];
  
  private providers: Map<string, AIProvider> = new Map();
  private activeProvider = 'ollama';

  async initialize(): Promise<void> {
    Logger.info('[AIPlatform] Starting Provider Manager, Prompt Manager, Memory Manager...');
    // Register mock providers for now
    this.providers.set('ollama', {
      name: 'ollama',
      chat: async (prompt) => `[Ollama] Local response to: ${prompt}`
    });
  }

  async chat(prompt: string): Promise<string> {
    const provider = this.providers.get(this.activeProvider);
    if (!provider) throw new Error('No active AI provider');
    
    Logger.debug(`[AIPlatform] Routing chat to ${this.activeProvider}`);
    return provider.chat(prompt);
  }
}

export const AIPlatform = new AIPlatformService();
