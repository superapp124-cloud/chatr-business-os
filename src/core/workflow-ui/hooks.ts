/**
 * CHATR Workflow UI SDK — React Hooks
 *
 * useWorkflowSession: Subscribe to widget updates for a workflowId
 * useWorkflowTimeline: Subscribe to timeline entries for a workflowId
 * useAllWorkflowSessions: Subscribe to the full list of active sessions
 */

import { useState, useEffect, useCallback } from 'react';
import { workflowUIRuntime } from './WorkflowUIRuntime';
import { workflowTimeline } from './WorkflowTimeline';
import type { WorkflowUISession, TimelineEntry, WidgetAction, WidgetInstance } from './types';
import { eventBus } from '../runtime/EventBus';

// ─── useWorkflowSession ───────────────────────────────────────────────────────

/**
 * Subscribe to all widget state for a specific workflow session.
 * Re-renders only when the session changes (no polling).
 *
 * @example
 * const session = useWorkflowSession('conv-43/cab-booking');
 * session?.widgets // → WidgetInstance[]
 */
export function useWorkflowSession(workflowId: string | undefined): WorkflowUISession | undefined {
  const [session, setSession] = useState<WorkflowUISession | undefined>();

  useEffect(() => {
    if (!workflowId) return;

    const update = () => {
      const s = workflowUIRuntime.getSession(workflowId);
      // Shallow clone session and widgets array to break React reference equality
      setSession(s ? { ...s, widgets: [...s.widgets] } : undefined);
    };

    update();
    return workflowUIRuntime.subscribe(workflowId, update);
  }, [workflowId]);

  return session;
}

// ─── useWorkflowTimeline ──────────────────────────────────────────────────────

/**
 * Subscribe to the execution timeline for a specific workflow.
 * Returns ordered TimelineEntry[] sorted by timestamp.
 *
 * @example
 * const entries = useWorkflowTimeline('conv-43/cab-booking');
 */
export function useWorkflowTimeline(workflowId: string | undefined): TimelineEntry[] {
  const [entries, setEntries] = useState<TimelineEntry[]>(
    () => workflowId ? workflowTimeline.getEntries(workflowId) : []
  );

  useEffect(() => {
    if (!workflowId) return;

    setEntries(workflowTimeline.getEntries(workflowId));

    const unsub = workflowTimeline.subscribe(workflowId, () => {
      setEntries([...workflowTimeline.getEntries(workflowId)]);
    });

    return unsub;
  }, [workflowId]);

  return entries;
}

// ─── useAllWorkflowSessions ───────────────────────────────────────────────────

/**
 * Subscribe to all active workflow sessions.
 * Used by a global "Workflow Tray" to show running workflows.
 */
export function useAllWorkflowSessions(): WorkflowUISession[] {
  const [sessions, setSessions] = useState<WorkflowUISession[]>(
    () => workflowUIRuntime.getActiveSessions()
  );

  useEffect(() => {
    const unsub = workflowUIRuntime.subscribeGlobal(() => {
      setSessions([...workflowUIRuntime.getActiveSessions()]);
    });
    return unsub;
  }, []);

  return sessions;
}

// ─── useWidgetAction ─────────────────────────────────────────────────────────

/**
 * Returns a stable callback for dispatching widget actions.
 * Used by WorkflowRenderer to pass down to individual widgets.
 *
 * Emits WIDGET_ACTION event via eventBus → WorkflowUIRuntime → re-publishes
 * as "{WORKFLOW_TYPE}.WIDGET_ACTION" for the capability to consume.
 *
 * Rule: Widget → WidgetAction → Kernel Event → Workflow Runtime
 * Never: Widget → Workflow method call
 */
export function useWidgetAction(workflowId: string) {
  return useCallback(
    (action: Omit<WidgetAction, 'timestamp'>) => {
      eventBus.publish(
        'WORKFLOW_UI_EVENT',
        {
          event: 'WIDGET_ACTION' as const,
          workflowId,
          widgetId: action.widgetId,
          widgetType: (workflowUIRuntime
            .getSession(workflowId)
            ?.widgets.find(w => w.id === action.widgetId)?.type) ?? 'action',
          widgetVersion: '1.0',
          lifecycle: 'EXECUTING' as const,
          payload: action,
          actor: 'user' as const,
          timestamp: Date.now(),
        },
        { source: 'WidgetAction', workflowId }
      );
    },
    [workflowId]
  );
}

// ─── useWidgetInstances ───────────────────────────────────────────────────────

/**
 * Convenience hook: returns just the widget instances for a session,
 * filtering to only visible (non-CREATED, non-ARCHIVED) widgets.
 */
export function useWidgetInstances(
  workflowId: string | undefined,
  includeArchived = false
): WidgetInstance[] {
  const session = useWorkflowSession(workflowId);

  if (!session) return [];

  return session.widgets.filter(w => {
    if (w.lifecycle === 'CREATED') return false;
    if (w.lifecycle === 'ARCHIVED') return includeArchived;
    return true;
  });
}
