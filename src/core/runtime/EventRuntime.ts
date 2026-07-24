import { eventSchemaRegistry } from './EventSchemaRegistry';
import { CHATREvent, EventPriority } from './types';

// ─── Envelopes & Types ────────────────────────────────────────────────────────

export type EventHandler<T = any> = (event: CHATREvent<T>) => void | Promise<void>;

export interface SubscriptionOpts {
  priority?: EventPriority;
  once?: boolean;
  timeoutMs?: number; // Execution timeout for isolation
  name?: string;      // Subscriber name for DLQ tracking
}

export interface Subscription {
  id: string;
  handler: EventHandler<unknown>;
  priority: EventPriority;
  once: boolean;
  timeoutMs: number;
  name: string;
}

export interface DeadLetterEntry {
  event: CHATREvent;
  subscriberName: string;
  failureReason: string;
  retryCount: number;
  firstFailure: number;
  lastFailure: number;
}

// ─── Store Adapter ────────────────────────────────────────────────────────────

export interface IEventStoreAdapter {
  writeBatch(events: CHATREvent[]): Promise<void>;
  query(filters: any): Promise<CHATREvent[]>;
}

export class InMemoryEventStore implements IEventStoreAdapter {
  private store: CHATREvent[] = [];

  async writeBatch(events: CHATREvent[]): Promise<void> {
    this.store.push(...events);
    if (this.store.length > 50000) {
      this.store = this.store.slice(-50000); // Bounded memory persistence for now
    }
  }

  async query(filters: any): Promise<CHATREvent[]> {
    return [...this.store];
  }

  shrink() {
    if (this.store.length > 10000) {
      this.store = this.store.slice(-10000); // Aggressive cut
    }
  }
}

// ─── The Event Runtime ────────────────────────────────────────────────────────

export class EventRuntimeImpl {
  // Routing
  private subscribers = new Map<string, Subscription[]>();
  
  // Delivery
  private deliveryQueue: CHATREvent[] = [];
  private isDispatching = false;
  
  // Persistence
  private storeAdapter: IEventStoreAdapter = new InMemoryEventStore();
  private persistenceBuffer: CHATREvent[] = [];
  private isFlushing = false;
  
  public setStoreAdapter(adapter: IEventStoreAdapter): void {
    console.info(`[EventRuntime] Swapping EventStoreAdapter to ${adapter.constructor.name}`);
    this.storeAdapter = adapter;
  }
  
  // DLQ
  public dlq: DeadLetterEntry[] = [];
  
  // Metrics tracking
  public metrics = {
    publishedCount: 0,
    deliveredCount: 0,
    dlqCount: 0,
    batchFlushCount: 0,
    queueSaturation: 0,
  };

  constructor() {
    // Start Batch Writer Loop
    setInterval(() => this.flushBatchWriter(), 500); // 500ms flush window
    
    // Adaptive Memory Management
    this.subscribe('MEMORY_WARNING', () => {
      console.warn('[EventRuntime] Memory warning. Flushing buffers & DLQ.');
      if (this.deliveryQueue.length > 5000) this.deliveryQueue.length = 5000;
      if (this.persistenceBuffer.length > 5000) this.persistenceBuffer.length = 5000;
      if (this.dlq.length > 100) this.dlq.length = 100;
      
      // Also notify adapter to shrink if it's in-memory
      if ((this.storeAdapter as any).shrink) {
        (this.storeAdapter as any).shrink();
      }
    });
  }

  // ─── Registration ───────────────────────────────────────────────────────────

  public subscribe<T = unknown>(type: string, handler: EventHandler<T>, opts?: SubscriptionOpts): () => void {
    const sub: Subscription = {
      id: crypto.randomUUID(),
      handler: handler as EventHandler<unknown>,
      priority: opts?.priority ?? 'normal',
      once: opts?.once ?? false,
      timeoutMs: opts?.timeoutMs ?? 5000,
      name: opts?.name ?? 'anonymous',
    };

    const list = this.subscribers.get(type) ?? [];
    list.push(sub);
    this.subscribers.set(type, list);

    return () => {
      const current = this.subscribers.get(type) || [];
      this.subscribers.set(type, current.filter(s => s.id !== sub.id));
    };
  }

  // ─── Publishing ─────────────────────────────────────────────────────────────

  public realtimeActive = false;

  public publish<T = unknown>(type: string, payload: T, opts?: Partial<CHATREvent>): CHATREvent<T> {
    const schema = eventSchemaRegistry.get(type);
    
    // Check if the caller explicitly wants it to NOT persist (e.g. from realtime broadcast)
    const explicitlySkipPersist = opts?.persist === false;
    
    const event: CHATREvent<T> = {
      id: opts?.id || crypto.randomUUID(), // Preserve ID if given
      type,
      payload,
      schemaVersion: schema?.version ?? '1.0',
      timestamp: opts?.timestamp || Date.now(),
      source: opts?.source ?? 'system',
      persist: explicitlySkipPersist ? false : (opts?.persist ?? schema?.persistent ?? false),
      priority: opts?.priority ?? schema?.priority ?? 'normal',
      workflowId: opts?.workflowId,
      traceId: opts?.traceId,
      correlationId: opts?.correlationId,
      causationId: opts?.causationId,
      tenantId: opts?.tenantId,
    };

    this.metrics.publishedCount++;

    if (event.persist) {
      this.persistenceBuffer.push(event);
      // Stage 1.3: If Realtime is active, DO NOT deliver this event locally.
      // Wait for it to round-trip through Supabase -> Realtime Channel -> dispatchFromRealtime.
      if (!this.realtimeActive) {
        this.deliveryQueue.push(event);
      }
    } else {
      // Non-persistent events or events coming FROM the realtime channel are delivered immediately.
      this.deliveryQueue.push(event);
    }

    // Trigger async dispatch loop without blocking publisher
    this.triggerDispatcher();

    return event;
  }

  // ─── Delivery Dispatcher ────────────────────────────────────────────────────

  private async triggerDispatcher() {
    if (this.isDispatching || this.deliveryQueue.length === 0) return;
    this.isDispatching = true;

    try {
      while (this.deliveryQueue.length > 0) {
        // Calculate saturation (assuming 10k is warning threshold)
        this.metrics.queueSaturation = Math.min(100, (this.deliveryQueue.length / 10000) * 100);

        const event = this.deliveryQueue.shift();
        if (!event) break;

        const specificSubs = this.subscribers.get(event.type) || [];
        const wildcardSubs = this.subscribers.get('*') || [];
        const subs = [...specificSubs, ...wildcardSubs];
        const toRemove: string[] = [];

        // Fan-out execution using Promise.allSettled for true isolation
        await Promise.allSettled(subs.map(async (sub) => {
          try {
            // Promise wrapper for timeouts
            await Promise.race([
              sub.handler(event),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Subscriber Timeout')), sub.timeoutMs))
            ]);
            this.metrics.deliveredCount++;
            if (sub.once) toRemove.push(sub.id);
          } catch (err: any) {
            this.handleDeliveryFailure(event, sub, err);
          }
        }));

        if (toRemove.length > 0) {
          const current = this.subscribers.get(event.type) || [];
          this.subscribers.set(event.type, current.filter(s => !toRemove.includes(s.id)));
          const currentWild = this.subscribers.get('*') || [];
          this.subscribers.set('*', currentWild.filter(s => !toRemove.includes(s.id)));
        }
      }
    } finally {
      this.isDispatching = false;
      this.metrics.queueSaturation = 0;
    }
  }

  private handleDeliveryFailure(event: CHATREvent, sub: Subscription, err: any) {
    console.error(`[EventRuntime] Subscriber ${sub.name} failed on ${event.type}:`, err);
    this.metrics.dlqCount++;
    this.dlq.push({
      event,
      subscriberName: sub.name,
      failureReason: err.message || 'Unknown Error',
      retryCount: 0,
      firstFailure: Date.now(),
      lastFailure: Date.now()
    });
  }

  // ─── Batch Writer ───────────────────────────────────────────────────────────

  private async flushBatchWriter() {
    if (this.isFlushing || this.persistenceBuffer.length === 0) return;
    this.isFlushing = true;

    try {
      // Drain buffer
      const batch = this.persistenceBuffer.splice(0, 1000); // Write up to 1000 at a time
      if (batch.length > 0) {
        await this.storeAdapter.writeBatch(batch);
        this.metrics.batchFlushCount++;
      }
    } catch (err) {
      console.error('[EventRuntime] Batch persistence failed', err);
      // In production, we'd add back-pressure or circuit breakers here
    } finally {
      this.isFlushing = false;
    }
  }

  // ─── Replay Engine ──────────────────────────────────────────────────────────

  public async replay(
    events: CHATREvent[], 
    mode: 'Analytics' | 'TimelineRebuild' | 'Debugging' | 'FullBusiness'
  ) {
    console.warn(`[EventRuntime] Replaying ${events.length} events in ${mode} mode`);
    // Example: For TimelineRebuild, we would only trigger subscribers that register for Timeline events.
    // For FullBusiness, we bypass queues and dispatch directly (DANGEROUS).
    
    // For now, simple direct dispatch (ignoring timeouts for replay simplicity)
    for (const event of events) {
      const subs = this.subscribers.get(event.type) || [];
      for (const sub of subs) {
        try {
           await sub.handler(event);
        } catch {}
      }
    }
  }
}

export const eventRuntime = new EventRuntimeImpl();
