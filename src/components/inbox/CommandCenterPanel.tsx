/**
 * CommandCenterPanel — Smart Inbox AI Sidebar
 *
 * Mounts inside Smart Inbox as a right-side panel.
 * Features:
 * - Unified search across mail + messages + tasks + files
 * - AI triage: what needs attention NOW
 * - Quick action shortcuts
 * - Intent-aware suggestions from GlobalIntentProvider
 * - Today's summary stats
 */

import React, { useState, useEffect, useRef } from 'react';
import {
 Search, Zap, Mail, MessageSquare, CheckCircle2, FileText,
 Clock, AlertTriangle, Star, ArrowUpRight, Loader2, Sparkles,
 BarChart2, Bell, Filter, ChevronRight, Phone, Calendar
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useCHATROS } from '@/core/os/hooks';
import { kernelClient } from '@/core/ipc/KernelClient';
import { osScheduler } from '@/core/services/OSSchedulerService';

interface TriageItem {
 id: string;
 type: 'email' | 'message' | 'task' | 'reminder' | 'call';
 title: string;
 sender?: string;
 urgency: 'high' | 'medium' | 'low';
 timeAgo: string;
 actionLabel: string;
}

interface CommandCenterPanelProps {
 onSearch?: (q: string) => void;
 stats?: { unread: number; tasks: number; meetings: number };
}

const URGENCY_COLORS = {
 high: 'border-red-500/30 bg-red-500/[0.04]',
 medium: 'border-amber-500/30 bg-amber-500/[0.04]',
 low: 'border-white/[0.05] bg-white/[0.02]',
};
const URGENCY_DOT = { high: 'bg-red-500', medium: 'bg-amber-400', low: 'bg-white/20' };

const TYPE_ICONS: Record<string, React.ReactNode> = {
 email: <Mail className="w-3 h-3" />,
 message: <MessageSquare className="w-3 h-3" />,
 task: <CheckCircle2 className="w-3 h-3" />,
 reminder: <Bell className="w-3 h-3" />,
 call: <Phone className="w-3 h-3" />,
};
const TYPE_COLORS: Record<string, string> = {
 email: 'text-cyan-400',
 message: 'text-blue-400',
 task: 'text-emerald-400',
 reminder: 'text-violet-400',
 call: 'text-orange-400',
};

export const CommandCenterPanel: React.FC<CommandCenterPanelProps> = ({
 onSearch,
 stats = { unread: 0, tasks: 0, meetings: 0 },
}) => {
 const [searchQuery, setSearchQuery] = useState('');
 const [triage, setTriage] = useState<TriageItem[]>([]);
 const [aiLoading, setAiLoading] = useState(false);
 const [aiBrief, setAiBrief] = useState('');
 const [activeFilter, setActiveFilter] = useState<string>('all');
 const { knowledge, scheduledToday, observeText } = useCHATROS();
 const inputRef = useRef<HTMLInputElement>(null);

 // Build triage from OSScheduler and knowledge
 useEffect(() => {
 const built: TriageItem[] = [];

 // From scheduled items today
 scheduledToday.slice(0, 5).forEach(entry => {
 built.push({
 id: entry.id,
 type: 'reminder',
 title: entry.title,
 urgency: new Date(entry.scheduledFor) < new Date() ? 'high' : 'medium',
 timeAgo: new Date(entry.scheduledFor).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
 actionLabel: 'View',
 });
 });

 // From detected intents in knowledge
 if (knowledge.intents.includes('email')) {
 built.push({ id: 'email-intent', type: 'email', title: 'Emails awaiting reply', urgency: 'medium', timeAgo: 'now', actionLabel: 'Open' });
 }
 if (knowledge.intents.includes('followup')) {
 built.push({ id: 'followup-intent', type: 'task', title: 'Follow-ups overdue', urgency: 'high', timeAgo: 'now', actionLabel: 'Review' });
 }
 if (knowledge.intents.includes('meeting')) {
 built.push({ id: 'meeting-intent', type: 'reminder', title: 'Upcoming meeting', urgency: 'medium', timeAgo: 'soon', actionLabel: 'Join' });
 }

 // Static demo triage if empty
 if (built.length === 0) {
 built.push(
 { id: 'd1', type: 'call', title: 'Interview starts in 10 minutes', sender: 'Calendar', urgency: 'high', timeAgo: 'now', actionLabel: 'Join' },
 { id: 'd2', type: 'task', title: 'Invoice overdue', sender: 'Finance', urgency: 'high', timeAgo: '2h ago', actionLabel: 'Pay' },
 { id: 'd3', type: 'message', title: 'GitHub build failed', sender: 'CI/CD', urgency: 'high', timeAgo: '15m ago', actionLabel: 'View' },
 { id: 'd4', type: 'message', title: 'Slack incident', sender: 'DevOps', urgency: 'high', timeAgo: '30m ago', actionLabel: 'Acknowledge' },
 { id: 'd5', type: 'message', title: 'LinkedIn recruiter waiting', sender: 'Recruiting', urgency: 'medium', timeAgo: '1h ago', actionLabel: 'Reply' },
 { id: 'd6', type: 'reminder', title: 'Calendar conflict', sender: 'Calendar', urgency: 'medium', timeAgo: '3h ago', actionLabel: 'Resolve' }
 );
 }

 // Sort: high → medium → low
 built.sort((a, b) => { const o = { high: 0, medium: 1, low: 2 }; return o[a.urgency] - o[b.urgency]; });
 setTriage(built);
 }, [scheduledToday, knowledge]);

 const generateBrief = async () => {
 setAiLoading(true);
 try {
 const count = scheduledToday.length;
 const intents = knowledge.intents.join(', ');
 
 const response = await kernelClient.dispatchIntent<{ brief: string }>({
 intent: 'generate_daily_brief',
 context: {
 scheduledCount: count,
 detectedIntents: intents || 'general communication'
 }
 });

 if (response.success && response.data?.brief) {
 setAiBrief(response.data.brief);
 } else {
 throw new Error(response.error || 'Failed to generate brief');
 }
 } catch (err) {
 console.warn('[CommandCenter] Intent failed:', err);
 setAiBrief('Start with high-urgency items. Clear your inbox before 12 PM for best focus.');
 } finally {
 setAiLoading(false);
 }
 };

 const handleSearch = (q: string) => {
 setSearchQuery(q);
 observeText(q);
 onSearch?.(q);
 };

 const filtered = activeFilter === 'all'
 ? triage
 : triage.filter(t => t.type === activeFilter || (activeFilter === 'urgent' && t.urgency === 'high'));

 const FILTERS = [
 { id: 'all', label: 'All' },
 { id: 'urgent', label: 'Urgent' },
 { id: 'email', label: 'Email' },
 { id: 'task', label: 'Tasks' },
 ];

 return (
 <div className="flex flex-col h-full bg-black/20 text-slate-300 font-sans backdrop-blur-md">
 <div className="flex-shrink-0 p-4 border-b border-white/[0.05]">
 <div className="flex items-center gap-2 mb-4 text-emerald-400">
 <Sparkles className="w-4 h-4" />
 <span className="text-label font-bold tracking-widest uppercase">Command Center</span>
 </div>

 {/* Search bar */}
 <div className="relative">
 <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30" />
 <input
 ref={inputRef}
 value={searchQuery}
 onChange={e => handleSearch(e.target.value)}
 placeholder="Search everything..."
 className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl pl-7 pr-3 py-2 text-[11px] text-white placeholder:text-white/25 focus:outline-none focus:border-cyan-500/40 transition-colors"
 />
 </div>
 </div>

 <ScrollArea className="flex-1">
 <div className="p-3 space-y-4">

 {/* Stats Bar */}
 <div className="grid grid-cols-3 gap-1.5">
 {[
 { label: 'Unread', value: stats.unread || scheduledToday.length, icon: <Mail className="w-3 h-3" />, color: 'text-cyan-400' },
 { label: 'Tasks', value: stats.tasks || knowledge.intents.filter(i => i === 'task').length, icon: <CheckCircle2 className="w-3 h-3" />, color: 'text-emerald-400' },
 { label: 'Meetings', value: stats.meetings || scheduledToday.filter(e => e.capability === 'core.meeting').length, icon: <Calendar className="w-3 h-3" />, color: 'text-violet-400' },
 ].map(s => (
 <div key={s.label} className="flex flex-col items-center gap-1 p-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
 <span className={s.color}>{s.icon}</span>
 <span className="text-[13px] font-bold text-white">{s.value}</span>
 <span className="text-[8px] text-white/30 uppercase tracking-wider">{s.label}</span>
 </div>
 ))}
 </div>

 {/* AI Brief */}
 <div className="p-2.5 rounded-xl bg-cyan-500/[0.06] border border-cyan-500/15">
 <div className="flex items-center gap-1.5 mb-1.5">
 <Sparkles className="w-3 h-3 text-cyan-400" />
 <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-wider">AI Brief</span>
 </div>
 {aiLoading ? (
 <div className="flex items-center gap-2 text-[10px] text-white/30">
 <Loader2 className="w-3 h-3 animate-spin" /> Generating...
 </div>
 ) : aiBrief ? (
 <p className="text-[10px] text-white/60 leading-relaxed">{aiBrief}</p>
 ) : (
 <button
 onClick={generateBrief}
 className="w-full py-1.5 text-[10px] text-cyan-400 font-semibold hover:text-cyan-300 transition-colors text-left"
 >
 Generate AI Daily Brief →
 </button>
 )}
 </div>

 {/* Triage: What Needs Attention */}
 <div>
 <div className="flex items-center justify-between mb-2">
 <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Needs Attention</span>
 <div className="flex gap-1">
 {FILTERS.map(f => (
 <button
 key={f.id}
 onClick={() => setActiveFilter(f.id)}
 className={cn(
 'px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider transition-colors',
 activeFilter === f.id ? 'bg-white/10 text-white/80' : 'text-white/25 hover:text-white/50'
 )}
 >
 {f.label}
 </button>
 ))}
 </div>
 </div>

 <div className="space-y-1.5">
 {filtered.map(item => (
 <div
 key={item.id}
 className={cn(
 'flex items-start gap-2.5 px-2.5 py-2 rounded-xl border transition-all hover:brightness-125 cursor-pointer',
 URGENCY_COLORS[item.urgency]
 )}
 >
 <div className="flex items-center gap-1.5 mt-0.5 shrink-0">
 <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', URGENCY_DOT[item.urgency])} />
 <span className={TYPE_COLORS[item.type]}>{TYPE_ICONS[item.type]}</span>
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-[11px] font-semibold text-white/80 leading-tight truncate">{item.title}</p>
 {item.sender && <p className="text-[9px] text-white/35 mt-0.5">from {item.sender}</p>}
 <p className="text-[9px] text-white/30">{item.timeAgo}</p>
 </div>
 <span className="text-[9px] text-white/30 hover:text-white/70 font-semibold shrink-0 transition-colors">
 {item.actionLabel}
 </span>
 </div>
 ))}
 {filtered.length === 0 && (
 <div className="text-center py-6">
 <CheckCircle2 className="w-5 h-5 text-emerald-500/40 mx-auto mb-2" />
 <p className="text-[10px] text-white/25">All clear — great job!</p>
 </div>
 )}
 </div>
 </div>

 {/* Quick Shortcuts */}
 <div>
 <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">Quick Actions</p>
 <div className="space-y-1">
 {[
 { label: 'Compose Email', icon: <Mail className="w-3 h-3" />, color: 'text-cyan-400' },
 { label: 'New Task', icon: <CheckCircle2 className="w-3 h-3" />, color: 'text-emerald-400' },
 { label: 'Schedule Meeting', icon: <Calendar className="w-3 h-3" />, color: 'text-violet-400' },
 { label: 'Set Reminder', icon: <Bell className="w-3 h-3" />, color: 'text-amber-400' },
 ].map(action => (
 <button
 key={action.label}
 className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-white/[0.04] transition-colors"
 onClick={() => observeText(action.label)}
 >
 <span className={action.color}>{action.icon}</span>
 <span className="text-[11px] text-white/60 hover:text-white/80 transition-colors">{action.label}</span>
 <ArrowUpRight className="w-3 h-3 text-white/15 ml-auto" />
 </button>
 ))}
 </div>
 </div>

 {/* Detected Knowledge from typing */}
 {(knowledge.people.length > 0 || knowledge.intents.length > 0) && (
 <div>
 <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">Detected Context</p>
 <div className="flex flex-wrap gap-1.5">
 {knowledge.people.map((p, i) => (
 <span key={i} className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[9px] font-bold text-blue-400">{p}</span>
 ))}
 {knowledge.intents.map((intent, i) => (
 <span key={i} className="px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-[9px] font-bold text-violet-400 capitalize">{intent}</span>
 ))}
 </div>
 </div>
 )}
 </div>
 </ScrollArea>
 </div>
 );
};
