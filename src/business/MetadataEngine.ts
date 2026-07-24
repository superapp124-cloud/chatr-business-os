import { supabase } from '@/integrations/supabase/client';

/**
 * Cache for all metadata. In a true OS, this is loaded into memory on startup
 * or module activation.
 */
class MetadataEngineService {
  private cache: Map<string, any> = new Map();

  async loadGraph(organizationId: string) {
    console.log(`Loading metadata graph for Org: ${organizationId}`);
    
    // Load Modules
    const { data: modules } = await supabase.from('sys_modules').select('*').eq('organization_id', organizationId);
    if (modules) this.cache.set('modules', modules);

    // Load Entities
    if (modules && modules.length > 0) {
      const moduleIds = modules.map(m => m.id);
      const { data: entities } = await supabase.from('sys_entities').select('*').in('module_id', moduleIds);
      if (entities) {
        this.cache.set('entities', entities);
        
        // Load Views for these entities (This is the JSON view layout the user mentioned)
        const entityIds = entities.map(e => e.id);
        const { data: views } = await supabase.from('sys_views').select('*').in('entity_id', entityIds);
        if (views) this.cache.set('views', views);
      }
    }
  }

  getViewDef(entityName: string, viewType: string) {
    const entities = this.cache.get('entities') || [];
    const entity = entities.find((e: any) => e.name === entityName);
    if (!entity) return null;

    const views = this.cache.get('views') || [];
    return views.find((v: any) => v.entity_id === entity.id && v.type === viewType);
  }

  getEntityDef(entityName: string) {
    const entities = this.cache.get('entities') || [];
    return entities.find((e: any) => e.name === entityName);
  }
}

export const MetadataEngine = new MetadataEngineService();
