import { supabase } from '@/integrations/supabase/client';
import { ExecutionKernel } from '@/kernel/ExecutionKernel';

export type MemoryTier = 'personal' | 'conversation' | 'business' | 'knowledge';

export class RAGService {
  /**
   * Universal embedding generator via the ExecutionKernel
   */
  static async generateEmbedding(text: string, context: any): Promise<number[]> {
    // Uses the kernel to route to the appropriate capability (e.g. Ollama nomic-embed-text)
    const result = await ExecutionKernel.execute({
      capabilityType: 'Embeddings',
      payload: { text }
    }, context);
    
    return result.embedding;
  }

  /**
   * Queries one of the 4 Memory Tiers.
   */
  static async searchMemory(
    tier: MemoryTier, 
    queryText: string, 
    limit: number = 5, 
    context: any
  ) {
    const embedding = await this.generateEmbedding(queryText, context);
    
    const tableName = `ai_memory_${tier}`;
    
    // Assumes an RPC function setup in Supabase to handle vector distance:
    // match_memory(table_name, query_embedding, match_threshold, match_count)
    const { data, error } = await supabase.rpc('match_memory_tier', {
      tier_name: tier,
      query_embedding: embedding,
      match_threshold: 0.7,
      match_count: limit,
      org_id: context.organizationId,
      user_id: context.userId // only relevant for personal
    });

    if (error) {
      console.error(`RAG search failed for tier ${tier}`, error);
      return [];
    }

    return data;
  }
}
