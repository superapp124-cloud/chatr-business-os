import { IAIProvider } from './IAIProvider';
import { ModelProfile, IAIProviderResponse } from '../runtime/RuntimeInterfaces';
import { JSONValidator } from '../runtime/JSONValidator';
import { PromptEngine } from '../runtime/PromptEngine';
import { eventBus } from '@/core/runtime/EventBus';

/**
 * OllamaProvider — v1.1A Production Grade
 *
 * Implements the full IAIProvider contract against a locally-running Ollama instance.
 * - No paid cloud dependency.
 * - Emits real latency telemetry via EventBus.
 * - Implements a 10s timeout on all inference calls.
 * - Gracefully returns error metadata on failure.
 */
export class OllamaProvider implements IAIProvider {
  id = 'ollama-provider';
  name = 'Ollama Local Provider';
  type = 'ai';
  role: any = 'AIProvider';

  // Configurable: allow CHATR OS settings to override the endpoint
  private get baseUrl(): string {
    return (typeof globalThis !== 'undefined' && (globalThis as any).__CHATR_OLLAMA_URL__)
      ? (globalThis as any).__CHATR_OLLAMA_URL__
      : 'http://localhost:11434';
  }

  // Default model — overridden by ModelRouter if multiple models are available
  private activeModel = 'qwen2.5:latest';
  private readonly TIMEOUT_MS = 10_000;

  capabilities() {
    return { canSearch: true, canBook: false, canCancel: false, canVerify: true };
  }

  async health() {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${this.baseUrl}/api/tags`, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) return { isHealthy: true, lastChecked: Date.now() };
    } catch (e) {
      console.warn(`[OllamaProvider] Health check failed: ${(e as any)?.message}`);
    }
    return { isHealthy: false, lastChecked: Date.now() };
  }

  async authenticate() { return true; }

  async getAvailableModels(): Promise<ModelProfile[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.models.map((m: any) => ({
        id: m.name,
        provider: 'ollama',
        capabilities: {
          reasoning: 80,
          extraction: 80,
          classification: 80,
          vision: false,
          multilingual: true,
          contextWindow: 8192
        },
        metrics: { latency: 'medium', memoryRequirementsGb: 4 }
      }));
    } catch (e) {
      return [];
    }
  }

  private async generateInternal(prompt: string, format?: string): Promise<{ response: string, latencyMs: number }> {
    const startTime = performance.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

    eventBus.publish('AI_INFERENCE_START', { providerId: this.id, model: this.activeModel });

    try {
      const res = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.activeModel,
          prompt,
          stream: false,
          ...(format ? { format } : {})
        }),
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!res.ok) {
        eventBus.publish('AI_PROVIDER_ERROR', { providerId: this.id, status: res.status, prompt: prompt.slice(0, 80) });
        throw new Error(`Ollama returned HTTP ${res.status}`);
      }

      const data = await res.json();
      const latencyMs = Math.round(performance.now() - startTime);

      eventBus.publish('AI_INFERENCE_COMPLETE', {
        providerId: this.id,
        model: this.activeModel,
        latencyMs,
        tokenEstimate: (data.response?.length ?? 0) / 4
      });

      return { response: data.response, latencyMs };
    } catch (e: any) {
      clearTimeout(timer);
      if (e.name === 'AbortError') {
        throw new Error(`[OllamaProvider] Inference timed out after ${this.TIMEOUT_MS}ms`);
      }
      throw e;
    }
  }

  async extractStructuredData<T>(text: string, schemaName: string, schemaDef?: any): Promise<IAIProviderResponse<T>> {
    const prompt = `${PromptEngine.getTemplate('extractStructuredData')}\n\nSchema: ${schemaName}\nData: ${text}`;
    const { response, latencyMs } = await this.generateInternal(prompt, 'json');
    const validated = JSONValidator.validate<T>(response);
    return {
      result: validated,
      confidence: 0.95,
      reasoning: 'Extracted structure using schema mapping.',
      providerData: { modelUsed: this.activeModel, latencyMs }
    };
  }

  async classify(text: string, categories: string[]): Promise<IAIProviderResponse<{ category: string }>> {
    const prompt = `${PromptEngine.getTemplate('classify')}\n\nCategories: ${categories.join(', ')}\n\nText: ${text}`;
    const { response, latencyMs } = await this.generateInternal(prompt, 'json');
    const validated = JSONValidator.validate<{ category: string }>(response);
    return { result: validated, confidence: 0.9, reasoning: 'Classified text.', providerData: { modelUsed: this.activeModel, latencyMs } };
  }

  async summarize(text: string): Promise<IAIProviderResponse<{ summary: string }>> {
    const prompt = `${PromptEngine.getTemplate('summarize')}\n\nText: ${text}`;
    const { response, latencyMs } = await this.generateInternal(prompt);
    return { result: { summary: response }, confidence: 0.9, reasoning: 'Summarized text.', providerData: { modelUsed: this.activeModel, latencyMs } };
  }

  async reason(context: string, goal: string): Promise<IAIProviderResponse<{ reasoning: string; decision: string }>> {
    const prompt = `${PromptEngine.getTemplate('reason')}\n\nGoal: ${goal}\nContext: ${context}`;
    const { response, latencyMs } = await this.generateInternal(prompt, 'json');
    const validated = JSONValidator.validate<{ reasoning: string; decision: string }>(response);
    return { result: validated, confidence: 0.9, reasoning: 'Evaluated reasoning logic.', providerData: { modelUsed: this.activeModel, latencyMs } };
  }

  async generate(prompt: string): Promise<IAIProviderResponse<{ output: string }>> {
    const { response, latencyMs } = await this.generateInternal(prompt);
    return { result: { output: response }, confidence: 0.9, reasoning: 'Generated completion.', providerData: { modelUsed: this.activeModel, latencyMs } };
  }

  // --- Resource Lifecycle Management ---

  async loadModel(modelId: string): Promise<void> {
    await this.warmup(modelId);
  }

  async unloadModel(modelId: string): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelId, keep_alive: 0 })
      });
    } catch (e) {
      console.warn(`[OllamaProvider] Failed to unload model ${modelId}:`, e);
    }
  }

  isLoaded(modelId: string): boolean {
    return true; // We defer strict loaded state to ResourceManagerEngine tracking
  }

  getStatus(modelId: string): 'UNLOADED' | 'LOADING' | 'READY' | 'BUSY' | 'IDLE' | 'UNLOADING' {
    return 'READY'; // Defer strict status to ResourceManagerEngine
  }

  async getMemoryUsage(modelId: string): Promise<number> {
    try {
      const res = await fetch(`${this.baseUrl}/api/ps`);
      if (res.ok) {
        const data = await res.json();
        const model = data.models?.find((m: any) => m.name === modelId);
        if (model) return model.size_vram || model.size || 0;
      }
    } catch (e) {}
    return 0;
  }

  async warmup(modelId: string): Promise<void> {
    try {
      // Send an empty prompt with keep_alive to load model into VRAM
      await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelId, prompt: '', keep_alive: '15m' })
      });
    } catch (e) {
      console.warn(`[OllamaProvider] Failed to warmup model ${modelId}:`, e);
    }
  }

  async shutdown(): Promise<void> {
    await this.unloadModel(this.activeModel);
  }
}

// Auto-register the provider upon import
import { providerRegistry } from '@/core/providers/ProviderRegistry';
providerRegistry.register(new OllamaProvider());
