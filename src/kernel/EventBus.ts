import { EventStore, OS_Event } from './EventStore';

type EventHandler = (payload: any, context: any) => void | Promise<void>;

class EventBusService {
  private handlers: Map<string, EventHandler[]> = new Map();

  subscribe(eventType: string, handler: EventHandler) {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)?.push(handler);
  }

  unsubscribe(eventType: string, handler: EventHandler) {
    const current = this.handlers.get(eventType) || [];
    this.handlers.set(eventType, current.filter(h => h !== handler));
  }

  /**
   * Publishes an event to memory listeners and persists it to the EventStore.
   */
  async publish(eventType: string, payload: any, context: any, aggregateId?: string, aggregateType?: string) {
    // 1. Notify in-memory listeners
    const listeners = this.handlers.get(eventType) || [];
    // We execute listeners asynchronously without blocking the main thread
    listeners.forEach(handler => {
      try {
        handler(payload, context);
      } catch (e) {
        console.error(`Error in event handler for ${eventType}`, e);
      }
    });

    // 2. Persist to Event Store if it's an aggregate event
    if (aggregateId && aggregateType) {
      const event: OS_Event = {
        eventType,
        aggregateId,
        aggregateType,
        payload,
      };
      await EventStore.append(event, context);
    }
  }
}

export const EventBus = new EventBusService();
