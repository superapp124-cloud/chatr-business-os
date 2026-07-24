import { EventStore, KernelEvent } from '../storage/EventStore';

export interface ICursorStore {
  getCursor(projectionName: string): Promise<number>;
  saveCursor(projectionName: string, position: number): Promise<void>;
}

export class InMemoryCursorStore implements ICursorStore {
  private cursors: Map<string, number> = new Map();
  async getCursor(name: string) { return this.cursors.get(name) || 0; }
  async saveCursor(name: string, position: number) { this.cursors.set(name, position); }
}

export type ProjectionState = 'idle' | 'syncing' | 'recovering' | 'offline' | 'replaying';

export interface IProjection {
  name: string;
  handleEvent(event: KernelEvent): Promise<void>;
  reset(): Promise<void>; // Clear the projection (for replay)
}

/**
 * Current State Projection
 * Maintains the latest snapshot of every living object.
 */
export class CurrentStateProjection implements IProjection {
  name = 'CurrentState';
  private stateMap: Map<string, any> = new Map();

  async handleEvent(event: KernelEvent): Promise<void> {
    const currentState = this.stateMap.get(event.aggregateId) || {};
    // Apply event payload over current state
    const newState = { 
      ...currentState, 
      ...event.payload, 
      _lastUpdated: event.timestamp,
      _version: event.expectedVersion 
    };
    this.stateMap.set(event.aggregateId, newState);
    // In production, this would write to a fast read-replica DB or Redis cache.
  }

  async reset(): Promise<void> {
    this.stateMap.clear();
  }

  getState(aggregateId: string): any {
    return this.stateMap.get(aggregateId);
  }
}

/**
 * Graph Projection
 * Maintains the relationships between objects for graph traversals.
 */
export class GraphProjection implements IProjection {
  name = 'Graph';
  private edges: Array<{ source: string; target: string; predicate: string }> = [];

  async handleEvent(event: KernelEvent): Promise<void> {
    if (event.eventType === 'RelationshipCreated') {
      this.edges.push({
        source: event.payload.sourceId,
        target: event.payload.targetId,
        predicate: event.payload.predicate
      });
    }
  }

  async reset(): Promise<void> {
    this.edges = [];
  }
}

/**
 * Timeline Projection
 * Maintains the chronological history (audit log) of an object.
 */
export class TimelineProjection implements IProjection {
  name = 'Timeline';
  private timelineMap: Map<string, any[]> = new Map();

  async handleEvent(event: KernelEvent): Promise<void> {
    const timeline = this.timelineMap.get(event.aggregateId) || [];
    timeline.push({
      eventId: event.eventId,
      eventType: event.eventType,
      timestamp: event.timestamp,
      actorId: event.actorId
    });
    this.timelineMap.set(event.aggregateId, timeline);
  }

  async reset(): Promise<void> {
    this.timelineMap.clear();
  }
}

/**
 * Projection Service
 * Subscribes to the EventStore and routes events to all registered projections.
 * It also supports rebuilding projections from scratch via replay.
 */
export class ProjectionService {
  private projections: IProjection[] = [];
  private isRunning = false;
  private state: ProjectionState = 'idle';
  private stateListeners: ((state: ProjectionState) => void)[] = [];

  constructor(
    private eventStore: EventStore,
    private cursorStore?: ICursorStore
  ) {
    this.register(new CurrentStateProjection());
    this.register(new GraphProjection());
    this.register(new TimelineProjection());
  }

  register(projection: IProjection) {
    this.projections.push(projection);
  }

  onStateChange(listener: (state: ProjectionState) => void) {
    this.stateListeners.push(listener);
    listener(this.state);
    return () => {
      this.stateListeners = this.stateListeners.filter(l => l !== listener);
    };
  }

  private setState(newState: ProjectionState) {
    if (this.state !== newState) {
      this.state = newState;
      this.stateListeners.forEach(l => l(newState));
    }
  }

  stop() {
    this.isRunning = false;
    this.setState('offline');
  }

  /**
   * Start listening to real-time events.
   */
  /**
   * Resume projections from last known cursors, then start listening.
   */
  async start() {
    this.isRunning = true;
    this.setState('recovering');
    
    // Resume each projection independently if we have a cursor store
    if (this.cursorStore) {
      for (const projection of this.projections) {
        const cursor = await this.cursorStore.getCursor(projection.name);
        if (cursor > 0) {
          const missedEvents = await this.eventStore.loadSince(cursor);
          for (const event of missedEvents) {
            if (!this.isRunning) break;
            try {
              await projection.handleEvent(event);
              if (event.globalSequence) await this.cursorStore.saveCursor(projection.name, event.globalSequence);
            } catch (err) {
              console.error(`Projection ${projection.name} failed to resume event ${event.eventId}:`, err);
            }
          }
        }
      }
    }

    this.eventStore.subscribe(async (event) => {
      if (this.isRunning) {
        await this.dispatch(event);
      }
    });
    
    this.setState('idle');
  }

  /**
   * Dispatches an event to all projections.
   */
  private async dispatch(event: KernelEvent) {
    for (const projection of this.projections) {
      try {
        await projection.handleEvent(event);
        if (this.cursorStore && event.globalSequence) {
          await this.cursorStore.saveCursor(projection.name, event.globalSequence);
        }
      } catch (err) {
        console.error(`Projection ${projection.name} failed to handle event ${event.eventId}:`, err);
        this.setState('offline');
        // Let it throw to simulate crashes accurately for hardening tests
        throw err;
      }
    }
  }

  /**
   * Rebuilds all projections from the Event Store.
   * This showcases the power of Event Sourcing - caches are entirely disposable.
   */
  async rebuild(fromPosition: number = 0) {
    this.setState('replaying');
    console.log('[ProjectionService] Resetting all projections...');
    for (const projection of this.projections) {
      await projection.reset();
    }

    console.log('[ProjectionService] Replaying events from position', fromPosition);
    const events = await this.eventStore.loadSince(fromPosition);
    for (const event of events) {
      await this.dispatch(event);
    }
    
    console.log('[ProjectionService] Rebuild complete.');
    this.setState('idle');
  }
}
