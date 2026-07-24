import React, { useState, useEffect } from 'react';
import { Commitment } from '../../core/capabilities/types';
import { osScheduler, ScheduleEntry } from '../../core/services/OSSchedulerService';
import { eventBus } from '@/core/runtime/EventBus';
import { telemetry } from '../../core/services/TelemetryService';
import {
 AlertTriangle, Activity, Clock, Calendar, CheckCircle2,
 Bell, Users, FileText, Phone, Mail, Briefcase, DollarSign,
 ChevronRight, Undo2, Star, BarChart2
} from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '@/lib/utils';

interface OutcomeCenterProps {
 outcomes: Commitment[];
}

const CAPABILITY_META: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
 'core.reminder': { icon: <Bell className="w-3.5 h-3.5" />, color: 'text-violet-400', label: 'Reminder' },
 'core.meeting': { icon: <Users className="w-3.5 h-3.5" />, color: 'text-blue-400', label: 'Meeting' },
 'core.calendar_event': { icon: <Calendar className="w-3.5 h-3.5" />, color: 'text-indigo-400', label: 'Event' },
 'core.task': { icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: 'text-emerald-400', label: 'Task' },
 'core.note': { icon: <FileText className="w-3.5 h-3.5" />, color: 'text-amber-400', label: 'Note' },
 'core.document': { icon: <FileText className="w-3.5 h-3.5" />, color: 'text-orange-400', label: 'Document' },
 'core.call': { icon: <Phone className="w-3.5 h-3.5" />, color: 'text-green-400', label: 'Call' },
 'core.email': { icon: <Mail className="w-3.5 h-3.5" />, color: 'text-cyan-400', label: 'Email' },
 'core.candidate_interview': { icon: <Briefcase className="w-3.5 h-3.5" />, color: 'text-pink-400', label: 'Interview' },
 'core.expense': { icon: <DollarSign className="w-3.5 h-3.5" />,color: 'text-lime-400', label: 'Expense' },
};

function getMeta(capability: string) {
 return CAPABILITY_META[capability] || {
 icon: <Star className="w-3.5 h-3.5" />,
 color: 'text-white/50',
 label: capability.split('.').pop() || 'Action'
 };
}

interface CommitmentCardProps {
 commitment: Commitment;
 onUndo?: (id: string) => void;
}

const CommitmentCard: React.FC<CommitmentCardProps> = ({ commitment, onUndo }) => {
 const meta = getMeta(commitment.capability);
 const isCompleted = commitment.status === 'completed' || commitment.status === 'reality_verified';
 const isError = commitment.status === 'canceled';

 return (
 <div className={cn(
 'group rounded-xl border p-3 transition-all duration-200 hover:translate-x-0.5',
 isCompleted
 ? 'bg-emerald-950/20 border-emerald-500/15'
 : isError
 ? 'bg-red-950/20 border-red-500/15'
 : 'bg-white/[0.02] border-white/[0.05] hover:border-white/[0.10]'
 )}>
 <div className="flex items-start gap-3">
 <div className={cn('p-1.5 rounded-lg shrink-0 mt-0.5', isCompleted ? 'bg-emerald-500/15' : 'bg-white/[0.05]', meta.color)}>
 {meta.icon}
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-[12px] font-semibold text-white/90 truncate">{commitment.title}</p>
 <div className="flex items-center gap-2 mt-1">
 <span className={cn('text-[9px] font-bold uppercase tracking-widest', meta.color)}>{meta.label}</span>
 <span className="text-[9px] text-white/25">·</span>
 <span className="text-[9px] text-white/30 capitalize">{commitment.status.replace(/_/g, ' ')}</span>
 </div>
 </div>
 {isCompleted && onUndo && (
 <button
 onClick={() => onUndo(commitment.id)}
 className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-white/10 text-white/30 hover:text-white/60"
 title="Undo"
 >
 <Undo2 className="w-3 h-3" />
 </button>
 )}
 </div>
 </div>
 );
};

interface SectionProps {
 title: string;
 emoji: string;
 count: number;
 accentClass: string;
 children: React.ReactNode;
 defaultOpen?: boolean;
}

const Section: React.FC<SectionProps> = ({ title, emoji, count, accentClass, children, defaultOpen = true }) => {
 const [open, setOpen] = useState(defaultOpen);
 if (count === 0) return null;

 return (
 <div className="mb-4">
 <button
 onClick={() => setOpen(o => !o)}
 className="w-full flex items-center gap-2 px-1 py-1.5 rounded-lg hover:bg-white/[0.03] transition-colors group mb-2"
 >
 <span className="text-label">{emoji}</span>
 <span className={cn('text-[10px] font-bold uppercase tracking-widest', accentClass)}>{title}</span>
 <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full font-bold ml-auto', `${accentClass.replace('text-', 'bg-').replace('400', '500/20')} ${accentClass}`)}>
 {count}
 </span>
 <ChevronRight className={cn('w-3 h-3 text-white/20 transition-transform', open && 'rotate-90')} />
 </button>
 {open && <div className="space-y-1.5">{children}</div>}
 </div>
 );
};

export const OutcomeCenter: React.FC<OutcomeCenterProps> = ({ outcomes }) => {
 const [scheduledEntries, setScheduledEntries] = useState<ScheduleEntry[]>([]);
 const [activeTab, setActiveTab] = useState<'outcomes' | 'telemetry'>('outcomes');

 useEffect(() => {
 const load = () => setScheduledEntries(osScheduler.getAll());
 load();
 window.addEventListener('chatr:outcome-executed', load);
 window.addEventListener('chatr:notification-delivered', load);
 return () => {
 window.removeEventListener('chatr:outcome-executed', load);
 window.removeEventListener('chatr:notification-delivered', load);
 };
 }, []);

 // Groups
 const needsAttention = outcomes.filter(o => ['needs_input', 'searching', 'results_ready'].includes(o.status));
 const inProgress = outcomes.filter(o => ['extracting', 'executing', 'waiting', 'preview_ready', 'confirmed'].includes(o.status));
 const todayItems = outcomes.filter(o => o.status === 'suggested');
 const completed = outcomes.filter(o => o.status === 'completed' || o.status === 'reality_verified');

 const handleUndo = (commitmentId: string) => {
 eventBus.publish('chatr:commitment-state-changed', { id: commitmentId, status: 'canceled' }, 'OutcomeCenter');
 osScheduler.cancel(commitmentId);
 };

 const stats = telemetry.getStats();
 const schedulerStats = osScheduler.getStats();

 const isEmpty = outcomes.length === 0 && scheduledEntries.length === 0;

 return (
 <div className="flex flex-col h-full">
 {/* Tabs */}
 <div className="flex gap-1 p-2 border-b border-white/[0.04] shrink-0">
 <button
 onClick={() => setActiveTab('outcomes')}
 className={cn(
 'flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all',
 activeTab === 'outcomes' ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/60'
 )}
 >
 Outcomes
 </button>
 <button
 onClick={() => setActiveTab('telemetry')}
 className={cn(
 'flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all',
 activeTab === 'telemetry' ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/60'
 )}
 >
 Analytics
 </button>
 </div>

 <ScrollArea className="flex-1">
 <div className="p-3">
 {activeTab === 'outcomes' ? (
 isEmpty ? (
 /* Premium empty state */
 <div className="flex flex-col items-center justify-center py-16 gap-4">
 <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-violet-500/10 border border-white/[0.06] flex items-center justify-center">
 <CheckCircle2 className="w-7 h-7 text-white/20" />
 </div>
 <div className="text-center">
 <p className="text-secondary font-semibold text-white/40">Nothing needs attention.</p>
 <p className="text-[11px] text-white/25 mt-1">Your day is clear.</p>
 </div>
 </div>
 ) : (
 <>
 <Section title="Needs Attention" emoji="⚠️" count={needsAttention.length} accentClass="text-amber-400">
 {needsAttention.map(o => <CommitmentCard key={o.id} commitment={o} />)}
 </Section>

 <Section title="In Progress" emoji="⚡" count={inProgress.length} accentClass="text-violet-400">
 {inProgress.map(o => <CommitmentCard key={o.id} commitment={o} />)}
 </Section>

 <Section title="Pending" emoji="📋" count={todayItems.length} accentClass="text-blue-400">
 {todayItems.map(o => <CommitmentCard key={o.id} commitment={o} />)}
 </Section>

 {/* Scheduled entries from OSScheduler */}
 {scheduledEntries.filter(e => e.status === 'pending').length > 0 && (
 <div className="mb-4">
 <div className="flex items-center gap-2 px-1 py-1.5 mb-2">
 <span className="text-label">⏰</span>
 <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Scheduled</span>
 <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold ml-auto bg-indigo-500/20 text-indigo-400">
 {scheduledEntries.filter(e => e.status === 'pending').length}
 </span>
 </div>
 <div className="space-y-1.5">
 {scheduledEntries.filter(e => e.status === 'pending').slice(0, 5).map(entry => (
 <div key={entry.id} className="flex items-center gap-3 p-3 rounded-xl bg-indigo-950/20 border border-indigo-500/15">
 <Bell className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
 <div className="flex-1 min-w-0">
 <p className="text-[12px] font-semibold text-white/80 truncate">{entry.title}</p>
 <p className="text-[10px] text-white/35 mt-0.5">
 {new Date(entry.scheduledFor).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
 </p>
 </div>
 <button
 onClick={() => { osScheduler.cancel(entry.id); setScheduledEntries(osScheduler.getAll()); }}
 className="p-1 rounded hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-colors"
 title="Cancel"
 >
 <span className="text-[10px]">✕</span>
 </button>
 </div>
 ))}
 </div>
 </div>
 )}

 <Section title="Completed" emoji="✅" count={completed.length} accentClass="text-emerald-400" defaultOpen={false}>
 {completed.slice(-8).reverse().map(o => (
 <CommitmentCard key={o.id} commitment={o} onUndo={handleUndo} />
 ))}
 </Section>

 {/* Overdue */}
 {scheduledEntries.filter(e => e.status === 'overdue').length > 0 && (
 <Section title="Overdue" emoji="🔴" count={scheduledEntries.filter(e => e.status === 'overdue').length} accentClass="text-red-400">
 {scheduledEntries.filter(e => e.status === 'overdue').map(entry => (
 <div key={entry.id} className="p-3 rounded-xl bg-red-950/20 border border-red-500/15">
 <p className="text-[12px] font-semibold text-white/80">{entry.title}</p>
 <p className="text-[10px] text-red-400/70 mt-0.5">Was due: {new Date(entry.scheduledFor).toLocaleString()}</p>
 </div>
 ))}
 </Section>
 )}
 </>
 )
 ) : (
 /* Analytics tab */
 <div className="space-y-4">
 <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
 <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3 flex items-center gap-2">
 <BarChart2 className="w-3.5 h-3.5" /> Platform Stats
 </p>
 <div className="grid grid-cols-3 gap-3">
 {[
 { label: 'Completion', value: `${stats.completionRate}%`, color: 'text-emerald-400' },
 { label: 'Total', value: stats.totalCommitments, color: 'text-white/70' },
 { label: 'Scheduler', value: schedulerStats.total, color: 'text-violet-400' },
 ].map(s => (
 <div key={s.label} className="text-center p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
 <p className={cn('text-workspace font-bold tabular-nums', s.color)}>{s.value}</p>
 <p className="text-[9px] text-white/30 mt-0.5">{s.label}</p>
 </div>
 ))}
 </div>
 </div>

 {Object.entries(stats.byCapability).length > 0 && (
 <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
 <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3">By Capability</p>
 <div className="space-y-2">
 {Object.entries(stats.byCapability).map(([cap, data]) => {
 const meta = getMeta(cap);
 const total = data.completed + data.cancelled;
 const rate = total > 0 ? Math.round((data.completed / total) * 100) : 0;
 return (
 <div key={cap} className="flex items-center gap-3">
 <span className={cn('shrink-0', meta.color)}>{meta.icon}</span>
 <span className="text-[11px] text-white/60 flex-1">{meta.label}</span>
 <div className="flex items-center gap-2">
 <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
 <div
 className="h-full rounded-full bg-emerald-500/70 transition-all"
 style={{ width: `${rate}%` }}
 />
 </div>
 <span className="text-[10px] text-white/40 tabular-nums w-7 text-right">{rate}%</span>
 </div>
 </div>
 );
 })}
 </div>
 </div>
 )}

 <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
 <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3">Scheduler Health</p>
 <div className="space-y-2">
 {[
 { label: 'Pending', value: schedulerStats.pending, color: 'text-violet-400' },
 { label: 'Fired', value: schedulerStats.fired, color: 'text-emerald-400' },
 { label: 'Overdue', value: schedulerStats.overdue, color: 'text-amber-400' },
 { label: 'Cancelled', value: schedulerStats.cancelled, color: 'text-white/30' },
 ].map(s => (
 <div key={s.label} className="flex items-center justify-between">
 <span className="text-[11px] text-white/50">{s.label}</span>
 <span className={cn('text-[11px] font-bold tabular-nums', s.color)}>{s.value}</span>
 </div>
 ))}
 </div>
 </div>
 </div>
 )}
 </div>
 </ScrollArea>
 </div>
 );
};
