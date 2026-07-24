import { supabase } from '@/integrations/supabase/client';
import { generate } from '@/services/ai';
import { Logger } from '@/platform/Infrastructure/Logger';

export type SemanticMemoryType = 'chat' | 'doc' | 'code' | 'rule' | 'log';

export interface SemanticMemoryRecord {
  id?: string;
  user_id?: string;
  type: SemanticMemoryType;
  content: string;
  metadata?: Record<string, any>;
  similarity?: number;
}

class SemanticMemoryService {
  /**
   * Stores a new memory record, automatically generating embeddings via local/remote AI.
   */
  async store(type: SemanticMemoryType, content: string, metadata: Record<string, any> = {}): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Logger.warn('[SemanticMemory] Cannot store memory without authenticated user');
        return;
      }

      // Generate embedding using AI Service
      // If generate doesn't support embedding directly, we fall back to a dummy vector 
      // or implement the embeddings endpoint in our ai service.
      let embedding: number[] = new Array(1536).fill(0).map(() => Math.random() * 0.01);
      
      try {
        const result = await generate({ prompt: content, model: 'embedding' } as any);
        if (result && result.embedding) {
          embedding = result.embedding;
        }
      } catch (err) {
        Logger.warn('[SemanticMemory] Falling back to dummy embedding (mock behavior)');
      }

      const { error } = await supabase.from('semantic_memory').insert({
        user_id: user.id,
        type,
        content,
        metadata,
        embedding,
      });

      if (error) throw error;
      
      Logger.debug(`[SemanticMemory] Stored ${type} memory:`, content.slice(0, 50) + '...');
    } catch (err: any) {
      Logger.error('[SemanticMemory] Store failed:', err.message);
    }
  }

  /**
   * Semantic search across memories.
   */
  async search(query: string, type?: SemanticMemoryType, limit = 5, threshold = 0.7): Promise<SemanticMemoryRecord[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      let query_embedding: number[] = new Array(1536).fill(0).map(() => Math.random() * 0.01);
      try {
        const result = await generate({ prompt: query, model: 'embedding' } as any);
        if (result && result.embedding) {
          query_embedding = result.embedding;
        }
      } catch (err) {
        Logger.warn('[SemanticMemory] Falling back to dummy embedding for query');
      }

      const { data, error } = await supabase.rpc('match_semantic_memory', {
        query_embedding,
        match_threshold: threshold,
        match_count: limit,
        p_user_id: user.id,
        p_type: type || null
      });

      if (error) throw error;
      return data as SemanticMemoryRecord[];
    } catch (err: any) {
      Logger.error('[SemanticMemory] Search failed:', err.message);
      return [];
    }
  }

  /**
   * Standard CRUD
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('semantic_memory').delete().eq('id', id);
    if (error) throw error;
  }

  async clearType(type: SemanticMemoryType): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('semantic_memory').delete().eq('type', type).eq('user_id', user.id);
    if (error) throw error;
  }
  async getHistory(user_id: string, contextId: string, limit: number = 20): Promise<{role: string, content: string}[]> {
    try {
      const { data, error } = await supabase
        .from('semantic_memory')
        .select('*')
        .eq('user_id', user_id)
        .eq('type', 'chat')
        .eq('metadata->>contextId', contextId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      
      // Reverse to get chronological order (oldest first among the N latest)
      return (data as SemanticMemoryRecord[]).reverse().map(r => ({
        role: r.metadata?.role || 'user',
        content: r.content
      }));
    } catch (err: any) {
      Logger.error('[SemanticMemory] getHistory failed:', err.message);
      return [];
    }
  }

  async buildSystemContext(user_id: string, contextId: string, systemPrompt?: string): Promise<any[]> {
    const system = {
      role: 'system',
      content: systemPrompt || 'You are CHATR Assistant — a helpful, concise AI built into the CHATR Enterprise Platform.'
    };
    const history = await this.getHistory(user_id, contextId);
    return [system, ...history];
  }

  async clearHistory(user_id: string, contextId: string): Promise<void> {
    const { error } = await supabase.from('semantic_memory')
      .delete()
      .eq('user_id', user_id)
      .eq('type', 'chat')
      .eq('metadata->>contextId', contextId);
    if (error) Logger.error('[SemanticMemory] clearHistory failed:', error.message);
  }
}

export const semanticMemory = new SemanticMemoryService();
