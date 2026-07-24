import { randomUUID } from '../utils/id';
import type { KernelEvent, EventDraft, EventId } from '../abi/v1';

export type EventSubscriptionHandler = (event: KernelEvent) => void | Promise<void>;

export class IntelligenceBus {
  // In-process Dispatcher
  private handlers = new Map<string, Set<EventSubscriptionHandler>>();
  
  // Event Store (In-Memory for now, can be swapped for persistent store)
  private eventStore: KernelEvent[] = [];

  /**
   * Publish an event to the bus.
   * Injects metadata (id, timestamp, schemaVersion) automatically.
   */
  public async publish(draft: EventDraft): Promise<EventId> {
    const id = `ev_${randomUUID()}` as EventId;
    
    const event: KernelEvent = {
      ...draft,
      id,
      timestamp: Date.now(),
      schemaVersion: '1.0.0',
    };

    // 1. Append Log (Event Store)
    this.eventStore.push(event);

    // 2. Notify Subscribers (Non-blocking, scatter-gather)
    this.dispatch(event).catch(err => {
      console.error(`[IntelligenceBus] Dispatch error for ${event.type}:`, err);
    });

    return id;
  }

  /**
   * Subscribe to events by pattern.
   * Supports wildcards (e.g. 'workflow.*')
   */
  public subscribe(pattern: string, handler: EventSubscriptionHandler): () => void {
    if (!this.handlers.has(pattern)) {
      this.handlers.set(pattern, new Set());
    }
    this.handlers.get(pattern)!.add(handler);

    return () => {
      this.handlers.get(pattern)?.delete(handler);
    };
  }

  /**
   * Replay past events.
   * Useful for deterministic testing, UI rebuilds, or time-travel debugging.
   */
  public async replay(options?: { fromTimestamp?: number; toTimestamp?: number; typePrefix?: string }): Promise<void> {
    let events = this.eventStore;

    if (options) {
      if (options.fromTimestamp) {
        events = events.filter(e => e.timestamp >= options.fromTimestamp!);
      }
      if (options.toTimestamp) {
        events = events.filter(e => e.timestamp <= options.toTimestamp!);
      }
      if (options.typePrefix) {
        events = events.filter(e => e.type.startsWith(options.typePrefix!));
      }
    }

    for (const event of events) {
      await this.dispatch(event);
    }
  }

  // ─── Internal Dispatcher ──────────────────────────────────────────────────

  private async dispatch(event: KernelEvent): Promise<void> {
    const tasks: Promise<void>[] = [];

    // Exact match handlers
    if (this.handlers.has(event.type)) {
      for (const handler of this.handlers.get(event.type)!) {
        tasks.push(this.invokeHandler(handler, event));
      }
    }

    // Wildcard prefix handlers (e.g., 'intent.*')
    const parts = event.type.split('.');
    if (parts.length > 1) {
      const prefix = `${parts[0]}.*`;
      if (this.handlers.has(prefix)) {
        for (const handler of this.handlers.get(prefix)!) {
          tasks.push(this.invokeHandler(handler, event));
        }
      }
    }

    // Global wildcard catch-all
    if (this.handlers.has('*')) {
      for (const handler of this.handlers.get('*')!) {
        tasks.push(this.invokeHandler(handler, event));
      }
    }

    await Promise.allSettled(tasks);
  }

  private async invokeHandler(handler: EventSubscriptionHandler, event: KernelEvent): Promise<void> {
    try {
      await handler(event);
    } catch (err) {
      console.error(`[IntelligenceBus] Handler failed for event ${event.type}:`, err);
    }
  }
}
