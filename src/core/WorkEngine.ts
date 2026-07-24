import { BusinessObject, BusinessObjectDefinition } from '../types/workEngine';
import { supabase } from '@/integrations/supabase/client';

export class WorkEngine {
  private objectDefinitions: Map<string, BusinessObjectDefinition> = new Map();
  private localStoreKey = 'work_engine_objects';

  constructor() {
    console.log("WorkEngine initialized.");
  }

  // --- Definitions ---
  
  public registerDefinition(definition: BusinessObjectDefinition): void {
    this.objectDefinitions.set(definition.id, definition);
  }

  public getDefinition(definitionId: string): BusinessObjectDefinition | undefined {
    return this.objectDefinitions.get(definitionId);
  }

  // --- CRUD for Business Objects ---

  private getLocalObjects(): BusinessObject[] {
    try {
      const data = localStorage.getItem(this.localStoreKey);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  private saveLocalObjects(objects: BusinessObject[]) {
    localStorage.setItem(this.localStoreKey, JSON.stringify(objects));
  }

  public async createObject(definitionId: string, data: Partial<BusinessObject>): Promise<BusinessObject> {
    const definition = this.getDefinition(definitionId);
    if (!definition) throw new Error(`Definition ${definitionId} not found`);

    const newObject: any = {
      id: `REQ-${Math.floor(Math.random() * 9000) + 1000}`,
      workspace_id: data.workspace_id || 'default-workspace',
      definition_id: definitionId,
      owner_id: data.owner_id || 'system',
      created_at: new Date(),
      updated_at: new Date(),
      metadata: data.metadata || {},
      status: 'Pending Approval', // Default state
      ...data // spreads dynamic_data for subclasses like WorkItem
    };

    // Try Supabase first
    try {
      const { error } = await supabase.from('work_items').insert(newObject);
      if (error && error.code !== 'PGRST116') console.warn('Supabase insert issue:', error);
    } catch (e) {}

    // Always save locally for bulletproof demo experience
    const local = this.getLocalObjects();
    this.saveLocalObjects([newObject, ...local]);
    
    // Add creation history
    await this.addHistory(newObject.id, data.author || 'system', 'CREATION', { text: `Created ${newObject.title}` });

    return newObject;
  }

  public async getObject(objectId: string): Promise<BusinessObject | undefined> {
    return this.getLocalObjects().find(o => o.id === objectId);
  }

  public async getObjects(typeFilter?: string): Promise<any[]> {
    let local = this.getLocalObjects();
    
    // Seed initial data if completely empty
    if (local.length === 0) {
      local = [
        { id: 'REQ-1042', definition_id: 'def_it_support', title: 'VPN not connecting', status: 'In Progress', priority: 'High', date: '10 mins ago', author: 'Arshid Wani' },
        { id: 'EXP-892', definition_id: 'def_expense_report', title: 'Q3 Team Offsite', status: 'Pending Approval', priority: 'Medium', date: '2 hours ago', author: 'Sarah Jenkins' },
        { id: 'HR-402', definition_id: 'def_leave_request', title: 'Annual Vacation', status: 'Draft', priority: 'Low', date: '1 day ago', author: 'Arshid Wani' }
      ];
      this.saveLocalObjects(local as any);
    }

    if (typeFilter) {
      if (typeFilter === 'leave') return local.filter(o => o.definition_id === 'def_leave_request');
      if (typeFilter === 'expenses') return local.filter(o => o.definition_id === 'def_expense_report');
      if (typeFilter === 'it') return local.filter(o => o.definition_id === 'def_it_support');
    }
    
    return local;
  }

  public async updateObject(objectId: string, updates: Partial<BusinessObject>): Promise<BusinessObject> {
    const local = this.getLocalObjects();
    const idx = local.findIndex(o => o.id === objectId);
    if (idx === -1) throw new Error(`Object ${objectId} not found`);

    const updated = {
      ...local[idx],
      ...updates,
      updated_at: new Date()
    };
    
    local[idx] = updated;
    this.saveLocalObjects(local);

    // Try Supabase sync
    try {
      await supabase.from('work_items').update(updates).eq('id', objectId);
    } catch (e) {}

    return updated;
  }

  // --- History Engine ---
  private historyStoreKey = 'work_engine_history';

  private getLocalHistory(): any[] {
    try {
      const data = localStorage.getItem(this.historyStoreKey);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  public async addHistory(objectId: string, actorId: string, action: string, details: any): Promise<void> {
    const history = this.getLocalHistory();
    const newEntry = {
      id: crypto.randomUUID(),
      work_item_id: objectId,
      actor_id: actorId,
      action: action,
      details: details,
      created_at: new Date().toISOString()
    };
    
    localStorage.setItem(this.historyStoreKey, JSON.stringify([newEntry, ...history]));

    try {
      await supabase.from('work_item_history').insert(newEntry);
    } catch(e) {}
  }

  public async getHistory(objectId: string): Promise<any[]> {
    const history = this.getLocalHistory().filter(h => h.work_item_id === objectId);
    return history;
  }
}

export const workEngine = new WorkEngine();
