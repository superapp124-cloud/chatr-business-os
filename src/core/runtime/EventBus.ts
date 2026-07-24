import { CHATREvent, EventPriority, EventHandler } from './types';
import { kernel } from '../../kernel/abi';
import { EventDraft, KernelEvent } from '../../kernel/abi/v1';

/**
 * EventBus Facade over the Kernel IntelligenceBus.
 * Preserves the exact public API so we don't have to refactor 100+ files.
 */
class EventBusFacade {
  // ─── Subscribe ──────────────────────────────────────────────────────────────

  on<T = unknown>(
    type: string,
    handler: EventHandler<T>,
    opts?: { priority?: EventPriority; once?: boolean }
  ): () => void {
    const unsub = kernel.subscribeEvents(type, (event: KernelEvent) => {
      // Map KernelEvent back to legacy CHATREvent shape for the UI
      const legacyEvent: CHATREvent<T> = {
        eventId: event.id,
        type: event.type,
        timestamp: event.timestamp,
        source: event.source as string,
        payload: event.payload as T,
        priority: opts?.priority || 'NORMAL',
        metadata: {
          correlationId: event.correlationId,
          causationId: event.causationId,
        }
      };

      handler(legacyEvent);

      if (opts?.once) {
        unsub();
      }
    });

    return unsub;
  }

  once<T = unknown>(type: string, handler: EventHandler<T>): () => void {
    return this.on(type, handler, { once: true });
  }

  onAny<T = unknown>(handler: EventHandler<T>): () => void {
    return this.on('*', handler);
  }

  // Backward compatibility alias for 'on'
  subscribe<T = unknown>(type: string, handler: EventHandler<T>): () => void {
    return this.on(type, handler);
  }

  // Backward compatibility alias
  unsubscribe<T = unknown>(type: string, handler: EventHandler<T>): void {
    // Deprecated. Return function from subscribe() must be used.
  }

  // ─── Persistence ──────────────────────────────────────────────────────────

  setPersistenceHandler(handler: (event: CHATREvent) => void): void {
    console.warn('[EventBusFacade] setPersistenceHandler is deprecated. Handled by kernel.');
  }

  // ─── Publish ───────────────────────────────────────────────────────────────

  publish<T = unknown>(
    type: string,
    payload: T,
    opts?: {
      priority?: EventPriority;
      source?: string;
      correlationId?: string;
      workflowId?: string;
    } | string
  ): CHATREvent<T> {
    const options = typeof opts === 'string' ? { source: opts } : (opts ?? {});
    
    const draft: EventDraft = {
      type,
      source: (options.source || 'ui') as any,
      payload,
      priority: (options.priority as any) || 'NORMAL',
      trust: {
        confidence: 1.0, reputation: 1.0, verification: 1.0,
        reliability: 1.0, security: 1.0, compliance: 1.0, privacy: 1.0
      },
      cost: { resources: [], totalUSD: 0 },
      correlationId: options.correlationId,
      intentId: options.workflowId as any,
    };

    // The publishEvent is async but the legacy signature is sync.
    // In JavaScript we can fire and forget if the signature doesn't wait.
    kernel.publishEvent(draft).catch(err => {
      console.error(`[EventBusFacade] publish failed for ${type}:`, err);
    });

    // Return synthetic CHATREvent for legacy sync callers
    return {
      eventId: `ev_legacy_${Date.now()}`,
      type,
      timestamp: Date.now(),
      source: draft.source as string,
      payload,
      priority: options.priority || 'NORMAL',
    };
  }

  // ─── Replay ───────────────────────────────────────────────────────────────

  replay(events: CHATREvent[], mode: 'Analytics' | 'TimelineRebuild' | 'Debugging' | 'FullBusiness' = 'Debugging'): void {
    console.warn('[EventBusFacade] replay is delegated to IntelligenceBus.');
  }

  get throughputPerSecond(): number {
    return 0; // Deprecated
  }
}

export const eventBus = new EventBusFacade();
