import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useService, usePlatformReady } from '@/platform/Infrastructure/PlatformContext';
import type { CalendarEvent } from '@/platform/Domain/Execution/CalendarService';
import type { ActivityItem } from '@/platform/Domain/Activity/ActivityService';
import {
 MessageSquare, Phone, Video, Users, Sparkles, Calendar, CheckSquare,
 BrainCircuit, ArrowRight, Clock, PhoneMissed, FileText, Inbox,
 TrendingUp, Zap, BookOpen, MoreHorizontal, RefreshCw, Activity,
 ChevronRight, Building2, Hash, Shield, Battery, BatteryCharging,
 Clipboard, Monitor, Wifi, WifiOff, Cpu, Star, Pin,
 ChevronDown, ChevronUp, Send, Archive, Bot, Mic,
 Play, Pause, CheckCircle2, AlertCircle, Upload, Lock,
 Layers, BarChart3, FileSpreadsheet, Presentation, Image,
 MailOpen, Reply, CalendarPlus, Lightbulb, Settings2,
 Radio, HardDrive, CloudSync, Bell, Globe
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HomeStats {
 unreadMessages: number;
 missedCalls: number;
 meetingsToday: number;
 aiDrafts: number;
 tasksOverdue: number;
 pendingTickets: number;
}

// ─── Static Data ──────────────────────────────────────────────────────────────

const RECENT_CONVERSATIONS = [
 { id: '1', name: 'Rahul Sharma', avatar: 'RS', color: 'from-blue-600 to-cyan-500', message: 'Can we push the deadline to Friday?', time: '2m', unread: 3, status: 'typing', presence: 'online' as const },
 { id: '2', name: 'Isha Kapoor', avatar: 'IK', color: 'from-pink-600 to-rose-400', message: '✓ Invoice approved — see attachment', time: '14m', unread: 0, status: null, presence: 'online' as const },
 { id: '3', name: 'Recruitment Team', avatar: 'RT', color: 'from-purple-600 to-fuchsia-400', message: 'Shortlisted 4 candidates for review', time: '1h', unread: 7, status: null, presence: 'busy' as const },
 { id: '4', name: 'AI Assistant', avatar: 'AI', color: 'from-violet-700 to-purple-500', message: 'Your meeting summary is ready', time: '1h', unread: 1, status: null, presence: 'online' as const },
 { id: '5', name: 'Finance Dept', avatar: 'FD', color: 'from-emerald-600 to-teal-400', message: 'Q3 budget report uploaded', time: '3h', unread: 0, status: null, presence: 'away' as const },
 { id: '6', name: 'Sanobar', avatar: 'SA', color: 'from-orange-600 to-amber-400', message: 'Proposal_v3.pdf sent for your review', time: '5h', unread: 2, status: null, presence: 'away' as const },
];

const PINNED_ITEMS = [
 { name: 'Product Roadmap', icon: Presentation, color: 'text-blue-400' },
 { name: 'Finance Channel', icon: BarChart3, color: 'text-emerald-400' },
 { name: 'AI Workspace', icon: BrainCircuit, color: 'text-violet-400' },
];

const TEAM_PULSE = [
 { name: 'Rahul', avatar: 'R', color: 'from-blue-600 to-cyan-500', status: 'Typing in #design', presence: 'online' as const },
 { name: 'Isha', avatar: 'I', color: 'from-pink-600 to-rose-400', status: 'In Meeting (28m)', presence: 'busy' as const },
 { name: 'Harish', avatar: 'H', color: 'from-emerald-600 to-teal-400', status: 'Available', presence: 'online' as const },
 { name: 'Finance', avatar: 'F', color: 'from-amber-600 to-orange-400', status: '5 active members', presence: 'online' as const },
];

const TODAYS_AGENDA = [
 { time: '09:30', title: 'Product Review', participants: 6, color: 'bg-blue-500', soon: false, done: true },
 { time: '11:00', title: 'Client Call — TechCorp', participants: 3, color: 'bg-purple-500', soon: false, done: true },
 { time: '14:00', title: 'Interview — Senior Engineer', participants: 4, color: 'bg-amber-500', soon: true, done: false },
 { time: '16:30', title: 'Q3 Follow-up', participants: 2, color: 'bg-emerald-500', soon: false, done: false },
];

const PRIORITY_INBOX = [
 {
 id: 'e1', sender: 'Rahul Sharma', avatar: 'RS', color: 'from-blue-600 to-cyan-500',
 subject: 'Re: Contract renewal — urgent sign-off needed',
 snippet: 'Hi, the client needs the signed contract before COB today. Can you please review...',
 time: '9:41 AM', tag: 'Needs Reply', tagColor: 'bg-red-500/15 text-red-400 border-red-500/20',
 aiSuggestion: 'Draft reply: "I\'ll review and sign by 3 PM today."'
 },
 {
 id: 'e2', sender: 'Finance Dept', avatar: 'FD', color: 'from-emerald-600 to-teal-400',
 subject: 'Invoice #244 — Approval required (₹1,24,000)',
 snippet: 'Please approve the attached invoice from vendor Acme Corp for Q3 services...',
 time: '8:52 AM', tag: 'Invoice', tagColor: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
 aiSuggestion: 'AI: Vendor verified, amount matches PO. Safe to approve.'
 },
 {
 id: 'e3', sender: 'Sanobar Khan', avatar: 'SK', color: 'from-orange-600 to-amber-400',
 subject: 'Proposal_v3 — Review requested',
 snippet: 'Attaching the updated proposal with the revised pricing model and timeline...',
 time: 'Yesterday', tag: 'Action', tagColor: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
 aiSuggestion: 'AI summarized: 3 key changes from v2. View summary?'
 },
];

const RECENT_FILES = [
 { name: 'Contract_Acme.pdf', type: 'pdf', size: '2.4 MB', time: '2h ago', icon: FileText, color: 'text-red-400', bg: 'bg-red-500/10' },
 { name: 'Q3_Roadmap.pptx', type: 'pptx', size: '8.1 MB', time: '5h ago', icon: Presentation, color: 'text-orange-400', bg: 'bg-orange-500/10' },
 { name: 'MeetingNotes.docx', type: 'docx', size: '340 KB', time: 'Yesterday', icon: FileText, color: 'text-blue-400', bg: 'bg-blue-500/10' },
 { name: 'Budget_Q3.xlsx', type: 'xlsx', size: '1.2 MB', time: 'Yesterday', icon: FileSpreadsheet, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
];

const TASKS = {
 today: [
 { id: 't1', text: 'Approve Acme invoice', priority: 'high' },
 { id: 't2', text: 'Review interview shortlist', priority: 'medium' },
 ],
 inProgress: [
 { id: 't3', text: 'Contract renewal with TechCorp', priority: 'high' },
 { id: 't4', text: 'Q3 budget finalization', priority: 'medium' },
 ],
 done: [
 { id: 't5', text: 'Product review meeting', priority: 'low' },
 { id: 't6', text: 'AI summary reviewed', priority: 'low' },
 ],
};

// ACTIVITY_FEED static data replaced by live ActivityService — see component below

const ACTIVITY_ICON_MAP: Record<string, any> = {
 message: MessageSquare,
 task: CheckCircle2,
 meeting: Calendar,
 file: FileText,
 system: Zap,
 ai: BrainCircuit,
};

const ACTIVITY_COLOR_MAP: Record<string, string> = {
 message: 'text-blue-400 bg-blue-500/10',
 task: 'text-emerald-400 bg-emerald-500/10',
 meeting: 'text-violet-400 bg-violet-500/10',
 file: 'text-sky-400 bg-sky-500/10',
 system: 'text-zinc-400 bg-zinc-500/10',
 ai: 'text-violet-400 bg-violet-500/10',
};

const AI_TIMELINE = [
 { time: '9:41', event: 'Drafted reply for Rahul\'s contract email', icon: Reply },
 { time: '9:38', event: 'Summarized Q3 review meeting (42 min)', icon: Sparkles },
 { time: '9:20', event: 'Organized 14 unread emails by priority', icon: Inbox },
 { time: '8:55', event: 'Detected duplicate invoice — flagged', icon: AlertCircle },
 { time: '8:10', event: 'Prepared brief for 11:00 Client Call', icon: Calendar },
];

const SUGGESTED_REPLIES = [
 {
 to: 'Rahul Sharma',
 subject: 'Contract renewal',
 draft: 'Hi Rahul, I\'ll review and sign the contract by 3 PM today. Will keep you posted.',
 confidence: 94,
 },
 {
 to: 'Finance Dept',
 subject: 'Invoice #244',
 draft: 'Approved. Please proceed with the payment to Acme Corp for Q3 services.',
 confidence: 88,
 },
];

const AUTOMATIONS = [
 { name: 'Email Digest', status: 'Running', color: 'bg-emerald-500', desc: 'Next run in 4h' },
 { name: 'Task Sync', status: 'Active', color: 'bg-blue-500', desc: 'Real-time' },
 { name: 'Invoice Watch', status: 'Watching', color: 'bg-amber-500', desc: '3 pending' },
];

const SMART_INSIGHTS = [
 { text: 'Rahul\'s reply rate is highest on Tuesdays', icon: TrendingUp, color: 'text-blue-400' },
 { text: 'You resolve invoices 2× faster in mornings', icon: Zap, color: 'text-amber-400' },
 { text: 'Team productivity peaks between 10–12 PM', icon: BarChart3, color: 'text-emerald-400' },
];

// ─── Micro components ─────────────────────────────────────────────────────────

const PresenceDot: React.FC<{ status: 'online' | 'away' | 'busy'; size?: 'sm' | 'md' }> = ({ status, size = 'sm' }) => {
 const colors = { online: 'bg-emerald-400', away: 'bg-amber-400', busy: 'bg-red-500' };
 const sizes = { sm: 'w-2 h-2', md: 'w-2.5 h-2.5' };
 return <span className={cn('rounded-full ring-[1.5px] ring-zinc-900 shrink-0', colors[status], sizes[size])} />;
};

const TypingDots: React.FC = () => (
 <span className="flex items-center gap-0.5">
 {[0, 1, 2].map(i => (
 <span
 key={i}
 className="w-1 h-1 rounded-full bg-emerald-400"
 style={{ animation: `bounce 1s infinite ${i * 0.15}s` }}
 />
 ))}
 </span>
);

const SectionLabel: React.FC<{ icon: React.ElementType; label: string; badge?: number; action?: { label: string; onClick: () => void } }> =
 ({ icon: Icon, label, badge, action }) => (
 <div className="flex items-center justify-between mb-2.5 px-0.5">
 <div className="flex items-center gap-1.5">
 <Icon className="w-3.5 h-3.5 text-white/30" />
 <span className="text-[10px] font-bold text-white/35 uppercase tracking-widest">{label}</span>
 {badge !== undefined && badge > 0 && (
 <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[8px] font-black flex items-center justify-center animate-pulse">
 {badge > 9 ? '9+' : badge}
 </span>
 )}
 </div>
 {action && (
 <button onClick={action.onClick} className="text-[10px] text-white/25 hover:text-white/60 transition-colors font-medium">
 {action.label}
 </button>
 )}
 </div>
 );

const Card: React.FC<{ children: React.ReactNode; className?: string; elevated?: boolean }> = ({ children, className, elevated }) => (
 <div className={cn(
 'rounded-2xl border transition-all duration-200',
 elevated
 ? 'bg-zinc-900/90 border-white/[0.09] shadow-xl shadow-black/40'
 : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05]',
 className
 )}>
 {children}
 </div>
);

// ─── Main Component ────────────────────────────────────────────────────────────

export const AdaptiveHome: React.FC = () => {
 const navigate = useNavigate();
 const isReady = usePlatformReady();
 const calendarService = useService<any>('CalendarService');
 const notificationService = useService<any>('NotificationService');
 const activityService = useService<any>('ActivityService');

 const [profile, setProfile] = useState<any>(null);
 const [stats, setStats] = useState<HomeStats>({ unreadMessages: 0, missedCalls: 0, meetingsToday: 0, aiDrafts: 0, tasksOverdue: 0, pendingTickets: 0 });
 const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
 const [unreadNotifCount, setUnreadNotifCount] = useState(0);
 const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
 const [briefExpanded, setBriefExpanded] = useState(false);
 const [networkStatus, setNetworkStatus] = useState<'excellent' | 'good' | 'poor'>('excellent');
 const [currentTime, setCurrentTime] = useState(new Date());
 const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
 const [checkedTasks, setCheckedTasks] = useState<Set<string>>(new Set());
 const [activePresence, setActivePresence] = useState<string | null>(null);
 const [voiceActive, setVoiceActive] = useState(false);
 const [focusMinutes] = useState(18);

 // Real-time clock
 useEffect(() => {
 const t = setInterval(() => setCurrentTime(new Date()), 30000);
 return () => clearInterval(t);
 }, []);

 // Network
 useEffect(() => {
 const update = () => setNetworkStatus(navigator.onLine ? 'excellent' : 'poor');
 window.addEventListener('online', update);
 window.addEventListener('offline', update);
 update();
 return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
 }, []);

 // Fetch profile + base stats (messages)
 useEffect(() => {
 const loadAll = async () => {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return;
 const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
 if (prof) setProfile(prof);
 const { data: myParts } = await supabase.from('conversation_participants').select('conversation_id').eq('user_id', user.id);
 const convIds = (myParts || []).map((p: any) => p.conversation_id);
 if (convIds.length > 0) {
 const yesterday = new Date(Date.now() - 86400000).toISOString();
 const { count: msgCount } = await supabase.from('messages').select('id', { count: 'exact', head: true }).in('conversation_id', convIds).neq('sender_id', user.id).gte('created_at', yesterday);
 setStats(prev => ({ ...prev, unreadMessages: msgCount || 0 }));
 }

 // Load unread notification count
 if (notificationService) {
 const count = await notificationService.getUnreadCount(user.id).catch(() => 0);
 setUnreadNotifCount(count);
 // Subscribe to new notifications
 notificationService.onNewNotification(() => {
 notificationService.getUnreadCount(user.id).then((c: number) => setUnreadNotifCount(c)).catch(() => {});
 });
 }
 };
 loadAll();
 }, [notificationService]);

 // Load upcoming calendar events (today + next 7 days)
 useEffect(() => {
 if (!isReady || !calendarService) return;
 const resolveWorkspaceAndLoad = async () => {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return;
 const { data: memberRows } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).limit(1);
 const workspaceId = memberRows?.[0]?.workspace_id;
 if (!workspaceId) return;

 const events = await calendarService.getUpcomingEvents(workspaceId, 5).catch(() => []);
 setUpcomingEvents(events);
 setStats(prev => ({ ...prev, meetingsToday: events.filter((e: CalendarEvent) => {
 const d = new Date(e.startAt);
 const now = new Date();
 return d.toDateString() === now.toDateString();
 }).length }));
 };
 resolveWorkspaceAndLoad();
 }, [isReady, calendarService]);

 // Load live activity feed
 useEffect(() => {
 if (!isReady || !activityService) return;
 activityService.getRecentActivity(20).then((items: ActivityItem[]) => {
 setActivityFeed(items);
 }).catch(() => {});

 // Subscribe to new activities in real-time
 const unsub = activityService.onNewActivity((item: ActivityItem) => {
 setActivityFeed(prev => [item, ...prev].slice(0, 20));
 });
 return () => unsub?.();
 }, [isReady, activityService]);

 const hour = currentTime.getHours();
 const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
 const firstName = (profile?.full_name || profile?.display_name || profile?.username || 'Arshid').split(' ')[0].replace(/\?/g, '') || 'Arshid';
 const timeStr = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
 const totalUnread = RECENT_CONVERSATIONS.reduce((sum, c) => sum + c.unread, 0);

 const toggleTask = (id: string) => {
 setCheckedTasks(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
 };

 return (
 <div className="flex flex-col h-full overflow-hidden bg-[#0a0a12]">

 {/* ══════════════════════════════════════════════════════
 AI DAILY BRIEF BAR
 ══════════════════════════════════════════════════════ */}
 <div className={cn(
 'shrink-0 border-b border-white/[0.06] bg-gradient-to-r from-violet-950/70 via-[#0e0b1f]/80 to-indigo-950/50 backdrop-blur-xl transition-all duration-300 relative overflow-hidden',
 briefExpanded ? 'py-4' : 'py-2.5'
 )}>
 {/* Top gradient line */}
 <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />
 <div className="absolute -top-10 left-1/4 w-64 h-32 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

 <div className="px-5 relative z-10">
 {/* Collapsed header */}
 <div className="flex items-center gap-4">
 <div className="flex items-center gap-2.5">
 <div className="w-7 h-7 rounded-lg bg-violet-600/25 border border-violet-500/30 flex items-center justify-center shrink-0">
 <BrainCircuit className="w-3.5 h-3.5 text-violet-300" />
 </div>
 <div>
 <div className="flex items-center gap-2">
 <span className="text-secondary font-bold text-white/90">{greeting}, {firstName}</span>
 <span className="flex items-center gap-1.5 text-label bg-white/10 px-2 py-0.5 rounded-lg border border-white/20 backdrop-blur-md shadow-sm">
 <Clock className="w-3.5 h-3.5 text-violet-300" /> 
 <span className="tracking-wide font-medium">{timeStr}</span>
 </span>
 </div>
 <div className="flex items-center gap-1.5 mt-0.5">
 <span className="text-label text-white/50">You're on track today</span>
 </div>
 </div>
 </div>

 {/* Stat chips — wired to live data */}
 <div className="flex items-center gap-2 flex-wrap">
 {[
 { val: `${stats.meetingsToday} meeting${stats.meetingsToday !== 1 ? 's' : ''} today`, color: 'text-blue-400', dot: 'bg-blue-400' },
 { val: `${stats.unreadMessages > 0 ? stats.unreadMessages : 'No'} new message${stats.unreadMessages !== 1 ? 's' : ''}`, color: 'text-amber-400', dot: 'bg-amber-400' },
 { val: unreadNotifCount > 0 ? `${unreadNotifCount} notification${unreadNotifCount !== 1 ? 's' : ''}` : 'All caught up', color: 'text-violet-400', dot: 'bg-violet-400' },
 { val: 'Synced', color: 'text-emerald-400', dot: 'bg-emerald-400' },
 ].map((chip, i) => (
 <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/[0.06]">
 <div className={cn('w-1.5 h-1.5 rounded-full', chip.dot)} />
 <span className={cn('text-[10px] font-semibold', chip.color)}>{chip.val}</span>
 </div>
 ))}
 </div>

 <div className="flex-1" />

 {/* Suggested action pills */}
 <div className="hidden xl:flex items-center gap-2">
 {['Reply to Rahul', 'Approve Invoice', 'Prepare Meeting Notes'].map((a, i) => (
 <button key={i} className="px-3 py-1 rounded-full bg-violet-600/20 hover:bg-violet-600/35 border border-violet-500/25 text-[10px] font-bold text-violet-300 transition-all">
 {a}
 </button>
 ))}
 </div>

 <button onClick={() => setBriefExpanded(p => !p)} className="ml-3 w-6 h-6 rounded-md bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center transition-colors shrink-0">
 {briefExpanded ? <ChevronUp className="w-3.5 h-3.5 text-white/50" /> : <ChevronDown className="w-3.5 h-3.5 text-white/50" />}
 </button>
 </div>

 {/* Expanded content */}
 {briefExpanded && (
 <div className="mt-4 grid grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
 <div className="space-y-2">
 <div className="text-[10px] font-bold text-white/35 uppercase tracking-widest">Today's Checklist</div>
 {[
 { text: '12 emails need review', done: false },
 { text: '3 invoices pending approval', done: false },
 { text: 'Rahul hasn\'t replied in 4 days', done: false },
 { text: 'Product review meeting — done ✓', done: true },
 ].map((item, i) => (
 <div key={i} className={cn('flex items-center gap-2 text-label', item.done ? 'text-white/30 line-through' : 'text-white/70')}>
 <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', item.done ? 'bg-white/20' : 'bg-violet-400')} />
 {item.text}
 </div>
 ))}
 </div>
 <div className="space-y-2">
 <div className="text-[10px] font-bold text-white/35 uppercase tracking-widest">Risks</div>
 {['Contract deadline today at 5PM', 'Overdue invoice from vendor', 'Interview prep not started'].map((r, i) => (
 <div key={i} className="flex items-center gap-2 text-label text-amber-400/80">
 <AlertCircle className="w-3 h-3 shrink-0" />{r}
 </div>
 ))}
 </div>
 <div className="space-y-2">
 <div className="text-[10px] font-bold text-white/35 uppercase tracking-widest">AI Can Handle</div>
 {['Draft contract reply (2 min)', 'Approve invoice with summary (1 min)', 'Generate interview brief (4 min)'].map((a, i) => (
 <button key={i} className="flex items-center gap-2 text-button text-violet-300 hover:text-white transition-colors">
 <Sparkles className="w-3 h-3 shrink-0 text-violet-400" />{a}
 </button>
 ))}
 </div>
 </div>
 )}
 </div>
 </div>

 {/* ══════════════════════════════════════════════════════
 3-COLUMN MAIN LAYOUT
 ══════════════════════════════════════════════════════ */}
 <div className="flex-1 flex overflow-hidden">

 {/* ── LEFT COLUMN — Communication & People ──────────────────── */}
 <div className="w-[22%] min-w-[240px] max-w-[300px] shrink-0 border-r border-white/[0.06] bg-[#0b0b14] flex flex-col">
 <ScrollArea className="flex-1">
 <div className="p-3 space-y-5 pb-4">

 {/* Quick Actions */}
 <div>
 <SectionLabel icon={Zap} label="Quick Actions" />
 <div className="grid grid-cols-2 gap-1.5">
 {[
 { icon: MessageSquare, label: 'New Chat', color: 'text-blue-400', onClick: () => navigate('/desktop/chat') },
 { icon: Phone, label: 'Call Back', color: 'text-emerald-400', onClick: () => navigate('/desktop/calls') },
 { icon: Video, label: 'Start Meet', color: 'text-purple-400', onClick: () => navigate('/desktop/calls') },
 { icon: Sparkles, label: 'Ask AI', color: 'text-violet-400', onClick: () => navigate('/desktop/canvas') },
 ].map((a, i) => (
 <button key={i} onClick={a.onClick} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.05] transition-all group">
 <a.icon className={cn('w-3.5 h-3.5 shrink-0', a.color)} />
 <span className="text-[11px] font-semibold text-white/70 group-hover:text-white/90 transition-colors">{a.label}</span>
 </button>
 ))}
 </div>
 </div>

 {/* Recent Conversations */}
 <div>
 <SectionLabel icon={MessageSquare} label="Recent" badge={totalUnread} action={{ label: 'All', onClick: () => navigate('/desktop/chat') }} />
 <div className="space-y-0.5">
 {RECENT_CONVERSATIONS.map((conv) => (
 <button
 key={conv.id}
 onClick={() => navigate('/desktop/chat')}
 className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl hover:bg-white/[0.05] transition-all group text-left"
 >
 {/* Avatar */}
 <div className="relative shrink-0">
 <div className={cn('w-8 h-8 rounded-full bg-gradient-to-br flex items-center justify-center text-[11px] font-bold text-white', conv.color)}>
 {conv.avatar.slice(0, 1)}
 </div>
 <div className="absolute -bottom-0.5 -right-0.5">
 <PresenceDot status={conv.presence} />
 </div>
 </div>
 {/* Content */}
 <div className="flex-1 min-w-0">
 <div className="flex items-center justify-between">
 <span className="text-[12px] font-semibold text-white/85 truncate">{conv.name}</span>
 <span className="text-[9px] text-white/30 shrink-0 ml-1">{conv.time}</span>
 </div>
 <div className="flex items-center gap-1 mt-0.5">
 {conv.status === 'typing' ? (
 <div className="flex items-center gap-1">
 <TypingDots />
 <span className="text-[10px] text-emerald-400 font-medium">typing...</span>
 </div>
 ) : (
 <p className="text-[10px] text-white/40 truncate">{conv.message}</p>
 )}
 </div>
 </div>
 {/* Unread */}
 {conv.unread > 0 && (
 <div className="w-4 h-4 rounded-full bg-violet-500 text-white text-[8px] font-black flex items-center justify-center shrink-0">
 {conv.unread > 9 ? '9+' : conv.unread}
 </div>
 )}
 </button>
 ))}
 </div>
 </div>

 {/* Pinned */}
 <div>
 <SectionLabel icon={Pin} label="Pinned" />
 <div className="space-y-1">
 {PINNED_ITEMS.map((p, i) => (
 <button key={i} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-white/[0.05] transition-colors text-left">
 <p.icon className={cn('w-3.5 h-3.5 shrink-0', p.color)} />
 <span className="text-[11px] text-white/65 hover:text-white/90 transition-colors font-medium">{p.name}</span>
 </button>
 ))}
 </div>
 </div>

 {/* Team Pulse */}
 <div>
 <SectionLabel icon={Users} label="Team Pulse" badge={TEAM_PULSE.filter(t => t.presence === 'online').length} />
 <div className="space-y-1">
 {TEAM_PULSE.map((member, i) => (
 <div key={i} className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-white/[0.04] transition-colors cursor-default">
 <div className="relative shrink-0">
 <div className={cn('w-7 h-7 rounded-full bg-gradient-to-br flex items-center justify-center text-[10px] font-bold text-white', member.color)}>
 {member.avatar}
 </div>
 <div className="absolute -bottom-0.5 -right-0.5">
 <PresenceDot status={member.presence} />
 </div>
 </div>
 <div className="flex-1 min-w-0">
 <div className="text-[11px] font-semibold text-white/80">{member.name}</div>
 <div className={cn('text-[9px] truncate', member.status.includes('Meeting') ? 'text-red-400/80' : member.status === 'Available' ? 'text-emerald-400/80' : 'text-white/40')}>
 {member.status}
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>

 </div>
 </ScrollArea>
 </div>

 {/* ── CENTER COLUMN — Work & Priorities ───────────────────────── */}
 <div className="flex-1 flex flex-col overflow-hidden min-w-0">
 <ScrollArea className="flex-1">
 <div className="p-4 space-y-4 pb-6">

 {/* ★ Focus Now Card */}
 <Card elevated className="relative overflow-hidden">
 <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
 <div className="absolute -right-8 -top-8 w-32 h-32 bg-amber-500/8 rounded-full blur-3xl pointer-events-none" />
 <div className="p-4 relative z-10">
 <div className="flex items-start justify-between mb-3">
 <div className="flex items-center gap-2">
 <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
 <Star className="w-3.5 h-3.5 text-amber-400" />
 </div>
 <div>
 <div className="text-secondary font-bold text-white/90">Focus Now</div>
 <div className="text-[10px] text-amber-400/80">Interview starts in {focusMinutes} minutes</div>
 </div>
 </div>
 <div className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/25">
 <span className="text-[10px] font-bold text-amber-400">{focusMinutes}m window</span>
 </div>
 </div>
 <div className="grid grid-cols-3 gap-2 mb-3">
 {[
 { action: 'Reply to Rahul', time: '2 min', icon: Reply, color: 'border-blue-500/25 bg-blue-500/5 text-blue-400' },
 { action: 'Approve Invoice', time: '1 min', icon: CheckCircle2, color: 'border-emerald-500/25 bg-emerald-500/5 text-emerald-400' },
 { action: 'Review Agenda', time: '4 min', icon: Calendar, color: 'border-purple-500/25 bg-purple-500/5 text-purple-400' },
 ].map((item, i) => (
 <button key={i} className={cn('flex flex-col items-start gap-1.5 p-3 rounded-xl border transition-all hover:scale-[1.02]', item.color)}>
 <item.icon className="w-3.5 h-3.5" />
 <div className="text-[10px] font-semibold text-left leading-tight">{item.action}</div>
 <div className="text-[9px] text-white/35">{item.time}</div>
 </button>
 ))}
 </div>
 <button className="w-full py-2 rounded-xl bg-violet-600/20 hover:bg-violet-600/35 border border-violet-500/25 text-[11px] font-bold text-violet-300 transition-all flex items-center justify-center gap-2">
 <Sparkles className="w-3.5 h-3.5" /> AI can complete all three for you
 </button>
 </div>
 </Card>

 {/* Top row: Agenda + Workspace Health */}
 <div className="grid grid-cols-5 gap-4">

 {/* Daily Timeline */}
 <Card elevated className="col-span-3">
 <div className="p-4">
 <SectionLabel icon={Calendar} label="Daily Timeline" action={{ label: 'Schedule', onClick: () => navigate('/desktop/workspace') }} />
 <div className="space-y-2 border-l-2 border-white/5 pl-4 ml-2 relative">
 {TODAYS_AGENDA.map((event, i) => (
 <div key={i} className={cn('flex items-center gap-3 p-2.5 rounded-xl border transition-all relative', event.done ? 'opacity-50 border-white/[0.04] bg-white/[0.01]' : event.soon ? 'border-amber-500/25 bg-amber-500/5' : 'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06]')}>
 <div className={cn('absolute -left-[23px] w-3 h-3 rounded-full border-2 border-zinc-950', event.color)} />
 <div className="flex-1 min-w-0">
 <div className="text-[11px] font-bold text-white/85 truncate">{event.title}</div>
 <div className="text-[9px] text-white/35 mt-0.5">{event.time} · {event.participants} participants</div>
 </div>
 {event.done && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/50 shrink-0" />}
 {event.soon && (
 <button className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/30 text-[9px] font-bold text-amber-400 shrink-0">
 Join
 </button>
 )}
 {!event.done && !event.soon && <ChevronRight className="w-3.5 h-3.5 text-white/20 shrink-0" />}
 </div>
 ))}
 </div>
 </div>
 </Card>

 {/* Workspace Health */}
 <Card elevated className="col-span-2">
 <div className="p-4">
 <SectionLabel icon={Monitor} label="Workspace Health" />
 <div className="space-y-2.5">
 {[
 { label: 'Sync', value: '99.9%', icon: RefreshCw, color: 'text-emerald-400', bar: 99 },
 { label: 'Threats', value: '0 found', icon: Shield, color: 'text-emerald-400', bar: 100 },
 { label: 'Cache', value: '14 GB', icon: HardDrive, color: 'text-blue-400', bar: 55 },
 { label: 'Uploads', value: '2 pending', icon: Upload, color: 'text-amber-400', bar: 30 },
 ].map((item, i) => (
 <div key={i} className="space-y-1">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-1.5">
 <item.icon className={cn('w-3 h-3', item.color)} />
 <span className="text-[10px] text-white/40">{item.label}</span>
 </div>
 <span className={cn('text-[10px] font-bold', item.color)}>{item.value}</span>
 </div>
 <div className="w-full h-1 rounded-full bg-white/[0.06] overflow-hidden">
 <div className={cn('h-full rounded-full transition-all', item.bar > 80 ? 'bg-emerald-500' : item.bar > 50 ? 'bg-blue-500' : 'bg-amber-500')} style={{ width: `${item.bar}%` }} />
 </div>
 </div>
 ))}
 </div>
 </div>
 </Card>
 </div>

 {/* Priority Inbox */}
 <Card elevated>
 <div className="p-4">
 <SectionLabel icon={Inbox} label="Priority Inbox" badge={PRIORITY_INBOX.length} action={{ label: 'Open Inbox', onClick: () => navigate('/desktop/smart-inbox') }} />
 <div className="space-y-2">
 {PRIORITY_INBOX.map((email) => (
 <div key={email.id} className={cn('rounded-xl border transition-all duration-200 overflow-hidden', expandedEmail === email.id ? 'border-violet-500/30 bg-violet-500/5' : 'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.05]')}>
 {/* Email row */}
 <button
 className="w-full flex items-start gap-3 p-3 text-left"
 onClick={() => setExpandedEmail(expandedEmail === email.id ? null : email.id)}
 >
 <div className={cn('w-8 h-8 rounded-full bg-gradient-to-br flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5', email.color)}>
 {email.avatar.slice(0, 1)}
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center justify-between gap-2">
 <span className="text-[11px] font-bold text-white/85 truncate">{email.sender}</span>
 <div className="flex items-center gap-1.5 shrink-0">
 <span className={cn('text-[8px] font-bold px-1.5 py-0.5 rounded border', email.tagColor)}>{email.tag}</span>
 <span className="text-[9px] text-white/30">{email.time}</span>
 </div>
 </div>
 <p className="text-[11px] font-semibold text-white/70 mt-0.5 truncate">{email.subject}</p>
 <p className="text-[10px] text-white/35 mt-0.5 truncate">{email.snippet}</p>
 </div>
 </button>

 {/* Expanded actions */}
 {expandedEmail === email.id && (
 <div className="px-3 pb-3 animate-in fade-in slide-in-from-top-1 duration-150">
 {/* AI suggestion */}
 <div className="flex items-start gap-2 p-2.5 rounded-lg bg-violet-500/10 border border-violet-500/20 mb-2.5">
 <Sparkles className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />
 <p className="text-[10px] text-violet-300 leading-relaxed">{email.aiSuggestion}</p>
 </div>
 {/* Action buttons */}
 <div className="flex items-center gap-1.5 flex-wrap">
 {[
 { icon: Reply, label: 'Reply', color: 'bg-blue-600/80 hover:bg-blue-500 text-white border-blue-500/30' },
 { icon: Archive, label: 'Archive', color: 'bg-white/[0.06] hover:bg-white/[0.1] text-white/70 border-white/[0.08]' },
 { icon: CalendarPlus, label: 'Schedule', color: 'bg-white/[0.06] hover:bg-white/[0.1] text-white/70 border-white/[0.08]' },
 { icon: Sparkles, label: 'AI Draft', color: 'bg-violet-600/60 hover:bg-violet-500 text-violet-200 border-violet-500/30' },
 { icon: Hash, label: 'Assign', color: 'bg-white/[0.06] hover:bg-white/[0.1] text-white/70 border-white/[0.08]' },
 ].map((action, i) => (
 <button key={i} className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold transition-all', action.color)}>
 <action.icon className="w-3 h-3" />{action.label}
 </button>
 ))}
 </div>
 </div>
 )}
 </div>
 ))}
 </div>
 </div>
 </Card>

 {/* Bottom row: Recent Files + Task Board */}
 <div className="grid grid-cols-2 gap-4">

 {/* Recent Files */}
 <Card elevated>
 <div className="p-4">
 <SectionLabel icon={FileText} label="Recent Files" action={{ label: 'All', onClick: () => {} }} />
 <div className="space-y-1.5">
 {RECENT_FILES.map((file, i) => (
 <button key={i} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-white/[0.06] transition-all group text-left">
 <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', file.bg)}>
 <file.icon className={cn('w-3.5 h-3.5', file.color)} />
 </div>
 <div className="flex-1 min-w-0">
 <div className="text-[11px] font-semibold text-white/80 truncate">{file.name}</div>
 <div className="text-[9px] text-white/30">{file.size} · {file.time}</div>
 </div>
 <ChevronRight className="w-3 h-3 text-white/15 group-hover:text-white/50 transition-colors" />
 </button>
 ))}
 </div>
 </div>
 </Card>

 {/* Task Board */}
 <Card elevated>
 <div className="p-4">
 <SectionLabel icon={CheckSquare} label="Task Board" badge={stats.tasksOverdue} action={{ label: 'Open', onClick: () => navigate('/desktop/workspace') }} />
 <div className="grid grid-cols-3 gap-2">
 {([
 { key: 'today', label: 'Today', color: 'text-amber-400', dot: 'bg-amber-400', tasks: TASKS.today },
 { key: 'inProgress', label: 'In Progress', color: 'text-blue-400', dot: 'bg-blue-400', tasks: TASKS.inProgress },
 { key: 'done', label: 'Done', color: 'text-emerald-400', dot: 'bg-emerald-500', tasks: TASKS.done },
 ] as const).map(col => (
 <div key={col.key}>
 <div className="flex items-center gap-1 mb-2">
 <div className={cn('w-1.5 h-1.5 rounded-full', col.dot)} />
 <span className={cn('text-[9px] font-bold uppercase tracking-wider', col.color)}>{col.label}</span>
 </div>
 <div className="space-y-1.5">
 {col.tasks.map(task => (
 <button
 key={task.id}
 onClick={() => toggleTask(task.id)}
 className={cn(
 'w-full text-left p-2 rounded-lg border text-[10px] leading-snug transition-all',
 checkedTasks.has(task.id)
 ? 'bg-white/[0.02] border-white/[0.04] text-white/25 line-through'
 : 'bg-white/[0.04] border-white/[0.06] text-white/70 hover:bg-white/[0.07]'
 )}
 >
 {task.text}
 </button>
 ))}
 </div>
 </div>
 ))}
 </div>
 </div>
 </Card>
 </div>

 {/* Activity Timeline */}
 <Card elevated>
 <div className="p-4">
 <SectionLabel icon={Activity} label="Live Activity" />
 <div className="space-y-1">
 {activityFeed.length === 0 ? (
 <div className="text-center py-6 text-white/25 text-[11px]">No activity yet — start collaborating!</div>
 ) : activityFeed.map((item) => {
 const originalType = item.metadata?.originalType || item.entityType || 'system';
 const Icon = ACTIVITY_ICON_MAP[originalType] || Zap;
 const colorClass = ACTIVITY_COLOR_MAP[originalType] || ACTIVITY_COLOR_MAP.system;
 const [iconColor, bgColor] = colorClass.split(' ');
 const timeStr = (() => {
 try {
 const d = new Date(item.createdAt);
 const now = new Date();
 const diffMs = now.getTime() - d.getTime();
 if (diffMs < 60000) return 'Just now';
 if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
 if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
 return 'Yesterday';
 } catch { return ''; }
 })();
 return (
 <div key={item.id} className="flex items-start gap-3 px-2 py-2 rounded-xl hover:bg-white/[0.04] transition-colors group">
 <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5', bgColor)}>
 <Icon className={cn('w-3 h-3', iconColor)} />
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-[11px] text-white/70 leading-snug">{item.description}</p>
 </div>
 <span className="text-[9px] text-white/25 shrink-0">{timeStr}</span>
 </div>
 );
 })}
 </div>
 </div>
 </Card>

 </div>
 </ScrollArea>
 </div>

 {/* ── RIGHT COLUMN — AI & Automation ──────────────────────────── */}
 <div className="w-[22%] min-w-[240px] max-w-[300px] shrink-0 border-l border-white/[0.06] bg-gradient-to-b from-violet-950/20 via-[#0b0b15] to-[#0a0a12] flex flex-col">
 <ScrollArea className="flex-1">
 <div className="p-3 space-y-4 pb-4">

 {/* AI Copilot Header */}
 <div className="flex items-center justify-between px-0.5">
 <div className="flex items-center gap-2">
 <div className="w-7 h-7 rounded-lg bg-violet-600/25 border border-violet-500/30 flex items-center justify-center">
 <BrainCircuit className="w-3.5 h-3.5 text-violet-300" />
 </div>
 <div>
 <div className="text-label font-bold text-white/90">AI Copilot</div>
 <div className="text-[9px] text-violet-400/70">Continuously working</div>
 </div>
 </div>
 <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
 <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
 <span className="text-[9px] font-bold text-emerald-400 uppercase">Live</span>
 </div>
 </div>

 {/* Meeting Prep */}
 <Card className="bg-amber-500/5 border-amber-500/20">
 <div className="p-3">
 <div className="flex items-center gap-2 mb-2">
 <Calendar className="w-3.5 h-3.5 text-amber-400" />
 <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Meeting Prep</span>
 </div>
 <p className="text-[11px] text-white/70 mb-2">
 <span className="font-bold text-white/85">Interview</span> starts in <span className="text-amber-400 font-bold">18 min</span> · 4 participants
 </p>
 <div className="space-y-1.5 mb-3">
 {['Candidate CV loaded', 'Questions ready (8)', 'Scorecard template open'].map((item, i) => (
 <div key={i} className="flex items-center gap-1.5 text-[10px] text-white/50">
 <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />{item}
 </div>
 ))}
 </div>
 <button className="w-full py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/25 text-[10px] font-bold text-amber-300 transition-all">
 Open Meeting Room
 </button>
 </div>
 </Card>

 {/* Suggested Replies */}
 <div>
 <SectionLabel icon={Reply} label="Suggested Replies" badge={SUGGESTED_REPLIES.length} />
 <div className="space-y-2.5">
 {SUGGESTED_REPLIES.map((reply, i) => (
 <Card key={i} className="bg-violet-500/5 border-violet-500/15">
 <div className="p-3">
 <div className="flex items-center justify-between mb-1.5">
 <span className="text-[10px] font-bold text-white/60">To: {reply.to}</span>
 <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{reply.confidence}% match</span>
 </div>
 <p className="text-[10px] text-white/55 leading-relaxed mb-2.5 italic">"{reply.draft}"</p>
 <div className="flex gap-1.5">
 <button className="flex-1 py-1.5 rounded-lg bg-violet-600/60 hover:bg-violet-500 text-[9px] font-bold text-white transition-all">Send</button>
 <button className="flex-1 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-[9px] font-bold text-white/60 transition-all border border-white/[0.07]">Edit</button>
 </div>
 </div>
 </Card>
 ))}
 </div>
 </div>

 {/* Running Automations */}
 <div>
 <SectionLabel icon={Zap} label="Automations" />
 <div className="space-y-1.5">
 {AUTOMATIONS.map((auto, i) => (
 <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05]">
 <div className={cn('w-2 h-2 rounded-full animate-pulse shrink-0', auto.color)} />
 <div className="flex-1 min-w-0">
 <div className="text-[11px] font-semibold text-white/75">{auto.name}</div>
 <div className="text-[9px] text-white/35">{auto.desc}</div>
 </div>
 <span className="text-[9px] font-bold text-white/40">{auto.status}</span>
 </div>
 ))}
 </div>
 </div>

 {/* AI Timeline */}
 <div>
 <SectionLabel icon={Activity} label="AI Timeline" />
 <div className="space-y-0 relative">
 {AI_TIMELINE.map((event, i) => (
 <div key={i} className="relative flex items-start gap-2.5 pl-3 pb-3 last:pb-0">
 {i < AI_TIMELINE.length - 1 && (
 <div className="absolute left-[5px] top-3 bottom-0 w-px bg-violet-500/20" />
 )}
 <div className="w-2.5 h-2.5 rounded-full bg-violet-500/40 border border-violet-500/60 shrink-0 mt-0.5 relative z-10" />
 <div>
 <div className="text-[10px] text-white/60 leading-snug">{event.event}</div>
 <div className="text-[9px] text-white/25 mt-0.5 font-mono">{event.time}</div>
 </div>
 </div>
 ))}
 </div>
 </div>

 {/* Smart Insights */}
 <div>
 <SectionLabel icon={Lightbulb} label="Smart Insights" />
 <div className="space-y-2">
 {SMART_INSIGHTS.map((insight, i) => (
 <div key={i} className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
 <insight.icon className={cn('w-3.5 h-3.5 shrink-0 mt-0.5', insight.color)} />
 <p className="text-[10px] text-white/55 leading-relaxed">{insight.text}</p>
 </div>
 ))}
 </div>
 </div>

 {/* Voice Assistant */}
 <button
 onClick={() => setVoiceActive(p => !p)}
 className={cn(
 'w-full flex items-center gap-3 p-3.5 rounded-2xl border transition-all',
 voiceActive
 ? 'bg-violet-600/25 border-violet-500/40 shadow-lg shadow-violet-900/30'
 : 'bg-white/[0.04] border-white/[0.07] hover:bg-white/[0.07]'
 )}
 >
 <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', voiceActive ? 'bg-violet-500/30' : 'bg-white/[0.06]')}>
 <Mic className={cn('w-4.5 h-4.5', voiceActive ? 'text-violet-300' : 'text-white/50')} />
 </div>
 <div className="flex-1 text-left">
 <div className={cn('text-secondary font-bold', voiceActive ? 'text-violet-200' : 'text-white/70')}>
 {voiceActive ? 'Listening...' : 'Voice Assistant'}
 </div>
 <div className="text-[10px] text-white/35 mt-0.5">
 {voiceActive ? 'Say a command or question' : 'Click to activate'}
 </div>
 </div>
 {voiceActive && (
 <div className="flex gap-0.5 items-end h-5">
 {[3, 5, 7, 5, 4, 6, 3].map((h, i) => (
 <div key={i} className="w-1 rounded-sm bg-violet-400" style={{ height: `${h * 3}px`, animation: `pulse 1s infinite ${i * 0.1}s` }} />
 ))}
 </div>
 )}
 </button>

 </div>
 </ScrollArea>
 </div>
 </div>

 {/* ══════════════════════════════════════════════════════
 ENTERPRISE PRESENCE BAR (bottom)
 ══════════════════════════════════════════════════════ */}
 <div className="h-8 shrink-0 border-t border-white/[0.05] bg-[#08080f]/90 backdrop-blur-sm flex items-center px-4 gap-1 overflow-x-auto scrollbar-none">
 {[
 { icon: Shield, label: 'Secure', value: 'E2E Encrypted', color: 'text-emerald-400', dot: 'bg-emerald-400' },
 { icon: Lock, label: 'Device Trusted', value: 'Verified', color: 'text-emerald-400', dot: 'bg-emerald-400' },
 { icon: Wifi, label: networkStatus === 'poor' ? 'Offline' : 'Network', value: networkStatus === 'excellent' ? 'Excellent' : networkStatus === 'good' ? 'Good' : 'Poor', color: networkStatus === 'poor' ? 'text-red-400' : 'text-emerald-400', dot: networkStatus === 'poor' ? 'bg-red-500' : 'bg-emerald-400' },
 { icon: RefreshCw, label: 'Sync', value: 'Complete', color: 'text-emerald-400', dot: 'bg-emerald-400' },
 { icon: BrainCircuit, label: 'AI', value: 'Ready', color: 'text-violet-400', dot: 'bg-violet-400' },
 { icon: Users, label: 'Teammates', value: '42 online', color: 'text-blue-400', dot: 'bg-blue-400' },
 { icon: HardDrive, label: 'Storage', value: '14 GB', color: 'text-white/40', dot: 'bg-white/25' },
 { icon: Activity, label: 'Tasks', value: '3 background', color: 'text-white/40', dot: 'bg-white/25' },
 ].map((item, i) => (
 <React.Fragment key={i}>
 <button className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-white/[0.05] transition-colors group shrink-0">
 <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', item.dot)} />
 <span className={cn('text-[9px] font-semibold', item.color)}>{item.label}</span>
 <span className="text-[9px] text-white/25 group-hover:text-white/40 transition-colors">{item.value}</span>
 </button>
 {i < 7 && <div className="w-px h-3.5 bg-white/[0.06] shrink-0" />}
 </React.Fragment>
 ))}
 <div className="flex-1" />
 <span className="text-[9px] text-white/20 shrink-0">{timeStr}</span>
 </div>

 {/* Global animation keyframes */}
 <style>{`
 @keyframes bounce {
 0%, 60%, 100% { transform: translateY(0); }
 30% { transform: translateY(-4px); }
 }
 `}</style>
 </div>
 );
};

// Ensure window.electronAPI type is available
declare global {
 interface Window {
 electronAPI?: {
 invoke: (channel: string, data?: any) => Promise<any>;
 on: (channel: string, func: (...args: any[]) => void) => void;
 };
 }
}
