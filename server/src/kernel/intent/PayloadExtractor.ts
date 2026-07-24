import { ExecutionContext } from '../../types.js';

export class SystemPayloadExtractor {
  async extract(context: ExecutionContext): Promise<ExecutionContext> {
    if (!context.resolvedIntent) throw new Error('Cannot extract payload: No capability resolved.');
    
    console.log(`[PayloadExtractor] Extracting parameters for action: ${context.resolvedIntent.action}`);

    // In reality, this would use LLM Entity Extraction based on the registered Capability schema.
    // For this slice, we mock the extraction.
    
    if (context.resolvedIntent.action === 'log_decision') {
      context.resolvedIntent.payload = {
        title: context.rawInput, // Use the raw input as the decision title for now
        priority: context.rawInput.toLowerCase().includes('urgent') ? 'high' : 'medium',
        impact: 'medium'
      };
    }

    return context;
  }
}

export const PayloadExtractor = new SystemPayloadExtractor();
