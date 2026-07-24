import { IStorageAdapter, IEventStore, EventRecord } from '../contracts/StorageContracts';

export class EventRepository implements IEventStore {
  constructor(private db: IStorageAdapter) {}

  public async appendEvent(event: EventRecord): Promise<void> {
    await this.db.executeRaw(
      `INSERT INTO events (eventId, timestamp, entityId, eventType, payload) VALUES (?, ?, ?, ?, ?)`,
      [event.eventId, event.timestamp, event.entityId, event.eventType, JSON.stringify(event.payload)]
    );
  }

  public async getEventsForEntity(entityId: string): Promise<EventRecord[]> {
    // We fall back to standard raw queries when the generic abstraction isn't enough,
    // though ideally the StorageAdapter would have a richer typed query builder.
    return []; // Stub for now until generic query maps are added
  }

  public async replayEvents(since: number): Promise<EventRecord[]> {
    return [];
  }
}
