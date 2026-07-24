import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Clock, StopCircle } from 'lucide-react';
import {
 type WidgetProps,
 type ProgressWidgetPayload,
} from '@/core/workflow-ui';
import { cn } from '@/lib/utils';
import { WidgetShell } from '../primitives/WidgetShell';
import { StepList } from '../primitives/StepList';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Formats estimated ms into a human-readable string, e.g. "30–45 sec"
 * Falls back to a generic label when not provided.
 */
function formatEstimate(ms?: number): string {
 if (!ms) return '30–45 sec';
 const sec = Math.round(ms / 1000);
 if (sec < 60) return `${sec} sec`;
 const min = Math.floor(sec / 60);
 const rem = sec % 60;
 return rem === 0 ? `${min} min` : `${min}m ${rem}s`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ProgressWidget: React.FC<WidgetProps> = ({
 instance,
 workflowId,
 onAction,
}) => {
 const payload = instance.payload as ProgressWidgetPayload;
 const { steps, title, subtitle, estimatedMs, showSecureExecution } = payload;

 const isActionable =
 instance.lifecycle === 'WAITING_USER' || instance.lifecycle === 'EXECUTING';

 const handleStop = () => {
 onAction({
 widgetId: instance.id,
 workflowId,
 action: 'CANCEL',
 data: { reason: 'user_stopped' },
 });
 };

 return (
 <WidgetShell
 title={title ?? 'Running Task'}
 subtitle={subtitle}
 lifecycle={instance.lifecycle}
 collapsible={false}
 >
 {/* ── Inner card content ── */}
 <div className="px-4 pt-3 pb-4 flex flex-col gap-4">

 {/* ── Sub-header: workflow info + estimate ── */}
 <div className="flex items-center justify-between">
 <span className="text-label text-white/50 ">
 {title ?? 'Automating steps'}
 </span>
 <div className="flex items-center gap-1 text-white/30">
 <Clock className="h-3 w-3" aria-hidden="true" />
 <span className="text-[11px]">
 Est. time: {formatEstimate(estimatedMs)}
 </span>
 </div>
 </div>

 {/* ── Steps ── */}
 {steps && steps.length > 0 && (
 <StepList steps={steps} />
 )}

 {/* ── Secure execution footer ── */}
 {showSecureExecution && (
 <motion.div
 initial={{ opacity: 0, y: 4 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.15, duration: 0.25 }}
 className={cn(
 'flex items-start gap-2 rounded-xl px-3 py-2.5',
 'bg-emerald-950/40 border border-emerald-800/30',
 )}
 >
 <Shield
 className="h-3.5 w-3.5 text-emerald-400 mt-px shrink-0"
 aria-hidden="true"
 />
 <p className="text-[11px] text-emerald-300/80 leading-snug">
 All actions performed on your device. No data sent to any server.{' '}
 <button
 className="underline underline-offset-2 text-emerald-300 hover:text-emerald-200 transition-colors"
 onClick={() =>
 onAction({
 widgetId: instance.id,
 workflowId,
 action: 'LEARN_MORE',
 data: { context: 'secure_execution' },
 })
 }
 >
 Learn more
 </button>
 </p>
 </motion.div>
 )}

 {/* ── Stop Task button ── */}
 {isActionable && (
 <motion.button
 initial={{ opacity: 0, y: 6 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: 6 }}
 transition={{ duration: 0.22, ease: 'easeOut' }}
 onClick={handleStop}
 className={cn(
 'flex items-center justify-center gap-2 w-full',
 'rounded-2xl px-4 py-2.5',
 'bg-red-950/50 border border-red-700/40',
 'text-red-400 text-secondary font-semibold',
 'hover:bg-red-900/60 hover:border-red-600/60 hover:text-red-300',
 'active:scale-[0.98] transition-all duration-150',
 'focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60',
 )}
 aria-label="Stop the current task"
 >
 <StopCircle className="h-4 w-4" aria-hidden="true" />
 Stop Task
 </motion.button>
 )}
 </div>
 </WidgetShell>
 );
};

export default ProgressWidget;
