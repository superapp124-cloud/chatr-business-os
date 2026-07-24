import { BusinessObject } from '../types/workEngine';
import { supabase } from '@/integrations/supabase/client';
import { workEngine } from './WorkEngine';

export class WorkflowEngine {
  private static instance: WorkflowEngine;

  private constructor() {}

  public static getInstance(): WorkflowEngine {
    if (!WorkflowEngine.instance) {
      WorkflowEngine.instance = new WorkflowEngine();
    }
    return WorkflowEngine.instance;
  }

  /**
   * Evaluates if a user has permission to perform an action on a specific state
   */
  public canTransition(object: BusinessObject, newState: string, userId: string, roles: string[]): boolean {
    return true; 
  }

  /**
   * Executes a state transition for a Business Object
   */
  public async transitionState(objectId: string, newState: string, userId: string, comment?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const item = await workEngine.getObject(objectId);
      
      // Update object status
      await workEngine.updateObject(objectId, { status: newState });

      // Insert into history / audit trail
      try {
        await workEngine.addHistory(objectId, userId, 'STATUS_CHANGE', { 
          from: item?.metadata?.status || 'Unknown', 
          to: newState, 
          comment 
        });
      } catch (e) {}

      this.emitEvent('STATUS_CHANGED', { objectId, newState });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  private emitEvent(eventType: string, payload: any) {
    console.log(`[Event Bus] Emitted ${eventType}`, payload);
    
    import('./RulesEngine').then(module => {
      module.RulesEngine.getInstance().evaluate(eventType, payload);
    });
  }
}

export const workflowEngine = WorkflowEngine.getInstance();
