import { supabase } from '@/integrations/supabase/client';
import { KnowledgeKernelABI, KnowledgeEntry } from '../contracts/os/KnowledgeKernel.abi';

export class SupabaseKnowledgeAPI implements KnowledgeKernelABI {
  
  async queryFacts(entityId: string): Promise<KnowledgeEntry[]> {
    return this.queryKnowledgeType('fact', entityId);
  }

  async getHeuristics(capabilityId: string): Promise<KnowledgeEntry[]> {
    // In our model, a capability (like a Marketplace Package) is also a Reality Entity
    return this.queryKnowledgeType('heuristic', capabilityId);
  }

  async getPolicies(scopeEntityId: string): Promise<KnowledgeEntry[]> {
    return this.queryKnowledgeType('policy', scopeEntityId);
  }

  private async queryKnowledgeType(type: string, entityId: string): Promise<KnowledgeEntry[]> {
    const { data, error } = await supabase
      .from('knowledge_kernel')
      .select('*')
      .eq('knowledge_type', type)
      .contains('reality_entity_ids', [entityId])
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch ${type} knowledge for entity ${entityId}: ${error.message}`);
    }

    return (data || []).map(this.mapToKnowledgeEntry);
  }

  private mapToKnowledgeEntry(row: any): KnowledgeEntry {
    return {
      id: row.id,
      type: row.knowledge_type as any,
      content: row.content,
      context: {
        realityEntityIds: row.reality_entity_ids,
        timeframe: {
          start: row.timeframe_start,
          end: row.timeframe_end
        }
      },
      provenance: {
        sourceEventId: row.provenance_event_id,
        confidence: row.confidence
      },
      createdAt: row.created_at
    };
  }
}
