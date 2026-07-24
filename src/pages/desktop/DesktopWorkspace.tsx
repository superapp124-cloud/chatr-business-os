import React, { useState, useEffect, useCallback } from 'react';
import { useAppearanceStore } from '@/hooks/useAppearanceStore';
import { WorkspaceOSPanel } from '@/components/workspace/WorkspaceOSPanel';
import { 
 Calendar as CalendarIcon, 
 CalendarCheck2,
 Clock, 
 ChevronLeft, 
 ChevronRight,
 Plus,
 MoreVertical,
 CheckCircle2,
 Circle,
 ListTodo,
 Users,
 Video,
 Sparkles,
 MapPin,
 AlignLeft,
 Bot,
 Loader2,
 X,
 MessageSquare
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { format, addDays, startOfWeek, endOfWeek, isSameDay } from 'date-fns';
import { useService } from '@/platform/Infrastructure/PlatformContext';
import { usePlatformReady } from '@/platform/Infrastructure/PlatformContext';
import { supabase } from '@/integrations/supabase/client';
import { CommentThread } from '@/platform/Domain/Collaboration/CommentThread';
import type { Task } from '@/platform/Domain/Execution/TaskService';
import type { CalendarEvent } from '@/platform/Domain/Execution/CalendarService';

// ─── UI helper: map DB task to view-model ────────────────────────────────────

interface TaskViewModel {
 id: string;
 title: string;
 list: string;
 done: boolean;
 priority: 'low' | 'medium' | 'high' | 'critical';
}

function taskToViewModel(t: Task, listName: string): TaskViewModel {
 return {
 id: t.id,
 title: t.title,
 list: listName,
 done: t.status === 'done',
 priority: t.priority,
 };
}

// ─── UI helper: map DB event to render-model ─────────────────────────────────

interface EventRenderModel {
 id: string;
 title: string;
 /** 1-indexed weekday within rendered week (1=Mon…5=Fri) */
 day: number;
 startHour: number;
 duration: number;
 type: string;
 color: string;
 location?: string;
 attendees?: string[];
}

const EVENT_TYPE_COLOR: Record<string, string> = {
 meeting: 'bg-blue-500',
 sync: 'bg-blue-500',
 review: 'bg-purple-500',
 deadline: 'bg-rose-500',
 reminder: 'bg-amber-500',
 other: 'bg-emerald-500',
};

function calendarEventToRenderModel(event: CalendarEvent, weekStart: Date): EventRenderModel | null {
 const startDate = new Date(event.start_at);
 const endDate = new Date(event.end_at);

 // Which weekday column (Mon=1 … Fri=5)?
 const dayIndex = Math.floor(
 (startDate.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24)
 ) + 1;

 if (dayIndex < 1 || dayIndex > 5) return null; // outside Mon-Fri view

 const startHour = startDate.getHours() + startDate.getMinutes() / 60;
 const endHour = endDate.getHours() + endDate.getMinutes() / 60;
 const duration = Math.max(endHour - startHour, 0.5);

 const color = event.color
 ? `bg-[${event.color}]` // user-set colour — fallback below if Tailwind can't JIT it
 : EVENT_TYPE_COLOR[event.event_type] ?? 'bg-blue-500';

 const typeColor = EVENT_TYPE_COLOR[event.event_type] ?? 'bg-blue-500';

 return {
 id: event.id,
 title: event.title,
 day: dayIndex,
 startHour,
 duration,
 type: event.event_type,
 color: typeColor,
 location: event.location ?? undefined,
 };
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────

export const DesktopWorkspace: React.FC = () => {
 const { themeMode } = useAppearanceStore();
 const isDark = themeMode === 'dark';
 const isReady = usePlatformReady();

 const taskService = useService<any>('TaskService');
 const calendarService = useService<any>('CalendarService');

 // ── State ──────────────────────────────────────────────────────────────────
 const [currentDate, setCurrentDate] = useState(new Date());
 const [tasks, setTasks] = useState<TaskViewModel[]>([]);
 const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
 const [events, setEvents] = useState<EventRenderModel[]>([]);
 const [workspaceId, setWorkspaceId] = useState<string | null>('personal_local_workspace');
 const [currentUserName, setCurrentUserName] = useState<string>('');
 const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(true);
 const [isLoadingTasks, setIsLoadingTasks] = useState(false);
 const [isLoadingEvents, setIsLoadingEvents] = useState(false);
 const [newTaskTitle, setNewTaskTitle] = useState('');

 // Week generation
 const startDate = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
 const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
 const weekDays = Array.from({ length: 5 }).map((_, i) => addDays(startDate, i));
 const hours = Array.from({ length: 11 }).map((_, i) => i + 8); // 8AM → 6PM

 // ── Step 1: Resolve workspace from auth ───────────────────────────────────
 useEffect(() => {
 let cancelled = false;

 async function resolveWorkspace() {
 setIsLoadingWorkspace(true);
 try {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user || cancelled) return;

 const { data: profile } = await supabase.from('profiles').select('full_name, username').eq('id', user.id).single();
 if (profile && !cancelled) setCurrentUserName(profile.full_name || profile.username || 'User');

 // Find first workspace where user is a member or owner
 const { data: memberRows } = await supabase
 .from('workspace_members')
 .select('workspace_id')
 .eq('user_id', user.id)
 .limit(1);

 if (memberRows && memberRows.length > 0 && !cancelled) {
 setWorkspaceId(memberRows[0].workspace_id);
 return;
 }

 // Fallback: check owned workspaces
 const { data: owned } = await supabase
 .from('workspaces')
 .select('id')
 .eq('owner_id', user.id)
 .limit(1);

 if (owned && owned.length > 0 && !cancelled) {
 setWorkspaceId(owned[0].id);
 } else if (!cancelled) {
 // Auto-create a personal workspace for the calendar to function
 try {
 const { data: newWorkspace } = await supabase
 .from('workspaces')
 .insert({ name: 'Personal Workspace', type: 'personal', owner_id: user.id })
 .select('id')
 .single();
 
 if (newWorkspace) {
 setWorkspaceId(newWorkspace.id);
 await supabase.from('workspace_members').insert({ workspace_id: newWorkspace.id, user_id: user.id, role: 'owner' });
 }
 } catch (e) {
 console.error('Failed to auto-create workspace', e);
 }
 }
 } catch (err) {
 console.error('[DesktopWorkspace] Failed to resolve workspace', err);
 } finally {
 if (!cancelled) setIsLoadingWorkspace(false);
 }
 }

 resolveWorkspace();
 return () => { cancelled = true; };
 }, []);

 // ── Step 2: Load tasks when workspace is known ────────────────────────────
 useEffect(() => {
 if (!workspaceId || !isReady) return;
 let cancelled = false;

 async function loadTasks() {
 setIsLoadingTasks(true);
 try {
 const [rawTasks, rawLists] = await Promise.all([
 taskService.getTasks(undefined, workspaceId),
 taskService.getLists(workspaceId),
 ]);

 if (cancelled) return;

 const listMap: Record<string, string> = {};
 for (const l of rawLists) listMap[l.id] = l.name;

 const viewModels: TaskViewModel[] = rawTasks.map((t: Task) =>
 taskToViewModel(t, t.list_id ? (listMap[t.list_id] ?? 'My Tasks') : 'My Tasks')
 );

 setTasks(viewModels);
 } catch (err) {
 console.error('[DesktopWorkspace] loadTasks failed', err);
 } finally {
 if (!cancelled) setIsLoadingTasks(false);
 }
 }

 loadTasks();
 return () => { cancelled = true; };
 }, [workspaceId, isReady]);

 // ── Step 3: Load calendar events for current week ─────────────────────────
 useEffect(() => {
 if (!workspaceId || !isReady) return;
 let cancelled = false;

 async function loadEvents() {
 setIsLoadingEvents(true);
 try {
 const rawEvents: CalendarEvent[] = await calendarService.getEvents(
 workspaceId,
 startDate,
 weekEnd
 );

 if (cancelled) return;

 const rendered = rawEvents
 .map((e: CalendarEvent) => calendarEventToRenderModel(e, startDate))
 .filter((e): e is EventRenderModel => e !== null);

 setEvents(rendered);
 } catch (err) {
 console.error('[DesktopWorkspace] loadEvents failed', err);
 } finally {
 if (!cancelled) setIsLoadingEvents(false);
 }
 }

 loadEvents();
 return () => { cancelled = true; };
 }, [workspaceId, isReady, currentDate]);

 // ── Step 4: Real-time task subscription ───────────────────────────────────
 useEffect(() => {
 if (!workspaceId || !isReady) return;

 const unsubscribe = taskService.subscribeToTasks(workspaceId, (updatedTask: Task) => {
 setTasks(prev => {
 const idx = prev.findIndex(t => t.id === updatedTask.id);
 const vm = taskToViewModel(updatedTask, 'My Tasks');
 if (idx === -1) return [...prev, vm];
 const next = [...prev];
 next[idx] = vm;
 return next;
 });
 });

 return unsubscribe;
 }, [workspaceId, isReady]);

 // ── Step 5: Real-time calendar subscription ───────────────────────────────
 useEffect(() => {
 if (!workspaceId || !isReady) return;

 const unsubscribe = calendarService.subscribeToEvents(workspaceId, () => {
 // Re-fetch events on any change
 calendarService
 .getEvents(workspaceId, startDate, weekEnd)
 .then((rawEvents: CalendarEvent[]) => {
 const rendered = rawEvents
 .map((e: CalendarEvent) => calendarEventToRenderModel(e, startDate))
 .filter((e): e is EventRenderModel => e !== null);
 setEvents(rendered);
 })
 .catch((err: unknown) => console.error('[DesktopWorkspace] realtime events refresh failed', err));
 });

 return unsubscribe;
 }, [workspaceId, isReady, currentDate]);

 // ── Handlers ───────────────────────────────────────────────────────────────

 const toggleTask = useCallback(async (id: string) => {
 const task = tasks.find(t => t.id === id);
 if (!task) return;

 // Optimistic update
 setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));

 try {
 if (!task.done) {
 await taskService.completeTask(id);
 } else {
 await taskService.updateTask(id, { status: 'todo', completed_at: null });
 }
 } catch (err) {
 // Revert on failure
 setTasks(prev => prev.map(t => t.id === id ? { ...t, done: task.done } : t));
 console.error('[DesktopWorkspace] toggleTask failed', err);
 }
 }, [tasks, taskService]);

 const handleCreateTask = useCallback(async () => {
 const title = newTaskTitle.trim();
 if (!title || !workspaceId) return;
 setNewTaskTitle('');

 try {
 const created = await taskService.createTask({ title, workspaceId });
 setTasks(prev => [...prev, taskToViewModel(created, 'My Tasks')]);
 } catch (err) {
 console.error('[DesktopWorkspace] createTask failed', err);
 }
 }, [newTaskTitle, workspaceId, taskService]);

 // ── Empty state ────────────────────────────────────────────────────────────

 if (isLoadingWorkspace) {
 return (
 <div className="flex h-full items-center justify-center bg-[#0a0a12]">
 <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
 </div>
 );
 }

 // Bypass "No workspace found" block handled via initial state

 return (
 <div className={cn("flex h-full font-sans overflow-hidden", isDark ? "bg-[#0a0a12] text-white" : "bg-white text-zinc-950")}>
 
 {/* ── LEFT PANE: Calendars & Filters ───────────────────────────────── */}
 <div className="w-64 shrink-0 border-r border-white/[0.06] bg-[#0b0b14] flex flex-col relative z-20">
 
 {/* Header */}
 <div className="h-16 px-4 flex items-center justify-between border-b border-white/[0.04]">
 <h2 className="text-secondary font-bold text-white/90">Calendar</h2>
 <Button variant="ghost" size="icon" className="w-7 h-7 hover:bg-white/[0.08] text-white/50">
 <Plus className="w-4 h-4" />
 </Button>
 </div>

 <ScrollArea className="flex-1">
 <div className="p-4 space-y-6">
 
 {/* Mini Calendar */}
 <div>
 <div className="flex items-center justify-between mb-3">
 <span className="text-label font-bold text-white/90">{format(currentDate, 'MMMM yyyy')}</span>
 <div className="flex gap-1">
 <ChevronLeft className="w-3.5 h-3.5 text-white/40 cursor-pointer hover:text-white" onClick={() => setCurrentDate(addDays(currentDate, -30))} />
 <ChevronRight className="w-3.5 h-3.5 text-white/40 cursor-pointer hover:text-white" onClick={() => setCurrentDate(addDays(currentDate, 30))} />
 </div>
 </div>
 <div className="grid grid-cols-7 gap-1 text-center mb-1">
 {['M','T','W','T','F','S','S'].map((d, i) => (
 <div key={i} className="text-[9px] font-bold text-white/30">{d}</div>
 ))}
 </div>
 <div className="grid grid-cols-7 gap-1 text-center">
 {Array.from({length: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()}).map((_, i) => {
 const day = i + 1;
 const isToday = new Date().getDate() === day && new Date().getMonth() === currentDate.getMonth() && new Date().getFullYear() === currentDate.getFullYear();
 return (
 <div key={i} onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), day))} className={cn(
 "w-6 h-6 mx-auto rounded-full flex items-center justify-center text-[10px] cursor-pointer transition-colors",
 isToday ? "bg-violet-600 text-white font-bold shadow-md shadow-violet-500/20" : "text-white/70 hover:bg-white/10"
 )}>
 {day}
 </div>
 );
 })}
 </div>
 </div>

 {/* My Calendars */}
 <div>
 <div className="flex items-center justify-between px-1 mb-2">
 <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">My Calendars</span>
 </div>
 <div className="space-y-0.5">
 <div className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/5 cursor-pointer">
 <div className="w-3 h-3 rounded bg-violet-500 flex items-center justify-center">
 <div className="w-1.5 h-1.5 rounded-sm bg-white" />
 </div>
 <span className="text-label text-white/90 ">{currentUserName || 'Personal Calendar'}</span>
 </div>
 </div>
 </div>

 {/* Other Calendars */}
 <div>
 <div className="flex items-center justify-between px-1 mb-2">
 <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Other Calendars</span>
 <Plus className="w-3 h-3 text-white/30 cursor-pointer hover:text-white" onClick={() => toast.info('Adding calendars coming soon')} />
 </div>
 <div className="px-2 text-[10px] text-white/40 italic">
 No other calendars added
 </div>
 </div>

 </div>
 </ScrollArea>
 </div>

 {/* ── CENTER PANE: Calendar Grid ───────────────────────────────────── */}
 <div className="flex-1 flex flex-col min-w-0 relative bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed">
 <div className="absolute inset-0 bg-zinc-950/95" /> 
 
 {/* Header Toolbar */}
 <div className="h-16 shrink-0 border-b border-white/[0.06] bg-zinc-950/80 backdrop-blur-md flex items-center justify-between px-6 relative z-10">
 <div className="flex items-center gap-4">
 <Button
 variant="outline"
 className="h-8 px-3 rounded-lg bg-zinc-900 border-white/10 text-label font-semibold hover:bg-zinc-800 text-white"
 onClick={() => setCurrentDate(new Date())}
 >
 Today
 </Button>
 <div className="flex items-center gap-2">
 <button
 className="p-1 hover:bg-white/10 rounded-md text-white/50 hover:text-white transition-colors"
 onClick={() => setCurrentDate(d => addDays(d, -7))}
 >
 <ChevronLeft className="w-4 h-4" />
 </button>
 <h2 className="text-section font-bold text-white/90 min-w-[120px] text-center">
 {format(startDate, 'MMMM yyyy')}
 </h2>
 <button
 className="p-1 hover:bg-white/10 rounded-md text-white/50 hover:text-white transition-colors"
 onClick={() => setCurrentDate(d => addDays(d, 7))}
 >
 <ChevronRight className="w-4 h-4" />
 </button>
 </div>
 </div>
 
 <div className="flex items-center gap-2">
 <div className="flex bg-zinc-900 rounded-lg p-0.5 border border-white/10">
 <button className="px-3 py-1 rounded-md text-button text-white/50 hover:text-white transition-colors">Day</button>
 <button className="px-3 py-1 rounded-md bg-white/10 text-button font-bold text-white shadow-sm">Week</button>
 <button className="px-3 py-1 rounded-md text-button text-white/50 hover:text-white transition-colors">Month</button>
 </div>
 <Button className="h-8 gap-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg shadow-lg">
 <Plus className="w-3.5 h-3.5" /> New Event
 </Button>
 </div>
 </div>

 {/* Grid Area */}
 <div className="flex-1 flex flex-col relative z-10 overflow-hidden">
 
 {/* Day Headers */}
 <div className="flex border-b border-white/[0.06] bg-zinc-950/50">
 <div className="w-16 shrink-0 border-r border-white/[0.06]" /> {/* Time column spacer */}
 {weekDays.map((day, i) => {
 const isTodayRender = isSameDay(day, new Date());
 return (
 <div key={i} className="flex-1 flex flex-col items-center justify-center py-3 border-r border-white/[0.06] last:border-r-0">
 <span className={cn("text-[10px] font-bold uppercase tracking-widest mb-1", isTodayRender ? "text-violet-400" : "text-white/40")}>
 {format(day, 'EEE')}
 </span>
 <div className={cn(
 "w-8 h-8 rounded-full flex items-center justify-center text-section font-light",
 isTodayRender ? "bg-violet-600 text-white shadow-md shadow-violet-500/20" : "text-white/90"
 )}>
 {format(day, 'd')}
 </div>
 </div>
 );
 })}
 </div>

 {/* Scrollable Timeline */}
 <ScrollArea className="flex-1 bg-zinc-950/30">
 <div className="flex relative min-w-[600px] h-[800px]"> {/* Fixed height for scroll */}
 
 {/* Time Column */}
 <div className="w-16 shrink-0 border-r border-white/[0.06] bg-zinc-950/50 relative z-20">
 {hours.map(hour => (
 <div key={hour} className="h-20 border-b border-transparent relative">
 <span className="absolute -top-2.5 right-2 text-[10px] font-medium text-white/30">
 {hour > 12 ? `${hour-12} PM` : hour === 12 ? '12 PM' : `${hour} AM`}
 </span>
 </div>
 ))}
 </div>

 {/* Grid Columns */}
 {weekDays.map((_, dayIndex) => (
 <div key={dayIndex} className="flex-1 border-r border-white/[0.06] last:border-r-0 relative group">
 {/* Grid Lines */}
 {hours.map(hour => (
 <div key={hour} className="h-20 border-b border-white/[0.03] w-full" />
 ))}

 {/* Render Events for this day */}
 {isLoadingEvents ? (
 <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
 {dayIndex === 2 && <Loader2 className="w-4 h-4 text-violet-400 animate-spin opacity-40" />}
 </div>
 ) : (
 events.filter(e => e.day === dayIndex + 1).map(event => {
 const top = (event.startHour - 8) * 80; // 80px per hour
 const height = event.duration * 80;
 
 return (
 <div 
 key={event.id}
 className="absolute left-1 right-1 rounded-xl p-0.5 transition-transform hover:z-30 hover:scale-[1.02] cursor-pointer shadow-sm"
 style={{ top: `${top}px`, height: `${height}px` }}
 >
 <div className={cn(
 "w-full h-full rounded-[10px] border px-2.5 py-1.5 flex flex-col overflow-hidden relative",
 event.color.replace('bg-', 'bg-').replace('500', '500/20'), // Background opacity
 event.color.replace('bg-', 'border-').replace('500', '500/30') // Border opacity
 )}>
 <div className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-l-[10px]", event.color)} />
 
 <div className="flex items-start justify-between gap-2">
 <span className={cn(
 "text-label font-bold truncate ",
 event.color.replace('bg-', 'text-').replace('500', '400')
 )}>{event.title}</span>
 {event.type === 'sync' && <Video className="w-3 h-3 text-white/50 shrink-0" />}
 </div>
 
 <span className="text-[10px] text-white/60 mt-0.5 block truncate">
 {event.startHour > 12 ? event.startHour-12 : event.startHour}:00 - 
 {event.startHour+event.duration > 12 ? (event.startHour+event.duration)-12 : event.startHour+event.duration}:00
 </span>

 {height > 60 && event.attendees && (
 <div className="flex -space-x-1.5 mt-auto pb-0.5">
 {event.attendees.map((att, i) => (
 <div key={i} className="w-5 h-5 rounded-full bg-zinc-800 border-2 border-[#12121a] flex items-center justify-center text-[7px] font-bold text-white z-10">
 {att}
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 );
 })
 )}

 {/* Current Time Indicator (real day) */}
 {isSameDay(weekDays[dayIndex], new Date()) && (() => {
 const now = new Date();
 const topPx = (now.getHours() + now.getMinutes() / 60 - 8) * 80;
 if (topPx < 0 || topPx > 880) return null;
 return (
 <div className="absolute left-0 right-0 z-40 pointer-events-none" style={{ top: `${topPx}px` }}>
 <div className="h-px bg-red-500 w-full relative shadow-[0_0_8px_rgba(239,68,68,0.8)]">
 <div className="absolute -left-1.5 -top-1.5 w-3 h-3 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
 </div>
 </div>
 );
 })()}

 {/* Hover visualizer (click to add) */}
 <div className="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none flex flex-col">
 {hours.map(hour => (
 <div key={hour} className="h-20 w-full hover:bg-white/[0.02] pointer-events-auto transition-colors" />
 ))}
 </div>
 </div>
 ))}
 </div>
 </ScrollArea>
 </div>
 </div>

 {/* ── RIGHT PANE: Tasks & Scheduler / Task Detail ──────────────────── */}
 <div className="w-80 shrink-0 border-l border-white/[0.06] bg-[#0b0b14] flex flex-col relative z-20">
 
 {selectedTaskId ? (() => {
 const activeTask = tasks.find(t => t.id === selectedTaskId);
 return (
 <>
 {/* Task Detail Header */}
 <div className="h-16 shrink-0 flex items-center justify-between px-4 border-b border-white/[0.04]">
 <div className="flex items-center gap-2">
 <ListTodo className="w-4 h-4 text-emerald-400" />
 <h3 className="text-secondary font-bold text-white/90 truncate max-w-[200px]">{activeTask?.title || 'Task Details'}</h3>
 </div>
 <Button variant="ghost" size="icon" className="w-7 h-7 hover:bg-white/[0.08] text-white/50" onClick={() => setSelectedTaskId(null)}>
 <X className="w-4 h-4" />
 </Button>
 </div>
 
 <ScrollArea className="flex-1">
 <div className="p-4 flex flex-col gap-6">
 {/* Task Meta */}
 <div className="p-4 rounded-xl bg-zinc-900 border border-white/10 space-y-3">
 <div className="flex items-center justify-between">
 <span className="text-[10px] text-white/40 uppercase tracking-wider">Status</span>
 <span className={cn("text-label font-bold", activeTask?.done ? "text-emerald-400" : "text-amber-400")}>
 {activeTask?.done ? "Completed" : "In Progress"}
 </span>
 </div>
 <div className="flex items-center justify-between">
 <span className="text-[10px] text-white/40 uppercase tracking-wider">Priority</span>
 <span className="text-label text-white/80 capitalize">{activeTask?.priority || 'Medium'}</span>
 </div>
 </div>

 {/* Comment Thread */}
 <div>
 <div className="flex items-center gap-2 mb-3">
 <MessageSquare className="w-4 h-4 text-violet-400" />
 <h4 className="text-label font-bold text-white/90">Discussion</h4>
 </div>
 <div className="rounded-xl border border-white/10 bg-[#0a0a12] overflow-hidden">
 <CommentThread entityType="task" entityId={selectedTaskId} workspaceId={workspaceId} />
 </div>
 </div>
 </div>
 </ScrollArea>
 </>
 );
 })() : (
 <>
 {/* Header */}
 <div className="h-16 shrink-0 flex items-center justify-between px-4 border-b border-white/[0.04]">
 <div className="flex items-center gap-2">
 <h3 className="text-secondary font-bold text-white/90">Tasks & Agent</h3>
 </div>
 <div className="flex gap-1">
 <Button variant="ghost" size="icon" className="w-7 h-7 hover:bg-white/[0.08] text-white/50"><MoreVertical className="w-4 h-4" /></Button>
 </div>
 </div>
 
 <ScrollArea className="flex-1">
 <div className="p-4 flex flex-col gap-6">
 
 {/* AI Scheduling Agent */}
 <div className="rounded-2xl bg-gradient-to-b from-violet-500/10 to-transparent border border-violet-500/20 p-4 relative overflow-hidden">
 <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
 <Bot className="w-24 h-24" />
 </div>
 
 <div className="flex items-center gap-2 mb-3 relative z-10">
 <Sparkles className="w-4 h-4 text-violet-400" />
 <h4 className="text-label font-bold text-violet-300">Scheduling Agent</h4>
 </div>
 
 <p className="text-[11px] text-white/60 mb-4 relative z-10 leading-relaxed">
 I can find time on your calendar, resolve conflicts, and draft invites automatically.
 </p>

 <div className="relative z-10">
 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
 <Sparkles className="w-3.5 h-3.5 text-white/30" />
 </div>
 <Input 
 placeholder="e.g., Find 30m with Rahul on Thursday..." 
 className="bg-zinc-900 border-white/10 text-label pl-9 rounded-xl focus:border-violet-500/50"
 />
 </div>
 </div>

 {/* Task Board */}
 <div>
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-2">
 <ListTodo className="w-4 h-4 text-emerald-400" />
 <h4 className="text-label font-bold text-white/90">Action Items</h4>
 {isLoadingTasks && <Loader2 className="w-3 h-3 text-white/30 animate-spin" />}
 </div>
 <Button
 variant="ghost"
 size="icon"
 className="w-5 h-5 hover:bg-white/[0.08] text-white/50"
 onClick={handleCreateTask}
 title="Add task"
 >
 <Plus className="w-3 h-3" />
 </Button>
 </div>

 {/* Quick Add Task Input */}
 <div className="mb-3">
 <Input
 value={newTaskTitle}
 onChange={e => setNewTaskTitle(e.target.value)}
 onKeyDown={e => e.key === 'Enter' && handleCreateTask()}
 placeholder="Add a task and press Enter…"
 className="bg-zinc-900 border-white/10 text-label rounded-xl focus:border-emerald-500/50 placeholder:text-white/20"
 />
 </div>

 <div className="space-y-4">
 
 {/* My Tasks Section */}
 <div>
 <h5 className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-2">My Tasks</h5>
 <div className="space-y-1.5">
 {tasks.filter(t => t.list === 'My Tasks' || t.list === 'my-tasks').map(task => (
 <div key={task.id} className="group flex items-start gap-2 p-2 rounded-xl hover:bg-white/[0.04] transition-colors cursor-pointer" onClick={() => setSelectedTaskId(task.id)}>
 <button onClick={(e) => { e.stopPropagation(); toggleTask(task.id); }} className="mt-0.5 shrink-0 transition-colors">
 {task.done ? (
 <CheckCircle2 className="w-4 h-4 text-emerald-500" />
 ) : (
 <Circle className="w-4 h-4 text-white/20 group-hover:text-emerald-500/50" />
 )}
 </button>
 <div className="flex-1 min-w-0 pt-0.5">
 <p className={cn("text-[11px] leading-tight transition-all", task.done ? "text-white/30 line-through" : "text-white/80")}>
 {task.title}
 </p>
 {!task.done && (
 <div className="flex items-center gap-2 mt-1">
 {task.priority === 'high' && <span className="text-[8px] font-bold text-rose-400 uppercase">High Priority</span>}
 {task.priority === 'medium' && <span className="text-[8px] font-bold text-amber-400 uppercase">Medium</span>}
 </div>
 )}
 </div>
 </div>
 ))}
 {!isLoadingTasks && tasks.filter(t => t.list === 'My Tasks' || t.list === 'my-tasks').length === 0 && (
 <p className="text-[10px] text-white/20 px-2 py-1">No tasks yet. Add one above!</p>
 )}
 </div>
 </div>

 {/* Delegated Section */}
 <div>
 <h5 className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-2 mt-2">Delegated</h5>
 <div className="space-y-1.5">
 {tasks.filter(t => t.list === 'Delegated' || t.list === 'delegated').map(task => (
 <div key={task.id} className="group flex items-start gap-2 p-2 rounded-xl hover:bg-white/[0.04] transition-colors cursor-pointer" onClick={() => setSelectedTaskId(task.id)}>
 <button onClick={(e) => { e.stopPropagation(); toggleTask(task.id); }} className="mt-0.5 shrink-0 transition-colors">
 {task.done ? (
 <CheckCircle2 className="w-4 h-4 text-emerald-500" />
 ) : (
 <Circle className="w-4 h-4 text-white/20 group-hover:text-emerald-500/50" />
 )}
 </button>
 <div className="flex-1 min-w-0 pt-0.5">
 <p className={cn("text-[11px] leading-tight transition-all", task.done ? "text-white/30 line-through" : "text-white/80")}>
 {task.title}
 </p>
 {!task.done && (
 <div className="flex items-center gap-1 mt-1">
 <div className="w-3.5 h-3.5 rounded bg-blue-500 flex items-center justify-center text-[7px] font-bold text-white">IK</div>
 <span className="text-[8px] text-white/40">Waiting on assignee</span>
 </div>
 )}
 </div>
 </div>
 ))}
 {!isLoadingTasks && tasks.filter(t => t.list === 'Delegated' || t.list === 'delegated').length === 0 && (
 <p className="text-[10px] text-white/20 px-2 py-1">No delegated tasks.</p>
 )}
 </div>
 </div>

 </div>
 </div>
 
 </div>
 </ScrollArea>
 </>
 )}
 </div>

 {/* Workspace OS Panel — right side intelligence */}
 <WorkspaceOSPanel
 onCreateWorkspace={(id) => console.log('[WorkspaceOS] Creating:', id)}
 />
 </div>
 );
};
