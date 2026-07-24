import React, { useState, useEffect } from 'react';
import { Commitment } from '../../core/capabilities/types';
import { osScheduler, ScheduleEntry } from '../../core/services/OSSchedulerService';
import { ScrollArea } from '../ui/scroll-area';
import { Bell, Calendar, CheckCircle2, Clock, AlertTriangle, Users, FileText, Phone, Mail, Briefcase, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { kernelAPI } from '../../core/runtime/KernelAPI';
import { useKernelState } from '../../core/os/useKernelState';

interface DailyTimelineProps {
 outcomes?: Commitment[]; // Legacy prop — kept for compatibility
}

const CAPABILITY_ICONS: Record<string, React.ReactNode> = {
 'core.reminder': <Bell className="w-3.5 h-3.5" />,
 'core.meeting': <Users className="w-3.5 h-3.5" />,
 'core.calendar_event': <Calendar className="w-3.5 h-3.5" />,
 'core.task': <CheckCircle2 className="w-3.5 h-3.5" />,
 'core.follow_up': <Clock className="w-3.5 h-3.5" />,
 'core.call': <Phone className="w-3.5 h-3.5" />,
 'core.email': <Mail className="w-3.5 h-3.5" />,
 'core.candidate_interview':<Briefcase className="w-3.5 h-3.5" />,
 'core.expense': <DollarSign className="w-3.5 h-3.5" />,
 'core.document': <FileText className="w-3.5 h-3.5" />,
};

const STATUS_STYLES: Record<string, { dot: string; bg: string; label: string }> = {
 pending: { dot: 'bg-violet-400 border-violet-500', bg: 'bg-violet-500/8 border-violet-500/20', label: 'Scheduled' },
 fired: { dot: 'bg-emerald-400 border-emerald-500', bg: 'bg-emerald-500/8 border-emerald-500/20', label: 'Done' },
 overdue: { dot: 'bg-amber-400 border-amber-500', bg: 'bg-amber-500/8 border-amber-500/20', label: 'Overdue' },
 cancelled:{ dot: 'bg-white/20 border-white/20', bg: 'bg-white/[0.02] border-white/[0.06]', label: 'Cancelled' },
};

function formatTime(iso: string): string {
 return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function getHour(iso: string): number {
 return new Date(iso).getHours();
}

function isToday(iso: string): boolean {
 const today = new Date().toDateString();
 return new Date(iso).toDateString() === today;
}

function isTomorrow(iso: string): boolean {
 const tomorrow = new Date();
 tomorrow.setDate(tomorrow.getDate() + 1);
 return new Date(iso).toDateString() === tomorrow.toDateString();
}

function formatDayLabel(iso: string): string {
 if (isToday(iso)) return 'Today';
 if (isTomorrow(iso)) return 'Tomorrow';
 return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

interface TimelineSectionProps {
 title: string;
 emoji: string;
 entries: ScheduleEntry[];
 accentColor: string;
}

const TimelineSection: React.FC<TimelineSectionProps> = ({ title, emoji, entries, accentColor }) => {
 if (entries.length === 0) return null;

 return (
 <div className="mb-6">
 <div className="flex items-center gap-2 mb-3 ml-11">
 <span className="text-secondary">{emoji}</span>
 <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{title}</h3>
 <div className="flex-1 h-px bg-white/[0.04]" />
 <span className="text-[10px] text-white/20">{entries.length}</span>
 </div>
 <div className="space-y-2 relative">
 {entries.map(entry => {
 const styles = STATUS_STYLES[entry.status] || STATUS_STYLES.pending;
 const icon = CAPABILITY_ICONS[entry.capability] || <Bell className="w-3.5 h-3.5" />;

 return (
 <div key={entry.id} className="flex gap-3 group">
 {/* Time column */}
 <div className="w-10 text-right shrink-0 pt-2.5">
 <span className="text-[10px] font-bold text-white/40 tabular-nums">
 {formatTime(entry.scheduledFor)}
 </span>
 </div>

 {/* Timeline dot */}
 <div className="flex flex-col items-center shrink-0">
 <div className={cn('w-2.5 h-2.5 rounded-full border-2 mt-2.5 transition-transform group-hover:scale-125', styles.dot)} />
 <div className="w-px flex-1 bg-white/[0.05] mt-1" />
 </div>

 {/* Card */}
 <div className={cn(
 'flex-1 mb-2 rounded-xl border p-3 transition-all duration-200 group-hover:translate-x-0.5',
 styles.bg
 )}>
 <div className="flex items-start justify-between gap-2">
 <div className="flex-1 min-w-0">
 <p className="text-[12px] font-semibold text-white/90 truncate">{entry.title}</p>
 {entry.metadata?.attendees && entry.metadata.attendees.length > 0 && (
 <p className="text-[10px] text-white/40 mt-0.5">
 with {(entry.metadata.attendees as string[]).join(', ')}
 </p>
 )}
 </div>
 <div className={cn('shrink-0 p-1.5 rounded-lg', styles.bg, 'text-white/50')}>
 {icon}
 </div>
 </div>
 <div className="flex items-center gap-2 mt-2">
 <span className="text-[9px] text-white/25 uppercase tracking-widest font-medium">{styles.label}</span>
 {entry.status === 'overdue' && (
 <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
 )}
 </div>
 </div>
 </div>
 );
 })}
 </div>
 </div>
 );
};

export const DailyTimeline: React.FC<DailyTimelineProps> = ({ outcomes }) => {
 const [entries, setEntries] = useState<ScheduleEntry[]>([]);
 const [selectedDay, setSelectedDay] = useState<'today' | 'tomorrow' | 'upcoming'>('today');
 const [flags, setFlags] = useState(kernelAPI.flags.getAll());
 const kernelScheduler = useKernelState('scheduler');

 useEffect(() => {
 // Listen to flags
 const unsubscribe = kernelAPI.events.subscribe('KERNEL_READY', () => {
 setFlags(kernelAPI.flags.getAll());
 });
 return unsubscribe;
 }, []);

 useEffect(() => {
 const loadEntries = () => {
 setEntries(osScheduler.getAll());
 };

 if (flags['use_kernel_timeline']) {
 setEntries(kernelScheduler.entries || []);
 } else {
 loadEntries();
 const handleUpdate = () => loadEntries();
 window.addEventListener('chatr:notification-delivered', handleUpdate);
 window.addEventListener('chatr:outcome-executed', handleUpdate);
 return () => {
 window.removeEventListener('chatr:notification-delivered', handleUpdate);
 window.removeEventListener('chatr:outcome-executed', handleUpdate);
 };
 }
 }, [flags['use_kernel_timeline'], kernelScheduler.entries]);

 // Filter by selected day
 const filterByDay = (e: ScheduleEntry) => {
 if (selectedDay === 'today') return isToday(e.scheduledFor);
 if (selectedDay === 'tomorrow') return isTomorrow(e.scheduledFor);
 return !isToday(e.scheduledFor) && !isTomorrow(e.scheduledFor);
 };

 const dayEntries = entries.filter(filterByDay).filter(e => e.status !== 'cancelled');

 // Group by time of day
 const morning = dayEntries.filter(e => getHour(e.scheduledFor) >= 5 && getHour(e.scheduledFor) < 12);
 const afternoon = dayEntries.filter(e => getHour(e.scheduledFor) >= 12 && getHour(e.scheduledFor) < 17);
 const evening = dayEntries.filter(e => getHour(e.scheduledFor) >= 17 && getHour(e.scheduledFor) < 21);
 const night = dayEntries.filter(e => getHour(e.scheduledFor) >= 21 || getHour(e.scheduledFor) < 5);
 const fired = entries.filter(e => e.status === 'fired' || e.status === 'overdue').slice(-8);

 const todayCount = entries.filter(e => isToday(e.scheduledFor) && e.status !== 'cancelled').length;
 const tomorrowCount = entries.filter(e => isTomorrow(e.scheduledFor) && e.status !== 'cancelled').length;
 const upcomingCount = entries.filter(e => !isToday(e.scheduledFor) && !isTomorrow(e.scheduledFor) && e.status !== 'cancelled').length;

 return (
 <div className="flex flex-col h-full">
 {/* Day selector tabs */}
 <div className="flex items-center gap-1 p-3 border-b border-white/[0.04] shrink-0">
 {[
 { key: 'today', label: 'Today', count: todayCount },
 { key: 'tomorrow', label: 'Tomorrow', count: tomorrowCount },
 { key: 'upcoming', label: 'Upcoming', count: upcomingCount },
 ].map(({ key, label, count }) => (
 <button
 key={key}
 onClick={() => setSelectedDay(key as any)}
 className={cn(
 'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all',
 selectedDay === key
 ? 'bg-white/10 text-white'
 : 'text-white/40 hover:text-white/70 hover:bg-white/5'
 )}
 >
 {label}
 {count > 0 && (
 <span className={cn(
 'text-[9px] px-1.5 py-0.5 rounded-full font-bold',
 selectedDay === key ? 'bg-violet-500/30 text-violet-300' : 'bg-white/10 text-white/40'
 )}>
 {count}
 </span>
 )}
 </button>
 ))}
 </div>

 <ScrollArea className="flex-1">
 <div className="p-4 relative">
 {/* Vertical timeline line */}
 <div className="absolute left-[55px] top-4 bottom-4 w-px bg-white/[0.04]" />

 {dayEntries.length === 0 && selectedDay !== 'upcoming' ? (
 /* Premium empty state */
 <div className="flex flex-col items-center justify-center py-16 gap-4">
 <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
 <Calendar className="w-6 h-6 text-white/20" />
 </div>
 <div className="text-center">
 <p className="text-secondary font-semibold text-white/40">
 {selectedDay === 'today' ? 'Your day is clear.' : 'Nothing tomorrow.'}
 </p>
 <p className="text-[11px] text-white/25 mt-1">
 Type anything to schedule something.
 </p>
 </div>
 </div>
 ) : (
 <>
 <TimelineSection title="Morning" emoji="🌅" entries={morning} accentColor="amber" />
 <TimelineSection title="Afternoon" emoji="☀️" entries={afternoon} accentColor="orange" />
 <TimelineSection title="Evening" emoji="🌆" entries={evening} accentColor="violet" />
 <TimelineSection title="Night" emoji="🌙" entries={night} accentColor="indigo" />

 {selectedDay === 'today' && fired.length > 0 && (
 <TimelineSection title="Completed / Fired" emoji="✅" entries={fired} accentColor="emerald" />
 )}

 {selectedDay === 'upcoming' && dayEntries.length === 0 && (
 <div className="flex flex-col items-center justify-center py-16 gap-4">
 <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
 <Calendar className="w-6 h-6 text-white/20" />
 </div>
 <p className="text-secondary font-semibold text-white/40">Nothing scheduled ahead.</p>
 </div>
 )}
 </>
 )}
 </div>
 </ScrollArea>

 {/* Stats footer */}
 {entries.length > 0 && (
 <div className="p-3 border-t border-white/[0.04] flex items-center justify-between shrink-0">
 <div className="flex gap-3">
 {[
 { label: 'Scheduled', value: entries.filter(e => e.status === 'pending').length, color: 'text-violet-400' },
 { label: 'Done', value: entries.filter(e => e.status === 'fired').length, color: 'text-emerald-400' },
 { label: 'Overdue', value: entries.filter(e => e.status === 'overdue').length, color: 'text-amber-400' },
 ].map(s => s.value > 0 ? (
 <div key={s.label} className="text-center">
 <p className={cn('text-label font-bold tabular-nums', s.color)}>{s.value}</p>
 <p className="text-[9px] text-white/30">{s.label}</p>
 </div>
 ) : null)}
 </div>
 <button
 onClick={loadEntries}
 className="text-[10px] text-white/20 hover:text-white/50 transition-colors"
 >
 Refresh
 </button>
 </div>
 )}
 </div>
 );
};
