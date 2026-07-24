import { eventBus } from './EventBus';
import { CHATREvent, EventPriority } from './types';

/**
 * Stage 1.4: TraceContext
 * 
 * Provides a context-bound proxy to the EventBus.
 * Instead of relying on global/async storage (which is fragile in the browser event loop),
 * we explicitly pass a `TraceContext` down the call stack from Intent -> Planner -> Provider.
 * 
 * Any event published through this context automatically inherits the correlationId and traceId.
 */
export class TraceContext {
  constructor(
    public readonly traceId: string,
    public readonly correlationId: string,
    public readonly workflowId?: string
  ) {}

  /**
   * Factory to start a new root trace (e.g., from a user Intent)
   */
  static start(intentId: string, workflowId?: string): TraceContext {
    return new TraceContext(
      crypto.randomUUID(), // New trace ID for this execution tree
      intentId,            // The originating intent acts as the correlation root
      workflowId
    );
  }

  /**
   * Factory to branch a trace (e.g., Capability -> Provider)
   */
  branch(causationId: string): TraceContext {
    // correlationId stays the same, causationId points to the immediate parent
    return new TraceContext(this.traceId, this.correlationId, this.workflowId);
  }

  /**
   * Publishes an event bound to this trace context.
   */
  publish<T = unknown>(
    type: string, 
    payload: T, 
    opts?: {
      priority?: EventPriority;
      source?: string;
      persist?: boolean;
    }
  ): CHATREvent<T> {
    return eventBus.publish(type, payload, {
      ...opts,
      traceId: this.traceId,
      correlationId: this.correlationId,
      workflowId: this.workflowId
    });
  }
}
