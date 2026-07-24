/**
 * CHATR Workflow UI SDK — Core Package Index
 *
 * Import everything from here:
 *   import { workflowUIRuntime, emitWorkflowUIEvent, useWorkflowSession } from '@/core/workflow-ui';
 */

export * from './types';
export { widgetRegistry } from './WidgetRegistry';
export { workflowTimeline } from './WorkflowTimeline';
export { workflowUIRuntime, emitWorkflowUIEvent } from './WorkflowUIRuntime';
export {
  useWorkflowSession,
  useWorkflowTimeline,
  useAllWorkflowSessions,
  useWidgetAction,
  useWidgetInstances,
} from './hooks';
