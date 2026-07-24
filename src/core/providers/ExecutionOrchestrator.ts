import { IProvider, ExecutionContext, ExecutionReceipt } from './types';
import { executionPlanner } from './ExecutionPlanner';
import { providerRegistry } from './ProviderRegistry';

export class ExecutionOrchestrator {
  
  /**
   * Discovers options across all available providers for an intent.
   * Useful for comparison widgets (e.g., flight or cab booking).
   */
  async discoverOptions(intent: string, type: string, parameters: Record<string, any>): Promise<any[]> {
    const context: ExecutionContext = { intent, parameters };
    
    // 1. Plan - Get ranked providers
    const providers = await executionPlanner.planExecution(intent, type);
    
    // 2. Discover - Ask each capable provider for options
    const discoveryPromises = providers
      .filter(p => typeof p.discover === 'function')
      .map(async (provider) => {
        try {
          const options = await provider.discover!(context);
          // Tag options with the provider ID for later execution
          return options.map(opt => ({ ...opt, providerId: provider.id }));
        } catch (error) {
          console.error(`[ExecutionOrchestrator] Provider ${provider.id} discover failed:`, error);
          return [];
        }
      });
      
    const results = await Promise.all(discoveryPromises);
    return results.flat();
  }

  /**
   * Executes a specific option with its associated provider.
   */
  async executeOption(intent: string, providerId: string, parameters: Record<string, any>): Promise<ExecutionReceipt> {
    const context: ExecutionContext = { intent, parameters };
    
    // Fetch the provider directly from registry by ID
    const provider = providerRegistry.getProvidersByTypeAndRole('cab', 'ExecutionProvider').find(p => p.id === providerId) 
                  || providerRegistry.getProvidersByType('cab').find(p => p.id === providerId);
                  
    if (!provider || typeof provider.execute !== 'function') {
      return {
        status: 'Failed',
        providerId,
        strategyUsed: 'LOCAL',
        message: 'Provider not found or does not support execution.'
      };
    }
    
    try {
      return await provider.execute(context);
    } catch (error) {
      console.error(`[ExecutionOrchestrator] Provider ${providerId} execution failed:`, error);
      return {
        status: 'Failed',
        providerId,
        strategyUsed: 'LOCAL',
        message: 'Execution failed due to an internal error.'
      };
    }
  }
}

export const executionOrchestrator = new ExecutionOrchestrator();
