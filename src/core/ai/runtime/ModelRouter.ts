import { ModelProfile } from './RuntimeInterfaces';
import { IAIProvider } from '../providers/IAIProvider';

export class ModelRouter {
  
  /**
   * Selects the best model and provider for a specific task type.
   * e.g., 'reasoning' tasks get routed to models with high reasoning scores.
   */
  static async route(taskType: string, providers: IAIProvider[]): Promise<{ provider: IAIProvider, model: ModelProfile }> {
    let allModels: { provider: IAIProvider, profile: ModelProfile }[] = [];

    for (const p of providers) {
      if (p.getAvailableModels) {
        try {
          const profiles = await p.getAvailableModels();
          profiles.forEach(profile => allModels.push({ provider: p, profile }));
        } catch (e) {
          console.warn(`[ModelRouter] Failed to fetch models from provider ${p.id}`);
        }
      }
    }

    if (allModels.length === 0) {
      throw new Error("No AI Models available across any provider.");
    }

    // Sort based on taskType requirements
    allModels.sort((a, b) => {
      if (taskType === 'reason') return b.profile.capabilities.reasoning - a.profile.capabilities.reasoning;
      if (taskType === 'extractStructuredData') return b.profile.capabilities.extraction - a.profile.capabilities.extraction;
      if (taskType === 'classify') return b.profile.capabilities.classification - a.profile.capabilities.classification;
      return 0; // Default sort
    });

    return { provider: allModels[0].provider, model: allModels[0].profile };
  }
}
