import { OSEvent } from '../contracts/os/EventLog.abi';
import { supabase } from '@/integrations/supabase/client';
import { createHash } from 'crypto';

export class RealityProjector {
  /**
   * Processes a stream of OS events deterministically.
   * NO external APIs, clocks, or randomness are allowed in this function.
   * If run 1,000 times with the same events, it MUST produce the exact same Reality Graph.
   */
  async project(events: OSEvent[]): Promise<void> {
    for (const event of events) {
      switch (event.type) {
        case 'reality.entity_created':
          await this.handleEntityCreated(event);
          break;
        case 'reality.entity_updated':
          await this.handleEntityUpdated(event);
          break;
        case 'reality.relationship_created':
          await this.handleRelationshipCreated(event);
          break;
        default:
          // Ignore events that don't mutate reality projections (e.g. observer metrics)
          break;
      }
    }
  }

  private async handleEntityCreated(event: OSEvent) {
    const entity = event.payload;
    const { error } = await supabase.from('reality_entities').insert({
      id: entity.id,
      entity_type: entity.type,
      attributes: entity.attributes,
      provenance_event_id: event.id,
      effective_from: event.metadata.timestamp,
      effective_to: '9999-12-31T23:59:59Z'
    });

    if (error) {
      console.error(`[RealityProjector] Failed to project entity_created ${entity.id}:`, error);
    }
  }

  private async handleEntityUpdated(event: OSEvent) {
    const entity = event.payload;
    // Soft delete the previous version by closing its temporal window
    await supabase.from('reality_entities')
      .update({ effective_to: event.metadata.timestamp })
      .eq('id', entity.id)
      .eq('effective_to', '9999-12-31T23:59:59Z');

    // Insert the new version
    await supabase.from('reality_entities').insert({
      id: entity.id,
      entity_type: entity.type,
      attributes: entity.attributes,
      provenance_event_id: event.id,
      effective_from: event.metadata.timestamp,
      effective_to: '9999-12-31T23:59:59Z'
    });
  }

  private async handleRelationshipCreated(event: OSEvent) {
    const rel = event.payload;
    await supabase.from('reality_relationships').insert({
      id: rel.id,
      source_entity_id: rel.sourceEntityId,
      target_entity_id: rel.targetEntityId,
      relation_type: rel.relationType,
      attributes: rel.attributes,
      provenance_event_id: event.id,
      effective_from: event.metadata.timestamp,
      effective_to: '9999-12-31T23:59:59Z'
    });
  }

  /**
   * Generates a deterministic SHA-256 checksum of the current active Reality Graph projection.
   * This is used to prove projection consistency after a replay.
   */
  async computeChecksum(): Promise<string> {
    const { data } = await supabase.from('reality_entities')
      .select('id, entity_type, attributes, provenance_event_id, effective_from')
      .eq('effective_to', '9999-12-31T23:59:59Z')
      .order('id');
      
    const hash = createHash('sha256');
    hash.update(JSON.stringify(data || []));
    return hash.digest('hex');
  }
}
