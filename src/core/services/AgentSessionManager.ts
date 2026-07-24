import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/platform/Infrastructure/Logger';

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface AgentSession {
  id: string;
  user_id: string;
  agent_id: string;
  session_name: string | null;
  messages: AgentMessage[];
  summary: string | null;
  context_tokens: number;
  total_messages: number;
  model_used: string | null;
  goals: any[];
  open_tasks: any[];
  entities: any[];
  topics: any[];
  mood: string | null;
  pinned_context: string | null;
  workspace_state: Record<string, any>;
  memory_references: any[];
  last_active_at: string;
  created_at: string;
  updated_at: string;
}

class AgentSessionManagerImpl {
  async getSession(sessionId: string): Promise<AgentSession | null> {
    try {
      const { data, error } = await supabase
        .from('agent_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();
        
      if (error) throw error;
      return data as AgentSession;
    } catch (err: any) {
      Logger.error(`[AgentSessionManager] Failed to get session ${sessionId}:`, err.message);
      return null;
    }
  }

  async createSession(agentId: string, initialMessage?: AgentMessage): Promise<AgentSession | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const messages = initialMessage ? [initialMessage] : [];

      const { data, error } = await supabase
        .from('agent_sessions')
        .insert({
          user_id: user.id,
          agent_id: agentId,
          messages,
          total_messages: messages.length,
          last_active_at: new Date().toISOString()
        })
        .select('*')
        .single();
        
      if (error) throw error;
      return data as AgentSession;
    } catch (err: any) {
      Logger.error(`[AgentSessionManager] Failed to create session for agent ${agentId}:`, err.message);
      return null;
    }
  }

  async appendMessage(sessionId: string, message: AgentMessage): Promise<void> {
    try {
      // Optimistic concurrency or simple jsonb append. 
      // Supabase RPC or straightforward update:
      const session = await this.getSession(sessionId);
      if (!session) return;

      const updatedMessages = [...(session.messages || []), message];
      
      const { error } = await supabase
        .from('agent_sessions')
        .update({
          messages: updatedMessages,
          total_messages: updatedMessages.length,
          last_active_at: new Date().toISOString()
        })
        .eq('id', sessionId);
        
      if (error) throw error;
    } catch (err: any) {
      Logger.error(`[AgentSessionManager] Failed to append message to session ${sessionId}:`, err.message);
    }
  }

  async updateMetadata(sessionId: string, metadata: Partial<AgentSession>): Promise<void> {
    try {
      const payload: any = { ...metadata, updated_at: new Date().toISOString() };
      // Prevent updating read-only fields
      delete payload.id;
      delete payload.user_id;
      
      const { error } = await supabase
        .from('agent_sessions')
        .update(payload)
        .eq('id', sessionId);
        
      if (error) throw error;
    } catch (err: any) {
      Logger.error(`[AgentSessionManager] Failed to update metadata for session ${sessionId}:`, err.message);
    }
  }
}

export const agentSessionManager = new AgentSessionManagerImpl();
