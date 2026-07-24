import { IService } from '../Shared/Types';
import { Logger } from './Logger';

class ConfigurationManagerService implements IService {
  name = 'Configuration';
  dependencies = []; // Root dependency
  
  private config: Record<string, any> = {
    features: {
      enableLocalAI: true,
      enableCloudFallback: false,
      enableOfflineSync: true
    },
    ai: {
      defaultProvider: 'ollama',
      localModel: 'llama3.2',
    }
  };

  async initialize(): Promise<void> {
    Logger.info('[Configuration] Initialized with defaults.');
    // In the future, this will load from local storage or remote config API.
  }

  get<T>(path: string, defaultValue?: T): T {
    const keys = path.split('.');
    let current = this.config;
    for (const key of keys) {
      if (current[key] === undefined) return defaultValue as T;
      current = current[key];
    }
    return current as unknown as T;
  }
}

export const ConfigurationManager = new ConfigurationManagerService();
