import { EventStore, KernelEvent } from '../storage/EventStore';
import { EDLLivingObject } from '../contracts/edl/types';

/**
 * A requested change to an aggregate's state.
 */
export interface Command {
  commandId?: string;  // Idempotency key
  aggregateType: string;
  aggregateId: string;
  action: string;      // e.g., 'Create', 'Assign', 'Transition'
  payload: any;
  expectedVersion?: number; // Optimistic locking
  correlationId?: string;
}

export interface IPolicyEngine {
  evaluate(command: Command, currentState: any, edl: EDLLivingObject, actorId: string): Promise<boolean>;
}

/**
 * The Object Runtime
 * 
 * The execution coordinator. It never owns persistence. 
 * It strictly enforces the pipeline: Command → Validation → Policy → Event → EventStore.
 */
import { CapabilityRegistry } from '../registry/CapabilityRegistry';

export class ObjectRuntime {
  constructor(
    private eventStore: EventStore,
    private registry: CapabilityRegistry,
    private policyEngine?: IPolicyEngine // Optional for Milestone 3, fully integrated later
  ) {}

  /**
   * Executes a command against the Kernel.
   * Resolves the required EDL from the CapabilityRegistry.
   */
  async executeCommand(
    command: Command, 
    actorId: string, 
    tenantId: string
  ): Promise<KernelEvent> {
    
    // 0. Resolve Capability Metadata
    const edl = this.registry.getAggregate(command.aggregateType);

    // 1. Load History from Event Store
    const history = await this.eventStore.loadAggregate(command.aggregateType, command.aggregateId);
    
    // Concurrency Check (Optimistic Locking)
    if (command.expectedVersion !== undefined && command.expectedVersion !== history.length) {
      const err = new Error(`ConcurrencyError: Expected version ${command.expectedVersion}, but found ${history.length}`);
      err.name = 'ConcurrencyError';
      throw err;
    }
    
    const expectedVersion = history.length;
    
    // 2. Rebuild Current State (In-Memory Aggregate Reducer)
    let currentState: any = {};
    let currentLifecycleState = edl.lifecycle?.initialState;
    
    for (const event of history) {
      // Idempotency Check
      if (command.commandId && event.commandId === command.commandId) {
        return event; // Deduplication: return original event without appending
      }
      
      currentState = { ...currentState, ...event.payload };
      if (event.payload._lifecycleState) {
        currentLifecycleState = event.payload._lifecycleState;
      }
    }

    // 3. Validation (Schema & Lifecycle constraints based on EDL)
    this.validateCommand(edl, command, expectedVersion, currentLifecycleState);

    // 4. Policy Check
    if (this.policyEngine) {
      const allowed = await this.policyEngine.evaluate(command, currentState, edl, actorId);
      if (!allowed) {
        throw new Error(`Policy violation: Actor ${actorId} is not permitted to execute ${command.action} on ${command.aggregateId}`);
      }
    }

    // 5. Create Event
    const eventType = this.mapCommandToEvent(command.aggregateType, command.action);
    const streamId = `urn:chatr:object:${command.aggregateType.toLowerCase()}:${command.aggregateId}`;
    
    // Polyfill crypto for node/browser compatibility in this simplified example
    const eventId = typeof crypto !== 'undefined' ? crypto.randomUUID() : Math.random().toString(36).substring(2);

    const newEvent: Omit<KernelEvent, 'globalSequence' | 'expectedVersion' | 'streamId'> = {
      eventId,
      aggregateType: command.aggregateType,
      aggregateId: command.aggregateId,
      commandId: command.commandId,
      eventType: eventType as any,
      timestamp: new Date(),
      actorId,
      tenantId,
      correlationId: command.correlationId,
      payload: command.payload,
      metadata: {
        source: 'ObjectRuntime',
        edlVersion: '0.1'
      }
    };

    // 6. Append to Event Store (Optimistic Concurrency Enforced Here)
    const appendedEvent = await this.eventStore.append(streamId, expectedVersion, newEvent);

    // Note: Projections, Query Engine, and Evidence Builder are automatically 
    // updated downstream via EventStore.subscribe(). The ObjectRuntime does not 
    // synchronously mutate them.

    return appendedEvent;
  }

  /**
   * Basic EDL Validation
   */
  private validateCommand(
    edl: EDLLivingObject, 
    command: Command, 
    expectedVersion: number,
    currentLifecycleState?: string
  ) {
    if (command.action === 'Create' && expectedVersion > 0) {
      throw new Error(`Aggregate ${command.aggregateId} already exists.`);
    }

    if (command.action !== 'Create' && expectedVersion === 0) {
      throw new Error(`Aggregate ${command.aggregateId} does not exist.`);
    }

    // If it's a lifecycle transition command, validate against EDL transitions
    if (command.action === 'Transition' && command.payload.targetState) {
      const targetState = command.payload.targetState;
      const validTransition = edl.lifecycle.transitions.find(
        t => t.to === targetState && t.from.includes(currentLifecycleState || '')
      );
      if (!validTransition) {
        throw new Error(`Invalid lifecycle transition from ${currentLifecycleState} to ${targetState}`);
      }
    }
  }

  /**
   * Maps an imperative command action to a past-tense domain event.
   */
  private mapCommandToEvent(aggregateType: string, action: string): string {
    if (action === 'Create') return `${aggregateType}Created`;
    if (action === 'Update') return `${aggregateType}Updated`;
    if (action === 'Transition') return `${aggregateType}Transitioned`;
    if (action === 'Archive') return `${aggregateType}Archived`;
    
    // Custom domain actions like 'Assign', 'Repair'
    if (action.endsWith('e')) return `${aggregateType}${action}d`;
    return `${aggregateType}${action}ed`;
  }
}
