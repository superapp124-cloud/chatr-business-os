import { CapabilityType } from './CapabilityRegistry';

export interface ParsedIntent {
  capabilityType: CapabilityType;
  action: string;
  payload: any;
  confidence: number;
}

export class IntentResolver {
  /**
   * Resolves a natural language or structured intent into an executable capability.
   * This would typically involve a lightweight classifier or an LLM call internally,
   * but operates strictly as part of the Kernel routing.
   */
  static async resolve(input: string | any, context: any): Promise<ParsedIntent> {
    // Basic mock implementation for structured routing
    if (typeof input === 'object' && input.capabilityType) {
      return {
        capabilityType: input.capabilityType as CapabilityType,
        action: input.action || 'default',
        payload: input.payload || {},
        confidence: 1.0
      };
    }

    // In a real implementation, this would use a fast local embedding lookup or router model
    // For now, default to text generation if it's just a string
    return {
      capabilityType: 'TextGeneration',
      action: 'generate',
      payload: { prompt: input },
      confidence: 0.9
    };
  }
}
