import { EventBus } from './EventBus';
import { supabase } from '@/integrations/supabase/client'; // Assuming standard location

export interface StateTransition {
  fromState: string;
  toState: string;
  allowedRoles?: string[];
  conditions?: any; // e.g. JSONLogic
}

export class StateManager {
  /**
   * Retrieves the valid transitions for a specific entity's state machine.
   */
  static async getTransitions(entityId: string): Promise<StateTransition[]> {
    const { data, error } = await supabase
      .from('sys_entities')
      .select('state_machine_json')
      .eq('id', entityId)
      .single();

    if (error || !data?.state_machine_json) {
      return [];
    }

    return (data.state_machine_json as any).transitions || [];
  }

  /**
   * Attempts to transition a record to a new state deterministically.
   * Prevents invalid state jumps (e.g. Draft -> Paid without Approved).
   */
  static async transitionState(
    entityId: string, 
    recordId: string, 
    currentState: string, 
    targetState: string, 
    context: any
  ): Promise<boolean> {
    
    const transitions = await this.getTransitions(entityId);
    
    // Find valid transition
    const validTransition = transitions.find(
      t => t.fromState === currentState && t.toState === targetState
    );

    if (!validTransition) {
      throw new Error(`Invalid state transition from ${currentState} to ${targetState}`);
    }

    // Check Role constraints
    if (validTransition.allowedRoles && validTransition.allowedRoles.length > 0) {
      if (!validTransition.allowedRoles.includes(context.role)) {
        throw new Error(`Role ${context.role} is not authorized to transition to ${targetState}`);
      }
    }

    // Check conditions (pseudo-code for evaluating conditions)
    // if (validTransition.conditions && !evaluateConditions(validTransition.conditions, context)) {
    //   throw new Error("Conditions for transition not met");
    // }

    // Emit event before transition
    EventBus.publish('State.Transitioning', { entityId, recordId, currentState, targetState }, context);

    // In a real implementation, this would perform the update on the business table
    // await UniversalCRUD.update(...)

    // Emit event after transition
    EventBus.publish('State.Transitioned', { entityId, recordId, previousState: currentState, newState: targetState }, context, recordId, 'Record');

    return true;
  }
}
