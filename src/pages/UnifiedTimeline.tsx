import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
 Mail, MessageSquare, Phone, PhoneMissed, Shield, AlertTriangle, 
 CheckCircle, Clock, ChevronRight, Zap, RefreshCw,
 Inbox, List, Grid, Calendar, SendHorizontal, Plane,
 FileText, IndianRupee
} from 'lucide-react';
import { intelligenceEngine, intelligenceBus } from '@/services/intelligence';
import { actionExecutor } from '@/services/intelligence/actionExecutor';
import type { CommunicationEvent } from '@/services/intelligence';
import { TimelineSidebar } from '@/components/timeline/TimelineSidebar';
import { TimelineTopbar } from '@/components/timeline/TimelineTopbar';
import { AIAssistantSidebar } from '@/components/timeline/AIAssistantSidebar';
import { useInstantCache } from '@/hooks/useInstantCache';
import { supabase } from '@/integrations/supabase/client';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SOURCE_ICON: Record<string, React.ReactNode> = {
 mail: <Mail className="w-4 h-4" />,
 sms: <MessageSquare className="w-4 h-4" />,
 call: <Phone className="w-4 h-4" />,
 voicemail: <Phone className="w-4 h-4" />,
 notification: <Zap className="w-4 h-4" />,
};

const SOURCE_COLOR: Record<string, string> = {
 mail: 'text-blue-400 bg-blue-500/10',
 sms: 'text-emerald-400 bg-emerald-500/10',
 call: 'text-violet-400 bg-violet-500/10',
 voicemail: 'text-pink-400 bg-pink-500/10',
 notification: 'text-amber-400 bg-amber-500/10',
};

function relativeTime(iso: string): string {
 const diff = (Date.now() - new Date(iso).getTime()) / 1000;
 const d = new Date(iso);
 if (diff < 60) return 'just now';
 if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
 if (diff < 86400) return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
 return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function priorityColor(score: number): string {
 if (score >= 80) return 'text-red-400';
 if (score >= 60) return 'text-amber-400';
 if (score >= 40) return 'text-blue-400';
 return 'text-slate-500';
}

function priorityLabel(score: number): string {
 if (score >= 80) return 'High';
 if (score >= 60) return 'Medium';
 if (score >= 40) return 'Low';
 return 'Normal';
}

// ─── Daily Brief Grid ─────────────────────────────────────────────────────────────

interface BriefStats {
 repliesNeeded: number;
 billsDue: number;
 meetings: number;
 threatsDetected: number;
 unread: number;
}

const DailyBriefGrid: React.FC<{ stats: BriefStats }> = ({ stats }) => {
 const total = stats.repliesNeeded + stats.billsDue + stats.meetings;
 const estMinutes = Math.max(1, Math.ceil(total * 1.5));

 return (
 <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
 {/* Replies */}
 <div className="bg-[#15151c] rounded-2xl p-4 border border-white/5 flex flex-col justify-between group hover:border-indigo-500/30 transition-colors">
 <div className="flex justify-between items-start mb-2">
 <h2 className="text-display text-white">{stats.repliesNeeded}</h2>
 <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
 <MessageSquare className="w-4 h-4" />
 </div>
 </div>
 <div>
 <p className="text-secondary font-medium text-slate-300">Replies needed</p>
 <p className="text-label text-indigo-400 mt-1">High priority</p>
 </div>
 </div>

 {/* Bills */}
 <div className="bg-[#15151c] rounded-2xl p-4 border border-white/5 flex flex-col justify-between group hover:border-amber-500/30 transition-colors">
 <div className="flex justify-between items-start mb-2">
 <h2 className="text-display text-white">{stats.billsDue}</h2>
 <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400">
 <FileText className="w-4 h-4" />
 </div>
 </div>
 <div>
 <p className="text-secondary font-medium text-slate-300">Bills due</p>
 <p className="text-label text-slate-500 mt-1">₹12,450 total</p>
 </div>
 </div>

 {/* Meetings */}
 <div className="bg-[#15151c] rounded-2xl p-4 border border-white/5 flex flex-col justify-between group hover:border-blue-500/30 transition-colors">
 <div className="flex justify-between items-start mb-2">
 <h2 className="text-display text-white">{stats.meetings}</h2>
 <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
 <Calendar className="w-4 h-4" />
 </div>
 </div>
 <div>
 <p className="text-secondary font-medium text-slate-300">Meetings today</p>
 <p className="text-label text-blue-400 mt-1">Next in 45 min</p>
 </div>
 </div>

 {/* Threats */}
 <div className="bg-[#15151c] rounded-2xl p-4 border border-white/5 flex flex-col justify-between group hover:border-emerald-500/30 transition-colors">
 <div className="flex justify-between items-start mb-2">
 <h2 className="text-display text-white">{stats.threatsDetected}</h2>
 <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
 <Shield className="w-4 h-4" />
 </div>
 </div>
 <div>
 <p className="text-secondary font-medium text-slate-300">Threats detected</p>
 <p className="text-label text-slate-500 mt-1">You're all good</p>
 </div>
 </div>

 {/* Review Time */}
 <div className="bg-[#15151c] rounded-2xl p-4 border border-white/5 flex flex-col justify-between group hover:border-purple-500/30 transition-colors">
 <div className="flex justify-between items-start mb-2">
 <h2 className="text-display text-white">{estMinutes} <span className="text-section text-slate-400 font-normal">min</span></h2>
 <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400">
 <Clock className="w-4 h-4" />
 </div>
 </div>
 <div>
 <p className="text-secondary font-medium text-slate-300">Est. review time</p>
 <p className="text-label text-slate-500 mt-1">Save 1.5 hours</p>
 </div>
 </div>
 </div>
 );
};

// ─── Event Card ───────────────────────────────────────────────────────────────

const EventCard: React.FC<{ event: CommunicationEvent }> = ({ event }) => {
 const ai = event.aiResults;
 const attention = ai?.attention;
 const threat = ai?.threat;
 const isUnread = event.status === 'received';
 const isThreat = threat?.detected;
 const isMissedCall = event.direction === 'missed';

 return (
 <div className={`rounded-2xl border transition-all duration-200 hover:bg-white/5 flex items-start gap-4 p-4 ${
 isThreat 
 ? 'border-red-500/30 bg-red-500/5' 
 : isUnread 
 ? 'border-white/10 bg-[#15151c]' 
 : 'border-transparent bg-transparent'
 }`}>
 {/* Unread Indicator */}
 <div className="pt-2">
 {isUnread ? <div className={`w-2 h-2 rounded-full ${SOURCE_COLOR[event.source].split(' ')[0]} bg-current`} /> : <div className="w-2 h-2" />}
 </div>

 {/* Main Avatar / Icon */}
 <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 border ${
 isMissedCall ? 'text-red-400 bg-red-500/10 border-red-500/20' : 'text-slate-300 bg-[#1a1a24] border-white/10'
 }`}>
 {event.source === 'mail' && event.sender.displayName?.includes('Amazon') ? (
 <span className="font-bold text-workspace text-orange-400">a</span>
 ) : event.source === 'mail' && event.sender.displayName?.includes('HDFC') ? (
 <span className="font-bold text-workspace text-blue-600">H</span>
 ) : event.source === 'sms' && event.sender.displayName?.includes('ICICI') ? (
 <span className="font-bold text-workspace text-orange-500">i</span>
 ) : (
 isMissedCall ? <PhoneMissed className="w-5 h-5" /> : SOURCE_ICON[event.source]
 )}
 </div>

 {/* Main content */}
 <div className="flex-1 min-w-0">
 <div className="flex items-center justify-between gap-2 mb-1">
 <div className="flex items-center gap-2">
 <span className={`text-body font-semibold truncate ${isUnread ? 'text-white' : 'text-slate-300'}`}>
 {event.sender.displayName ?? event.sender.canonical ?? event.sender.raw}
 </span>
 <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] uppercase font-bold border ${isMissedCall ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-white/5 text-slate-400 border-white/10'}`}>
 {isMissedCall ? <PhoneMissed className="w-3 h-3"/> : SOURCE_ICON[event.source]}
 {isMissedCall ? 'Call' : event.source}
 </div>
 </div>
 <span className="text-label text-slate-500">{relativeTime(event.timestamp)}</span>
 </div>

 {event.subject && (
 <p className={`text-secondary mb-1 truncate ${isUnread ? 'text-slate-200 font-medium' : 'text-slate-400'}`}>
 {event.subject}
 </p>
 )}

 <p className="text-secondary text-slate-400 line-clamp-1 mb-2">
 {event.content}
 </p>

 {/* AI metadata row */}
 <div className="flex items-center gap-2 flex-wrap">
 {isThreat && (
 <span className="flex items-center gap-1 text-label text-red-400 bg-red-500/10 px-2 py-1 rounded-md border border-red-500/20">
 <Shield className="w-3.5 h-3.5" />
 {threat?.type?.replace(/_/g, ' ')}
 </span>
 )}
 {attention?.replyNeeded && !isThreat && (
 <span className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
 <Clock className="w-3 h-3" /> Typically replies in 15m
 </span>
 )}
 {isMissedCall && (
 <button className="flex items-center gap-1 text-[11px] text-slate-400 font-medium hover:text-white transition-colors">
 <Phone className="w-3 h-3" /> Tap to call back
 </button>
 )}
 
 <div className="flex-1" />
 
 {/* Priority Badge */}
 {attention && attention.overall > 0 && !isThreat && (
 <span className={`text-[11px] px-2 py-1 rounded-md font-medium flex items-center gap-1 border border-current/20 ${priorityColor(attention.overall)} bg-current/10`}>
 <Zap className="w-3 h-3" />
 {priorityLabel(attention.overall)}
 </span>
 )}
 </div>
 </div>
 </div>
 );
};

// ─── Filter Bar ────────────────────────────────────────────────────────────────

type FilterMode = 'all' | 'mail' | 'sms' | 'call' | 'meetings' | 'tasks' | 'documents';

const FilterBar: React.FC<{
 active: FilterMode;
 onChange: (f: FilterMode) => void;
}> = ({ active, onChange }) => {
 const filters: { key: FilterMode; label: string }[] = [
 { key: 'all', label: 'All' },
 { key: 'mail', label: 'Mail' },
 { key: 'sms', label: 'SMS' },
 { key: 'call', label: 'Calls' },
 { key: 'meetings', label: 'Meetings' },
 { key: 'tasks', label: 'Tasks' },
 { key: 'documents', label: 'Documents' },
 ];

 return (
 <div className="flex gap-2 overflow-x-auto scrollbar-none">
 {filters.map(({ key, label }) => (
 <button
 key={key}
 onClick={() => onChange(key)}
 className={`shrink-0 text-secondary px-4 py-2 rounded-full font-medium transition-all ${
 active === key
 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
 : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
 }`}
 >
 {label}
 </button>
 ))}
 </div>
 );
};

// ─── Widgets ────────────────────────────────────────────────────────────────

const UpcomingWidget = () => (
 <div className="bg-[#15151c] rounded-2xl p-5 border border-white/5 mb-6">
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-secondary font-semibold text-white">Upcoming</h3>
 <button className="text-button text-indigo-400 hover:text-indigo-300">View all</button>
 </div>
 <div className="space-y-4">
 {[
 { title: 'Team Standup', time: 'Today, 3:00 PM', type: 'meet' },
 { title: 'Product Review', time: 'Today, 5:30 PM', type: 'meet' },
 { title: 'Client Call', time: 'Tomorrow, 11:00 AM', type: 'call' }
 ].map((item, i) => (
 <div key={i} className="flex items-center gap-3 group">
 <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 text-slate-300">
 {item.type === 'call' ? <Phone className="w-4 h-4 text-violet-400" /> : <Calendar className="w-4 h-4 text-indigo-400" />}
 </div>
 <div className="flex-1">
 <h4 className="text-secondary font-medium text-white">{item.title}</h4>
 <p className="text-label text-slate-500">{item.time}</p>
 </div>
 <button className="px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 text-button font-semibold hover:bg-indigo-500/20 transition-colors opacity-0 group-hover:opacity-100">
 Join
 </button>
 </div>
 ))}
 </div>
 </div>
);

const InsightsWidget = () => (
 <div className="bg-[#15151c] rounded-2xl p-5 border border-white/5">
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-secondary font-semibold text-white">Top Insights</h3>
 <button className="text-button text-indigo-400 hover:text-indigo-300">View all</button>
 </div>
 <div className="space-y-5">
 <div className="flex items-start gap-3">
 <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center shrink-0">
 <span className="font-bold text-white italic">A</span>
 </div>
 <div>
 <h4 className="text-secondary font-medium text-indigo-300">Airtel Prepaid plan expiring</h4>
 <p className="text-label text-red-400 my-0.5">in 2 days</p>
 <p className="text-label text-slate-500">Recharge ₹199 to continue</p>
 </div>
 </div>
 <div className="flex items-start gap-3">
 <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center shrink-0 text-white">
 <IndianRupee className="w-5 h-5" />
 </div>
 <div>
 <h4 className="text-secondary font-medium text-white">Swiggy order arriving</h4>
 <p className="text-label text-slate-400 my-0.5">in 35 mins</p>
 <p className="text-label text-slate-500">Order #123456789012</p>
 </div>
 </div>
 <div className="flex items-start gap-3">
 <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center shrink-0 text-white">
 <Plane className="w-5 h-5" />
 </div>
 <div>
 <h4 className="text-secondary font-medium text-white">Flight to Delhi</h4>
 <p className="text-label text-slate-400 my-0.5">Tomorrow, 7:45 AM</p>
 <p className="text-label text-slate-500">AI237 • PNR: ABC123</p>
 </div>
 </div>
 </div>
 </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function UnifiedTimeline() {
 const [events, setEvents] = useState<CommunicationEvent[]>([]);
 const [brief, setBrief] = useState<BriefStats>({ repliesNeeded: 0, billsDue: 0, meetings: 0, threatsDetected: 0, unread: 0 });
 const [filter, setFilter] = useState<FilterMode>('all');
 const [searchQuery, setSearchQuery] = useState('');
 const [isLoading, setIsLoading] = useState(true);
 const [isSearching, setIsSearching] = useState(false);
 const [viewMode, setViewMode] = useState<'list'|'grid'>('list');

 const { data: profile } = useInstantCache('user-profile-timeline', async () => {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return null;
 const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
 return data;
 });

 const firstName = profile?.first_name || 'Guest';
 const avatarUrl = profile?.avatar_url || undefined;

 const loadData = useCallback(async () => {
 setIsLoading(true);
 try {
 const [items, stats] = await Promise.all([
 intelligenceEngine.getTimeline({ limit: 50, orderBy: 'attention' }),
 intelligenceEngine.getDailyBrief(),
 ]);
 setEvents(items);
 setBrief(stats);
 } catch (err) {
 console.error('[UnifiedTimeline] load error', err);
 } finally {
 setIsLoading(false);
 }
 }, []);

 // Live updates: refresh when a new event is fully processed
 useEffect(() => {
 loadData();
 const unsub = intelligenceBus.on('brief:updated', () => loadData());
 return unsub;
 }, [loadData]);

 // Search
 useEffect(() => {
 if (!searchQuery.trim()) { loadData(); return; }
 const timer = setTimeout(async () => {
 setIsSearching(true);
 const results = await intelligenceEngine.search(searchQuery, 30);
 setEvents(results);
 setIsSearching(false);
 }, 300);
 return () => clearTimeout(timer);
 }, [searchQuery, loadData]);

 // Client-side filter
 const filtered = events.filter((e) => {
 if (filter === 'all') return true;
 if (filter === 'mail' || filter === 'sms' || filter === 'call') return e.source === filter;
 return false; // stub for meetings, tasks, documents
 });

 const hour = new Date().getHours();
 const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

 return (
 <div className="flex h-screen bg-[#0a0a0f] text-white overflow-hidden">
 {/* Left Sidebar */}
 <TimelineSidebar />

 {/* Main Content Column */}
 <div className="flex-1 flex flex-col h-full overflow-hidden relative">
 <TimelineTopbar searchQuery={searchQuery} setSearchQuery={setSearchQuery} avatarUrl={avatarUrl} />

 <div className="flex-1 overflow-y-auto custom-scrollbar">
 <div className="max-w-[1200px] mx-auto p-8 pb-32 lg:pb-8">
 
 {/* Greeting & Brief */}
 {!searchQuery && (
 <>
 <h1 className="text-[28px] font-bold text-white mb-6 tracking-tight">
 {greeting}, {firstName} <span className="inline-block ml-1">👋</span>
 </h1>
 <DailyBriefGrid stats={brief} />
 </>
 )}

 {/* Filter & View Mode */}
 <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
 <FilterBar active={filter} onChange={setFilter} />
 
 <div className="flex items-center gap-4 shrink-0">
 <button className="text-button text-slate-300 hover:text-white transition-colors flex items-center gap-1">
 Smart sort <ChevronRight className="w-4 h-4 rotate-90" />
 </button>
 <div className="flex bg-[#15151c] border border-white/5 rounded-xl p-1 shadow-inner">
 <button 
 onClick={() => setViewMode('list')}
 className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' : 'text-slate-500 hover:text-slate-300'}`}
 >
 <List className="w-4 h-4" />
 </button>
 <button 
 onClick={() => setViewMode('grid')}
 className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' : 'text-slate-500 hover:text-slate-300'}`}
 >
 <Grid className="w-4 h-4" />
 </button>
 </div>
 </div>
 </div>

 {/* Main Grid: Events & Widgets */}
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
 
 {/* Event List */}
 <div className="lg:col-span-2">
 {isLoading ? (
 <div className="flex flex-col items-center justify-center py-32 gap-4">
 <div className="w-10 h-10 rounded-full border-2 border-indigo-500/40 border-t-indigo-500 animate-spin" />
 <p className="text-secondary text-slate-500 font-medium">Syncing intelligence…</p>
 </div>
 ) : filtered.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-32 gap-4 text-center px-8 border border-dashed border-white/10 rounded-3xl bg-white/[0.02]">
 <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center shadow-inner">
 <Inbox className="w-8 h-8 text-slate-500" />
 </div>
 <div>
 <p className="text-body font-semibold text-slate-200">
 {searchQuery ? `No results for "${searchQuery}"` : 'No communications yet'}
 </p>
 <p className="text-secondary text-slate-500 mt-1">
 {searchQuery ? 'Try different keywords or dates' : 'Connect Gmail or send an SMS to see your unified timeline'}
 </p>
 </div>
 </div>
 ) : (
 <div className="space-y-1">
 {filtered.map((event) => (
 <EventCard key={event.id} event={event} />
 ))}
 <div className="pt-4 pb-2 text-center">
 <button className="text-button font-semibold text-indigo-400 hover:text-indigo-300 flex items-center justify-center gap-1 mx-auto group">
 View all communications <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
 </button>
 </div>
 </div>
 )}
 </div>

 {/* Right Side Widgets */}
 <div className="space-y-6">
 <UpcomingWidget />
 <InsightsWidget />
 </div>

 </div>

 </div>
 </div>
 </div>

 {/* Right Sidebar: AI Assistant */}
 <AIAssistantSidebar firstName={firstName} />
 </div>
 );
}
