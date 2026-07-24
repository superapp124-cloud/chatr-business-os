import { eventBus } from '@/core/runtime/EventBus';
import type {
  PlatformEvent,
  PlatformEventHandler,
  PlatformEventInput,
  PlatformUnsubscribe,
} from '@/platform/types';

function createEventId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export class PlatformEventBus {
  subscribe<TPayload = unknown>(
    type: string,
    handler: PlatformEventHandler<TPayload>
  ): PlatformUnsubscribe {
    const unsub = eventBus.on(type, (evt) => {
      handler({
        id: evt.id,
        type: evt.type,
        payload: evt.payload as TPayload,
        timestamp: new Date(evt.timestamp).toISOString(),
        version: 1,
        source: evt.source
      });
    });
    return { unsubscribe: unsub };
  }

  async publish<TPayload = unknown>(
    input: PlatformEventInput<TPayload>
  ): Promise<PlatformEvent<TPayload>> {
    const event: PlatformEvent<TPayload> = {
      ...input,
      id: input.id ?? createEventId(),
      timestamp: input.timestamp ?? new Date().toISOString(),
      version: input.version ?? 1,
    };

    eventBus.publish(event.type, event.payload, { correlationId: event.id, source: event.source });
    return event;
  }

  subscribeAll(handler: PlatformEventHandler): PlatformUnsubscribe {
    const unsub = eventBus.onAny((evt) => {
      handler({
        id: evt.id,
        type: evt.type,
        payload: evt.payload,
        timestamp: new Date(evt.timestamp).toISOString(),
        version: 1,
        source: evt.source
      });
    });
    return { unsubscribe: unsub };
  }
}

export const platformEventBus = new PlatformEventBus();
