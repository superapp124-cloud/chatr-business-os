import { IProvider, ExecutionContext } from './types';
import { providerRegistry } from './ProviderRegistry';

export class ExecutionPlanner {
  
  /**
   * Discovers and ranks providers for a specific intent based on health, confidence, and latency.
   * Returns a prioritized list of providers capable of fulfilling the intent.
   */
  async planExecution(intent: string, type: string): Promise<IProvider[]> {
    // Get all healthy execution providers for the given type
    const healthyProviders = await providerRegistry.getHealthyProviders(type, 'ExecutionProvider');
    
    if (healthyProviders.length === 0) {
      console.warn(`[ExecutionPlanner] No healthy providers found for type: ${type}`);
      return [];
    }

    // Evaluate metrics for each provider
    const evaluatedProviders = await Promise.all(
      healthyProviders.map(async (provider) => {
        const metrics = provider.metrics ? await provider.metrics() : { confidence: 50, latencyMs: 1000 };
        return { provider, metrics };
      })
    );

    // Rank by confidence (descending) then latency (ascending)
    evaluatedProviders.sort((a, b) => {
      if (b.metrics.confidence !== a.metrics.confidence) {
        return b.metrics.confidence - a.metrics.confidence;
      }
      return a.metrics.latencyMs - b.metrics.latencyMs;
    });

    return evaluatedProviders.map(ep => ep.provider);
  }
}

export const executionPlanner = new ExecutionPlanner();
