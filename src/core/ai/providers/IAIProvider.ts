import { IProvider } from '@/core/providers/ProviderRegistry';
import { IAIProviderResponse, ModelProfile } from '../runtime/RuntimeInterfaces';

export interface IAIProvider extends IProvider {
  /**
   * Discover and report available models dynamically.
   */
  getAvailableModels(): Promise<ModelProfile[]>;

  /**
   * Core AI Primitives
   */
  extractStructuredData<T>(text: string, schemaName: string, schemaDefinition?: any): Promise<IAIProviderResponse<T>>;
  classify(text: string, categories: string[]): Promise<IAIProviderResponse<{ category: string }>>;
  summarize(text: string): Promise<IAIProviderResponse<{ summary: string }>>;
  reason(context: string, goal: string): Promise<IAIProviderResponse<{ reasoning: string; decision: string }>>;
  generate(prompt: string): Promise<IAIProviderResponse<{ output: string }>>;

  /**
   * Resource Lifecycle Management
   */
  loadModel?(modelId: string): Promise<void>;
  unloadModel?(modelId: string): Promise<void>;
  isLoaded?(modelId: string): boolean;
  getStatus?(modelId: string): 'UNLOADED' | 'LOADING' | 'READY' | 'BUSY' | 'IDLE' | 'UNLOADING';
  getMemoryUsage?(modelId: string): Promise<number>;
  warmup?(modelId: string): Promise<void>;
  shutdown?(): Promise<void>;
}
