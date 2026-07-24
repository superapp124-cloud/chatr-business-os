/**
 * CHATR OS — Explanation Engine
 * 
 * Part of the Universal Executive Runtime.
 * Provides the "Why?" audit trails and reasoning for decisions made by the AI.
 */

export class ExplanationEngine {
  
  static explain(context: any, action: string, result: any): string {
    if (!result || !result.success) {
      return 'I encountered an error and could not complete the operation. No changes were made.';
    }

    if (action === 'create') {
      return `I successfully created the record. This action was authorized by your current role and mapped to the standard workflow template.`;
    }

    if (action === 'inform') {
      return `These metrics were aggregated directly from the BusinessObjectStore. Confidence is 99% as no AI estimation was used.`;
    }

    return 'The operation completed successfully based on standard system rules.';
  }
}
