/**
 * CHATR OS — Universal Executive Runtime
 * 
 * The central operating system intelligence layer. 
 * Orchestrates the Conversation Engine, Knowledge Brain, and Action Brain.
 */
import { IntentEngine } from './IntentEngine';
import { ContextRuntime } from './ContextRuntime';
import { ConversationEngine } from './ConversationEngine';
import { KnowledgeBrain } from './KnowledgeBrain';
import { ActionBrain } from './ActionBrain';
import { ExplanationEngine } from './ExplanationEngine';
import { IStructuredResponse } from '../types';

export class UniversalExecutiveRuntime {
  
  static async processCommand(
    userInput: string, 
    departmentId: string, 
    sessionId: string = 'default'
  ): Promise<IStructuredResponse> {
    const memory = ConversationEngine.getMemory(sessionId);
    memory.history.push({ role: 'user', text: userInput });

    try {
      // 1. Understand Intent
      const intent = IntentEngine.parse(userInput);
      
      // 2. Build Context (Resolves object and capabilities)
      const context = ContextRuntime.buildContext(intent);
      
      // 3. Clarification Check
      const clarification = ConversationEngine.checkClarification(intent, memory);
      if (clarification) {
        memory.history.push({ role: 'assistant', response: clarification });
        return clarification;
      }

      // 4. Route to Brains
      const isInform = intent.action === 'inform' || intent.action === 'analyze';
      
      let result;
      let response: IStructuredResponse;
      
      if (isInform) {
        result = await KnowledgeBrain.query(departmentId, intent);
        const explanation = ExplanationEngine.explain(context, intent.action, { success: true });
        response = ConversationEngine.formatInformResponse(intent, result, explanation);
      } else {
        // Act / Generate / etc.
        result = await ActionBrain.execute(context);
        const explanation = ExplanationEngine.explain(context, intent.action, result);
        response = ConversationEngine.formatActResponse(intent, result, explanation);
      }

      memory.history.push({ role: 'assistant', response });
      return response;
      
    } catch (err: any) {
      console.error('[UniversalExecutiveRuntime] Error:', err);
      const errorResponse: IStructuredResponse = {
        text: `I ran into an issue understanding or processing that request: ${err.message}`,
        confidence: 1.0
      };
      memory.history.push({ role: 'assistant', response: errorResponse });
      return errorResponse;
    }
  }

  static getConversationHistory(sessionId: string = 'default') {
    return ConversationEngine.getMemory(sessionId).history;
  }
}
