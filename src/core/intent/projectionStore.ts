import { Understanding } from './types';
import { toast } from 'sonner';

export interface KernelEvent {
  id: string;
  eventName: string;
  timestamp: number;
  stage: string;
  correlationId: string;
  payload: any;
}

export interface ProjectionState {
  understanding: Understanding | null;
  isReady: boolean;
  activeCorrelationId: string | null;
  activeSuggestion: any | null;
  latencyMetrics: Record<string, number>;
  events: KernelEvent[];
  cursor: number; // For time travel, points to the currently applied event index
}

type Subscriber = (state: ProjectionState) => void;

class ProjectionStore {
  private state: ProjectionState;
  private subscribers: Set<Subscriber>;
  private stageTimestamps: Record<string, number> = {};

  constructor() {
    this.subscribers = new Set();
    this.state = this.getInitialState();
  }

  private getInitialState(): ProjectionState {
    return {
      understanding: null,
      isReady: false,
      activeCorrelationId: null,
      activeSuggestion: null,
      latencyMetrics: {},
      events: [],
      cursor: -1
    };
  }

  subscribe(callback: Subscriber) {
    this.subscribers.add(callback);
    callback(this.state);
    return () => this.subscribers.delete(callback);
  }

  private notify() {
    this.subscribers.forEach(s => s(this.state));
  }

  public getState() {
    return this.state;
  }

  public handleEvent(event: KernelEvent) {
    // Only append real events if we are at the edge of the cursor (not time-traveling)
    if (this.state.cursor === this.state.events.length - 1) {
      this.state.events.push(event);
      this.state.cursor++;
      this.applyEvent(event, true);
    } else {
      // If we are actively time-traveling, push to history but do not apply immediately
      this.state.events.push(event);
    }
  }

  private applyEvent(event: KernelEvent, updateMetrics: boolean) {
    const { stage, eventName, correlationId, payload } = event;

    if (this.state.activeCorrelationId && correlationId !== this.state.activeCorrelationId) {
      if (eventName === 'KERNEL.OBSERVATION.CREATED') {
        this.resetStateForNewIntent(correlationId);
      } else {
        return; // Ignore stale events
      }
    } else if (!this.state.activeCorrelationId) {
      this.resetStateForNewIntent(correlationId);
    }

    if (updateMetrics) {
      const now = Date.now(); // We use local time for UI metrics
      const lastStageTime = Object.values(this.stageTimestamps).pop() || now;
      const latency = now - lastStageTime;
      this.stageTimestamps[stage] = now;
      this.state.latencyMetrics = { ...this.state.latencyMetrics, [stage]: latency };
    }

    if (eventName === 'KERNEL.UNDERSTANDING.CREATED') {
      const classifications = payload.classifications;
      if (classifications?.length > 0) {
        this.state.understanding = classifications[0] as Understanding;
      }
    } else if (eventName === 'KERNEL.OUTCOME.DETECTED') {
      // New v1.0 Outcome Engine
      const outcomes = payload.outcomes || [];
      if (outcomes.length > 0) {
        // We import outcomeRuntime dynamically or rely on global/window events 
        // to avoid circular deps if needed, but since we are in src/ it's fine.
        // Actually, we can just trigger a custom event that DesktopChat or OutcomeRuntime listens to.
        window.dispatchEvent(new CustomEvent('chatr:outcomes-detected', { detail: outcomes }));
      }
    } else if (eventName === 'KERNEL.ACTION.REVEALED') {
      if (this.state.understanding) {
        this.state.understanding = {
          ...this.state.understanding,
          _action: payload.action,
          readyForSuggestion: true
        };
      }
      
      // Auto-promote primary actions to the active suggestion so the Outcome Engine renders them
      if (!this.state.activeSuggestion && payload.action) {
        this.state.activeSuggestion = {
          type: payload.action.type.replace('CREATE_', ''),
          title: payload.action.summary || payload.action.type,
          action: payload.action.type,
          context: 'Primary Intent',
          payload: payload,
          entities: payload.action.entities || {}
        };
        toast.info('5. Store: Created active suggestion: ' + this.state.activeSuggestion.title);
      }
      
      this.state.isReady = true;
      toast.success('6. Store: state.isReady = true');
    } else if (eventName === 'KERNEL.CONTEXT.RESOLVED') {
       // Typically context resolution comes bundled before ACTION.REVEALED, 
       // but we could explicitly update UI state here if needed
    } else if (eventName === 'KERNEL.SUGGESTION.PROPOSED') {
      this.state.activeSuggestion = payload;
      this.state.isReady = true;
    }

    this.notify();
  }

  private resetStateForNewIntent(correlationId: string) {
    this.state.activeCorrelationId = correlationId;
    this.state.understanding = null;
    this.state.activeSuggestion = null;
    this.state.isReady = false;
    this.state.latencyMetrics = {};
    this.stageTimestamps = { 'START': Date.now() };
  }

  public reset() {
    this.state = this.getInitialState();
    this.stageTimestamps = {};
    this.notify();
  }

  // --- Time Travel Debugging ---

  public stepForward() {
    if (this.state.cursor < this.state.events.length - 1) {
      this.state.cursor++;
      this.applyEvent(this.state.events[this.state.cursor], false);
    }
  }

  public stepBackward() {
    if (this.state.cursor >= 0) {
      this.state.cursor--;
      this.rebuildStateFromHistory(this.state.cursor);
    }
  }

  public play() {
    this.state.cursor = this.state.events.length - 1;
    this.rebuildStateFromHistory(this.state.cursor);
  }

  public stop() {
    this.reset();
  }

  private rebuildStateFromHistory(targetCursor: number) {
    // Save events array before rebuilding
    const allEvents = this.state.events;
    
    // Wipe state clean
    this.state = {
      understanding: null,
      isReady: false,
      activeCorrelationId: null,
      activeSuggestion: null,
      latencyMetrics: {}, // We don't replay metrics during time travel
      events: allEvents,
      cursor: targetCursor
    };

    // Reapply events up to cursor
    for (let i = 0; i <= targetCursor; i++) {
      this.applyEvent(allEvents[i], false);
    }
    
    this.notify();
  }
}

export const projectionStore = new ProjectionStore();
