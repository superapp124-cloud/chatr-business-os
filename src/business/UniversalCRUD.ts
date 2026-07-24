import { MetadataEngine } from './MetadataEngine';
import { supabase } from '@/integrations/supabase/client';
import { EventBus } from '@/kernel/EventBus';
import { SyncEngine } from '@/runtime/SyncEngine';

export class UniversalCRUD {
  /**
   * Universal Create, Read, Update, Delete powered by Metadata.
   * Eliminates the need for module-specific CRUD logic.
   */

  static async create(entityName: string, payload: any, context: any) {
    const entity = MetadataEngine.getEntityDef(entityName);
    if (!entity) throw new Error(`Entity ${entityName} not found in Metadata Graph`);

    // Optionally validate payload against sys_attributes here...

    if (context.isOffline) {
       return SyncEngine.queueOperation('INSERT', entity.table_name, payload);
    }

    const { data, error } = await supabase
      .from(entity.table_name)
      .insert({ ...payload, organization_id: context.organizationId })
      .select()
      .single();

    if (error) throw error;

    EventBus.publish('Data.Created', { entity: entityName, data }, context, data.id, entityName);
    return data;
  }

  static async read(entityName: string, query: any, context: any) {
    const entity = MetadataEngine.getEntityDef(entityName);
    if (!entity) throw new Error(`Entity ${entityName} not found`);

    let request = supabase.from(entity.table_name).select('*');
    // Apply filters based on query json...
    
    const { data, error } = await request;
    if (error) throw error;
    return data;
  }

  static async update(entityName: string, id: string, payload: any, context: any, expectedVersion: number) {
    const entity = MetadataEngine.getEntityDef(entityName);
    if (!entity) throw new Error(`Entity ${entityName} not found`);

    if (context.isOffline) {
       return SyncEngine.queueOperation('UPDATE', entity.table_name, { id, ...payload }, expectedVersion);
    }

    // Versioned update for concurrency control
    const { data, error } = await supabase
      .from(entity.table_name)
      .update(payload)
      .eq('id', id)
      .eq('version', expectedVersion) // Optimistic concurrency control
      .select()
      .single();

    if (error) throw error;
    
    EventBus.publish('Data.Updated', { entity: entityName, data }, context, id, entityName);
    return data;
  }
}
