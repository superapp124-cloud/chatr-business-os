/**
 * CHATR Workflow UI SDK — Component Package Index
 *
 * Barrel export + auto-registration of all built-in widgets into WidgetRegistry.
 *
 * Import pattern:
 *   import { WorkflowRenderer, WorkflowTimelinePanel } from '@/components/workflow-ui';
 *
 * Auto-registration runs once when this module is first imported.
 * After this, widgetRegistry.resolve('progress') returns ProgressWidget, etc.
 */

import { widgetRegistry } from '@/core/workflow-ui/WidgetRegistry';

// ─── Widget Imports ───────────────────────────────────────────────────────────

import ProgressWidget from './widgets/ProgressWidget';
import SelectionWidget from './widgets/SelectionWidget';
import ConfirmationWidget from './widgets/ConfirmationWidget';
import TrackingWidget from './widgets/TrackingWidget';
import ApprovalWidget from './widgets/ApprovalWidget';
import PaymentWidget from './widgets/PaymentWidget';
import ResultWidget from './widgets/ResultWidget';
import FormWidget from './widgets/FormWidget';
import ActionWidget from './widgets/ActionWidget';
import RoutePickerWidget from './widgets/RoutePickerWidget';
import { ExecutionConsoleWidget } from './widgets/ExecutionConsoleWidget';
import { TimelineWidget } from './widgets/TimelineWidget';
import { MeetingTrackingWidget } from './widgets/MeetingTrackingWidget';
import { ExtractionProgressWidget } from './widgets/ExtractionProgressWidget';
import { ATSResultWidget } from './widgets/ATSResultWidget';
import { DocumentPreviewWidget } from './widgets/DocumentPreviewWidget';

// ─── Auto-Registration ────────────────────────────────────────────────────────

widgetRegistry.register('progress',          ProgressWidget,         '1.0');
widgetRegistry.register('selection',         SelectionWidget,        '1.0');
widgetRegistry.register('confirmation',      ConfirmationWidget,     '1.0');
widgetRegistry.register('tracking',          TrackingWidget,         '1.0');
widgetRegistry.register('route_picker',      RoutePickerWidget,      '1.0');
widgetRegistry.register('approval',          ApprovalWidget,         '1.0');
widgetRegistry.register('payment',           PaymentWidget,          '1.0');
widgetRegistry.register('result',            ResultWidget,           '1.0');
widgetRegistry.register('form',              FormWidget,             '1.0');
widgetRegistry.register('action',            ActionWidget,           '1.0');
widgetRegistry.register('execution_console', ExecutionConsoleWidget, '1.0');
widgetRegistry.register('timeline',          TimelineWidget,         '1.0');
widgetRegistry.register('meeting_tracking',  MeetingTrackingWidget as any, '1.0');
widgetRegistry.register('extraction_progress', ExtractionProgressWidget as any, '1.0');
widgetRegistry.register('ATSResultWidget',     ATSResultWidget as any, '1.0');
widgetRegistry.register('DocumentPreviewWidget', DocumentPreviewWidget as any, '1.0');

// ─── Public Exports ───────────────────────────────────────────────────────────

export { WorkflowRenderer } from './WorkflowRenderer';
export { WorkflowTimelinePanel } from './WorkflowTimelinePanel';

// Primitives (for use in custom widgets)
export { default as WidgetShell } from './primitives/WidgetShell';
export { default as LifecycleBadge } from './primitives/LifecycleBadge';
export { default as StepList } from './primitives/StepList';

// Widgets (for direct import if needed)
export { default as ProgressWidget } from './widgets/ProgressWidget';
export { default as SelectionWidget } from './widgets/SelectionWidget';
export { default as ConfirmationWidget } from './widgets/ConfirmationWidget';
export { default as TrackingWidget } from './widgets/TrackingWidget';
export { default as ApprovalWidget } from './widgets/ApprovalWidget';
export { default as PaymentWidget } from './widgets/PaymentWidget';
export { default as ResultWidget } from './widgets/ResultWidget';
export { default as FormWidget } from './widgets/FormWidget';
export { default as ActionWidget } from './widgets/ActionWidget';
