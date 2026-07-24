/**
 * WorkflowTimelinePanel — Execution audit log UI.
 *
 * Shows every event in a workflow's execution timeline with timestamps,
 * elapsed times, actor indicators, and lifecycle state badges.
 *
 * Used in: developer mode, enterprise audit view, workflow debugging.
 * Toggle visibility — collapsed by default in production.
 */

import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, ChevronDown, ChevronUp, User, Cpu, CheckCircle2, XCircle, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkflowTimeline } from '@/core/workflow-ui/hooks';
import type { TimelineEntry } from '@/core/workflow-ui';

function formatElapsed(ms: number): string {
 if (ms < 1000) return `${ms}ms`;
 const s = (ms / 1000).toFixed(1);
 return `${s}s`;
}

function formatTimestamp(ts: number): string {
 return new Date(ts).toLocaleTimeString('en-IN', {
 hour: '2-digit',
 minute: '2-digit',
 second: '2-digit',
 hour12: false,
 });
}

const LIFECYCLE_DOT: Record<string, string> = {
 CREATED: 'bg-white/30',
 ACTIVE: 'bg-blue-400',
 WAITING_USER: 'bg-violet-400 animate-pulse',
 EXECUTING: 'bg-amber-400 animate-pulse',
 COMPLETED: 'bg-emerald-400',
 FAILED: 'bg-red-400',
 CANCELLED: 'bg-white/20',
 ARCHIVED: 'bg-white/15',
};

const TimelineRow = memo(function TimelineRow({ entry }: { entry: TimelineEntry }) {
 const dot = LIFECYCLE_DOT[entry.lifecycle] ?? 'bg-white/20';

 return (
 <motion.div
 initial={{ opacity: 0, x: -8 }}
 animate={{ opacity: 1, x: 0 }}
 transition={{ duration: 0.2 }}
 className="flex items-start gap-3 py-1.5"
 >
 {/* Dot */}
 <div className="flex flex-col items-center shrink-0 mt-1">
 <span className={cn('h-2 w-2 rounded-full shrink-0', dot)} />
 </div>

 {/* Content */}
 <div className="flex-1 min-w-0">
 <div className="flex items-baseline gap-2 flex-wrap">
 <span className="text-[12px] font-medium text-white/80 leading-snug">{entry.label}</span>
 <span className="text-[10px] text-white/25 font-mono">{entry.event}</span>
 </div>
 <div className="flex items-center gap-2 mt-0.5">
 {entry.actor === 'user' ? (
 <User className="h-2.5 w-2.5 text-violet-400/70" />
 ) : (
 <Cpu className="h-2.5 w-2.5 text-blue-400/70" />
 )}
 <span className="text-[10px] text-white/25">{formatTimestamp(entry.timestamp)}</span>
 <span className="text-[10px] text-white/20">+{formatElapsed(entry.elapsed)}</span>
 </div>
 </div>

 {/* Lifecycle badge */}
 <span className="text-[9px] font-bold uppercase tracking-wide text-white/20 shrink-0 mt-1">
 {entry.lifecycle}
 </span>
 </motion.div>
 );
});

interface WorkflowTimelinePanelProps {
 workflowId: string;
 defaultExpanded?: boolean;
 className?: string;
}

export const WorkflowTimelinePanel = memo(function WorkflowTimelinePanel({
 workflowId,
 defaultExpanded = false,
 className,
}: WorkflowTimelinePanelProps) {
 const [expanded, setExpanded] = useState(defaultExpanded);
 const entries = useWorkflowTimeline(workflowId);

 const completed = entries.filter(e => e.lifecycle === 'COMPLETED').length;
 const failed = entries.filter(e => e.lifecycle === 'FAILED').length;

 return (
 <div className={cn('rounded-2xl border border-white/[0.05] bg-white/[0.02] overflow-hidden', className)}>
 {/* Header */}
 <button
 onClick={() => setExpanded(v => !v)}
 className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/[0.03] transition-colors"
 >
 <div className="flex items-center gap-2">
 <Clock className="h-3.5 w-3.5 text-white/30" />
 <span className="text-[11px] font-bold text-white/40 uppercase tracking-wide">
 Execution Timeline
 </span>
 <span className="text-[10px] text-white/20">{entries.length} events</span>
 </div>
 <div className="flex items-center gap-2">
 {completed > 0 && (
 <span className="flex items-center gap-1 text-[10px] text-emerald-400/60">
 <CheckCircle2 className="h-3 w-3" />{completed}
 </span>
 )}
 {failed > 0 && (
 <span className="flex items-center gap-1 text-[10px] text-red-400/60">
 <XCircle className="h-3 w-3" />{failed}
 </span>
 )}
 {expanded
 ? <ChevronUp className="h-3.5 w-3.5 text-white/20" />
 : <ChevronDown className="h-3.5 w-3.5 text-white/20" />}
 </div>
 </button>

 {/* Timeline entries */}
 <AnimatePresence initial={false}>
 {expanded && (
 <motion.div
 initial={{ height: 0, opacity: 0 }}
 animate={{ height: 'auto', opacity: 1 }}
 exit={{ height: 0, opacity: 0 }}
 transition={{ duration: 0.25, ease: 'easeInOut' }}
 className="overflow-hidden"
 >
 <div className="px-3 pb-3 divide-y divide-white/[0.04] max-h-64 overflow-y-auto">
 {entries.length === 0 ? (
 <div className="flex items-center gap-2 py-3 text-white/20">
 <Zap className="h-3.5 w-3.5" />
 <span className="text-[11px]">No events yet</span>
 </div>
 ) : (
 entries.map(entry => (
 <TimelineRow key={entry.id} entry={entry} />
 ))
 )}
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 );
});

export default WorkflowTimelinePanel;
