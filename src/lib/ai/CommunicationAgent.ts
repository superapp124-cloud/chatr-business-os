import { AIModelRouter } from './AIModelRouter';
import { supabase } from '@/integrations/supabase/client';

export class CommunicationAgent {
  
  /**
   * The Skill System: Exposed capabilities of this agent.
   */
  async executeSkill(skillName: string, payload: any): Promise<any> {
    switch (skillName) {
      case 'Summarize':
        return this.summarizeThread(payload.conversationId);
      case 'DraftReply':
        return this.draftReply(payload.conversationId);
      case 'Translate':
        return this.translateMessage(payload.text, payload.targetLanguage);
      default:
        throw new Error(`Skill ${skillName} not supported by CommunicationAgent`);
    }
  }

  /**
   * Proactive action triggered by the Orchestrator when the user is idle.
   */
  async proactiveDrafting(): Promise<void> {
    console.log('[CommunicationAgent] Running proactive drafting routine...');
    
    // Find unread messages
    const { data: unreadConversations } = await supabase
      .from('conversations')
      .select('id, name')
      // .gt('unread_count', 0) // Assuming this column exists or similar logic
      .limit(3);
      
    if (!unreadConversations || unreadConversations.length === 0) return;

    for (const conv of unreadConversations) {
      console.log(`[CommunicationAgent] Proactively drafting reply for: ${conv.name}`);
      await this.draftReply(conv.id);
      // In a real app, we would save this draft to the database (e.g., a `message_drafts` table)
      // so the AdaptiveHome UI can pull it up instantly.
    }
  }

  // --- Skill Implementations ---

  private async summarizeThread(conversationId: string): Promise<string> {
    const prompt = `Summarize the recent messages for conversation ${conversationId}.`;
    return AIModelRouter.routeTask(prompt, { taskType: 'summarize', privacyRequired: true });
  }

  private async draftReply(conversationId: string): Promise<string> {
    const prompt = `Draft a professional reply for the latest messages in conversation ${conversationId}.`;
    return AIModelRouter.routeTask(prompt, { taskType: 'draft_reply', privacyRequired: true });
  }

  private async translateMessage(text: string, targetLanguage: string): Promise<string> {
    const prompt = `Translate this to ${targetLanguage}: ${text}`;
    return AIModelRouter.routeTask(prompt, { taskType: 'complex_reasoning' });
  }
}
