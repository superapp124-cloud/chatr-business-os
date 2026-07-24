/**
 * CHATR Workflow UI SDK — WorkflowUIRuntime
 *
 * The boundary between the Execution Kernel and the React UI layer.
 *
 * Responsibilities:
 *   1. Boot: subscribe to 'WORKFLOW_UI_EVENT' on the eventBus
 *   2. Dispatch: route each event to the correct session handler
 *   3. State: maintain in-memory WorkflowUISession map
 *   4. Persistence: delegate to IWorkflowUIStore (memory by default)
 *   5. Notification: notify React hooks when sessions change
 *
 * What it does NOT do:
 *   - Import React
 *   - Call widget methods directly
 *   - Know anything about specific capabilities (cab, food, flight, etc.)
 *
 * Boot location: called once from ChatrOSProvider at app startup.
 */

import { eventBus } from '../runtime/EventBus';
import type { CHATREvent } from '../runtime/types';
import type {
  WorkflowUIEvent,
  WorkflowUISession,
  WorkflowManifest,
  WidgetInstance,
  WorkflowLifecycle,
  IWorkflowUIStore,
  WidgetAction,
} from './types';
import { workflowTimeline } from './WorkflowTimeline';

// ─── LocalStorage Store ──────────────────────────────────────────────────────

const STORAGE_KEY = 'chatr_workflow_sessions';

class LocalStorageWorkflowUIStore implements IWorkflowUIStore {
  private getStore(): Record<string, WorkflowUISession> {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  private setStore(data: Record<string, WorkflowUISession>) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
  }

  async save(session: WorkflowUISession): Promise<void> {
    const store = this.getStore();
    store[session.workflowId] = session;
    this.setStore(store);
  }

  async load(workflowId: string): Promise<WorkflowUISession | null> {
    const store = this.getStore();
    return store[workflowId] || null;
  }

  async loadAll(): Promise<WorkflowUISession[]> {
    const store = this.getStore();
    return Object.values(store);
  }

  async delete(workflowId: string): Promise<void> {
    const store = this.getStore();
    delete store[workflowId];
    this.setStore(store);
  }
}

// ─── WorkflowUIRuntime ────────────────────────────────────────────────────────

class WorkflowUIRuntime {
  private static instance: WorkflowUIRuntime;

  /** Live in-memory sessions (source of truth for React hooks) */
  private sessions = new Map<string, WorkflowUISession>();

  /** Listeners keyed by workflowId — notified on any session change */
  private listeners = new Map<string, Set<() => void>>();

  /** Global listeners — notified when any session list changes */
  private globalListeners = new Set<() => void>();

  private store: IWorkflowUIStore = new LocalStorageWorkflowUIStore();
  private booted = false;

  private constructor() {}

  static getInstance(): WorkflowUIRuntime {
    if (!WorkflowUIRuntime.instance) {
      WorkflowUIRuntime.instance = new WorkflowUIRuntime();
    }
    return WorkflowUIRuntime.instance;
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Boot the runtime. Call once at app startup (e.g. in ChatrOSProvider).
   * Idempotent — safe to call multiple times.
   */
  boot(): void {
    if (this.booted) return;
    this.booted = true;

    // Load persisted sessions
    this.store.loadAll().then(sessions => {
      sessions.forEach(s => {
        this.sessions.set(s.workflowId, s);
      });
      if (sessions.length > 0) {
        this.notifyGlobal();
        if (import.meta.env.DEV) {
          console.debug(`[WorkflowUIRuntime] Loaded ${sessions.length} persisted sessions.`);
        }
      }
    });

    // Subscribe to all workflow UI events from the kernel
    eventBus.on<WorkflowUIEvent>('WORKFLOW_UI_EVENT', (kernelEvent: CHATREvent<WorkflowUIEvent>) => {
      this.dispatch(kernelEvent.payload);
    });

    if (import.meta.env.DEV) {
      console.debug('[WorkflowUIRuntime] Booted. Listening for WORKFLOW_UI_EVENT.');
    }
  }

  /**
   * Swap in a persistence adapter (Phase 2: Supabase, IndexedDB, etc.)
   * One-line change — same pattern as WorkflowStateStore.
   */
  setPersistenceAdapter(adapter: IWorkflowUIStore): void {
    this.store = adapter;
  }

  // ─── Core Dispatch ─────────────────────────────────────────────────────────

  private dispatch(event: WorkflowUIEvent): void {
    switch (event.event) {
      case 'WORKFLOW_STARTED':
        this.handleWorkflowStarted(event);
        break;
      case 'WORKFLOW_RESUMED':
        this.handleWorkflowResumed(event);
        break;
      case 'WIDGET_CREATED':
        this.handleWidgetCreated(event);
        break;
      case 'WIDGET_UPDATED':
        this.handleWidgetUpdated(event);
        break;
      case 'WIDGET_LIFECYCLE':
        this.handleWidgetLifecycle(event);
        break;
      case 'WIDGET_ACTION':
        this.handleWidgetAction(event);
        break;
      case 'WORKFLOW_COMPLETED':
        this.handleWorkflowTerminal(event, 'COMPLETED');
        break;
      case 'WORKFLOW_FAILED':
        this.handleWorkflowTerminal(event, 'FAILED');
        break;
      case 'WORKFLOW_CANCELLED':
        this.handleWorkflowTerminal(event, 'CANCELLED');
        break;
    }

    // Every event appends to the timeline
    workflowTimeline.append(event);
  }

  // ─── Event Handlers ────────────────────────────────────────────────────────

  private handleWorkflowStarted(event: WorkflowUIEvent): void {
    const payload = event.payload as { manifest: WorkflowManifest } | undefined;
    const manifest = payload?.manifest ?? this.defaultManifest(event.workflowId);

    workflowTimeline.markStart(event.workflowId);

    const session: WorkflowUISession = {
      workflowId: event.workflowId,
      parentWorkflowId: event.parentWorkflowId,
      manifest,
      widgets: [],
      timeline: [],
      lifecycle: 'ACTIVE',
      createdAt: event.timestamp,
      updatedAt: event.timestamp,
    };

    this.sessions.set(event.workflowId, session);
    this.persist(session);
    this.notify(event.workflowId);
    this.notifyGlobal();
  }

  private handleWorkflowResumed(event: WorkflowUIEvent): void {
    const session = this.sessions.get(event.workflowId);
    if (!session) return;
    session.lifecycle = 'ACTIVE';
    session.updatedAt = event.timestamp;
    this.persist(session);
    this.notify(event.workflowId);
  }

  private handleWidgetCreated(event: WorkflowUIEvent): void {
    let session = this.sessions.get(event.workflowId);

    // Auto-create session if workflow started without WORKFLOW_STARTED event
    if (!session) {
      session = {
        workflowId: event.workflowId,
        parentWorkflowId: event.parentWorkflowId,
        manifest: this.defaultManifest(event.workflowId),
        widgets: [],
        timeline: [],
        lifecycle: 'ACTIVE',
        createdAt: event.timestamp,
        updatedAt: event.timestamp,
      };
      workflowTimeline.markStart(event.workflowId);
      this.sessions.set(event.workflowId, session);
      this.notifyGlobal();
    }

    const widget: WidgetInstance = {
      id: event.widgetId,
      type: event.widgetType,
      version: event.widgetVersion,
      lifecycle: event.lifecycle,
      payload: event.payload,
      workflowId: event.workflowId,
      createdAt: event.timestamp,
      updatedAt: event.timestamp,
    };

    session.widgets.push(widget);
    session.updatedAt = event.timestamp;
    this.persist(session);
    this.notify(event.workflowId);
  }

  private handleWidgetUpdated(event: WorkflowUIEvent): void {
    console.log('[WorkflowUIRuntime] handleWidgetUpdated received:', event);
    const session = this.sessions.get(event.workflowId);
    if (!session) {
      console.warn('[WorkflowUIRuntime] Session NOT FOUND in handleWidgetUpdated:', event.workflowId);
      return;
    }

    const widgetIndex = session.widgets.findIndex(w => w.id === event.widgetId);
    if (widgetIndex === -1) {
      console.warn('[WorkflowUIRuntime] Widget NOT FOUND in handleWidgetUpdated:', event.widgetId, 'Available:', session.widgets.map(w => w.id));
      return;
    }

    // Clone the widget to break reference equality for React's memo
    const widget = { ...session.widgets[widgetIndex] };

    // Merge payload (shallow merge for top-level keys)
    if (event.payload && typeof event.payload === 'object') {
      console.log('[WorkflowUIRuntime] Merging payload for', widget.id);
      widget.payload = { ...(widget.payload as object), ...(event.payload as object) };
    }

    console.log(`[WorkflowUIRuntime] Updating widget ${widget.id} lifecycle to ${event.lifecycle}`);
    widget.lifecycle = event.lifecycle;
    widget.updatedAt = event.timestamp;
    
    // Replace in array
    session.widgets[widgetIndex] = widget;
    session.updatedAt = event.timestamp;

    this.persist(session);
    this.notify(event.workflowId);
  }

  private handleWidgetLifecycle(event: WorkflowUIEvent): void {
    const session = this.sessions.get(event.workflowId);
    if (!session) return;

    const widgetIndex = session.widgets.findIndex(w => w.id === event.widgetId);
    if (widgetIndex !== -1) {
      // Clone the widget to break reference equality for React's memo
      const widget = { ...session.widgets[widgetIndex] };
      widget.lifecycle = event.lifecycle;
      widget.updatedAt = event.timestamp;
      session.widgets[widgetIndex] = widget;
    }

    session.updatedAt = event.timestamp;
    this.persist(session);
    this.notify(event.workflowId);
  }

  private handleWidgetAction(event: WorkflowUIEvent): void {
    console.log('[WorkflowUIRuntime] Received WIDGET_ACTION:', event);
    const session = this.sessions.get(event.workflowId);
    if (session) {
      session.lifecycle = 'EXECUTING';
      session.updatedAt = event.timestamp;
    } else {
      console.warn('[WorkflowUIRuntime] Session NOT FOUND for workflowId:', event.workflowId);
    }

    const workflowType = event.workflowId.split('/')[1]?.toUpperCase().replace(/-/g, '_');
    console.log('[WorkflowUIRuntime] Derived workflowType:', workflowType);
    if (workflowType) {
      console.log(`[WorkflowUIRuntime] Publishing ${workflowType}.WIDGET_ACTION`);
      eventBus.publish(`${workflowType}.WIDGET_ACTION`, event.payload as WidgetAction, {
        source: 'WorkflowUIRuntime',
        workflowId: event.workflowId,
      });
    }

    this.notify(event.workflowId);
  }

  private handleWorkflowTerminal(event: WorkflowUIEvent, lifecycle: WorkflowLifecycle): void {
    const session = this.sessions.get(event.workflowId);
    if (!session) return;

    session.lifecycle = lifecycle;
    session.updatedAt = event.timestamp;

    // Transition all non-terminal widgets to ARCHIVED
    session.widgets.forEach(w => {
      if (!['COMPLETED', 'FAILED', 'CANCELLED', 'ARCHIVED'].includes(w.lifecycle)) {
        w.lifecycle = 'ARCHIVED';
        w.updatedAt = event.timestamp;
      }
    });

    this.persist(session);
    this.notify(event.workflowId);
    this.notifyGlobal();
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  getSession(workflowId: string): WorkflowUISession | undefined {
    return this.sessions.get(workflowId);
  }

  getAllSessions(): WorkflowUISession[] {
    return Array.from(this.sessions.values());
  }

  getActiveSessions(): WorkflowUISession[] {
    return this.getAllSessions().filter(
      s => !['COMPLETED', 'CANCELLED', 'ARCHIVED'].includes(s.lifecycle)
    );
  }

  /** Subscribe to session changes for a specific workflowId. Returns unsubscribe fn. */
  subscribe(workflowId: string, callback: () => void): () => void {
    const set = this.listeners.get(workflowId) ?? new Set();
    set.add(callback);
    this.listeners.set(workflowId, set);
    return () => {
      set.delete(callback);
    };
  }

  /** Subscribe to any session list change (used by global workflow tray). */
  subscribeGlobal(callback: () => void): () => void {
    this.globalListeners.add(callback);
    return () => {
      this.globalListeners.delete(callback);
    };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private notify(workflowId: string): void {
    this.listeners.get(workflowId)?.forEach(cb => cb());
  }

  private notifyGlobal(): void {
    this.globalListeners.forEach(cb => cb());
  }

  private persist(session: WorkflowUISession): void {
    this.store.save(session).catch(err => {
      if (import.meta.env.DEV) {
        console.warn('[WorkflowUIRuntime] Persist error:', err);
      }
    });
  }

  private defaultManifest(workflowId: string): WorkflowManifest {
    const type = workflowId.split('/')[1] ?? 'unknown';
    return {
      id: type.toUpperCase().replace(/-/g, '_'),
      version: '1.0',
      name: type.replace(/-/g, ' '),
      widgets: ['progress', 'selection', 'confirmation', 'result'],
      permissions: [],
      resumable: false,
      timeout: 300_000,
      cancellable: true,
    };
  }
}

export const workflowUIRuntime = WorkflowUIRuntime.getInstance();

// ─── Convenience: emit a WORKFLOW_UI_EVENT via eventBus ─────────────────────

/**
 * Helper used by WorkflowCapabilityContracts to emit events.
 * Ensures consistent event shape and timestamp.
 */
export function emitWorkflowUIEvent(
  event: Omit<WorkflowUIEvent, 'timestamp' | 'actor'> & { actor?: 'system' | 'user' }
): void {
  eventBus.publish<WorkflowUIEvent>(
    'WORKFLOW_UI_EVENT',
    {
      ...event,
      actor: event.actor ?? 'system',
      timestamp: Date.now(),
    },
    {
      source: 'WorkflowCapability',
      workflowId: event.workflowId,
    }
  );
}
