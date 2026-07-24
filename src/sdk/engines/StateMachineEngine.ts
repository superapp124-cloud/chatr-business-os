/**
 * CHATR OS — Kernel State Machine Runtime
 * Evaluates state transitions, enforces validity, and runs entry/exit actions.
 */

import { IStateMachine } from '../types';
import { BusinessObjectStore } from './BusinessObjectStore';

export const StateMachineEngine = {
  /**
   * Evaluates if a transition is valid according to the State Machine.
   * Returns an error message if invalid, or null if valid.
   */
  validateTransition(
    machine: IStateMachine, 
    currentState: string, 
    newState: string, 
    record: Record<string, any>
  ): string | null {
    // If no machine or state isn't changing, it's valid
    if (!machine || currentState === newState) return null;

    const stateDef = machine.states[currentState];
    if (!stateDef) {
      return `Current state '${currentState}' is not defined in the State Machine for ${machine.objectId}.`;
    }

    // Check if transition is explicitly allowed
    // Note: Some state machines might use wildcard '*' or if it's missing, block it.
    // For our strict ABI, we look up the transition:
    
    // To support { 'Approve': 'Offer' } format, we need to find if any transition leads to newState
    // Alternatively, if the keys are events and values are target states:
    const targetStates = Object.values(stateDef.transitions);
    if (!targetStates.includes(newState)) {
      return `Transition from '${currentState}' to '${newState}' is illegal.`;
    }

    // (Future) Run custom validators here (e.g. check if required fields are filled before moving to 'Offer')

    return null;
  },

  /**
   * Gets the State Machine for a specific capability and object.
   */
  getMachine(capabilityId: string, objectId: string): IStateMachine | undefined {
    // We need to fetch the SDK manifest from the global registry
    // In a real isolated kernel, this would query the CapabilityRuntime
    const sdk = (window as any).__CHATR_SDK_REGISTRY__?.[capabilityId];
    if (!sdk || !sdk.stateMachines) return undefined;
    
    return sdk.stateMachines.find((sm: IStateMachine) => sm.objectId === objectId);
  },

  /**
   * Called immediately after a successful state transition
   */
  onTransitionCompleted(
    capabilityId: string,
    objectId: string,
    recordId: string,
    oldState: string,
    newState: string
  ) {
    const machine = this.getMachine(capabilityId, objectId);
    if (!machine) return;

    const oldStateDef = machine.states[oldState];
    const newStateDef = machine.states[newState];

    console.log(`[StateMachineRuntime] ${objectId} [${recordId}] transitioned: ${oldState} -> ${newState}`);

    // Execute Exit Actions
    if (oldStateDef?.exitActions) {
      oldStateDef.exitActions.forEach(action => {
        console.log(`[StateMachineRuntime] Executing EXIT action: ${action}`);
        // Dispatch to EventBus/WorkflowEngine in the future
      });
    }

    // Execute Entry Actions
    if (newStateDef?.entryActions) {
      newStateDef.entryActions.forEach(action => {
        console.log(`[StateMachineRuntime] Executing ENTRY action: ${action}`);
        // Dispatch to EventBus/WorkflowEngine in the future
      });
    }
  }
};
