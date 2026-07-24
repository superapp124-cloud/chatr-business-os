import { IAIProvider } from './IAIProvider';
import { ModelProfile, IAIProviderResponse } from '../runtime/RuntimeInterfaces';

export class MockAIProvider implements IAIProvider {
  id = 'mock-ai-provider';
  name = 'Mock AI Provider';
  type = 'ai';
  role: any = 'AIProvider';

  capabilities() {
    return { canSearch: true, canBook: false, canCancel: false, canVerify: true };
  }

  async health() {
    return { isHealthy: true, lastChecked: Date.now() };
  }

  async authenticate() {
    return true;
  }

  async getAvailableModels(): Promise<ModelProfile[]> {
    return [
      {
        id: 'mock-model-v1',
        provider: 'mock',
        capabilities: { reasoning: 100, extraction: 100, classification: 100, vision: false, multilingual: true, contextWindow: 8192 },
        metrics: { latency: 'low', memoryRequirementsGb: 0 }
      }
    ];
  }

  async extractStructuredData<T>(text: string, schemaName: string): Promise<IAIProviderResponse<T>> {
    // Mock extraction
    return {
      result: {} as T,
      confidence: 0.99,
      reasoning: "Mock extraction successful."
    };
  }

  async classify(text: string, categories: string[]): Promise<IAIProviderResponse<{ category: string }>> {
    return { result: { category: categories[0] }, confidence: 0.9, reasoning: "Mock classification" };
  }

  async summarize(text: string): Promise<IAIProviderResponse<{ summary: string }>> {
    return { result: { summary: "Mock summary" }, confidence: 0.9, reasoning: "Mock summary generated" };
  }

  async reason(context: string, goal: string): Promise<IAIProviderResponse<{ reasoning: string; decision: string }>> {
    return { result: { reasoning: "Mock logic", decision: "Mock decision" }, confidence: 0.9, reasoning: "Mock reason evaluated" };
  }

  async generate(prompt: string): Promise<IAIProviderResponse<{ output: string }>> {
    return { result: { output: "Mock generated text" }, confidence: 0.9, reasoning: "Mock generation" };
  }
}
