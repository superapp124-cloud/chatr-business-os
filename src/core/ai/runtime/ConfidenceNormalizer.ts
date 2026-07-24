import { IAIProviderResponse } from './RuntimeInterfaces';

export class ConfidenceNormalizer {
  
  /**
   * Ensures every AI response adheres to the strict Enterprise format,
   * injecting defaults for models that don't output confidence or reasoning natively.
   */
  static normalize<T>(rawPayload: any, metadata: { modelUsed: string, latencyMs: number }): IAIProviderResponse<T> {
    
    // Check if the model wrapped the result in a standard envelope
    if (rawPayload.result && rawPayload.confidence !== undefined) {
      return {
        ...rawPayload,
        providerData: metadata
      };
    }

    // If it's a naked payload, wrap it.
    return {
      result: rawPayload as T,
      confidence: 0.85, // Default assumed confidence if model doesn't supply it
      reasoning: "Task completed based on contextual extraction.",
      warnings: [],
      missing_information: [],
      providerData: metadata
    };
  }
}
