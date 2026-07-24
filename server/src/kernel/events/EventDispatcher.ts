import { randomUUID } from 'crypto';
import { StoredEvent, IEventStore } from '../../types.js';
import { PostgresEventStore } from './PostgresEventStore.js';
import { EventBus } from '../../services/EventBusService.js';

class SystemEventDispatcher {
  private store: IEventStore;

  constructor() {
    this.store = new PostgresEventStore();
  }

  setStore(store: IEventStore) {
    this.store = store;
  }

  /**
   * Dispatches an event to BOTH the Event Store (for durability) and Event Bus (for volatility).
   */
  async dispatch(eventInput: Omit<StoredEvent, 'id' | 'version' | 'metadata'> & { 
    actorId: string; 
    tenantId: string; 
    source: string; 
    correlationId: string;
    causationId?: string;
  }): Promise<void> {
    
    const event: StoredEvent = {
      id: randomUUID(),
      version: 1,
      eventType: eventInput.eventType,
      streamId: eventInput.streamId,
      sequence: eventInput.sequence,
      payload: eventInput.payload,
      metadata: {
        actorId: eventInput.actorId,
        tenantId: eventInput.tenantId,
        source: eventInput.source,
        timestamp: new Date().toISOString(),
        correlationId: eventInput.correlationId,
        causationId: eventInput.causationId
      }
    };

    // 1. Append to Event Store (Durability)
    await this.store.append(event.streamId, event);

    // 2. Publish to Event Bus (Delivery)
    EventBus.publishVolatile(event);
  }
}

export const EventDispatcher = new SystemEventDispatcher();
