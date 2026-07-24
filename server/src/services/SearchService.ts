import { EventBus } from './EventBusService.js';
import { ObjectRegistry } from '../kernel/ObjectRegistry.js';
import { ISystemEvent } from '../types.js';

class SystemSearchRuntime {
  constructor() {
    // Only listen to terminal state events that represent finalized data
    EventBus.subscribe('WorkObjectCreated', this.handleIndexing.bind(this));
    EventBus.subscribe('WorkObjectUpdated', this.handleIndexing.bind(this));
  }

  private async handleIndexing(event: ISystemEvent) {
    const obj = event.payload.object;
    if (!obj || !obj.type) return;

    console.log(`[SearchRuntime] Intercepted Event. Indexing UWO type: ${obj.type}, ID: ${obj.id}`);
    
    // 1. Fetch Definition from Registry
    const def = ObjectRegistry.get(obj.type);
    if (!def) {
      console.warn(`[SearchRuntime] Unregistered object type ${obj.type} cannot be indexed.`);
      return;
    }

    // 2. Extract Searchable Fields
    const indexData: Record<string, any> = {};
    for (const field of def.searchableFields) {
      // Check base fields first, then metadata
      if (obj[field] !== undefined) indexData[field] = obj[field];
      else if (obj.metadata && obj.metadata[field] !== undefined) indexData[field] = obj.metadata[field];
    }

    // 3. Mock push to ElasticSearch / Typesense / Supabase Vector
    console.log(`[SearchRuntime] Pushing to Knowledge Graph / Vector DB:`, {
      id: obj.id,
      tenantId: obj.tenantId,
      departmentId: obj.departmentId,
      ...indexData
    });
    
    // In reality, this would be an API call to a search cluster.
    // We simulate a successful index operation here.
  }
}

export const SearchRuntime = new SystemSearchRuntime();
