/**
 * ExecutionConsoleWidget — AI Execution Transparency Panel
 *
 * Shows each phase of the workflow with per-phase latency and status.
 * This is CHATR's "trust layer" — enterprise users see exactly what
 * the AI is doing and how long each step takes.
 *
 * Collapsible by default. Expands on click.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Zap, CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react';
import type { WidgetProps, ExecutionConsoleWidgetPayload, ExecutionPhase, ExecutionPhaseStatus } from '@/core/workflow-ui/types';

// ─── Phase Status Icon ─────────────────────────────────────────────────────────

function PhaseIcon({ status }: { status: ExecutionPhaseStatus }) {
 switch (status) {
 case 'completed':
 return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
 case 'running':
 return <Loader2 className="w-3.5 h-3.5 text-violet-400 shrink-0 animate-spin" />;
 case 'failed':
 return <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />;
 default:
 return <Clock className="w-3.5 h-3.5 text-white/20 shrink-0" />;
 }
}

// ─── Phase Row ────────────────────────────────────────────────────────────────

function PhaseRow({ phase }: { phase: ExecutionPhase }) {
 return (
 <motion.div
 initial={{ opacity: 0, x: -8 }}
 animate={{ opacity: 1, x: 0 }}
 className="flex items-center gap-2.5 py-1"
 >
 <PhaseIcon status={phase.status} />

 <span
 className={`text-[11px] flex-1 leading-tight ${
 phase.status === 'pending'
 ? 'text-white/30'
 : phase.status === 'running'
 ? 'text-violet-200'
 : phase.status === 'completed'
 ? 'text-white/80'
 : 'text-red-300'
 }`}
 >
 {phase.label}
 {phase.detail && (
 <span className="ml-1 text-white/40">· {phase.detail}</span>
 )}
 </span>

 {phase.latencyMs !== undefined && (
 <span className="text-[10px] font-mono text-white/30 shrink-0">
 {phase.latencyMs}ms
 </span>
 )}

 {phase.status === 'running' && (
 <span className="text-[10px] text-violet-400 shrink-0 animate-pulse">
 Running
 </span>
 )}
 </motion.div>
 );
}

// ─── AI Mode Badge ─────────────────────────────────────────────────────────────

function AiModeBadge({ mode }: { mode: 'local' | 'cloud' | 'hybrid' }) {
 return (
 <div className="flex items-center gap-3 pt-2 mt-2 border-t border-white/[0.06]">
 <div className="flex items-center gap-1.5">
 <div
 className={`w-1.5 h-1.5 rounded-full ${
 mode === 'local' || mode === 'hybrid' ? 'bg-emerald-400' : 'bg-white/20'
 }`}
 />
 <span className="text-[10px] text-white/50">Local AI</span>
 {(mode === 'local' || mode === 'hybrid') && (
 <CheckCircle2 className="w-3 h-3 text-emerald-400" />
 )}
 </div>
 <div className="flex items-center gap-1.5">
 <div
 className={`w-1.5 h-1.5 rounded-full ${
 mode === 'cloud' || mode === 'hybrid' ? 'bg-blue-400' : 'bg-white/20'
 }`}
 />
 <span className="text-[10px] text-white/50">Cloud AI</span>
 {(mode === 'cloud' || mode === 'hybrid') ? (
 <CheckCircle2 className="w-3 h-3 text-blue-400" />
 ) : (
 <XCircle className="w-3 h-3 text-white/20" />
 )}
 </div>
 </div>
 );
}

// ─── ExecutionConsoleWidget ────────────────────────────────────────────────────

export function ExecutionConsoleWidget({ instance }: WidgetProps) {
 const payload = instance.payload as ExecutionConsoleWidgetPayload;
 const [expanded, setExpanded] = useState(payload.expanded ?? false);

 const phases = payload?.phases || [];
 const completedPhases = phases.filter(p => p.status === 'completed').length;
 const totalPhases = phases.length;
 const runningPhase = phases.find(p => p.status === 'running');
 const totalLatency = phases.reduce((acc, p) => acc + (p.latencyMs ?? 0), 0);

 return (
 <div className="rounded-xl border border-violet-500/20 bg-violet-950/20 overflow-hidden">
 {/* Header — always visible */}
 <button
 onClick={() => setExpanded(v => !v)}
 className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/[0.03] transition-colors"
 >
 <div className="flex items-center justify-center w-5 h-5 rounded-md bg-violet-500/20">
 <Zap className="w-3 h-3 text-violet-400" />
 </div>

 <div className="flex-1 text-left">
 <span className="text-[11px] font-medium text-violet-200">CHATR Brain</span>
 {!expanded && (
 <span className="ml-2 text-[10px] text-white/40">
 {runningPhase
 ? `${runningPhase.label}...`
 : `${completedPhases}/${totalPhases} phases · ${totalLatency}ms`}
 </span>
 )}
 </div>

 {/* Progress dots */}
 <div className="flex gap-0.5 mr-1">
 {phases.map(p => (
 <div
 key={p.id}
 className={`w-1 h-1 rounded-full transition-colors ${
 p.status === 'completed'
 ? 'bg-emerald-400'
 : p.status === 'running'
 ? 'bg-violet-400 animate-pulse'
 : p.status === 'failed'
 ? 'bg-red-400'
 : 'bg-white/15'
 }`}
 />
 ))}
 </div>

 {expanded ? (
 <ChevronUp className="w-3.5 h-3.5 text-white/30" />
 ) : (
 <ChevronDown className="w-3.5 h-3.5 text-white/30" />
 )}
 </button>

 {/* Expanded content */}
 <AnimatePresence>
 {expanded && (
 <motion.div
 initial={{ height: 0, opacity: 0 }}
 animate={{ height: 'auto', opacity: 1 }}
 exit={{ height: 0, opacity: 0 }}
 transition={{ duration: 0.2, ease: 'easeInOut' }}
 className="overflow-hidden"
 >
 <div className="px-3 pb-3 space-y-0.5">
 {phases.map(phase => (
 <PhaseRow key={phase.id} phase={phase} />
 ))}
 <AiModeBadge mode={payload?.aiMode || 'local'} />
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 );
}
