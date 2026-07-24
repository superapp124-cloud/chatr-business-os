import { eventBus } from '@/core/runtime/EventBus';
import { OSEvent } from './Types';

type EventListener = (event: OSEvent) => void;

class Bus {
  subscribe(listener: EventListener) {
    return eventBus.onAny((evt) => {
      listener({
        type: evt.type,
        payload: evt.payload,
        timestamp: evt.timestamp,
        correlationId: evt.correlationId
      });
    });
  }

  publish(event: OSEvent) {
    eventBus.publish(event.type, event.payload, { correlationId: event.correlationId, source: 'AutomationOS' });
  }

  getHistory() {
    const history = (eventBus as any).history;
    if (!history) return [];
    return history.map((evt: any) => ({
      type: evt.type,
      payload: evt.payload,
      timestamp: evt.timestamp,
      correlationId: evt.correlationId
    }));
  }
}

export const EventBus = new Bus();
