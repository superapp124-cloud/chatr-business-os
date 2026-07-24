import { EventBus } from './EventBus';
import { OSEvent } from './Types';

export interface TelemetryEvent {
  timestamp: number;
  workflowId: string;
  nodeId?: string;
  type: string;
  duration?: number;
  runtime?: string;
  memoryUsage?: number;
  cost?: number;
  aiOptimization?: string;
}

class Stream {
  private events: TelemetryEvent[] = [];
  private listeners: (() => void)[] = [];

  constructor() {
    EventBus.subscribe(this.handleEvent.bind(this));
  }

  private handleEvent(event: OSEvent) {
    if (['EXECUTION_STARTED', 'NODE_STARTED', 'NODE_COMPLETED', 'NODE_FAILED'].includes(event.type)) {
      this.events.push({
        timestamp: event.timestamp,
        workflowId: event.payload.workflowId || 'unknown',
        nodeId: event.payload.nodeId,
        type: event.type,
        runtime: 'edge-us-east',
        memoryUsage: Math.floor(Math.random() * 50) + 10,
        cost: 0.0001
      });
      this.notify();
    }
  }

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l());
  }

  getEvents() {
    return this.events;
  }
}

export const TelemetryStream = new Stream();
