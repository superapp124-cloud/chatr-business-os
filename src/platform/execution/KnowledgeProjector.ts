import { OSEvent } from '../contracts/os/EventLog.abi';
import { supabase } from '@/integrations/supabase/client';
import { createHash } from 'crypto';

export class KnowledgeProjector {
  /**
   * Deterministically projects OS events into organizational Knowledge.
   */
  async project(events: OSEvent[]): Promise<void> {
    for (const event of events) {
      if (event.type.startsWith('knowledge.')) {
        await this.handleKnowledgeEvent(event);
      }
    }
  }

  private async handleKnowledgeEvent(event: OSEvent) {
    // knowledge.fact_discovered, knowledge.heuristic_learned, etc.
    const typeParts = event.type.split('.');
    const knowledgeType = typeParts[1].split('_')[0]; // extracts 'fact' from 'fact_discovered'
    
    if (!['fact', 'experience', 'heuristic', 'prediction', 'explanation', 'policy'].includes(knowledgeType)) {
      return; // Invalid type, ignore
    }

    const payload = event.payload;

    const { error } = await supabase.from('knowledge_kernel').insert({
      id: payload.id, // Deterministic ID generated upstream based on event hash, or randomly if non-deterministic source
      knowledge_type: knowledgeType,
      content: payload.content,
      reality_entity_ids: payload.context?.realityEntityIds || [],
      timeframe_start: payload.context?.timeframe?.start,
      timeframe_end: payload.context?.timeframe?.end,
      provenance_event_id: event.id,
      confidence: event.metadata.confidence || 1.0,
      created_at: event.metadata.timestamp
    });

    if (error) {
      console.error(`[KnowledgeProjector] Failed to project ${event.type}:`, error);
    }
  }

  /**
   * Generates a deterministic SHA-256 checksum of the current Knowledge Kernel projection.
   */
  async computeChecksum(): Promise<string> {
    const { data } = await supabase.from('knowledge_kernel')
      .select('id, knowledge_type, content, provenance_event_id')
      .order('id');
      
    const hash = createHash('sha256');
    hash.update(JSON.stringify(data || []));
    return hash.digest('hex');
  }
}
