import { supabase } from '@/integrations/supabase/client';
import { RealityEntity, RealityRelationship, RealityGraphABI } from '../contracts/os/RealityGraph.abi';

export class SupabaseRealityAPI implements RealityGraphABI {
  
  async getEntity(id: string): Promise<RealityEntity | null> {
    const { data, error } = await supabase
      .from('reality_entities')
      .select('*')
      .eq('id', id)
      .eq('effective_to', '9999-12-31 23:59:59+00')
      .single();

    if (error || !data) {
      if (error?.code === 'PGRST116') return null; // No rows found
      throw new Error(`Failed to get entity ${id}: ${error?.message}`);
    }

    return this.mapToEntity(data);
  }

  async getRelationships(entityId: string, direction: 'in' | 'out' | 'both' = 'out'): Promise<RealityRelationship[]> {
    let q = supabase
      .from('reality_relationships')
      .select('*')
      .eq('effective_to', '9999-12-31 23:59:59+00');

    if (direction === 'out') {
      q = q.eq('source_entity_id', entityId);
    } else if (direction === 'in') {
      q = q.eq('target_entity_id', entityId);
    } else {
      q = q.or(`source_entity_id.eq.${entityId},target_entity_id.eq.${entityId}`);
    }

    const { data, error } = await q;

    if (error) {
      throw new Error(`Failed to fetch relationships for ${entityId}: ${error.message}`);
    }

    return (data || []).map(this.mapToRelationship);
  }

  async query(cypherOrGraphQL: string): Promise<any> {
    // Phase F: The underlying storage shouldn't leak to the caller.
    // For now, this is a placeholder where a custom parser would translate 
    // a generalized OS query language into the underlying Supabase syntax,
    // or call an RPC function if we needed deep graph traversal in Postgres.
    throw new Error('OS generalized query language compiler not yet implemented for Supabase.');
  }
  
  // --- Helpers ---
  
  private mapToEntity(row: any): RealityEntity {
    return {
      id: row.id,
      type: row.entity_type as any,
      attributes: row.attributes,
      provenance: {
        sourceEventId: row.provenance_event_id,
        authoritativeSource: row.attributes._source || 'os_projection',
        confidence: row.attributes._confidence || 1.0,
        lastVerifiedAt: row.attributes._last_verified || row.effective_from
      },
      createdAt: row.effective_from,
      updatedAt: row.effective_from // In a temporal model, the creation of THIS version is its update time
    };
  }
  
  private mapToRelationship(row: any): RealityRelationship {
    return {
      id: row.id,
      sourceEntityId: row.source_entity_id,
      targetEntityId: row.target_entity_id,
      relationType: row.relation_type,
      attributes: row.attributes,
      provenance: {
        sourceEventId: row.provenance_event_id,
        confidence: row.attributes._confidence || 1.0
      }
    };
  }
}
