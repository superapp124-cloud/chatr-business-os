/**
 * CHATR OS — Conversation Engine
 * 
 * Part of the Universal Executive Runtime.
 * Maintains conversation memory, determines missing intent parameters,
 * and formats the final structured response.
 */
import { IStructuredResponse } from '../types';

interface IConversationMemory {
  history: any[];
  pendingClarification?: string;
}

export class ConversationEngine {
  private static sessions = new Map<string, IConversationMemory>();

  static getMemory(sessionId: string) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, { history: [] });
    }
    return this.sessions.get(sessionId)!;
  }

  static checkClarification(intent: any, memory: IConversationMemory): IStructuredResponse | null {
    // If it's a create action, ensure subject is clear.
    if (intent.action === 'create' && (intent.entity === 'unknown' || !intent.subject || intent.subject === 'unknown')) {
      memory.pendingClarification = 'subject';
      return {
        text: 'I can help with that. Could you provide a bit more detail on what exactly you want to create (e.g., role title, location)?',
        confidence: 1.0,
        actions: [
          { label: 'Cancel', intent: 'cancel' }
        ]
      };
    }
    
    // Clear pending clarification if all good
    memory.pendingClarification = undefined;
    return null;
  }

  static formatActResponse(intent: any, result: any, explanation: string): IStructuredResponse {
    if (!result.success) {
      return {
        text: `Something prevented me from completing your request. No changes were saved.`,
        confidence: 1.0,
        explanation: result.error
      };
    }

    const record = result.data;
    return {
      text: `Done. I've created the new ${intent.businessObject || 'record'}.`,
      confidence: 1.0,
      widgets: record ? [
        {
          type: 'record',
          data: record
        }
      ] : [],
      actions: [
        { label: 'Generate Details', intent: `generate details for ${record?.id}`, variant: 'primary' },
        { label: 'Publish', intent: `publish ${record?.id}` }
      ],
      explanation
    };
  }

  static formatInformResponse(intent: any, result: any, explanation: string): IStructuredResponse {
    return {
      text: result.summary,
      confidence: 0.99,
      widgets: result.data?.length > 0 ? [
        {
          type: 'table',
          data: result.data
        }
      ] : [],
      explanation
    };
  }
}
