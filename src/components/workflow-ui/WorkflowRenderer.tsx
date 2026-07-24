/**
 * WorkflowRenderer — Renders the widget stack for a workflow session.
 *
 * Subscribes to a workflowId via useWorkflowSession.
 * Resolves each widget component from WidgetRegistry.
 * Passes onAction (→ Kernel) down to every widget.
 * Supports nested child workflows (indented rendering).
 *
 * This is the ONLY place that imports widget components (via registry).
 * AIChat.tsx renders: <WorkflowRenderer workflowId={message.workflowId} />
 */

import { memo, forwardRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { widgetRegistry } from '@/core/workflow-ui/WidgetRegistry';
import {
 useWorkflowSession,
 useWidgetAction,
 useWidgetInstances,
} from '@/core/workflow-ui/hooks';
import type { WidgetInstance } from '@/core/workflow-ui';
import { workflowUIRuntime } from '@/core/workflow-ui/WorkflowUIRuntime';

// ─── Single Widget Renderer ───────────────────────────────────────────────────

const SingleWidget = memo(forwardRef<HTMLDivElement, {
 instance: WidgetInstance;
 workflowId: string;
 onAction: ReturnType<typeof useWidgetAction>;
}>(function SingleWidget({ instance, workflowId, onAction }, ref) {
 const Component = widgetRegistry.resolve(instance.type, instance.version);

 if (!Component) {
 if (import.meta.env.DEV) {
 console.warn(`[WorkflowRenderer] No component registered for widget type "${instance.type}@${instance.version}"`);
 }
 return null;
 }

 return (
 <motion.div
 ref={ref}
 key={instance.id}
 layout
 initial={{ opacity: 0, y: 12, scale: 0.98 }}
 animate={{ opacity: 1, y: 0, scale: 1 }}
 exit={{ opacity: 0, y: -8, scale: 0.97 }}
 transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
 className="w-full"
 >
 <Component
 instance={instance}
 workflowId={workflowId}
 onAction={onAction}
 />
 </motion.div>
 );
}));

// ─── Nested Child Workflows ───────────────────────────────────────────────────

function ChildWorkflows({ parentWorkflowId }: { parentWorkflowId: string }) {
 // Find sessions that have this workflowId as parent
 const childSessions = workflowUIRuntime
 .getAllSessions()
 .filter(s => s.parentWorkflowId === parentWorkflowId);

 if (childSessions.length === 0) return null;

 return (
 <div className="ml-4 pl-3 border-l border-white/[0.06] space-y-3 mt-3">
 {childSessions.map(child => (
 <WorkflowRenderer key={child.workflowId} workflowId={child.workflowId} nested />
 ))}
 </div>
 );
}

// ─── WorkflowRenderer ─────────────────────────────────────────────────────────

interface WorkflowRendererProps {
 workflowId: string;
 /** When true, renders with reduced padding (nested child workflow). */
 nested?: boolean;
}

export const WorkflowRenderer = memo(function WorkflowRenderer({
 workflowId,
 nested = false,
}: WorkflowRendererProps) {
 const session = useWorkflowSession(workflowId);
 const widgets = useWidgetInstances(workflowId);
 const onAction = useWidgetAction(workflowId);

 // Don't render anything until the session is known
 if (!session) return null;

 return (
 <div className={nested ? 'space-y-2' : 'space-y-3 mt-2'}>
 <AnimatePresence mode="popLayout" initial={false}>
 {widgets.map(instance => (
 <SingleWidget
 key={instance.id}
 instance={instance}
 workflowId={workflowId}
 onAction={onAction}
 />
 ))}
 </AnimatePresence>

 {/* Nested child workflows (e.g. Trip Booking → Flight → Hotel → Cab) */}
 {session.manifest.supportsNestedWorkflows && (
 <ChildWorkflows parentWorkflowId={workflowId} />
 )}
 </div>
 );
});

export default WorkflowRenderer;
