import React, { useState, useEffect, useCallback } from 'react';
import { calendarService, CalendarEvent, CalendarConnection } from '@/core/services/CalendarService';
import { supabase } from '@/integrations/supabase/client';
import {
 Calendar, Plus, ChevronLeft, ChevronRight, Clock, MapPin,
 Users, Loader2, CheckCircle, Zap, Grid3X3, List, Link
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppearanceStore } from '@/hooks/useAppearanceStore';
import { cn } from '@/lib/utils';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

interface LocalEvent {
 id: string;
 title: string;
 start: string;
 end: string;
 color: string;
 location?: string;
 attendees?: string[];
}

const EVENT_COLORS = ['#6366f1','#a855f7','#10b981','#f59e0b','#f43f5e','#0ea5e9'];

export const DesktopCalendar: React.FC = () => {
 const { themeMode } = useAppearanceStore();
 const isDark = themeMode === 'dark';
 const [view, setView] = useState<'month' | 'week' | 'list'>('month');
 const [currentDate, setCurrentDate] = useState(new Date());
 const [events, setEvents] = useState<LocalEvent[]>([]);
 const [connections, setConnections] = useState<CalendarConnection[]>([]);
 const [loading, setLoading] = useState(true);
 const [showNewEvent, setShowNewEvent] = useState(false);
 const [newEvent, setNewEvent] = useState({ title: '', start: '', end: '', location: '', color: '#6366f1' });
 const [saving, setSaving] = useState(false);

 const bg = isDark ? 'bg-[#0d0f1a]' : 'bg-slate-50';
 const cardBg = isDark ? 'bg-white/[0.03] border-white/[0.08]' : 'bg-white border-slate-200';
 const labelColor = isDark ? 'text-white/50' : 'text-slate-400';
 const headingColor = isDark ? 'text-white' : 'text-slate-900';
 const textColor = isDark ? 'text-white/80' : 'text-slate-700';
 const cellBg = isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-slate-50';

 // Load events from Supabase
 useEffect(() => {
 const loadData = async () => {
 setLoading(true);
 try {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return;

 const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();
 const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59).toISOString();

 const { data } = await supabase
 .from('calendar_events' as any)
 .select('*')
 .eq('user_id', user.id)
 .gte('start_time', startOfMonth)
 .lte('start_time', endOfMonth)
 .order('start_time');

 if (data) {
 setEvents((data as any[]).map(e => ({
 id: e.id,
 title: e.title,
 start: e.start_time,
 end: e.end_time,
 color: e.color || '#6366f1',
 location: e.location,
 attendees: e.attendees,
 })));
 }

 // Load calendar connections
 const conns = calendarService.getConnections();
 setConnections(conns);
 } catch {
 // Table may not exist yet — fail gracefully
 } finally {
 setLoading(false);
 }
 };
 loadData();
 }, [currentDate]);

 const handleCreateEvent = async () => {
 if (!newEvent.title.trim() || !newEvent.start) {
 toast.error('Title and start time are required');
 return;
 }
 setSaving(true);
 try {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) throw new Error('Not authenticated');

 const eventData = {
 user_id: user.id,
 title: newEvent.title,
 start_time: newEvent.start,
 end_time: newEvent.end || newEvent.start,
 location: newEvent.location || null,
 color: newEvent.color,
 };

 const { data, error } = await supabase.from('calendar_events' as any).insert(eventData).select().single();
 if (error) throw error;

 const created: LocalEvent = {
 id: (data as any).id,
 title: (data as any).title,
 start: (data as any).start_time,
 end: (data as any).end_time,
 color: (data as any).color,
 location: (data as any).location,
 };
 setEvents(prev => [...prev, created]);

 // Also push to connected calendars
 const connectedProviders = connections.filter(c => c.connected);
 if (connectedProviders.length > 0) {
 try {
 await calendarService.createEvent({
 id: created.id,
 title: created.title,
 startDateTime: created.start,
 endDateTime: created.end,
 location: created.location,
 });
 toast.success(`Event created and synced to ${connectedProviders.length} calendar${connectedProviders.length > 1 ? 's' : ''}`);
 } catch {
 toast.success('Event created locally');
 }
 } else {
 toast.success('Event created');
 }

 setShowNewEvent(false);
 setNewEvent({ title: '', start: '', end: '', location: '', color: '#6366f1' });
 } catch (err: any) {
 // If table doesn't exist, show optimistic event
 const optimistic: LocalEvent = {
 id: `local-${Date.now()}`,
 title: newEvent.title,
 start: newEvent.start,
 end: newEvent.end,
 color: newEvent.color,
 location: newEvent.location,
 };
 setEvents(prev => [...prev, optimistic]);
 toast.success('Event created (local)');
 setShowNewEvent(false);
 setNewEvent({ title: '', start: '', end: '', location: '', color: '#6366f1' });
 } finally {
 setSaving(false);
 }
 };

 // Build calendar grid
 const year = currentDate.getFullYear();
 const month = currentDate.getMonth();
 const firstDay = new Date(year, month, 1).getDay();
 const daysInMonth = new Date(year, month + 1, 0).getDate();
 const today = new Date();

 const getEventsForDay = (day: number) => {
 return events.filter(e => {
 const d = new Date(e.start);
 return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
 });
 };

 const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
 const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

 return (
 <div className={cn('flex-1 flex flex-col overflow-hidden', bg)}>
 {/* Header */}
 <div className={cn('flex items-center justify-between px-6 py-4 border-b', isDark ? 'border-white/[0.06]' : 'border-slate-200')}>
 <div className="flex items-center gap-4">
 <div className="flex items-center gap-2">
 <button onClick={prevMonth} className={cn('p-1.5 rounded-lg transition-colors', isDark ? 'hover:bg-white/[0.06] text-white/60' : 'hover:bg-slate-100 text-slate-500')}>
 <ChevronLeft className="w-4 h-4" />
 </button>
 <h2 className={cn('text-section font-bold min-w-[160px] text-center', headingColor)}>
 {MONTHS[month]} {year}
 </h2>
 <button onClick={nextMonth} className={cn('p-1.5 rounded-lg transition-colors', isDark ? 'hover:bg-white/[0.06] text-white/60' : 'hover:bg-slate-100 text-slate-500')}>
 <ChevronRight className="w-4 h-4" />
 </button>
 </div>

 <button onClick={() => setCurrentDate(new Date())}
 className={cn('text-label px-3 py-1.5 rounded-lg transition-colors', isDark ? 'bg-white/[0.06] text-white/70 hover:bg-white/[0.1]' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
 Today
 </button>
 </div>

 <div className="flex items-center gap-2">
 {/* View toggle */}
 <div className={cn('flex items-center rounded-lg p-1', isDark ? 'bg-white/[0.05]' : 'bg-slate-100')}>
 {[{ id: 'month', icon: Grid3X3 }, { id: 'list', icon: List }].map(v => (
 <button key={v.id} onClick={() => setView(v.id as any)}
 className={cn('p-1.5 rounded-md transition-colors', view === v.id
 ? isDark ? 'bg-white/[0.1] text-white' : 'bg-white text-slate-900 shadow-sm'
 : isDark ? 'text-white/40 hover:text-white/70' : 'text-slate-400 hover:text-slate-600')}>
 <v.icon className="w-3.5 h-3.5" />
 </button>
 ))}
 </div>

 {/* Connect calendar */}
 <button onClick={() => calendarService.initiateOAuth('google')}
 className={cn('flex items-center gap-1.5 text-label px-3 py-1.5 rounded-lg transition-colors', isDark ? 'bg-white/[0.06] text-white/70 hover:bg-white/[0.1]' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
 <Link className="w-3.5 h-3.5" /> Connect Google
 </button>

 <button onClick={() => setShowNewEvent(true)}
 className="flex items-center gap-1.5 text-label px-4 py-2 rounded-lg font-semibold text-white transition-all hover:opacity-90"
 style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}>
 <Plus className="w-3.5 h-3.5" /> New Event
 </button>
 </div>
 </div>

 {loading ? (
 <div className="flex-1 flex items-center justify-center">
 <Loader2 className="w-7 h-7 animate-spin text-indigo-400" />
 </div>
 ) : view === 'month' ? (
 <div className="flex-1 overflow-y-auto p-4">
 {/* Day headers */}
 <div className="grid grid-cols-7 mb-2">
 {DAYS.map(d => (
 <div key={d} className={cn('text-center text-label font-semibold py-2', labelColor)}>{d}</div>
 ))}
 </div>
 {/* Cells */}
 <div className="grid grid-cols-7 flex-1">
 {Array.from({ length: firstDay }).map((_, i) => (
 <div key={`empty-${i}`} className={cn('min-h-[90px] border-b border-r', isDark ? 'border-white/[0.04]' : 'border-slate-100')} />
 ))}
 {Array.from({ length: daysInMonth }).map((_, i) => {
 const day = i + 1;
 const dayEvents = getEventsForDay(day);
 const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
 return (
 <div key={day} className={cn('min-h-[90px] border-b border-r p-1.5 transition-colors cursor-pointer', isDark ? 'border-white/[0.04]' : 'border-slate-100', cellBg)}>
 <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-label font-bold mb-1', isToday ? 'bg-indigo-500 text-white' : headingColor)}>
 {day}
 </div>
 <div className="space-y-0.5">
 {dayEvents.slice(0, 3).map(e => (
 <div key={e.id} className="text-[10px] px-1.5 py-0.5 rounded font-medium text-white truncate"
 style={{ background: e.color }}>
 {e.title}
 </div>
 ))}
 {dayEvents.length > 3 && (
 <div className={cn('text-[10px] px-1.5', labelColor)}>+{dayEvents.length - 3} more</div>
 )}
 </div>
 </div>
 );
 })}
 </div>
 </div>
 ) : (
 /* List view */
 <div className="flex-1 overflow-y-auto p-6">
 {events.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-20 gap-3">
 <Calendar className={cn('w-12 h-12', labelColor)} />
 <p className={cn('text-secondary', labelColor)}>No events this month</p>
 <button onClick={() => setShowNewEvent(true)}
 className="mt-2 px-4 py-2 rounded-lg text-secondary font-medium text-indigo-400 border border-indigo-400/30 hover:bg-indigo-400/10 transition-colors">
 Create your first event
 </button>
 </div>
 ) : (
 <div className="space-y-3 max-w-2xl mx-auto">
 {events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()).map(e => (
 <div key={e.id} className={cn('rounded-xl border p-4 flex items-start gap-3', cardBg)}>
 <div className="w-3 mt-1 h-3 rounded-full flex-shrink-0" style={{ background: e.color }} />
 <div className="flex-1 min-w-0">
 <p className={cn('font-semibold truncate', headingColor)}>{e.title}</p>
 <p className={cn('text-label mt-0.5', labelColor)}>
 {new Date(e.start).toLocaleString()} {e.end && e.end !== e.start && `→ ${new Date(e.end).toLocaleTimeString()}`}
 </p>
 {e.location && <p className={cn('text-label mt-1 flex items-center gap-1', labelColor)}><MapPin className="w-3 h-3" />{e.location}</p>}
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 )}

 {/* New Event Modal */}
 {showNewEvent && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
 onClick={e => e.target === e.currentTarget && setShowNewEvent(false)}>
 <div className={cn('w-full max-w-md rounded-2xl border p-6 space-y-4', cardBg)}>
 <h3 className={cn('text-section font-bold', headingColor)}>New Event</h3>
 <input type="text" placeholder="Event title" value={newEvent.title}
 onChange={e => setNewEvent(p => ({ ...p, title: e.target.value }))}
 className={cn('w-full px-4 py-2.5 rounded-xl border text-secondary outline-none focus:border-indigo-500', isDark ? 'bg-white/[0.05] border-white/[0.1] text-white placeholder:text-white/30' : 'bg-white border-slate-200')} />
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className={cn('text-label font-semibold block mb-1', labelColor)}>Start</label>
 <input type="datetime-local" value={newEvent.start}
 onChange={e => setNewEvent(p => ({ ...p, start: e.target.value }))}
 className={cn('w-full px-3 py-2 rounded-xl border text-secondary outline-none focus:border-indigo-500', isDark ? 'bg-white/[0.05] border-white/[0.1] text-white' : 'bg-white border-slate-200')} />
 </div>
 <div>
 <label className={cn('text-label font-semibold block mb-1', labelColor)}>End</label>
 <input type="datetime-local" value={newEvent.end}
 onChange={e => setNewEvent(p => ({ ...p, end: e.target.value }))}
 className={cn('w-full px-3 py-2 rounded-xl border text-secondary outline-none focus:border-indigo-500', isDark ? 'bg-white/[0.05] border-white/[0.1] text-white' : 'bg-white border-slate-200')} />
 </div>
 </div>
 <input type="text" placeholder="Location (optional)" value={newEvent.location}
 onChange={e => setNewEvent(p => ({ ...p, location: e.target.value }))}
 className={cn('w-full px-4 py-2.5 rounded-xl border text-secondary outline-none focus:border-indigo-500', isDark ? 'bg-white/[0.05] border-white/[0.1] text-white placeholder:text-white/30' : 'bg-white border-slate-200')} />
 {/* Color picker */}
 <div>
 <label className={cn('text-label font-semibold block mb-2', labelColor)}>Color</label>
 <div className="flex gap-2">
 {EVENT_COLORS.map(c => (
 <button key={c} onClick={() => setNewEvent(p => ({ ...p, color: c }))}
 className={cn('w-7 h-7 rounded-full transition-all', newEvent.color === c ? 'ring-2 ring-offset-2 scale-110' : '')}
 style={{ background: c }} />
 ))}
 </div>
 </div>
 <div className="flex gap-2 pt-2">
 <button onClick={handleCreateEvent} disabled={saving}
 className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-button font-semibold text-white bg-indigo-500 hover:bg-indigo-600 transition-colors disabled:opacity-50">
 {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
 {saving ? 'Creating…' : 'Create Event'}
 </button>
 <button onClick={() => setShowNewEvent(false)}
 className={cn('px-4 py-2.5 rounded-xl text-secondary font-semibold transition-colors', isDark ? 'text-white/60 hover:bg-white/[0.06]' : 'text-slate-500 hover:bg-slate-100')}>
 Cancel
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
};

export default DesktopCalendar;
