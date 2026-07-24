import { IAITask, IAIProviderResponse, AIGovernanceMetadata } from './RuntimeInterfaces';
import { ModelRouter } from './ModelRouter';
import { providerRegistry } from '@/core/providers/ProviderRegistry';
import { IAIProvider } from '../providers/IAIProvider';
import { responseCache } from './ResponseCache';
import { eventBus } from '@/core/runtime/EventBus';

/**
 * AITaskEngine — v1.1A (Ollama Integration)
 *
 * Responsibilities:
 * - Route tasks to the best available provider via ModelRouter.
 * - Apply LRU ResponseCache before calling any provider.
 * - Measure real provider latency and emit telemetry.
 * - Gracefully fall back if the primary provider fails.
 * - Emit provider health events for the Engine Dashboard.
 */
export class AITaskEngine {
  private static instance: AITaskEngine;

  private constructor() {}

  public static getInstance(): AITaskEngine {
    if (!AITaskEngine.instance) {
      AITaskEngine.instance = new AITaskEngine();
    }
    return AITaskEngine.instance;
  }

  public async executeTask<TInput, TOutput>(
    task: IAITask<TInput, TOutput>,
    input: TInput,
    contextSources?: string[]
  ): Promise<{ result: TOutput, metadata: AIGovernanceMetadata }> {
    console.log(`[AITaskEngine] Executing: ${task.name || task.id} (${task.type})`);

    // 1. Check Response Cache first
    const cacheKey = JSON.stringify({ taskType: task.type, input });
    const cacheHash = btoa(unescape(encodeURIComponent(cacheKey))).slice(0, 32);
    const cached = responseCache.get('global', 'any', task.type, cacheHash);
    if (cached) {
      console.log(`[AITaskEngine] Cache HIT for task: ${task.name || task.id}`);
      return task.execute(input, contextSources);
    }

    // 2. Discover providers via registry
    const aiProviders = providerRegistry.getProvidersByType('ai') as IAIProvider[];
    
    if (aiProviders.length === 0) {
      console.warn('[AITaskEngine] No AI providers registered. Executing task directly.');
      return task.execute(input, contextSources);
    }

    // 3. Health-check providers before routing (filter out unavailable ones)
    const healthyProviders: IAIProvider[] = [];
    for (const provider of aiProviders) {
      try {
        const h = await Promise.race([
          provider.health(),
          new Promise<{isHealthy: boolean}>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
        ]);
        if (h.isHealthy) {
          healthyProviders.push(provider);
        } else {
          console.warn(`[AITaskEngine] Provider ${provider.name} is unhealthy, skipping.`);
          eventBus.publish('AI_PROVIDER_DEGRADED', { providerId: provider.id, reason: 'health_check_failed' });
        }
      } catch {
        console.warn(`[AITaskEngine] Provider ${provider.name} health check timed out.`);
        eventBus.publish('AI_PROVIDER_DEGRADED', { providerId: provider.id, reason: 'health_check_timeout' });
      }
    }

    // 4. Fall back to task's own execute if no healthy providers
    if (healthyProviders.length === 0) {
      console.warn('[AITaskEngine] No healthy providers available. Degrading gracefully.');
      eventBus.publish('AI_RUNTIME_DEGRADED', { reason: 'all_providers_unhealthy' });
      return task.execute(input, contextSources);
    }

    // 5. Route to best provider
    try {
      const { provider, model } = await ModelRouter.route(task.type, healthyProviders);
      console.log(`[AITaskEngine] Routing to: ${provider.name} / model: ${model.id}`);

      const startTime = performance.now();
      const result = await task.execute(input, contextSources);
      const latencyMs = Math.round(performance.now() - startTime);

      // Emit real latency telemetry
      eventBus.publish('AI_TASK_COMPLETED', {
        taskType: task.type,
        providerId: provider.id,
        modelId: model.id,
        latencyMs,
        cached: false
      });

      return result;
    } catch (err: any) {
      console.error(`[AITaskEngine] Routing failed: ${err.message}. Falling back.`);
      eventBus.publish('AI_PROVIDER_ERROR', { taskType: task.type, error: err.message });
      return task.execute(input, contextSources);
    }
  }
}

export const aiTaskEngine = AITaskEngine.getInstance();
