import React, { useState, useEffect, useCallback } from 'react';
import {
 Activity, CheckCircle, XCircle, Clock, Zap, Shield, Cpu,
 ChevronRight, ChevronDown, RefreshCw, Layers, GitBranch,
 AlertTriangle, BarChart2, Radio, FileText, ArrowRight
} from 'lucide-react';
import { workflowInspectorStore, WorkflowInspectorRecord } from '@/core/runtime/WorkflowInspectorStore';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function durationLabel(ms?: number): string {
 if (!ms) return '—';
 if (ms < 1000) return `${ms}ms`;
 return `${(ms / 1000).toFixed(1)}s`;
}

const domainColors: Record<string, string> = {
 hiring: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
 hr: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
 crm: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
 finance: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
 travel: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
 unknown: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
};

const statusConfig: Record<string, { color: string; icon: React.ElementType }> = {
 RUNNING: { color: 'text-amber-400', icon: Clock },
 COMPLETED: { color: 'text-emerald-400', icon: CheckCircle },
 FAILED: { color: 'text-rose-400', icon: XCircle },
 COMPENSATED: { color: 'text-orange-400', icon: AlertTriangle },
};

// ─────────────────────────────────────────────────────────────
// Workflow Row
// ─────────────────────────────────────────────────────────────
function WorkflowRow({
 record, selected, onSelect
}: { record: WorkflowInspectorRecord; selected: boolean; onSelect: () => void }) {
 const { color: statusColor, icon: StatusIcon } = statusConfig[record.status] ?? statusConfig.RUNNING;
 const domainClass = domainColors[record.type] ?? domainColors.unknown;

 return (
 <button
 onClick={onSelect}
 className={cn(
 'w-full text-left px-4 py-3 flex items-center gap-4 transition-all hover:bg-slate-800/50 border-b border-slate-800/60',
 selected && 'bg-slate-800/70'
 )}
 >
 <StatusIcon className={cn('w-4 h-4 shrink-0', statusColor)} />
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-0.5">
 <span className={cn('text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border', domainClass)}>
 {record.type}
 </span>
 <span className="text-label font-mono text-slate-500 truncate">{record.workflowId.slice(0, 12)}…</span>
 </div>
 <div className="text-[11px] text-slate-500">
 {record.stages.length} stages · {record.events.length} events · {durationLabel(record.durationMs)}
 </div>
 </div>
 {record.compensationCount > 0 && (
 <span className="text-[10px] text-orange-400 font-medium flex items-center gap-1 shrink-0">
 <AlertTriangle className="w-3 h-3" />{record.compensationCount} comp.
 </span>
 )}
 <ChevronRight className={cn('w-3.5 h-3.5 text-slate-600 shrink-0 transition-transform', selected && 'rotate-90')} />
 </button>
 );
}

// ─────────────────────────────────────────────────────────────
// Stage Timeline
// ─────────────────────────────────────────────────────────────
function StageTimeline({ record }: { record: WorkflowInspectorRecord }) {
 return (
 <div className="space-y-1.5">
 {record.stages.map((stage, i) => {
 const { color, icon: Icon } = statusConfig[stage.status] ?? statusConfig.RUNNING;
 return (
 <div key={i} className="flex items-center gap-3">
 <div className="flex flex-col items-center">
 <Icon className={cn('w-3.5 h-3.5', color)} />
 {i < record.stages.length - 1 && <div className="w-px h-4 bg-slate-700 mt-1" />}
 </div>
 <div className="flex-1 flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2">
 <span className="text-secondary text-slate-300">{stage.stageName}</span>
 <div className="flex items-center gap-3">
 {stage.error && (
 <span className="text-[11px] text-rose-400 max-w-xs truncate">{stage.error}</span>
 )}
 <span className="text-[11px] text-slate-500 font-mono">{durationLabel(stage.latencyMs)}</span>
 </div>
 </div>
 </div>
 );
 })}
 </div>
 );
}

// ─────────────────────────────────────────────────────────────
// Event Stream
// ─────────────────────────────────────────────────────────────
function EventStream({ record }: { record: WorkflowInspectorRecord }) {
 return (
 <div className="space-y-1.5 max-h-64 overflow-y-auto">
 {record.events.map((ev, i) => (
 <div key={i} className="flex items-start gap-2 text-label">
 <Radio className="w-3 h-3 text-indigo-400 shrink-0 mt-0.5" />
 <span className="font-medium text-slate-300 shrink-0">{ev.eventType}</span>
 <span className="text-slate-600 ml-auto font-mono shrink-0">
 {new Date(ev.timestamp).toLocaleTimeString()}
 </span>
 </div>
 ))}
 {record.events.length === 0 && <p className="text-label text-slate-600 italic">No events recorded yet.</p>}
 </div>
 );
}

// ─────────────────────────────────────────────────────────────
// Detail Panel
// ─────────────────────────────────────────────────────────────
function DetailPanel({ record }: { record: WorkflowInspectorRecord }) {
 const [tab, setTab] = useState<'stages' | 'events' | 'policies' | 'metrics'>('stages');

 const tabs = [
 { id: 'stages', label: 'Pipeline', icon: GitBranch },
 { id: 'events', label: 'Events', icon: Radio },
 { id: 'policies', label: 'Policies', icon: Shield },
 { id: 'metrics', label: 'Metrics', icon: BarChart2 },
 ] as const;

 const { color: statusColor, icon: StatusIcon } = statusConfig[record.status] ?? statusConfig.RUNNING;

 return (
 <div className="flex flex-col h-full overflow-hidden">
 {/* Header */}
 <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
 <div>
 <div className="flex items-center gap-2 mb-1">
 <StatusIcon className={cn('w-4 h-4', statusColor)} />
 <span className={cn('text-label font-bold uppercase tracking-wider', statusColor)}>{record.status}</span>
 </div>
 <p className="text-[10px] font-mono text-slate-500 break-all">{record.workflowId}</p>
 </div>
 <div className="text-right">
 <p className="text-secondary font-bold text-white">{durationLabel(record.durationMs)}</p>
 <p className="text-[10px] text-slate-500">total duration</p>
 </div>
 </div>

 {/* Quick Stats */}
 <div className="grid grid-cols-4 border-b border-slate-800 shrink-0">
 {[
 { label: 'Stages', value: record.stages.length, icon: Layers },
 { label: 'Events', value: record.events.length, icon: Radio },
 { label: 'Retries', value: record.retryCount, icon: RefreshCw },
 { label: 'Comp.', value: record.compensationCount, icon: AlertTriangle },
 ].map(({ label, value, icon: Icon }) => (
 <div key={label} className="py-3 px-2 flex flex-col items-center border-r border-slate-800 last:border-r-0">
 <Icon className="w-3 h-3 text-slate-500 mb-1" />
 <span className="text-body font-bold text-white">{value}</span>
 <span className="text-[10px] text-slate-500">{label}</span>
 </div>
 ))}
 </div>

 {/* Tabs */}
 <div className="flex border-b border-slate-800 shrink-0">
 {tabs.map(({ id, label, icon: Icon }) => (
 <button key={id} onClick={() => setTab(id as any)}
 className={cn(
 'flex-1 py-2.5 text-label flex items-center justify-center gap-1.5 transition-colors',
 tab === id
 ? 'text-indigo-400 border-b-2 border-indigo-400'
 : 'text-slate-500 hover:text-slate-300'
 )}>
 <Icon className="w-3 h-3" /> {label}
 </button>
 ))}
 </div>

 {/* Tab Content */}
 <div className="flex-1 overflow-y-auto p-4">
 {tab === 'stages' && <StageTimeline record={record} />}

 {tab === 'events' && <EventStream record={record} />}

 {tab === 'policies' && (
 <div className="space-y-2">
 {record.policyEvaluations.length === 0
 ? <p className="text-label text-slate-600 italic">No policy evaluations recorded.</p>
 : record.policyEvaluations.map((p, i) => (
 <div key={i} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/40">
 <div className="flex justify-between text-label mb-1">
 <span className="font-medium text-slate-200">{p.domain} / {p.action}</span>
 <span className={cn('font-bold', p.decision.includes('Reject') ? 'text-rose-400' : 'text-emerald-400')}>
 {p.decision}
 </span>
 </div>
 <p className="text-[11px] text-slate-400">{p.reason}</p>
 </div>
 ))
 }
 </div>
 )}

 {tab === 'metrics' && (
 <div className="space-y-3">
 {[
 { label: 'Started', value: new Date(record.startedAt).toLocaleTimeString() },
 { label: 'Completed', value: record.completedAt ? new Date(record.completedAt).toLocaleTimeString() : '—' },
 { label: 'Total Duration', value: durationLabel(record.durationMs) },
 { label: 'Domain', value: record.type },
 { label: 'Stages Completed', value: `${record.stages.filter(s => s.status === 'COMPLETED').length} / ${record.stages.length}` },
 { label: 'Compensation Events', value: record.compensationCount },
 ].map(({ label, value }) => (
 <div key={label} className="flex justify-between text-secondary border-b border-slate-800 pb-2">
 <span className="text-slate-500">{label}</span>
 <span className="text-slate-200 font-medium">{value}</span>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 );
}

// ─────────────────────────────────────────────────────────────
// Main Workflow Inspector Page
// ─────────────────────────────────────────────────────────────
export const WorkflowInspector: React.FC = () => {
 const [workflows, setWorkflows] = useState<WorkflowInspectorRecord[]>([]);
 const [selectedId, setSelectedId] = useState<string | null>(null);

 useEffect(() => {
 const refresh = () => setWorkflows(workflowInspectorStore.getAllWorkflows());
 refresh();
 const unsub = workflowInspectorStore.subscribe(refresh);
 return unsub;
 }, []);

 const selected = workflows.find(w => w.workflowId === selectedId);

 const summary = {
 running: workflows.filter(w => w.status === 'RUNNING').length,
 completed: workflows.filter(w => w.status === 'COMPLETED').length,
 failed: workflows.filter(w => w.status === 'FAILED').length,
 compensated: workflows.filter(w => w.status === 'COMPENSATED').length,
 };

 return (
 <div className="flex flex-col h-full bg-slate-950 text-slate-200 font-sans">

 {/* Top Bar */}
 <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
 <Activity className="w-4 h-4 text-indigo-400" />
 </div>
 <div>
 <h1 className="text-body font-bold text-white">Workflow Inspector</h1>
 <p className="text-[11px] text-slate-500">Real-time pipeline observability</p>
 </div>
 </div>

 {/* Summary Pills */}
 <div className="flex items-center gap-2">
 {[
 { label: `${summary.running} Running`, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
 { label: `${summary.completed} Completed`, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
 { label: `${summary.failed} Failed`, color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
 { label: `${summary.compensated} Comp.`, color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
 ].map(({ label, color }) => (
 <span key={label} className={cn('text-[10px] font-bold px-2 py-1 rounded-md border', color)}>{label}</span>
 ))}
 <button
 onClick={() => workflowInspectorStore.clear()}
 className="ml-2 flex items-center gap-1.5 text-label text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors border border-slate-700"
 >
 <RefreshCw className="w-3 h-3" /> Clear
 </button>
 </div>
 </div>

 {/* Body: List + Detail */}
 <div className="flex flex-1 overflow-hidden">

 {/* Left: Workflow List */}
 <div className="w-96 shrink-0 border-r border-slate-800 overflow-y-auto">
 {workflows.length === 0 ? (
 <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-3 py-16">
 <Activity className="w-10 h-10 opacity-30" />
 <p className="text-secondary">No workflows detected yet.</p>
 <p className="text-label text-center max-w-xs">
 Trigger any enterprise capability (HR, CRM, Finance, Travel) to see live pipeline execution here.
 </p>
 </div>
 ) : (
 workflows.map(w => (
 <WorkflowRow
 key={w.workflowId}
 record={w}
 selected={selectedId === w.workflowId}
 onSelect={() => setSelectedId(w.workflowId)}
 />
 ))
 )}
 </div>

 {/* Right: Detail Panel */}
 <div className="flex-1 overflow-hidden bg-slate-900">
 {selected ? (
 <DetailPanel record={selected} />
 ) : (
 <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-3">
 <Layers className="w-10 h-10 opacity-30" />
 <p className="text-secondary">Select a workflow to inspect.</p>
 </div>
 )}
 </div>
 </div>
 </div>
 );
};

export default WorkflowInspector;
