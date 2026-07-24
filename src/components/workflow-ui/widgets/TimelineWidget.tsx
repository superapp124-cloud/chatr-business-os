/**
 * TimelineWidget — Workflow Audit Log
 *
 * Renders the full chronological history of a workflow.
 * Subscribes directly to workflowTimeline (reactive, no polling).
 * Acts as the "audit log" — shows every step the AI took.
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { History, CheckCircle2, Circle, AlertCircle, User, Cpu } from 'lucide-react';
import { workflowTimeline } from '@/core/workflow-ui/WorkflowTimeline';
import type { WidgetProps, TimelineEntry } from '@/core/workflow-ui/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatElapsed(ms: number): string {
 if (ms < 1000) return `${ms}ms`;
 return `${(ms / 1000).toFixed(1)}s`;
}

function formatTimestamp(ts: number): string {
 return new Date(ts).toLocaleTimeString('en-IN', {
 hour: '2-digit',
 minute: '2-digit',
 second: '2-digit',
 hour12: false,
 });
}

// ─── Entry Row ────────────────────────────────────────────────────────────────

function EntryRow({ entry, isLast }: { entry: TimelineEntry; isLast: boolean }) {
 const isActive = entry.lifecycle === 'ACTIVE' || entry.lifecycle === 'WAITING_USER' || entry.lifecycle === 'EXECUTING';
 const isFailed = entry.lifecycle === 'FAILED' || entry.lifecycle === 'CANCELLED';

 return (
 <motion.div
 initial={{ opacity: 0, y: 6 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.25 }}
 className="flex gap-2.5 relative"
 >
 {/* Vertical connector line */}
 {!isLast && (
 <div className="absolute left-[6px] top-5 bottom-0 w-px bg-white/[0.06]" />
 )}

 {/* Status icon */}
 <div className="mt-0.5 shrink-0 z-10">
 {isFailed ? (
 <AlertCircle className="w-3.5 h-3.5 text-red-400" />
 ) : isActive ? (
 <Circle className="w-3.5 h-3.5 text-violet-400 fill-violet-400/30" />
 ) : (
 <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400/70" />
 )}
 </div>

 {/* Content */}
 <div className="flex-1 pb-3">
 <div className="flex items-start justify-between gap-2">
 <span
 className={`text-[11px] leading-tight ${
 isActive ? 'text-white/90 font-medium' : 'text-white/55'
 }`}
 >
 {entry.label}
 </span>

 <div className="flex items-center gap-1.5 shrink-0">
 {/* Actor badge */}
 {entry.actor === 'user' ? (
 <User className="w-2.5 h-2.5 text-violet-400/60" />
 ) : (
 <Cpu className="w-2.5 h-2.5 text-blue-400/60" />
 )}

 <span className="text-[9px] font-mono text-white/25">
 {formatTimestamp(entry.timestamp)}
 </span>
 </div>
 </div>

 {/* Elapsed time */}
 {entry.elapsed > 0 && (
 <span className="text-[9px] text-white/25 font-mono">
 +{formatElapsed(entry.elapsed)}
 </span>
 )}
 </div>
 </motion.div>
 );
}

// ─── TimelineWidget ───────────────────────────────────────────────────────────

export function TimelineWidget({ instance }: WidgetProps) {
 const [entries, setEntries] = useState<TimelineEntry[]>(() =>
 workflowTimeline.getEntries(instance.workflowId)
 );
 const [collapsed, setCollapsed] = useState(true);

 // Subscribe to live timeline updates
 useEffect(() => {
 const update = () => {
 setEntries([...workflowTimeline.getEntries(instance.workflowId)]);
 };
 update();
 const unsubscribe = workflowTimeline.subscribe(instance.workflowId, update);
 return () => {
 if (typeof unsubscribe === 'function') {
 unsubscribe();
 }
 };
 }, [instance.workflowId]);

 // Filter out noise — only show meaningful milestones
 const milestones = entries.filter(e =>
 ['WIDGET_CREATED', 'WIDGET_ACTION', 'WORKFLOW_STARTED', 'WORKFLOW_COMPLETED'].includes(e.event)
 );

 const visibleEntries = collapsed ? milestones.slice(-4) : milestones;
 const hiddenCount = milestones.length - 4;

 return (
 <div className="rounded-xl border border-white/[0.06] bg-black/20 overflow-hidden">
 {/* Header */}
 <button
 onClick={() => setCollapsed(v => !v)}
 className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.03] transition-colors"
 >
 <History className="w-3.5 h-3.5 text-white/40 shrink-0" />
 <span className="text-[11px] text-white/50 flex-1 text-left">
 Workflow Timeline
 </span>
 <span className="text-[10px] text-white/25 font-mono">
 {milestones.length} events
 </span>
 {collapsed && hiddenCount > 0 && (
 <span className="text-[10px] text-violet-400/60 ml-1">
 +{hiddenCount} more
 </span>
 )}
 </button>

 {/* Entries */}
 <div className="px-3 pb-2">
 {visibleEntries.length === 0 ? (
 <p className="text-[10px] text-white/25 py-2">No events yet</p>
 ) : (
 <div className="space-y-0">
 {visibleEntries.map((entry, i) => (
 <EntryRow
 key={entry.id}
 entry={entry}
 isLast={i === visibleEntries.length - 1}
 />
 ))}
 </div>
 )}

 {collapsed && hiddenCount > 0 && (
 <button
 onClick={() => setCollapsed(false)}
 className="text-[10px] text-violet-400/70 hover:text-violet-400 transition-colors mt-1"
 >
 Show all {milestones.length} events
 </button>
 )}
 </div>
 </div>
 );
}
