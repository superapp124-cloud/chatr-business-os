import { kernel } from '../abi';
import { KernelEvent, EventDraft } from '../abi/v1';

export class KernelEventBus {
  /**
   * Legacy subscribe method. Routes directly to the new IntelligenceBus.
   */
  subscribe<T = any>(eventType: string, handler: (event: any) => Promise<void> | void): () => void {
    // ABI provides wildcard subscriptions, so legacy exact matches work natively.
    return kernel.subscribeEvents(eventType, (event: KernelEvent) => {
      // Legacy kernelBus passed the whole payload object as `event` 
      // but wrapped in an envelope. We'll pass the whole event object.
      handler(event);
    });
  }

  /**
   * Legacy publish method.
   * Transforms the legacy payload into the v1.0 EventDraft and submits to ABI.
   */
  async publish<T = any>(event: any): Promise<void> {
    const draft: EventDraft = {
      type: event.type,
      source: event.sourceService || 'legacy_kernel_bus',
      payload: event.payload,
      trust: {
        confidence: 1.0, reputation: 1.0, verification: 1.0,
        reliability: 1.0, security: 1.0, compliance: 1.0, privacy: 1.0
      },
      cost: { resources: [], totalUSD: 0 },
      priority: 'NORMAL',
    };

    if (event.payload?.intentId) draft.intentId = event.payload.intentId;
    if (event.authority) draft.source = event.authority;

    await kernel.publishEvent(draft);
  }

  /**
   * Replay all events since the start (for durability/recovery)
   */
  getHistory(): any[] {
    console.warn('[KernelEventBus] getHistory() is deprecated. Use IntelligenceBus replay.');
    return []; // Handled natively by IntelligenceBus now
  }
}

// Singleton instance for legacy Kernel Core compatibility
export const kernelBus = new KernelEventBus();
