/**
 * CHATR Workflow UI SDK — Execution Timeline
 *
 * Every WorkflowUIEvent automatically produces a TimelineEntry.
 * One implementation gives you: audit log, debug panel, enterprise history, analytics.
 *
 * This module manages the timeline independently from WorkflowUIRuntime
 * so it can be consumed without pulling in the full runtime.
 */

import type { TimelineEntry, WorkflowUIEvent } from './types';

let entryCounter = 0;

function generateTimelineId(): string {
  return `tl-${Date.now()}-${++entryCounter}`;
}

/**
 * Generate a human-readable label for a WorkflowUIEvent.
 * Capabilities can override via the event's metadata.label field.
 */
function generateLabel(event: WorkflowUIEvent): string {
  const meta = event.payload as Record<string, unknown> | null;
  if (meta?.timelineLabel && typeof meta.timelineLabel === 'string') {
    return meta.timelineLabel;
  }

  const actor = event.actor === 'user' ? 'User' : 'System';

  switch (event.event) {
    case 'WORKFLOW_STARTED':   return `Workflow started`;
    case 'WORKFLOW_RESUMED':   return `Workflow resumed`;
    case 'WORKFLOW_COMPLETED': return `Workflow completed`;
    case 'WORKFLOW_FAILED':    return `Workflow failed`;
    case 'WORKFLOW_CANCELLED': return `Workflow cancelled by ${actor.toLowerCase()}`;
    case 'WIDGET_CREATED':     return `${capitalize(event.widgetType)} widget created`;
    case 'WIDGET_UPDATED':     return `${capitalize(event.widgetType)} updated`;
    case 'WIDGET_LIFECYCLE':   return `${capitalize(event.widgetType)} → ${event.lifecycle}`;
    case 'WIDGET_ACTION': {
      const action = (event.payload as Record<string, unknown>)?.action as string;
      return action
        ? `${actor} action: ${action.toLowerCase().replace(/_/g, ' ')} on ${event.widgetType}`
        : `${actor} interacted with ${event.widgetType}`;
    }
    default:
      return `${event.event}`;
  }
}

function capitalize(s: string | undefined): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

class WorkflowTimeline {
  private static instance: WorkflowTimeline;
  /** Map from workflowId → ordered entries */
  private entries = new Map<string, TimelineEntry[]>();
  /** Map from workflowId → workflow start timestamp */
  private startTimes = new Map<string, number>();
  /** Listeners per workflowId */
  private listeners = new Map<string, Set<() => void>>();

  private constructor() {}

  static getInstance(): WorkflowTimeline {
    if (!WorkflowTimeline.instance) {
      WorkflowTimeline.instance = new WorkflowTimeline();
    }
    return WorkflowTimeline.instance;
  }

  /**
   * Record the start time for a workflow (called when WORKFLOW_STARTED).
   */
  markStart(workflowId: string): void {
    this.startTimes.set(workflowId, Date.now());
    if (!this.entries.has(workflowId)) {
      this.entries.set(workflowId, []);
    }
  }

  /**
   * Append a new timeline entry from a WorkflowUIEvent.
   */
  append(event: WorkflowUIEvent): TimelineEntry {
    const startTime = this.startTimes.get(event.workflowId) ?? event.timestamp;

    const entry: TimelineEntry = {
      id: generateTimelineId(),
      workflowId: event.workflowId,
      timestamp: event.timestamp,
      elapsed: event.timestamp - startTime,
      event: event.event,
      widgetType: event.widgetType,
      lifecycle: event.lifecycle,
      label: generateLabel(event),
      actor: event.actor,
      metadata: typeof event.payload === 'object' && event.payload !== null
        ? (event.payload as Record<string, unknown>)
        : undefined,
    };

    const list = this.entries.get(event.workflowId) ?? [];
    list.push(entry);
    this.entries.set(event.workflowId, list);

    this.notify(event.workflowId);
    return entry;
  }

  /** Get all entries for a workflow, ordered chronologically. */
  getEntries(workflowId: string): TimelineEntry[] {
    return this.entries.get(workflowId) ?? [];
  }

  /** Subscribe to timeline updates for a workflowId. Returns unsubscribe fn. */
  subscribe(workflowId: string, callback: () => void): () => void {
    const set = this.listeners.get(workflowId) ?? new Set();
    set.add(callback);
    this.listeners.set(workflowId, set);
    return () => {
      set.delete(callback);
    };
  }

  /** Clear timeline for a workflow (e.g. after archiving). */
  clear(workflowId: string): void {
    this.entries.delete(workflowId);
    this.startTimes.delete(workflowId);
    this.listeners.delete(workflowId);
  }

  private notify(workflowId: string): void {
    this.listeners.get(workflowId)?.forEach(cb => cb());
  }
}

export const workflowTimeline = WorkflowTimeline.getInstance();
